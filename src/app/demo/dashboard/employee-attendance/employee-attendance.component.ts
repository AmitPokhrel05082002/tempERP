import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Subject, of, throwError, forkJoin, map } from 'rxjs';
import { debounceTime, distinctUntilChanged, catchError, finalize } from 'rxjs/operators';
import { SharedModule } from 'src/app/theme/shared/shared.module';
import { HttpClient, HttpClientModule, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { FormBuilder, FormGroup } from '@angular/forms';
import { AuthService } from 'src/app/core/services/auth.service';

interface AttendanceApiResponse {
content: any[];
totalElements: number;
totalPages: number;
size: number;
number: number;
first: boolean;
last: boolean;
empty: boolean;
}

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

interface Department {
id?: string;
dept_id: string;
dept_name: string;
dept_code: string;
org_name: string;
branch_name: string;
branchId?: string;
name?: string;
code?: string;
isMainBranch?: boolean;
budget_allocation: number;
sub_departments_count: number;
}

interface Branch {
id?: string;
branchId: string;
branchName: string;
name?: string;
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
// Role-based access properties
currentUserRole: string = 'EMPLOYEE'; // Default to most restrictive
currentUserId: string = '';
currentUserEmpId: string = '';
currentUserBranchId: string = '';
currentUserDepartmentId: string = '';

// Permission flags
canViewAllBranches: boolean = false;
canViewAllDepartments: boolean = false;
canViewAllEmployees: boolean = false;
canSearch: boolean = false;
canExport: boolean = false;
canFilterByStatus: boolean = false;
canFilterByDate: boolean = false;

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

// Date filter properties
dateFilterForm: FormGroup;
showDateFilter = false;
currentFilterDate: string | null = null;
minDate: Date;
maxDate: Date;

httpOptions = {
  headers: new HttpHeaders({
    'Content-Type': 'application/json'
  })
};

private departmentMap: { [key: string]: string } = {}

constructor(
  private http: HttpClient,
  private fb: FormBuilder,
  private authService: AuthService
) {
  this.dateFilterForm = this.fb.group({
    filterDate: [null]
  });
}

ngOnInit(): void {
  // Initialize user role and permissions
  this.initializeUserRoleAndPermissions();

  this.initDateFilter();

  // Load data based on user role
  this.initializeDataBasedOnRole();

  // Setup search with debouncing - only if user has permission
  if (this.canSearch) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe((query) => {
      this.searchQuery = query;
      this.currentPage = 1;
      this.updateFilterCount();

      console.log('Search filter changed to:', query);
      this.loadAttendanceData();
    });
  }
}

private initializeUserRoleAndPermissions(): void {
  // Get user info from AuthService
  const currentUser = this.authService.getCurrentUser();

  if (currentUser) {
    // Map role names from your auth service to the appropriate role
    const roleMapping: { [key: string]: string } = {
      'Admin': 'ADMIN',
      'HR': 'HR',
      'Manager': 'MANAGER',
      'Employee': 'EMPLOYEE',
      'CTO': 'ADMIN' // CTO gets admin privileges
    };

    // Set user role from auth service
    this.currentUserRole = roleMapping[currentUser.roleName] || 'EMPLOYEE';

    // Set user IDs
    this.currentUserId = currentUser.userId || '';
    this.currentUserEmpId = currentUser.empId || '';

    // If user is an employee, get their additional details
    if (this.currentUserRole === 'EMPLOYEE' && this.currentUserEmpId) {
      // Get employee details to find their branch and department
      this.authService.getEmployeeByEmpId(this.currentUserEmpId).subscribe({
        next: (employeeData) => {
          if (employeeData?.data) {
            this.currentUserBranchId = employeeData.data.branchId || '';
            this.currentUserDepartmentId = employeeData.data.departmentId || '';
            console.log('Employee details loaded:', {
              empId: this.currentUserEmpId,
              branchId: this.currentUserBranchId,
              departmentId: this.currentUserDepartmentId
            });
          }
        },
        error: (error) => {
          console.error('Error fetching employee details:', error);
        }
      });
    }

    console.log('User initialized:', {
      role: this.currentUserRole,
      userId: this.currentUserId,
      empId: this.currentUserEmpId,
      roleName: currentUser.roleName
    });
  } else {
    // No user logged in, default to most restrictive
    this.currentUserRole = 'EMPLOYEE';
    console.warn('No user found in auth service, defaulting to EMPLOYEE role');
  }

  // Set permissions based on role
  this.setPermissionsBasedOnRole();
}

private setPermissionsBasedOnRole(): void {
  const currentUser = this.authService.getCurrentUser();

  // Check if user has specific permissions using the auth service methods
  const isAdmin = this.authService.isAdmin();
  const isCTO = this.authService.isCTO();
  const isEmployee = this.authService.isEmployee();
  const hasFullAccess = this.authService.hasFullAccess();

  if (isAdmin || isCTO || hasFullAccess) {
    // Admin and CTO have full access
    this.canViewAllBranches = true;
    this.canViewAllDepartments = true;
    this.canViewAllEmployees = true;
    this.canSearch = true;
    this.canExport = true;
    this.canFilterByStatus = true;
    this.canFilterByDate = true;
  } else if (currentUser?.roleName === 'HR') {
    // HR has full access
    this.canViewAllBranches = true;
    this.canViewAllDepartments = true;
    this.canViewAllEmployees = true;
    this.canSearch = true;
    this.canExport = true;
    this.canFilterByStatus = true;
    this.canFilterByDate = true;
  } else if (currentUser?.roleName === 'Manager') {
    // Manager can view their branch and all departments within it
    this.canViewAllBranches = true;
    this.canViewAllDepartments = true;
    this.canViewAllEmployees = true;
    this.canSearch = true;
    this.canExport = true;
    this.canFilterByStatus = true;
    this.canFilterByDate = true;
  } else if (isEmployee) {
    // Employee can only view their own attendance
    this.canViewAllBranches = false;
    this.canViewAllDepartments = false;
    this.canViewAllEmployees = false;
    this.canSearch = false;
    this.canExport = true; // Can export their own data
    this.canFilterByStatus = true; // Can filter their own attendance by status
    this.canFilterByDate = true; // Can filter their own attendance by date
  } else {
    // Default restrictive permissions
    this.canViewAllBranches = false;
    this.canViewAllDepartments = false;
    this.canViewAllEmployees = false;
    this.canSearch = false;
    this.canExport = false;
    this.canFilterByStatus = false;
    this.canFilterByDate = false;
  }

  console.log('Permissions set:', {
    role: this.currentUserRole,
    canViewAllBranches: this.canViewAllBranches,
    canViewAllDepartments: this.canViewAllDepartments,
    canViewAllEmployees: this.canViewAllEmployees,
    canSearch: this.canSearch
  });
}

private initializeDataBasedOnRole(): void {
  const isEmployee = this.authService.isEmployee();

  if (isEmployee && this.currentUserEmpId) {
    // For employees, wait a bit for employee details to load
    setTimeout(() => {
      // Set filters to their own data
      this.selectedBranchId = this.currentUserBranchId;
      this.activeTab = 'My Attendance';

      // Load only their attendance data
      this.loadAttendanceData();
    }, 500); // Small delay to ensure employee details are loaded
  } else if (isEmployee && !this.currentUserEmpId) {
    // Employee but no empId found
    this.errorMessage = 'Unable to load your attendance data. Employee ID not found.';
    this.isLoading = false;
  } else {
    // For other roles (Admin, HR, Manager, CTO), load branches and departments
    this.loadBranches()
      .then(() => {
        console.log('Branches loaded:', this.branches);
        return this.loadDepartments();
      })
      .then(() => {
        console.log('Initial departments loaded');
        return this.loadAttendanceData();
      })
      .catch(error => {
        console.error('Initialization error:', error);
        this.errorMessage = 'Failed to initialize data. Please refresh the page.';
      });
  }
}

private initDateFilter(): void {
  const today = new Date();
  this.maxDate = new Date(today);
  this.minDate = new Date(today);
  this.minDate.setMonth(today.getMonth() - 3); // Allow filtering up to 3 months back

  this.dateFilterForm = this.fb.group({
    filterDate: [null]
  });
}

toggleDateFilter(event?: Event): void {
  if (!this.canFilterByDate) return;

  if (event) {
    event.stopPropagation();
  }
  this.showDateFilter = !this.showDateFilter;
  if (this.showDateFilter) {
    this.dateFilterForm.reset();
    if (this.currentFilterDate) {
      this.dateFilterForm.patchValue({
        filterDate: this.formatDateForInput(this.currentFilterDate)
      });
    }
  }
}

private formatDate(date: Date | string): string {
  if (!date) return '--';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '--';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

private formatDateForInput(date: string | Date): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

hasAppliedFilters(): boolean {
  // For employees, only show date and status filters
  if (this.authService.isEmployee()) {
    return this.currentFilterDate !== null ||
           (this.selectedStatus !== 'All Employee' && this.canFilterByStatus);
  }

  // For other roles, show all applicable filters
  return this.currentFilterDate !== null ||
         (this.selectedBranchId !== '' && this.canViewAllBranches) ||
         (this.activeTab !== 'All Employee' && this.canViewAllDepartments) ||
         (this.selectedStatus !== 'All Employee' && this.canFilterByStatus) ||
         (this.searchQuery.trim() !== '' && this.canSearch);
}

getDepartmentName(dept: string | Department): string {
  if (typeof dept === 'string') {
    return dept === 'All Employee' ? 'All Departments' : dept;
  }
  return dept.dept_name || dept.name || '--';
}

getEmployeeFullName(emp: any): string {
  if (!emp) return '--';
  if (emp.name) return emp.name;
  const firstName = emp.firstName || '';
  const lastName = emp.lastName || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || '--';
}

getDepartmentDisplayName(emp: any): string {
  if (!emp) return 'Unassigned';
  return emp.displayDepartment || emp.department || emp.departmentId || 'Unassigned';
}

get emptyStateMessage(): string {
  if (this.errorMessage) return '';
  if (this.isLoading) return '';

  if (this.authService.isEmployee()) {
    return 'No attendance records found for your profile.';
  }

  const filtersApplied = [];
  if (this.selectedBranchId !== '' && this.canViewAllBranches) filtersApplied.push('branch');
  if (this.activeTab !== 'All Employee' && this.canViewAllDepartments) filtersApplied.push('department');
  if (this.selectedStatus !== 'All Employee' && this.canFilterByStatus) filtersApplied.push('status');
  if (this.currentFilterDate) filtersApplied.push('date');
  if (this.searchQuery.trim() !== '' && this.canSearch) filtersApplied.push('search');

  if (filtersApplied.length > 0) {
    return `No employees found matching the applied ${filtersApplied.join(', ')} filter(s).`;
  }

  return 'No employee attendance records found.';
}

private safeString(value: any): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

private safeLowerString(value: any): string {
  return this.safeString(value).toLowerCase();
}

private async loadBranches(): Promise<void> {
  // Only load branches if user has permission
  if (!this.canViewAllBranches) {
    this.branches = [];
    return Promise.resolve();
  }

  try {
    const response = await this.http.get<any>(this.branchApiUrl, this.httpOptions)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Failed to load branches:', error);
          this.errorMessage = 'Failed to load branches. Please try again later.';
          return of({ data: [] });
        })
      ).toPromise();

    this.branches = (Array.isArray(response) ? response : response?.data || []).map((branch: any) => ({
      id: branch.id || branch.branchId,
      name: branch.name || branch.branchName,
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
  // Only load departments if user has permission
  if (!this.canViewAllDepartments) {
    this.formDepartments = [];
    this.filteredDepartments = [];
    this.tabDepartments = ['My Attendance'];
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    let url = this.deptApiUrl;
    if (branchId) {
      url = `${this.deptApiUrl}/branch/${branchId}`;
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

onBranchChange(event?: Event): void {
  if (!this.canViewAllBranches) return;

  if (event) {
    const selectElement = event.target as HTMLSelectElement;
    this.selectedBranchId = selectElement.value;
  }

  this.currentPage = 1;
  this.updateFilterCount();

  const branchIdToLoad = this.selectedBranchId && this.selectedBranchId !== 'undefined'
    ? this.selectedBranchId
    : undefined;

  console.log('Branch filter changed to:', branchIdToLoad);

  this.loadDepartments(branchIdToLoad)
    .then(() => {
      console.log('Departments loaded for branch, now applying filters sequentially');
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

  const params: any = {
    page: (this.currentPage - 1).toString(),
    size: this.itemsPerPage.toString()
  };

  // For employees, always filter by their own employee ID
  const isEmployee = this.authService.isEmployee();
  if (isEmployee && this.currentUserEmpId) {
    // Use empId for employee attendance
    params.employeeId = this.currentUserEmpId;
    console.log('Loading attendance for employee:', this.currentUserEmpId);
  }

  let url: string;
  if (this.currentFilterDate) {
    url = `${environment.apiUrl}/api/v1/employee-attendance/date/${this.currentFilterDate}`;
  } else {
    url = this.apiUrl;
  }

  // Apply filters based on permissions

  // 1. Branch filter (if user has permission and filter is selected)
  if (this.canViewAllBranches && this.selectedBranchId && this.selectedBranchId !== '') {
    params.branchId = this.selectedBranchId;
  } else if (isEmployee && this.currentUserBranchId) {
    // For employees, always use their branch if available
    params.branchId = this.currentUserBranchId;
  }

  // 2. Department filter (if user has permission and filter is selected)
  if (this.canViewAllDepartments && this.activeTab !== 'All Employee' && this.activeTab !== 'My Attendance') {
    params.department = this.activeTab;
  } else if (isEmployee && this.currentUserDepartmentId) {
    // For employees, always use their department if available
    params.departmentId = this.currentUserDepartmentId;
  }

  // 3. Status filter (if user has permission)
  if (this.canFilterByStatus && this.selectedStatus !== 'All Employee') {
    params.status = this.selectedStatus;
  }

  // 4. Search filter (if user has permission)
  if (this.canSearch && this.searchQuery && this.searchQuery.trim() !== '') {
    if (this.currentFilterDate) {
      params.employeeId = this.searchQuery.trim();
    } else {
      params.search = this.searchQuery.trim();
    }
  }

  console.log('Loading attendance data with filters:', params);

  this.http.get<any>(url, { params })
    .pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading attendance data:', error);
        this.errorMessage = 'Failed to load attendance data. Please try again later.';
        return of({ content: [] });
      })
    )
    .subscribe({
      next: (response) => {
        const data = response.content !== undefined ? response.content : response;
        this.attendanceData = this.validateAttendanceData(Array.isArray(data) ? data : []);

        if (response.totalElements !== undefined) {
          this.itemsPerPage = response.size || this.itemsPerPage;
          this.currentPage = (response.number || 0) + 1;
        }

        console.log('Loaded attendance data:', this.attendanceData.length, 'records');
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error in subscription:', error);
        this.isLoading = false;
        this.errorMessage = 'An error occurred while processing the data.';
        this.attendanceData = [];
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

    if (item?.department && typeof item.department === 'string') {
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
  if (!item.actualCheckInTime || item.actualCheckInTime === '00:00:00') {
    return 'Absent';
  }

  const requiredIn = item.requiredCheckInTime;
  let requiredOut = item.requiredCheckOutTime;
  const day = (item.dayOfWeek || '').toLowerCase();

  if (day === 'saturday') {
    requiredOut = '13:00:00';
  }

  if (!requiredIn || requiredIn.trim() === '' || requiredIn === '00:00:00' ||
      !requiredOut || requiredOut.trim() === '' || requiredOut === '00:00:00') {
    return 'Present';
  }

  const actualIn = this.timeToMinutes(item.actualCheckInTime);
  const requiredInTime = this.timeToMinutes(requiredIn);

  if (actualIn > requiredInTime) {
    return 'Late';
  }

  if (item.actualCheckOutTime && item.actualCheckOutTime !== '00:00:00') {
    const actualOut = this.timeToMinutes(item.actualCheckOutTime);
    const requiredOutTime = this.timeToMinutes(requiredOut);

    if (actualOut < requiredOutTime) {
      return 'Early Departure';
    }
  }

  return 'Present';
}

private timeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;

  const timeParts = timeStr.split(':');
  if (timeParts.length >= 2) {
    const hours = parseInt(timeParts[0], 10) || 0;
    const minutes = parseInt(timeParts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
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
  if (!this.canViewAllDepartments) return;

  this.activeTab = dept;
  this.selectedDivision = dept;
  this.currentPage = 1;
  this.updateFilterCount();

  console.log('Department filter changed to:', dept);
  this.loadAttendanceData();
}

setStatusFilter(status: string): void {
  if (!this.canFilterByStatus) return;

  this.selectedStatus = status;
  this.currentPage = 1;
  this.updateFilterCount();

  console.log('Status filter changed to:', status);
  this.loadAttendanceData();
}

toggleFilters(): void {
  this.showFilters = !this.showFilters;
}

get filteredAttendance(): EmployeeAttendance[] {
  if (!this.attendanceData?.length) return [];
  return this.attendanceData;
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
    this.loadAttendanceData();
  }
}

nextPage(): void {
  if (this.currentPage < this.totalPages) {
    this.currentPage++;
    this.loadAttendanceData();
  }
}

private updateFilterCount(): void {
  let count = 0;

  if (this.authService.isEmployee()) {
    // For employees, only count date and status filters
    if (this.selectedStatus !== 'All Employee' && this.canFilterByStatus) count++;
    if (this.currentFilterDate) count++;
  } else {
    // For other roles, count all applicable filters
    if (this.activeTab !== 'All Employee' && this.canViewAllDepartments) count++;
    if (this.selectedStatus !== 'All Employee' && this.canFilterByStatus) count++;
    if (this.selectedBranchId !== '' && this.canViewAllBranches) count++;
    if (this.currentFilterDate) count++;
    if (this.searchQuery.trim() !== '' && this.canSearch) count++;
  }

  this.filterCount = count;
}

onSearchInput(event: Event): void {
  if (!this.canSearch) return;

  const value = (event.target as HTMLInputElement).value;
  this.searchSubject.next(value);
}

applyDateFilter(): void {
  if (!this.canFilterByDate) return;

  const selectedDate = this.dateFilterForm.get('filterDate')?.value;
  if (selectedDate) {
    this.currentFilterDate = this.formatDate(new Date(selectedDate));
    this.showDateFilter = false;
    this.currentPage = 1;
    this.updateFilterCount();

    console.log('Date filter applied:', this.currentFilterDate);
    this.loadAttendanceData();
  }
}

clearDateFilter(): void {
  if (!this.canFilterByDate) return;

  this.currentFilterDate = null;
  this.dateFilterForm.reset();
  this.showDateFilter = false;
  this.currentPage = 1;
  this.updateFilterCount();
  this.loadAttendanceData();

  console.log('Date filter cleared');
}

clearSearch(): void {
  if (!this.canSearch) return;

  this.searchQuery = '';
  this.searchSubject.next('');
  console.log('Search filter cleared');
  this.loadAttendanceData();
}

clearAllFilters(): void {
  console.log('Clearing all filters');

  // Only clear filters the user has permission to use
  if (this.canViewAllBranches) {
    this.selectedBranchId = '';
  }

  if (this.canViewAllDepartments) {
    this.activeTab = 'All Employee';
    this.selectedDivision = 'All Employee';
  }

  if (this.canFilterByStatus) {
    this.selectedStatus = 'All Employee';
  }

  if (this.canFilterByDate) {
    this.currentFilterDate = null;
    this.dateFilterForm.reset();
  }

  if (this.canSearch) {
    this.searchQuery = '';
  }

  this.currentPage = 1;
  this.updateFilterCount();

  // For employees, just reload their data
  if (this.authService.isEmployee()) {
    this.loadAttendanceData();
  } else {
    // For other roles, reload departments and data
    this.loadDepartments()
      .then(() => {
        this.loadAttendanceData();
      })
      .catch(error => {
        console.error('Error loading departments:', error);
        this.loadAttendanceData();
      });
  }
}

clearBranchFilter(): void {
  if (!this.canViewAllBranches) return;

  console.log('Clearing branch filter');
  this.selectedBranchId = '';
  this.onBranchChange();
}

getBranchDisplayName(): string {
  const branch = this.branches.find(b => b.branchId === this.selectedBranchId);
  return branch?.branchName || 'Unknown';
}

onItemsPerPageChange(): void {
  this.currentPage = 1;
  this.loadAttendanceData();
}

goToFirstPage(): void {
  this.currentPage = 1;
  this.loadAttendanceData();
}

goToLastPage(): void {
  this.currentPage = this.totalPages;
  this.loadAttendanceData();
}

formatDateForDisplay(dateString: string): string {
  try {
    const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  } catch {
    return dateString;
  }
}

// exportToPdf(): void {
//   if (!this.canExport) return;

//   const doc = new jsPDF({ orientation: 'landscape' });

//   let title = 'Employee Attendance Report';

//   // For employees, adjust title
//   if (this.currentUserRole === UserRole.EMPLOYEE) {
//     title = 'My Attendance Report';
//   } else {
//     if (this.activeTab !== 'All Employee') title += ` - ${this.activeTab}`;
//     if (this.selectedStatus !== 'All Employee') title += ` (${this.selectedStatus})`;
//     if (this.selectedBranchId !== '') {
//       const branchName = this.branches.find(b => b.branchId === this.selectedBranchId)?.branchName || 'Unknown Branch';
//       title += ` [Branch: ${branchName}]`;
//     }
//     if (this.searchQuery) title += ` [Search: "${this.searchQuery}"]`;
//   }

//   if (this.currentFilterDate) {
//     const filterDate = new Date(this.currentFilterDate);
//     const monthName = filterDate.toLocaleString('default', { month: 'long' });
//     const year = filterDate.getFullYear();
//     title += ` [${monthName} ${year}]`;
//   }

//   doc.setFontSize(18);
//   doc.text(title, 14, 15);
//   doc.setFontSize(10);
//   doc.setTextColor(100);
//   doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

//   const columns = [
//     { header: 'Employee ID', dataKey: 'employeeId' },
//     { header: 'Employee', dataKey: 'nameWithDept' },
//     { header: 'Department', dataKey: 'displayDepartment' },
//     { header: 'Branch', dataKey: 'branchName' },
//     { header: 'Date', dataKey: 'attendanceDate' },
//     { header: 'Shift', dataKey: 'timePeriod' },
//     { header: 'Status', dataKey: 'status' },
//     { header: 'Clock In', dataKey: 'actualCheckInTime' },
//     { header: 'Clock Out', dataKey: 'actualCheckOutTime' },
//     { header: 'Late Check-In', dataKey: 'lateCheckInTime' },
//     { header: 'Over Time', dataKey: 'overTime' }
//   ];

//   const tableData = this.filteredAttendance.map(item => {
//     const isLate = !!(item.lateCheckInTime && item.lateCheckInTime !== '--' && item.lateCheckInTime !== '00:00');
//     const branchName = this.branches.find(b => b.id === item.branchId)?.name || item.branchName || '--';

//     return {
//       employeeId: String(item.employeeId || '--'),
//       nameWithDept: `${item.name || 'Unknown'}`,
//       displayDepartment: item.displayDepartment || item.department || 'Unassigned',
//       branchName: branchName,
//       attendanceDate: item.attendanceDate ? this.formatDateForDisplay(item.attendanceDate) : '--',
//       timePeriod: String(item.timePeriod || '--'),
//       status: String(item.status || '--'),
//       actualCheckInTime: String(item.actualCheckInTime || '--'),
//       actualCheckOutTime: String(item.actualCheckOutTime || '--'),
//       lateCheckInTime: String(item.lateCheckInTime || '--'),
//       overTime: String(item.overTime || '--'),
//       isLate: isLate
//     };
//   });

//   autoTable(doc, {
//     columns: columns,
//     body: tableData,
//     startY: 30,
//     theme: 'grid',
//     styles: {
//       fontSize: 9,
//       cellPadding: 3,
//       overflow: 'linebreak',
//       halign: 'left',
//       valign: 'middle',
//       textColor: [0, 0, 0],
//       fontStyle: 'normal'
//     },
//     headStyles: {
//       fillColor: [41, 128, 185],
//       textColor: 255,
//       fontStyle: 'bold',
//       halign: 'center'
//     },
//     alternateRowStyles: {
//       fillColor: [245, 245, 245],
//       textColor: [0, 0, 0],
//       fontStyle: 'normal'
//     },
//     didParseCell: (data) => {
//       if (data.section === 'head') {
//         data.cell.styles.fillColor = [41, 128, 185];
//         data.cell.styles.textColor = 255;
//         data.cell.styles.fontStyle = 'bold';
//         data.cell.styles.halign = 'center';
//       }

//       if (data.row.raw && 'isLate' in data.row.raw && data.row.raw['isLate']) {
//         data.cell.styles.fillColor = [255, 235, 238];
//         data.cell.styles.textColor = [211, 47, 47];

//         if (data.column.dataKey === 'nameWithDept') {
//           data.cell.styles.textColor = [211, 47, 47];
//         }
//       }
//     }
//   });

//   let filename = this.currentUserRole === UserRole.EMPLOYEE ? 'My_Attendance' : 'Employee_Attendance';

//   if (this.currentUserRole !== UserRole.EMPLOYEE) {
//     if (this.activeTab !== 'All Employee') filename += `_${this.activeTab.replace(/[^a-zA-Z0-9]/g, '_')}`;
//     if (this.selectedStatus !== 'All Employee') filename += `_${this.selectedStatus.replace(/[^a-zA-Z0-9]/g, '_')}`;
//     if (this.selectedBranchId !== '') {
//       const branchName = this.branches.find(b => b.branchId === this.selectedBranchId)?.branchName || 'Branch';
//       filename += `_${branchName.replace(/[^a-zA-Z0-9]/g, '_')}`;
//     }
//     if (this.searchQuery) filename += `_Search_${this.searchQuery.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
//   }

//   if (this.currentFilterDate) {
//     const filterDate = new Date(this.currentFilterDate);
//     const year = filterDate.getFullYear();
//     const month = (filterDate.getMonth() + 1).toString().padStart(2, '0');
//     filename += `_${year}_${month}`;
//   }
//   filename += `_${new Date().toISOString().slice(0, 10)}.pdf`;

//   doc.save(filename);
// }

@HostListener('document:click', ['$event'])
onDocumentClick(event: MouseEvent) {
  // Close date filter when clicking outside
  const target = event.target as HTMLElement;
  const dateFilterButton = document.querySelector('.date-filter-button');
  const dateFilterDropdown = document.querySelector('.date-picker-dropdown');

  if (dateFilterButton && !dateFilterButton.contains(target) &&
      dateFilterDropdown && !dateFilterDropdown.contains(target)) {
    this.showDateFilter = false;
  }
}
}
