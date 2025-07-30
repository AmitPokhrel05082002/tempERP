import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subject, of, throwError } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError } from 'rxjs/operators';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { HttpClient, HttpClientModule, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';

interface EmployeeAttendance {
  id?: string;
  employeeId?: number;
  empCode?: string;
  name?: string;
  department?: string;
  displayDepartment?: string;
  departmentId?: string;
  branchId?: string;
  branchName?: string;
  attendanceDate?: string;
  dayOfWeek?: string;
  timePeriod?: string;
  status?: string;
  requiredCheckInTime?: string;
  requiredCheckOutTime?: string;
  actualCheckInTime?: string;
  actualCheckOutTime?: string;
  totalDuration?: string;
  lateCheckInTime?: string;
  overTime?: string;
}

// Fix the Department interface to match all properties you're using
interface Department {
  id?: string;  // Add this
  dept_id: string;
  dept_name: string;
  dept_code: string;
  org_name: string;
  branch_name: string;
  branchId?: string; // Add this if needed
  name?: string;     // Add this if needed
  code?: string;     // Add this if needed
  isMainBranch?: boolean; // Add this
  budget_allocation: number;
  sub_departments_count: number;
}

// Fix the Branch interface
interface Branch {
  id?: string;       // Add this
  branchId: string;
  branchName: string;
  name?: string;     // Add this if needed
  branchCode: string;
  dzongkhag: string;
  thromde: string;
  operationalStatus: boolean;
  organizationName: string;
}


@Component({
  selector: 'app-employee-attendance',
  standalone: true,
  imports: [CommonModule, SharedModule, HttpClientModule],
  templateUrl: './employee-attendance.component.html',
  styleUrls: ['./employee-attendance.component.scss']
})
export class EmployeeAttendanceComponent implements OnInit {
  divisions: Department[] = [];
  branches: Branch[] = [];
  tabDepartments: (Department | string)[] = ['All Employee'];
  selectedBranchId: string = '';
  filteredDepartments: Department[] = [];
  formDepartments: Department[] = [];
  statuses = ['All Employee', 'Present', 'Late', 'Absent', 'Early Departure', 'Leave'];

  selectedDivision = 'All Employee';
  selectedStatus = 'All Employee';
  selectedBranch = 'All Branches';
  searchQuery = '';
  private searchSubject = new Subject<string>();
  showFilters = false;
  filterCount = 0;
  currentPage = 1;
  itemsPerPage = 10;
  currentDate = new Date();
  activeTab = 'All Employee';

  attendanceData: EmployeeAttendance[] = [];
  isLoading = false;
  errorMessage = '';
  apiUrl = `${environment.apiUrl}/api/v1/employee-attendance/latest`;
  deptApiUrl = `${environment.apiUrl}/api/v1/departments`;
  branchApiUrl = `${environment.apiUrl}/api/v1/branches`;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    })
  };

  private departmentMap: { [key: string]: string } = {}
  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadBranches()
      .then(() => {
        console.log('Branches loaded:', this.branches); // Debug logging
        return this.loadDepartments();
      })
      .then(() => {
        console.log('Initial departments loaded'); // Debug logging
        return this.loadAttendanceData();
      })
      .catch(error => {
        console.error('Initialization error:', error);
        this.errorMessage = 'Failed to initialize data. Please refresh the page.';
      });
    this.loadBranches().then(() => {
      this.loadDepartments();
      this.loadAttendanceData();
    });

    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((query) => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.showEmptyStateIfNeeded();
    });
  }

  get emptyStateMessage(): string {
    if (this.errorMessage) return '';
    if (this.isLoading) return '';

    if (this.searchQuery || this.selectedDivision !== 'All Employee' || this.selectedStatus !== 'All Employee' || this.selectedBranch !== 'All Branches') {
      // return 'No records match your search!';
    }
    return 'No employee records found.';
  }

  private showEmptyStateIfNeeded(): void { }

  private safeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private safeLowerString(value: any): string {
    return this.safeString(value).toLowerCase();
  }

  private async loadBranches(): Promise<void> {
    try {
      const response = await this.http.get<any>(this.branchApiUrl, this.httpOptions)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('Failed to load branches:', error);
            this.errorMessage = 'Failed to load branches. Please try again later.';
            return of({ data: [] });
          })
        ).toPromise();

      // Handle response with proper typing
      this.branches = (Array.isArray(response) ? response : response?.data || []).map((branch: any) => ({
        id: branch.id || branch.branchId,
        name: branch.name || branch.branchName,
        // Include optional properties if needed
        branchId: branch.branchId,
        branchName: branch.branchName
      }));

      console.log('Branches loaded:', this.branches);
    } catch (error) {
      console.error('Error loading branches:', error);
      this.branches = [];
      this.errorMessage = 'Failed to load branches. Please try again later.';
    }
  }

  private loadDepartments(branchId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let url = this.deptApiUrl;
      if (branchId) {
        url = `${this.deptApiUrl}/branch/${branchId}`;  // Fixed string interpolation
      }

      this.http.get<{ success: boolean, message: string, data: Department[] }>(url, this.httpOptions)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            console.error('Failed to load departments:', error);
            this.errorMessage = 'Failed to load departments. Please try again later.';
            reject(error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.formDepartments = response.data;
              this.filteredDepartments = [...response.data];
              this.departmentMap = {};

              // Update tabDepartments with department names
              this.tabDepartments = [
                'All Employee',
                ...response.data.map(dept => dept.dept_name)
              ];

              response.data.forEach(dept => {
                this.departmentMap[dept.dept_id] = dept.dept_name;
              });
              resolve();
            } else {
              reject(new Error('Invalid department data'));
            }
          },
          error: (error) => {
            console.error('Error in department subscription:', error);
            reject(error);
          }
        });
    });
  }
  onBranchChange(): void {
    this.currentPage = 1;
    const branchIdToLoad = this.selectedBranchId && this.selectedBranchId !== 'undefined'
      ? this.selectedBranchId
      : undefined;

    console.log('Branch changed to:', branchIdToLoad); // Debug logging

    this.loadDepartments(branchIdToLoad)
      .then(() => {
        console.log('Departments loaded, now loading attendance data');
        this.loadAttendanceData();
      })
      .catch(error => {
        console.error('Error in branch change:', error);
        this.errorMessage = 'Failed to load department data. Please try again.';
      });
  }
  loadAttendanceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    let url = this.apiUrl;
    const params = new URLSearchParams();
    params.append('page', '0');
    params.append('size', '100'); // Increase size to get more records

    if (this.selectedBranchId) {
      params.append('branchId', this.selectedBranchId);
    }

    url = `${url}?${params.toString()}`;
    console.log('Fetching attendance data from:', url);

    this.http.get<any>(url).pipe(
      catchError(error => {
        this.errorMessage = 'Failed to load attendance data. Please try again later.';
        this.isLoading = false;
        console.error('API Error:', error);
        return of({ content: [], totalElements: 0 });
      })
    ).subscribe({
      next: (response) => {
        console.log('API Response:', response);

        // Handle paginated response structure
        if (response && response.content && Array.isArray(response.content)) {
          this.attendanceData = this.validateAttendanceData(response.content);
          console.log('Processed attendance data:', this.attendanceData);
        } else if (Array.isArray(response)) {
          // Fallback for direct array response
          this.attendanceData = this.validateAttendanceData(response);
        } else {
          console.warn('Unexpected response structure:', response);
          this.attendanceData = [];
        }

        this.attendanceData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        this.isLoading = false;
      },
      error: (error) => {
        this.errorMessage = 'Failed to connect to the server. Please check your network.';
        this.isLoading = false;
        console.error('Connection Error:', error);
      }
    });
  }

  private validateAttendanceData(data: any[]): EmployeeAttendance[] {
    console.log('Validating attendance data:', data);
    return data.map(item => {
      let departmentName = 'Unassigned';
      let displayDepartment = 'Unassigned';
      let branchId = '';
      let branchName = '';
      // Handle department parsing from the API response
      if (item?.department && typeof item.department === 'string') {
        // Parse department string like "All Departments>E-CENTRIC"
        const deptParts = item.department.split('>');
        if (deptParts.length > 1) {
          departmentName = deptParts[deptParts.length - 1].trim();
          displayDepartment = departmentName;
        } else {
          departmentName = item.department;
          displayDepartment = item.department;
        }
      } else if (item?.departmentId && this.formDepartments.length > 0) {
        const foundDept = this.formDepartments.find(d => d.dept_id === item.departmentId);
        if (foundDept) {
          departmentName = foundDept.dept_name;
          branchId = foundDept.branch_name;
          branchName = foundDept.branch_name;
          displayDepartment = foundDept.dept_name;
        }
      }
      const processedItem = {
        ...item,
        empCode: Number(item?.empCode) || 0,
        name: `${this.safeString(item?.firstName)} ${this.safeString(item?.lastName)}`.trim() || 'Unknown',
        department: departmentName,
        displayDepartment: displayDepartment,
        departmentId: item?.departmentId,
        branchId: branchId,
        branchName: branchName,
        attendanceDate: this.safeString(item?.attendanceDate),
        dayOfWeek: this.safeString(item?.dayOfWeek),
        timePeriod: this.safeString(item?.timePeriod),
        status: this.determineStatus(item),
        requiredCheckInTime: this.formatTime(item?.requiredCheckInTime),
        requiredCheckOutTime: this.formatTime(item?.requiredCheckOutTime),
        actualCheckInTime: this.formatTime(item?.actualCheckInTime),
        actualCheckOutTime: this.formatTime(item?.actualCheckOutTime),
        lateCheckInTime: this.formatTime(item?.lateCheckInTime),
        totalDuration: this.formatDuration(item?.totalDuration),
        overTime: this.calculateOvertime(item)
      };
      console.log('Processed item:', processedItem);
      return processedItem;
    });
  }

  private determineStatus(item: any): string {
    const requiredIn = item.requiredCheckInTime;
    let requiredOut = item.requiredCheckOutTime;
    const day = (item.dayOfWeek || '').toLowerCase();

    if (day === 'saturday') {
      requiredOut = '13:00:00';
    }

    const isRequiredInEmpty = !requiredIn || requiredIn.trim() === '' || requiredIn === '00:00:00';
    const isRequiredOutEmpty = !requiredOut || requiredOut.trim() === '' || requiredOut === '00:00:00';

    if (isRequiredInEmpty && isRequiredOutEmpty) {
      return 'Absent';
    }

    if (isRequiredInEmpty || isRequiredOutEmpty) {
      return 'Leave';
    }

    return 'Present';
  }

  private calculateOvertime(item: any): string {
    if (!item.actualCheckOutTime) return '--';

    const actualOut = new Date(`1970-01-01T${item.actualCheckOutTime}`);
    const overtimeStart = new Date(`1970-01-01T17:30`);
    const nextDayLimit = new Date(`1970-01-01T08:44`);

    if (actualOut <= overtimeStart && actualOut >= nextDayLimit) return '--';

    if (actualOut > overtimeStart) {
      const overtimeMs = actualOut.getTime() - overtimeStart.getTime();
      const overtimeHours = Math.floor(overtimeMs / (1000 * 60 * 60));
      const overtimeMinutes = Math.floor((overtimeMs % (1000 * 60 * 60)) / (1000 * 60));
      return `${overtimeHours.toString().padStart(2, '0')}:${overtimeMinutes.toString().padStart(2, '0')}`;
    }

    return '--';
  }

  formatTime(timeString: string): string {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  }

  formatDuration(duration: string): string {
    if (!duration) return '';
    return duration.substring(0, 5);
  }

  selectTab(dept: string): void {
    this.activeTab = dept;
    this.currentPage = 1;

    if (dept === 'All Employee') {
      this.selectedDivision = 'All Employee';
    } else {
      const foundDept = this.divisions.find(d =>
        d.name === dept || d.code === dept
      );
      this.selectedDivision = foundDept ? (foundDept.isMainBranch ? foundDept.name : foundDept.code) : dept;
    }

    this.showEmptyStateIfNeeded();
  }

  setBranchFilter(branchId: string): void {
    this.selectedBranchId = branchId;
    this.selectedBranch = branchId === '' ? 'All Branches' :
      this.branches.find(b => b.id === branchId)?.name || 'All Branches';
    this.currentPage = 1;
    this.updateFilterCount();
    this.onBranchChange(); // This will trigger department and data reload
  }
  applyFilters(): void {
    this.currentPage = 1;
    this.showEmptyStateIfNeeded();
  }
  get filteredAttendance(): EmployeeAttendance[] {
    if (!this.attendanceData?.length) return [];

    const query = this.safeLowerString(this.searchQuery);
    const status = this.safeLowerString(this.selectedStatus);
    const branch = this.safeLowerString(this.selectedBranch);

    return this.attendanceData.filter(emp => {
      if (this.selectedDivision !== 'All Employee') {
        const foundDept = this.divisions.find(d =>
          (d.isMainBranch ? d.name : d.code) === this.selectedDivision
        );
        if (!foundDept || emp.departmentId !== foundDept.id) {
          return false;
        }
      }

      if (status !== 'all employee') {
        const empStatus = this.safeLowerString(emp.status);
        if (empStatus !== status) return false;
      }

      if (branch !== 'all branches') {
        const empBranch = this.safeLowerString(emp.branchId);
        if (!empBranch.includes(branch)) return false;
      }

      if (query) {
        const empName = this.safeLowerString(emp.name);
        const empId = this.safeString(emp.employeeId);
        const empDept = this.safeLowerString(emp.department);

        if (!empName.includes(query) &&
          !empId.includes(query) &&
          !empDept.includes(query)) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAttendance.length / this.itemsPerPage);
  }

  get paginatedData(): EmployeeAttendance[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAttendance.slice(startIndex, startIndex + this.itemsPerPage);
  }

  previousPage(): void {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  setDivisionFilter(departmentName: string): void {
    this.selectedDivision = departmentName;
    this.currentPage = 1;
    this.updateFilterCount();
    this.showFilters = false;
    this.showEmptyStateIfNeeded();
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.updateFilterCount();
    this.showFilters = false;
    this.showEmptyStateIfNeeded();
  }

  private updateFilterCount(): void {
    this.filterCount =
      (this.selectedDivision !== 'All Employee' ? 1 : 0) +
      (this.selectedStatus !== 'All Employee' ? 1 : 0) +
      (this.selectedBranch !== 'All Branches' ? 1 : 0);
  }

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  formatDate(dateString: string): string {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch {
      return dateString;
    }
  }

  exportToPdf(): void {
    const doc = new jsPDF({ orientation: 'landscape' });

    let title = 'Employee Attendance Report';
    if (this.selectedDivision !== 'All Employee') title += ` - ${this.selectedDivision}`;
    if (this.selectedStatus !== 'All Employee') title += ` (${this.selectedStatus})`;
    if (this.selectedBranch !== 'All Branches') title += ` [Branch: ${this.selectedBranch}]`;
    if (this.searchQuery) title += ` [Search: "${this.searchQuery}"]`;

    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const columns = [
      { header: 'Employee ID', dataKey: 'employeeId' },
      { header: 'Employee', dataKey: 'nameWithDept' },
      { header: 'Department', dataKey: 'displayDepartment' },
      { header: 'Branch', dataKey: 'branchName' },
      { header: 'Date', dataKey: 'attendanceDate' },
      { header: 'Shift', dataKey: 'timePeriod' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Clock In', dataKey: 'actualCheckInTime' },
      { header: 'Clock Out', dataKey: 'actualCheckOutTime' },
      { header: 'Late Check-In', dataKey: 'lateCheckInTime' },
      { header: 'Over Time', dataKey: 'overTime' }
    ];

    const tableData = this.filteredAttendance.map(item => {
      const isLate = !!(item.lateCheckInTime && item.lateCheckInTime !== '--' && item.lateCheckInTime !== '00:00');
      const branchName = this.branches.find(b => b.id === item.branchId)?.name || item.branchName || '--';

      return {
        employeeId: String(item.employeeId || '--'),
        nameWithDept: `${item.name || 'Unknown'}`,
        displayDepartment: item.displayDepartment || item.department || 'Unassigned',
        branchName: branchName,
        attendanceDate: this.formatDate(item.attendanceDate) || '--',
        timePeriod: String(item.timePeriod || '--'),
        status: String(item.status || '--'),
        actualCheckInTime: String(item.actualCheckInTime || '--'),
        actualCheckOutTime: String(item.actualCheckOutTime || '--'),
        lateCheckInTime: String(item.lateCheckInTime || '--'),
        overTime: String(item.overTime || '--'),
        isLate: isLate
      };
    });

    autoTable(doc, {
      columns: columns,
      body: tableData,
      startY: 30,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: 'linebreak',
        halign: 'left',
        valign: 'middle',
        textColor: [0, 0, 0],
        fontStyle: 'normal'
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
        textColor: [0, 0, 0],
        fontStyle: 'normal'
      },
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.fillColor = [41, 128, 185];
          data.cell.styles.textColor = 255;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.halign = 'center';
        }

        if (data.row.raw && 'isLate' in data.row.raw && data.row.raw['isLate']) {
          data.cell.styles.fillColor = [255, 235, 238];
          data.cell.styles.textColor = [211, 47, 47];

          if (data.column.dataKey === 'nameWithDept') {
            data.cell.styles.textColor = [211, 47, 47];
          }
        }
      }
    });

    let filename = 'Employee_Attendance';
    if (this.selectedDivision !== 'All Employee') filename += `_${this.selectedDivision.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (this.selectedStatus !== 'All Employee') filename += `_${this.selectedStatus.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (this.selectedBranch !== 'All Branches') filename += `_Branch_${this.selectedBranch.replace(/[^a-zA-Z0-9]/g, '_')}`;
    if (this.searchQuery) filename += `_Search_${this.searchQuery.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
    filename += `_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.save(filename);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.filter-section') && !target.closest('.filter-toggle')) {
      this.showFilters = false;
    }
  }
}