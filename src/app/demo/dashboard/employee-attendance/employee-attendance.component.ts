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
  isLate?: boolean;
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
  currentUserRole: string = 'EMPLOYEE';
  currentUserId: string = '';
  currentUserEmpId: string = '';
  currentUserBranchId: string = '';
  currentUserDepartmentId: string = '';
  currentUserName: string = ''; // Add employee name

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
  statuses = ['All', 'Present', 'Late', 'Absent', 'Early Departure', 'Leave'];

  selectedDivision = 'All';
  selectedStatus = 'All';
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

  // API URLs - Updated to use the working monthly-grouped endpoint
  attendanceApiUrl = `${environment.apiUrl}/api/v1/employee-attendance/monthly-grouped`;
  latestApiUrl = `${environment.apiUrl}/api/v1/employee-attendance/latest`;
  deptApiUrl = `${environment.apiUrl}/api/v1/departments`;
  branchApiUrl = `${environment.apiUrl}/api/v1/branches`;

  // Date filter properties
  dateFilterForm: FormGroup;
  showDateFilter = false;
  currentFilterDate: string | null = null;
  minDate: Date = new Date();
  maxDate: Date = new Date();

  // Working endpoint storage
  private workingEndpoint: any = null;

  // Make Math available in template
  Math = Math;

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
    this.initializeUserRoleAndPermissions();
    this.initializeDateRange();
    this.initDateFilter();
    this.initializeDataBasedOnRole();

    if (this.canSearch) {
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe((query) => {
        this.searchQuery = query;
        this.currentPage = 1;
        this.updateFilterCount();
        this.loadAttendanceData();
      });
    }
  }

  private initializeUserRoleAndPermissions(): void {
    const currentUser = this.authService.getCurrentUser();

    if (currentUser) {
      const roleMapping: { [key: string]: string } = {
        'Admin': 'ADMIN',
        'HR': 'HR',
        'Manager': 'MANAGER',
        'Employee': 'EMPLOYEE',
        'CTO': 'ADMIN'
      };

      this.currentUserRole = roleMapping[currentUser.roleName] || 'EMPLOYEE';
      this.currentUserId = currentUser.userId || '';
      this.currentUserEmpId = currentUser.empId || '';

      console.log('User initialized:', {
        role: this.currentUserRole,
        userId: this.currentUserId,
        empId: this.currentUserEmpId,
        roleName: currentUser.roleName
      });

      if (this.currentUserRole === 'EMPLOYEE' && this.currentUserEmpId) {
        this.authService.getEmployeeByEmpId(this.currentUserEmpId).subscribe({
          next: (employeeData) => {
            if (employeeData?.data) {
              this.currentUserBranchId = employeeData.data.branchId || '';
              this.currentUserDepartmentId = employeeData.data.departmentId || '';

              // Set employee name for display
              const firstName = employeeData.data.firstName || '';
              const lastName = employeeData.data.lastName || '';
              this.currentUserName = `${firstName} ${lastName}`.trim() || 'Employee';

              console.log('Employee details loaded:', {
                empId: this.currentUserEmpId,
                name: this.currentUserName,
                branchId: this.currentUserBranchId,
                departmentId: this.currentUserDepartmentId
              });
            }
          },
          error: (error) => {
            console.error('Error fetching employee details:', error);
            this.currentUserName = 'Employee'; // Fallback name
          }
        });
      }
    } else {
      this.currentUserRole = 'EMPLOYEE';
      console.warn('No user found in auth service, defaulting to EMPLOYEE role');
    }

    this.setPermissionsBasedOnRole();
  }

  private setPermissionsBasedOnRole(): void {
    const currentUser = this.authService.getCurrentUser();
    const isAdmin = this.authService.isAdmin();
    const isCTO = this.authService.isCTO();
    const isEmployee = this.authService.isEmployee();
    const hasFullAccess = this.authService.hasFullAccess();

    if (isAdmin || isCTO || hasFullAccess) {
      this.canViewAllBranches = true;
      this.canViewAllDepartments = true;
      this.canViewAllEmployees = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (currentUser?.roleName === 'HR') {
      this.canViewAllBranches = true;
      this.canViewAllDepartments = true;
      this.canViewAllEmployees = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (currentUser?.roleName === 'Manager') {
      this.canViewAllBranches = true;
      this.canViewAllDepartments = true;
      this.canViewAllEmployees = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (isEmployee) {
      this.canViewAllBranches = false;
      this.canViewAllDepartments = false;
      this.canViewAllEmployees = false;
      this.canSearch = false;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else {
      this.canViewAllBranches = false;
      this.canViewAllDepartments = false;
      this.canViewAllEmployees = false;
      this.canSearch = false;
      this.canExport = false;
      this.canFilterByStatus = false;
      this.canFilterByDate = false;
    }
  }

  private initializeDateRange(): void {
    const today = new Date();
    this.maxDate = new Date(today);

    if (this.currentUserRole === 'EMPLOYEE') {
      this.minDate = new Date(today);
      this.minDate.setDate(today.getDate() - 365);
    } else {
      this.minDate = new Date(today);
      this.minDate.setMonth(today.getMonth() - 3);
    }
  }

  private initializeDataBasedOnRole(): void {
    const isEmployee = this.authService.isEmployee();

    if (isEmployee && this.currentUserEmpId) {
      setTimeout(() => {
        this.selectedBranchId = this.currentUserBranchId;
        this.activeTab = 'My Attendance';
        this.loadAttendanceData();
      }, 500);
    } else if (isEmployee && !this.currentUserEmpId) {
      this.errorMessage = 'Unable to load your attendance data. Employee ID not found.';
      this.isLoading = false;
    } else {
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
    this.dateFilterForm = this.fb.group({
      filterDate: [null]
    });
  }

  // MAIN LOAD METHOD WITH DEBUGGING
  loadAttendanceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('=== ATTENDANCE LOAD DEBUG ===');
    console.log('Current User:', {
      role: this.currentUserRole,
      empId: this.currentUserEmpId,
      userId: this.currentUserId,
      isEmployee: this.authService.isEmployee()
    });

    const isEmployee = this.authService.isEmployee();

    if (isEmployee && this.currentUserEmpId) {
      console.log('🔍 Employee detected - loading monthly-grouped data...');
      this.loadEmployeeAttendanceData();
    } else if (!isEmployee) {
      console.log('👥 Non-employee - loading all employee data');
      this.loadLatestAttendanceForAllEmployees();
    } else {
      this.errorMessage = 'Employee ID not found. Please contact administrator.';
      this.isLoading = false;
    }
  }

  // EMPLOYEE ATTENDANCE LOADING
  private loadEmployeeAttendanceData(): void {
    console.log('Loading employee-specific attendance data');

    const params: any = {
      employeeId: this.currentUserEmpId,
      page: (this.currentPage - 1).toString(),
      size: this.itemsPerPage.toString()
    };

    // Set date parameters
    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      params.year = filterDate.getFullYear().toString();
      params.month = (filterDate.getMonth() + 1).toString();
      console.log('Using specific date filter:', params.month, '/', params.year);
    } else {
      // For employees without date filter, load latest available month (excluding current)
      return this.loadLatestAvailableMonthForEmployee();
    }

    console.log('Employee API params:', params);

    this.http.get<any>(this.attendanceApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading employee attendance data:', error);
          this.errorMessage = 'Failed to load your attendance data. Please try again later.';
          return of({ content: [] });
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Employee attendance response:', response);
          this.processAttendanceResponse(response, true);
        },
        error: (error) => {
          console.error('Error in employee attendance subscription:', error);
          this.isLoading = false;
          this.errorMessage = 'An error occurred while processing your attendance data.';
          this.attendanceData = [];
        }
      });
  }

  private loadLatestAttendanceForAllEmployees(): void {
    console.log('Loading latest attendance for all employees');

    const params: any = {
      page: (this.currentPage - 1).toString(),
      size: this.itemsPerPage.toString()
    };

    // Apply filters based on permissions
    if (this.canViewAllBranches && this.selectedBranchId && this.selectedBranchId !== '') {
      params.branchId = this.selectedBranchId;
    }

    if (this.canViewAllDepartments && this.activeTab !== 'All Employee' && this.activeTab !== 'My Attendance') {
      params.department = this.activeTab;
    }

    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      params.year = filterDate.getFullYear().toString();
      params.month = (filterDate.getMonth() + 1).toString();
      console.log('Using date filter for all employees:', params.month, '/', params.year);
    }

    console.log('All employees API params:', params);

    // Use latest endpoint for getting latest attendance per employee
    this.http.get<any>(this.latestApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading latest attendance data:', error);

          // Fallback to regular attendance endpoint
          console.log('Falling back to monthly-grouped endpoint');
          return this.http.get<any>(this.attendanceApiUrl, { params })
            .pipe(
              catchError((fallbackError: HttpErrorResponse) => {
                console.error('Fallback also failed:', fallbackError);
                this.errorMessage = 'Failed to load attendance data. Please try again later.';
                return of({ content: [] });
              })
            );
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Latest attendance response:', response);
          this.processAttendanceResponse(response, false);
        },
        error: (error) => {
          console.error('Error in latest attendance subscription:', error);
          this.isLoading = false;
          this.errorMessage = 'An error occurred while processing attendance data.';
          this.attendanceData = [];
        }
      });
  }

  private loadLatestAvailableMonthForEmployee(): void {
    console.log('Searching for latest available month for employee (excluding current month)');

    const currentDate = new Date();
    const monthsToTry = [];

    // Try last 12 months excluding current month
    for (let i = 1; i <= 12; i++) {
      const testDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      monthsToTry.push({
        year: testDate.getFullYear(),
        month: testDate.getMonth() + 1
      });
    }

    this.tryMonthsSequentially(monthsToTry, 0);
  }

  private tryMonthsSequentially(monthsToTry: any[], index: number): void {
    if (index >= monthsToTry.length) {
      console.log('📅 No attendance data found in any of the last 12 months');
      console.log('📅 Tried months:', monthsToTry.map(m => `${m.month}/${m.year}`));
      this.errorMessage = 'No attendance records found in the last 12 months for your employee ID.';
      this.isLoading = false;
      this.attendanceData = [];
      return;
    }

    const monthToTry = monthsToTry[index];

    // Use the monthly-grouped endpoint (the one that works)
    const params: any = {
      employeeId: this.currentUserEmpId,
      year: monthToTry.year.toString(),
      month: monthToTry.month.toString(),
      page: '0',
      size: this.itemsPerPage.toString()
    };

    console.log(`📅 Trying month ${monthToTry.month}/${monthToTry.year} for employee:`, this.currentUserEmpId);
    console.log(`📅 Request URL:`, this.attendanceApiUrl);
    console.log(`📅 Request params:`, params);

    this.http.get<any>(this.attendanceApiUrl, { params })
      .pipe(
        catchError(error => {
          console.log(`📅 ${monthToTry.month}/${monthToTry.year} failed:`, error.status, error.message);
          return of({ content: [] });
        })
      )
      .subscribe({
        next: (response) => {
          console.log(`📅 API response for ${monthToTry.month}/${monthToTry.year}:`, response);

          // Check for monthly-grouped structure
          const data = response.content !== undefined ? response.content : response;
          let hasData = false;

          if (Array.isArray(data) && data.length > 0) {
            // Check if this is monthly-grouped structure
            if (data[0].employeeId && data[0].attendanceList) {
              // Find the employee's data
              const employeeData = data.find(emp => emp.employeeId === this.currentUserEmpId);
              if (employeeData && employeeData.attendanceList && employeeData.attendanceList.length > 0) {
                hasData = true;
                console.log(`✅ Found ${employeeData.attendanceList.length} records for ${monthToTry.month}/${monthToTry.year}`);
              }
            } else {
              hasData = data.length > 0;
              console.log(`✅ Found ${data.length} records for ${monthToTry.month}/${monthToTry.year}`);
            }
          }

          if (hasData) {
            console.log(`✅ Sample record:`, data[0]);
            this.updateEmployeeMonthDisplay(monthToTry.month, monthToTry.year);
            this.processAttendanceResponse(response, true);
          } else {
            console.log(`❌ No data for ${monthToTry.month}/${monthToTry.year} - data:`, data);
            this.tryMonthsSequentially(monthsToTry, index + 1);
          }
        }
      });
  }

  private updateEmployeeMonthDisplay(month: number, year: number): void {
    this.currentDate = new Date(year, month - 1, 1);
    console.log(`Updated display to show data for ${month}/${year}`);
  }

  private processAttendanceResponse(response: any, isEmployee: boolean): void {
    let data = response.content !== undefined ? response.content : response;

    console.log('Raw API response:', response);
    console.log('Raw data received:', data);
    console.log('Data type and length:', typeof data, Array.isArray(data) ? data.length : 'not array');

    // Handle monthly-grouped response structure
    if (Array.isArray(data) && data.length > 0 && data[0].employeeId && data[0].attendanceList) {
      console.log('Processing monthly-grouped data structure');
      const flattenedData: any[] = [];

      data.forEach((employeeGroup: any, index: number) => {
        console.log(`Processing employee group ${index}:`, {
          employeeId: employeeGroup.employeeId,
          currentUserEmpId: this.currentUserEmpId,
          isEmployee: isEmployee,
          attendanceListLength: employeeGroup.attendanceList ? employeeGroup.attendanceList.length : 0
        });

        if (employeeGroup.attendanceList && Array.isArray(employeeGroup.attendanceList)) {
          if (isEmployee) {
            // For employees, include ALL their records if it matches current user
            if (employeeGroup.employeeId === this.currentUserEmpId) {
              console.log('✓ Employee: This group matches current user, adding ALL records');
              flattenedData.push(...employeeGroup.attendanceList);
            } else {
              console.log('✗ Employee: Group does not match current user, skipping');
            }
          } else {
            // For non-employees (Admin, HR, Manager), only get the LATEST date record per employee
            console.log('✓ Non-employee: Processing employee data for LATEST date only');
            const sortedAttendance = employeeGroup.attendanceList.sort((a: any, b: any) => {
              return new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime();
            });

            if (sortedAttendance.length > 0) {
              // Only add the LATEST record for this employee
              console.log(`   → Adding latest record for employee ${employeeGroup.employeeId}: ${sortedAttendance[0].attendanceDate}`);
              flattenedData.push(sortedAttendance[0]);
            }
          }
        }
      });

      data = flattenedData;
      console.log('Flattened attendance data:', data.length, 'records');
      console.log('Sample flattened data:', data.slice(0, 2));
    }
    // Process the data based on user type for regular structure
    else if (!isEmployee) {
      // For Admin/HR/Manager - get latest record per employee
      console.log('Processing data for Admin/HR/Manager - extracting latest per employee');
      data = this.extractLatestPerEmployee(data);
    }

    this.attendanceData = this.validateAttendanceData(Array.isArray(data) ? data : []);

    if (response.totalElements !== undefined) {
      this.itemsPerPage = response.size || this.itemsPerPage;
      this.currentPage = (response.number || 0) + 1;
    }

    console.log('Final processed attendance data:', this.attendanceData.length, 'records');
    console.log('Final attendance data sample:', this.attendanceData.slice(0, 2));
    this.isLoading = false;
  }

  private extractLatestPerEmployee(data: any[]): any[] {
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    console.log('Extracting latest record per employee from', data.length, 'total records');

    // Group by employeeId
    const employeeGroups = data.reduce((groups, record) => {
      const empId = record.employeeId || record.empId || record.id;
      if (empId) {
        if (!groups[empId]) {
          groups[empId] = [];
        }
        groups[empId].push(record);
      }
      return groups;
    }, {});

    console.log('Employee groups found:', Object.keys(employeeGroups).length);

    // Get latest record for each employee
    const latestRecords = Object.values(employeeGroups).map((records: any[]) => {
      return records.sort((a, b) => {
        const dateA = new Date(a.attendanceDate || a.date);
        const dateB = new Date(b.attendanceDate || b.date);
        return dateB.getTime() - dateA.getTime();
      })[0];
    });

    console.log('Latest records extracted:', latestRecords.length);
    return latestRecords;
  }

  private validateAttendanceData(data: any[]): EmployeeAttendance[] {
    console.log('Validating attendance data:', data);

    const isEmployee = this.authService.isEmployee();

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

      const isLate = this.isLateCheckIn(item.lateCheckInTime);

      const processedItem: EmployeeAttendance = {
        ...item,
        empCode: item?.empCode || '--',
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
        overTime: this.formatTime(item?.overTime) || this.calculateOvertime(item),
        isLate: isLate
      };

      // For employees, additional filtering is not needed since we already filter in processAttendanceResponse
      return processedItem;
    }).filter(item => item !== null);
  }

  // Helper method to check if late check-in
  private isLateCheckIn(lateCheckInTime: string): boolean {
    if (!lateCheckInTime || lateCheckInTime === '--' || lateCheckInTime === '00:00' || lateCheckInTime === '00:00:00') {
      return false;
    }

    const timeParts = lateCheckInTime.split(':');
    if (timeParts.length >= 2) {
      const hours = parseInt(timeParts[0], 10) || 0;
      const minutes = parseInt(timeParts[1], 10) || 0;
      return hours > 0 || minutes > 0;
    }

    return false;
  }

  getRowClass(emp: EmployeeAttendance): string {
    return emp.isLate ? 'table-danger' : '';
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

  private safeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  // DATE FILTER METHODS
  toggleDateFilter(event?: Event): void {
    if (!this.canFilterByDate) return;
    if (event) event.stopPropagation();
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
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
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

  applyDateFilter(): void {
    if (!this.canFilterByDate) return;

    const selectedDate = this.dateFilterForm.get('filterDate')?.value;
    if (selectedDate) {
      this.currentFilterDate = this.formatDate(new Date(selectedDate));
      this.showDateFilter = false;
      this.currentPage = 1;
      this.updateFilterCount();

      console.log('📅 Date filter applied:', this.currentFilterDate);
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

    console.log('📅 Date filter cleared');
    this.loadAttendanceData();
  }

  // FILTER METHODS
  hasAppliedFilters(): boolean {
    if (this.authService.isEmployee()) {
      return this.currentFilterDate !== null ||
        (this.selectedStatus !== 'All' && this.canFilterByStatus);
    }

    return this.currentFilterDate !== null ||
      (this.selectedBranchId !== '' && this.canViewAllBranches) ||
      (this.activeTab !== 'All' && this.canViewAllDepartments) ||
      (this.selectedStatus !== 'All' && this.canFilterByStatus) ||
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
    if (this.activeTab !== 'All' && this.canViewAllDepartments) filtersApplied.push('department');
    if (this.selectedStatus !== 'All' && this.canFilterByStatus) filtersApplied.push('status');
    if (this.currentFilterDate) filtersApplied.push('date');
    if (this.searchQuery.trim() !== '' && this.canSearch) filtersApplied.push('search');

    if (filtersApplied.length > 0) {
      return `No employees found matching the applied ${filtersApplied.join(', ')} filter(s).`;
    }

    return 'No employee attendance records found.';
  }

  get filteredAttendance(): EmployeeAttendance[] {
    if (!this.attendanceData?.length) return [];

    let filtered = [...this.attendanceData];

    // Apply status filter if selected
    if (this.canFilterByStatus && this.selectedStatus !== 'All') {
      filtered = filtered.filter(item => item.status === this.selectedStatus);
    }

    // Apply search filter if user has permission and search query exists
    if (this.canSearch && this.searchQuery && this.searchQuery.trim() !== '') {
      const searchTerm = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(item => {
        const name = this.getEmployeeFullName(item).toLowerCase();
        const empCode = (item.empCode || '').toString().toLowerCase();
        const department = (item.displayDepartment || '').toLowerCase();

        return name.includes(searchTerm) ||
          empCode.includes(searchTerm) ||
          department.includes(searchTerm);
      });
    }

    return filtered;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredAttendance.length / this.itemsPerPage);
  }

  get paginatedData(): EmployeeAttendance[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredAttendance.slice(startIndex, startIndex + this.itemsPerPage);
  }

  // PAGINATION METHODS
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

  goToFirstPage(): void {
    this.currentPage = 1;
  }

  goToLastPage(): void {
    this.currentPage = this.totalPages;
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1;
  }

  // SEARCH AND FILTER MANAGEMENT
  private updateFilterCount(): void {
    let count = 0;

    if (this.authService.isEmployee()) {
      if (this.selectedStatus !== 'All' && this.canFilterByStatus) count++;
      if (this.currentFilterDate) count++;
    } else {
      if (this.activeTab !== 'All' && this.canViewAllDepartments) count++;
      if (this.selectedStatus !== 'All' && this.canFilterByStatus) count++;
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

  clearSearch(): void {
    if (!this.canSearch) return;

    this.searchQuery = '';
    this.searchSubject.next('');
    console.log('Search filter cleared');
    this.loadAttendanceData();
  }

  clearAllFilters(): void {
    console.log('Clearing all filters');

    if (this.canViewAllBranches) {
      this.selectedBranchId = '';
    }

    if (this.canViewAllDepartments) {
      this.activeTab = 'All';
      this.selectedDivision = 'All';
    }

    if (this.canFilterByStatus) {
      this.selectedStatus = 'All';
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

    if (this.authService.isEmployee()) {
      console.log('Employee - reloading data with default (latest available month)');
      this.loadAttendanceData();
    } else {
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

  // BRANCH AND DEPARTMENT METHODS
  private async loadBranches(): Promise<void> {
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

  // UTILITY METHODS
  formatDateForDisplay(dateString: string): string {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch {
      return dateString;
    }
  }

  // PDF EXPORT METHOD
  exportToPdf(): void {
    if (!this.canExport) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    let title = 'Employee Attendance Report';

    if (this.currentUserRole === 'EMPLOYEE') {
      title = 'My Attendance Report';

      if (this.currentFilterDate) {
        const filterDate = new Date(this.currentFilterDate);
        const monthName = filterDate.toLocaleString('default', { month: 'long' });
        const year = filterDate.getFullYear();
        title += ` - ${monthName} ${year}`;
      } else {
        const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
        const year = this.currentDate.getFullYear();
        title += ` - ${monthName} ${year}`;
      }
    } else {
      if (this.activeTab !== 'All') title += ` - ${this.activeTab}`;
      if (this.selectedStatus !== 'All') title += ` (${this.selectedStatus})`;
      if (this.selectedBranchId !== '') {
        const branchName = this.branches.find(b => b.branchId === this.selectedBranchId)?.branchName || 'Unknown Branch';
        title += ` [Branch: ${branchName}]`;
      }
      if (this.searchQuery) title += ` [Search: "${this.searchQuery}"]`;

      if (this.currentFilterDate) {
        const filterDate = new Date(this.currentFilterDate);
        const monthName = filterDate.toLocaleString('default', { month: 'long' });
        const year = filterDate.getFullYear();
        title += ` [${monthName} ${year}]`;
      }
    }

    doc.setFontSize(18);
    doc.text(title, 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 22);

    const columns = [];

    if (this.currentUserRole === 'EMPLOYEE') {
      // For Employee role: Show Employee and Emp Code columns
      columns.push({ header: 'Employee', dataKey: 'employeeName' });
      columns.push({ header: 'Emp Code', dataKey: 'empCode' });
    } else {
      // For non-employee roles: Show Emp ID and Employee columns
      columns.push({ header: 'Emp ID', dataKey: 'empCode' });
      columns.push({ header: 'Employee', dataKey: 'employeeName' });
    }

    columns.push(
      { header: 'Date', dataKey: 'attendanceDate' },
      { header: 'Shift', dataKey: 'timePeriod' },
      { header: 'Status', dataKey: 'status' },
      { header: 'Clock In', dataKey: 'actualCheckInTime' },
      { header: 'Clock Out', dataKey: 'actualCheckOutTime' },
      { header: 'Late Check-In', dataKey: 'lateCheckInTime' },
      { header: 'Over Time', dataKey: 'overTime' }
    );

    const tableData = this.filteredAttendance.map(item => {
      const data: any = {
        empCode: String(item.empCode || '--'),
        employeeName: String(this.getEmployeeFullName(item)),
        attendanceDate: item.attendanceDate ? this.formatDateForDisplay(item.attendanceDate) : '--',
        timePeriod: String(item.timePeriod || '--'),
        status: String(item.status || '--'),
        actualCheckInTime: String(item.actualCheckInTime || '--'),
        actualCheckOutTime: String(item.actualCheckOutTime || '--'),
        lateCheckInTime: String(item.lateCheckInTime || '--'),
        overTime: String(item.overTime || '--'),
        isLate: item.isLate || false
      };

      return data;
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

        // Highlight late rows in red
        if (data.row.raw && 'isLate' in data.row.raw && data.row.raw['isLate']) {
          data.cell.styles.fillColor = [255, 235, 238];
          data.cell.styles.textColor = [211, 47, 47];
        }
      }
    });

    let filename = this.currentUserRole === 'EMPLOYEE' ? 'My_Attendance' : 'Employee_Attendance';

    if (this.currentUserRole !== 'EMPLOYEE') {
      if (this.activeTab !== 'All') filename += `_${this.activeTab.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (this.selectedStatus !== 'All') filename += `_${this.selectedStatus.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (this.selectedBranchId !== '') {
        const branchName = this.branches.find(b => b.branchId === this.selectedBranchId)?.branchName || 'Branch';
        filename += `_${branchName.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      if (this.searchQuery) filename += `_Search_${this.searchQuery.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
    }

    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      const year = filterDate.getFullYear();
      const month = (filterDate.getMonth() + 1).toString().padStart(2, '0');
      filename += `_${year}_${month}`;
    } else if (this.currentUserRole === 'EMPLOYEE') {
      const year = this.currentDate.getFullYear();
      const month = (this.currentDate.getMonth() + 1).toString().padStart(2, '0');
      filename += `_${year}_${month}`;
    }

    filename += `_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.save(filename);
  }

  // EVENT LISTENER FOR CLOSING DROPDOWNS
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dateFilterButton = document.querySelector('.date-filter-button');
    const dateFilterDropdown = document.querySelector('.date-picker-dropdown');

    if (dateFilterButton && !dateFilterButton.contains(target) &&
      dateFilterDropdown && !dateFilterDropdown.contains(target)) {
      this.showDateFilter = false;
    }
  }
}