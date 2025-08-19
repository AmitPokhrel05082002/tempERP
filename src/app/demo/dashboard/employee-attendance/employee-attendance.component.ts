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
import { formatDate } from '@angular/common';

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
  firstName?: string;
  lastName?: string;
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
  attendanceGroup?: string;
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
  currentUserName: string = '';

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
  statuses = ['All Status', 'Present', 'Late', 'Absent', 'Early Departure', 'Leave'];

  selectedDivision = 'All';
  selectedStatus = 'All Status';
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

  // Manager specific properties
  isManager: boolean = false;
  managerDepartmentId: string = '';
  managerDepartmentName: string = '';
  managerDepartmentCode: string = '';

  // API URLs
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

  // ===============================
  // INITIALIZATION METHODS
  // ===============================

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

      // Manager checks based on deptId presence
      this.isManager = this.authService.isManager();
      
      if (this.isManager) {
        const managerDeptId = this.authService.getManagerDepartmentId();
        this.managerDepartmentId = managerDeptId || '';
        
        console.log('Manager Details:', {
          isDeptHead: currentUser.isDeptHead,
          managerDepartmentId: this.managerDepartmentId,
          roleName: currentUser.roleName,
          hasDeptId: !!managerDeptId,
          canAccess: this.authService.canManagerAccessDepartment()
        });

        if (!this.managerDepartmentId) {
          console.warn('Manager has no department assigned');
          this.errorMessage = 'Access restricted: No department assigned to your manager account.';
          this.isLoading = false;
          return;
        }
      }

      console.log('User initialized:', {
        role: this.currentUserRole,
        userId: this.currentUserId,
        empId: this.currentUserEmpId,
        isManager: this.isManager,
        managerDepartmentId: this.managerDepartmentId,
        roleName: currentUser.roleName,
        isDeptHead: currentUser.isDeptHead
      });

      if (this.currentUserRole === 'EMPLOYEE' && this.currentUserEmpId) {
        this.loadEmployeeDetails(this.currentUserEmpId);
      } else if (this.isManager && this.managerDepartmentId) {
        this.loadManagerDepartmentDetails();
      }
    } else {
      this.currentUserRole = 'EMPLOYEE';
      console.warn('No user found in auth service, defaulting to EMPLOYEE role');
    }

    this.setPermissionsBasedOnRole();
  }

  private setPermissionsBasedOnRole(): void {
    if (this.authService.hasAdminAccess()) {
      this.canViewAllBranches = true;
      this.canViewAllDepartments = true;
      this.canViewAllEmployees = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (this.authService.isHR()) {
      this.canViewAllBranches = true;
      this.canViewAllDepartments = true;
      this.canViewAllEmployees = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (this.authService.isManager() && this.managerDepartmentId) {
      this.canViewAllBranches = false;
      this.canViewAllDepartments = false;
      this.canViewAllEmployees = false;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByStatus = true;
      this.canFilterByDate = true;
    } else if (this.authService.isManager() && !this.managerDepartmentId) {
      this.canViewAllBranches = false;
      this.canViewAllDepartments = false;
      this.canViewAllEmployees = false;
      this.canSearch = false;
      this.canExport = false;
      this.canFilterByStatus = false;
      this.canFilterByDate = false;
    } else if (this.authService.isEmployee()) {
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
      }, 1000);
    } else if (isEmployee && !this.currentUserEmpId) {
      this.errorMessage = 'Unable to load your attendance data. Employee ID not found.';
      this.isLoading = false;
    } else if (this.isManager) {
      if (!this.authService.canManagerAccessDepartment()) {
        this.errorMessage = 'Access restricted: No department assigned to your manager account.';
        this.isLoading = false;
        return;
      }
      
      console.log('Initializing manager with department access');
      this.loadBranches()
        .then(() => {
          console.log('Branches loaded for manager');
        })
        .catch(error => {
          console.error('Initialization error for manager:', error);
          this.errorMessage = 'Failed to initialize manager data. Please refresh the page.';
          this.isLoading = false;
        });
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
      filterDate: [null] // No default date selection
    });
  }

  // ===============================
  // MANAGER DEPARTMENT METHODS
  // ===============================

  private loadManagerDepartmentDetails(): void {
    if (!this.managerDepartmentId) {
      this.errorMessage = 'No department assigned to your manager account.';
      this.isLoading = false;
      return;
    }

    const deptUrl = `${environment.apiUrl}/api/v1/departments/${this.managerDepartmentId}`;
    console.log('Loading manager department details from:', deptUrl);
    
    this.http.get<any>(deptUrl, this.httpOptions).subscribe({
      next: (response) => {
        console.log('Manager department response:', response);
        
        if (response.success && response.data) {
          this.managerDepartmentName = response.data.dept_name || response.data.name || 'My Department';
          this.managerDepartmentCode = response.data.dept_code || this.managerDepartmentName;
          
          console.log('Manager department loaded:', {
            name: this.managerDepartmentName,
            code: this.managerDepartmentCode,
            id: this.managerDepartmentId
          });
          
          this.tabDepartments = [this.managerDepartmentName];
          this.activeTab = this.managerDepartmentName;
          
          // Load attendance data after department is loaded
          this.loadAttendanceData();
        } else {
          console.error('Invalid department response:', response);
          this.errorMessage = 'Failed to load your department information.';
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading manager department:', error);
        this.managerDepartmentName = 'My Department';
        this.tabDepartments = [this.managerDepartmentName];
        this.activeTab = this.managerDepartmentName;
        this.errorMessage = 'Failed to load department details, but proceeding with limited data.';
        this.loadAttendanceData();
      }
    });
  }

  private isDepartmentMatch(employeeDepartment: string, managerDepartment: string): boolean {
    if (!employeeDepartment || !managerDepartment) return false;

    // Normalize strings
    const empDept = employeeDepartment.toLowerCase().trim().replace(/\s+/g, ' ');
    const mgrDept = managerDepartment.toLowerCase().trim().replace(/\s+/g, ' ');

    console.log('Comparing departments:', { empDept, mgrDept });

    // Direct match
    if (empDept === mgrDept) {
      return true;
    }

    // Handle hierarchical department structure like "All Departments>E-CENTRIC"
    if (empDept.includes('>')) {
      const departmentParts = empDept.split('>');
      const lastPart = departmentParts[departmentParts.length - 1].trim().toLowerCase();
      
      if (lastPart === mgrDept) {
        return true;
      }
      
      // Check if any part matches the manager department
      return departmentParts.some(part => part.trim().toLowerCase() === mgrDept);
    }

    // Check for partial matches (e.g., "E-Centric" vs "E-CENTRIC")
    const empParts = empDept.split(/\s+|>|_|-/);
    const mgrParts = mgrDept.split(/\s+|>|_|-/);
    
    return empParts.some(part => mgrParts.includes(part)) || 
           mgrParts.some(part => empParts.includes(part));
  }

  // ===============================
  // EMPLOYEE DETAILS METHODS
  // ===============================

  private loadEmployeeDetails(empId: string): void {
    console.log('Loading employee details for empId:', empId);
    
    this.authService.getEmployeeByEmpId(empId).subscribe({
      next: (employeeData) => {
        console.log('Employee data from auth service:', employeeData);
        
        if (employeeData?.data) {
          this.processEmployeeData(employeeData.data);
        } else {
          this.loadEmployeeDetailsDirectAPI(empId);
        }
      },
      error: (error) => {
        console.error('Error fetching employee details from auth service:', error);
        this.loadEmployeeDetailsDirectAPI(empId);
      }
    });
  }

  private loadEmployeeDetailsDirectAPI(empId: string): void {
    console.log('Trying direct API call for employee details with empId:', empId);
    
    const possibleEndpoints = [
      `${environment.apiUrl}/api/v1/employees/${empId}`,
      `${environment.apiUrl}/api/v1/employee/${empId}`,
      `${environment.apiUrl}/api/v1/employees/by-id/${empId}`,
      `${environment.apiUrl}/api/v1/employees/details/${empId}`
    ];

    this.tryEmployeeEndpoints(possibleEndpoints, 0, empId);
  }

  private tryEmployeeEndpoints(endpoints: string[], index: number, empId: string): void {
    if (index >= endpoints.length) {
      console.warn('All employee API endpoints failed, using fallback name');
      this.currentUserName = 'Employee';
      return;
    }

    const endpoint = endpoints[index];
    console.log(`Trying endpoint ${index + 1}/${endpoints.length}:`, endpoint);

    this.http.get<any>(endpoint, this.httpOptions).subscribe({
      next: (response) => {
        console.log(`Success with endpoint ${index + 1}:`, response);
        
        const employeeData = response.data || response.employee || response;
        
        if (employeeData && (employeeData.firstName || employeeData.name)) {
          this.processEmployeeData(employeeData);
        } else {
          console.log(`Endpoint ${index + 1} returned data but no name info, trying next...`);
          this.tryEmployeeEndpoints(endpoints, index + 1, empId);
        }
      },
      error: (error) => {
        console.log(`Endpoint ${index + 1} failed:`, error.status, error.message);
        this.tryEmployeeEndpoints(endpoints, index + 1, empId);
      }
    });
  }

  private processEmployeeData(employeeData: any): void {
    console.log('Processing employee data:', employeeData);
    
    this.currentUserBranchId = employeeData.branchId || '';
    this.currentUserDepartmentId = employeeData.departmentId || employeeData.department?.id || '';

    let employeeName = '';
    
    if (employeeData.firstName || employeeData.lastName) {
      const firstName = employeeData.firstName || '';
      const lastName = employeeData.lastName || '';
      employeeName = `${firstName} ${lastName}`.trim();
    } else if (employeeData.fullName) {
      employeeName = employeeData.fullName.trim();
    } else if (employeeData.name) {
      employeeName = employeeData.name.trim();
    } else if (employeeData.employeeName) {
      employeeName = employeeData.employeeName.trim();
    }

    this.currentUserName = employeeName || 'Employee';

    console.log('Employee details processed:', {
      empId: this.currentUserEmpId,
      name: this.currentUserName,
      branchId: this.currentUserBranchId,
      departmentId: this.currentUserDepartmentId
    });
  }

  // ===============================
  // ATTENDANCE DATA LOADING METHODS - FIXED
  // ===============================

  loadAttendanceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    console.log('=== ATTENDANCE LOAD DEBUG ===');
    console.log('Current User:', {
      role: this.currentUserRole,
      empId: this.currentUserEmpId,
      userId: this.currentUserId,
      isEmployee: this.authService.isEmployee(),
      isManager: this.isManager,
      managerDepartmentId: this.managerDepartmentId,
      canManagerAccess: this.authService.canManagerAccessDepartment()
    });

    const isEmployee = this.authService.isEmployee();

    if (isEmployee && this.currentUserEmpId) {
      console.log('🔍 Employee detected - loading employee data...');
      this.loadEmployeeAttendanceData();
    } else if (this.isManager) {
      console.log('👔 Manager detected - checking access permissions...');
      
      if (!this.authService.canManagerAccessDepartment()) {
        this.errorMessage = 'Access restricted: No department assigned to your manager account.';
        this.isLoading = false;
        return;
      }
      
      console.log('✓ Manager access verified - loading department employee data like admin');
      // FIXED: Load manager data similar to admin without current month restriction
      this.loadLatestAttendanceForManagerDepartment();
    } else if (!isEmployee) {
      console.log('👥 Admin/HR detected - loading all employee data');
      this.loadLatestAttendanceForAllEmployees();
    } else {
      this.errorMessage = 'Employee ID not found. Please contact administrator.';
      this.isLoading = false;
    }
  }

  // FIXED: New method for manager to load latest available data
  private loadLatestAttendanceForManagerDepartment(): void {
    console.log('Loading latest attendance for manager department employees');

    const params: any = {
      page: (this.currentPage - 1).toString(),
      size: this.itemsPerPage.toString(),
      departmentId: this.managerDepartmentId
    };

    // Only apply date filter if specifically selected
    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      params.year = filterDate.getFullYear().toString();
      params.month = (filterDate.getMonth() + 1).toString();
      params.day = filterDate.getDate().toString();
      console.log('Manager using specific date filter:', params.day, '/', params.month, '/', params.year);
      
      this.loadManagerAttendanceWithDateFilter(params);
      return;
    }

    console.log('Manager loading latest available data (no date filter)');

    // First try the latest endpoint similar to admin
    this.http.get<any>(this.latestApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Latest endpoint failed for manager, trying monthly-grouped:', error);
          // Fallback to monthly-grouped without date restriction
          return this.http.get<any>(this.attendanceApiUrl, { params })
            .pipe(
              catchError((fallbackError: HttpErrorResponse) => {
                console.error('Monthly-grouped also failed for manager:', fallbackError);
                this.errorMessage = 'Failed to load attendance data for your department.';
                return of({ content: [] });
              })
            );
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Manager latest attendance response:', response);
          this.processAttendanceResponse(response, false);
        },
        error: (error) => {
          console.error('Error in manager latest attendance subscription:', error);
          this.isLoading = false;
          this.errorMessage = 'An error occurred while processing attendance data.';
          this.attendanceData = [];
        }
      });
  }

  // FIXED: Method for manager with date filter
  private loadManagerAttendanceWithDateFilter(params: any): void {
    this.http.get<any>(this.attendanceApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading manager date-filtered data:', error);
          this.errorMessage = `Failed to load attendance data for ${this.formatDateForDisplay(this.currentFilterDate!)} in your department.`;
          return of({ content: [] });
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Manager date-filtered attendance response:', response);
          const data = response.content ?? [];
          
          // If no data found for selected date, show appropriate message
          if (data.length === 0) {
            this.errorMessage = `No attendance records found for ${this.formatDateForDisplay(this.currentFilterDate!)} in ${this.managerDepartmentName}.`;
          }
          
          this.processAttendanceResponse(response, false);
        },
        error: (error) => {
          console.error('Error in manager date-filtered subscription:', error);
          this.isLoading = false;
          this.errorMessage = 'An error occurred while processing date-filtered attendance data.';
          this.attendanceData = [];
        }
      });
  }

  private loadEmployeeAttendanceData(): void {
    console.log('Loading employee-specific attendance data');

    const params: any = {
      employeeId: this.currentUserEmpId,
      page: (this.currentPage - 1).toString(),
      size: this.itemsPerPage.toString()
    };

    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      params.year = filterDate.getFullYear().toString();
      params.month = (filterDate.getMonth() + 1).toString();
      params.day = filterDate.getDate().toString();
      console.log('Using specific date filter:', params.day, '/', params.month, '/', params.year);
    } else {
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
      
      this.loadAllEmployeesWithDateFilter(params);
      return;
    }

    console.log('All employees API params:', params);

    this.http.get<any>(this.latestApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading latest attendance data:', error);
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

  private loadAllEmployeesWithDateFilter(params: any): void {
    console.log('Loading all employees with date filter using monthly-grouped endpoint');
    
    this.http.get<any>(this.attendanceApiUrl, { params })
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading date-filtered attendance data:', error);
          this.errorMessage = `Failed to load attendance data for ${this.formatDateForDisplay(this.currentFilterDate!)}. Please try again later.`;
          return of({ content: [] });
        })
      )
      .subscribe({
        next: (response) => {
          console.log('Date-filtered attendance response for all employees:', response);
          this.processAttendanceResponse(response, false);
        },
        error: (error) => {
          console.error('Error in date-filtered attendance subscription:', error);
          this.isLoading = false;
          this.errorMessage = 'An error occurred while processing date-filtered attendance data.';
          this.attendanceData = [];
        }
      });
  }

  private loadLatestAvailableMonthForEmployee(): void {
    console.log('Searching for latest available month for employee (excluding current month)');

    const currentDate = new Date();
    const monthsToTry = [];

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
      this.errorMessage = 'No attendance records found in the last 12 months for your employee ID.';
      this.isLoading = false;
      this.attendanceData = [];
      return;
    }

    const monthToTry = monthsToTry[index];

    const params: any = {
      employeeId: this.currentUserEmpId,
      year: monthToTry.year.toString(),
      month: monthToTry.month.toString(),
      page: '0',
      size: this.itemsPerPage.toString()
    };

    console.log(`📅 Trying month ${monthToTry.month}/${monthToTry.year} for employee:`, this.currentUserEmpId);

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

          const data = response.content !== undefined ? response.content : response;
          let hasData = false;

          if (Array.isArray(data) && data.length > 0) {
            if (data[0].employeeId && data[0].attendanceList) {
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
            console.log(`❌ No data for ${monthToTry.month}/${monthToTry.year}`);
            this.tryMonthsSequentially(monthsToTry, index + 1);
          }
        }
      });
  }

  private updateEmployeeMonthDisplay(month: number, year: number): void {
    this.currentDate = new Date(year, month - 1, 1);
    console.log(`Updated display to show data for ${month}/${year}`);
  }

  // ===============================
  // ATTENDANCE DATA PROCESSING - FIXED
  // ===============================

  private processAttendanceResponse(response: any, isEmployee: boolean): void {
    let data = response.content !== undefined ? response.content : response;

    console.log('Raw API response:', response);
    console.log('Raw data received:', data);
    console.log('Manager department for filtering:', this.managerDepartmentName);

    // Handle monthly-grouped response structure
    if (Array.isArray(data) && data.length > 0 && data[0].employeeId && data[0].attendanceList) {
      console.log('Processing monthly-grouped data structure');
      const flattenedData: any[] = [];

      data.forEach((employeeGroup: any) => {
        console.log('Processing employee group:', employeeGroup.employeeId);
        
        if (isEmployee) {
          // For employees, only include their own records
          if (employeeGroup.employeeId === this.currentUserEmpId) {
            let attendanceRecords = employeeGroup.attendanceList || [];
            if (this.currentFilterDate) {
              const filterDateStr = this.formatDateForComparison(this.currentFilterDate);
              attendanceRecords = attendanceRecords.filter((record: any) => {
                const recordDateStr = this.formatDateForComparison(record.attendanceDate);
                return recordDateStr === filterDateStr;
              });
            }
            flattenedData.push(...attendanceRecords);
          }
        } else if (this.isManager) {
          // For managers, filter by department - FIXED to show all dates properly
          const attendanceList = employeeGroup.attendanceList || [];
          console.log('Checking attendance list length:', attendanceList.length);
          
          // Check if any record in this employee's list belongs to manager's department
          const departmentMatches = attendanceList.filter((record: any) => {
            const matches = this.isDepartmentMatch(record.department, this.managerDepartmentName);
            console.log(`Department match for ${record.department} vs ${this.managerDepartmentName}:`, matches);
            return matches;
          });

          if (departmentMatches.length > 0) {
            if (this.currentFilterDate) {
              // FIXED: When date filter is applied, show records for that specific date
              const filterDateStr = this.formatDateForComparison(this.currentFilterDate);
              const dateFilteredRecords = departmentMatches.filter((record: any) => {
                const recordDateStr = this.formatDateForComparison(record.attendanceDate);
                return recordDateStr === filterDateStr;
              });
              flattenedData.push(...dateFilteredRecords);
            } else {
              // FIXED: When no date filter, get latest record per employee (like admin)
              const latestRecord = departmentMatches.sort((a: any, b: any) => 
                new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime()
              )[0];
              
              if (latestRecord) {
                console.log('Adding latest record for employee:', latestRecord);
                flattenedData.push(latestRecord);
              }
            }
          }
        } else {
          // For Admin/HR - include all records
          const attendanceList = employeeGroup.attendanceList || [];
          if (this.currentFilterDate) {
            const filterDate = new Date(this.currentFilterDate);
            const filteredRecords = attendanceList.filter((record: any) => {
              const recordDate = new Date(record.attendanceDate);
              return recordDate.getMonth() === filterDate.getMonth() && 
                     recordDate.getFullYear() === filterDate.getFullYear();
            });
            flattenedData.push(...filteredRecords);
          } else {
            // Get latest record per employee
            if (attendanceList.length > 0) {
              const latestRecord = attendanceList.sort((a: any, b: any) => 
                new Date(b.attendanceDate).getTime() - new Date(a.attendanceDate).getTime()
              )[0];
              flattenedData.push(latestRecord);
            }
          }
        }
      });

      data = flattenedData;
      console.log('Flattened data length:', data.length);
    }
    // Process the data based on user type for regular structure
    else if (!isEmployee && Array.isArray(data)) {
      console.log('Processing regular data structure');
      
      if (this.isManager) {
        // Filter data for manager's department
        data = data.filter((record: any) => {
          const matches = this.isDepartmentMatch(record.department, this.managerDepartmentName);
          console.log(`Regular structure - department match for ${record.department}:`, matches);
          return matches;
        });
        
        // FIXED: For managers without date filter, get latest record per employee
        if (!this.currentFilterDate) {
          data = this.extractLatestPerEmployee(data);
        }
      }
    }

    // FIXED: Validate and process attendance data ensuring date integrity
    this.attendanceData = this.validateAttendanceData(Array.isArray(data) ? data : []);
    
    console.log('Final attendance data length:', this.attendanceData.length);
    console.log('Sample processed record:', this.attendanceData[0]);

    // Sort data appropriately
    if (this.authService.isEmployee()) {
      this.attendanceData.sort((a, b) => 
        new Date(b.attendanceDate || '').getTime() - new Date(a.attendanceDate || '').getTime()
      );
    } else if (this.isManager) {
      this.attendanceData.sort((a, b) => {
        const nameA = this.getEmployeeFullName(a).toLowerCase();
        const nameB = this.getEmployeeFullName(b).toLowerCase();
        if (nameA === nameB) {
          return new Date(b.attendanceDate || '').getTime() - new Date(a.attendanceDate || '').getTime();
        }
        return nameA.localeCompare(nameB);
      });
    } else {
      this.attendanceData.sort((a, b) => 
        this.getEmployeeFullName(a).toLowerCase().localeCompare(this.getEmployeeFullName(b).toLowerCase())
      );
    }

    if (response.totalElements !== undefined) {
      this.itemsPerPage = response.size || this.itemsPerPage;
      this.currentPage = (response.number || 0) + 1;
    }

    // Handle empty state messages
    if (this.attendanceData.length === 0) {
      if (this.isManager) {
        if (this.currentFilterDate) {
          const filterDate = new Date(this.currentFilterDate);
          const monthName = filterDate.toLocaleString('default', { month: 'long' });
          const year = filterDate.getFullYear();
          this.errorMessage = `No attendance records found for employees in ${this.managerDepartmentName} for ${monthName} ${year}.`;
        } else {
          this.errorMessage = `No attendance records found for employees in ${this.managerDepartmentName}.`;
        }
      } else if (this.authService.isEmployee()) {
        this.errorMessage = 'No attendance records found for your profile.';
      } else {
        this.errorMessage = 'No employee attendance records found.';
      }
    }
    
    this.isLoading = false;
  }

  private formatDateForComparison(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0]; // Returns YYYY-MM-DD format
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

  // FIXED: Enhanced validation ensuring proper date handling
  private validateAttendanceData(data: any[]): EmployeeAttendance[] {
    console.log('Validating attendance data:', data.length, 'records');

    return data.map(item => {
      let departmentName = 'Unassigned';
      let displayDepartment = 'Unassigned';
      let branchId = '';
      let branchName = '';

      // Enhanced department parsing for the API response format
      if (item?.department && typeof item.department === 'string') {
        const dept = item.department.trim();
        
        // Handle hierarchical department structure like "All Departments>E-CENTRIC"
        if (dept.includes('>')) {
          const deptParts = dept.split('>');
          // Get the last part as the main department name
          departmentName = deptParts[deptParts.length - 1].trim();
          displayDepartment = departmentName;
          
          // For managers, ensure we show their department context
          if (this.isManager && this.managerDepartmentName) {
            // Check if this record belongs to manager's department
            if (this.isDepartmentMatch(dept, this.managerDepartmentName)) {
              displayDepartment = departmentName;
            }
          }
        } else {
          departmentName = dept;
          displayDepartment = dept;
        }
      } else if (item?.departmentId && this.formDepartments.length > 0) {
        const foundDept = this.formDepartments.find(d => d.dept_id === item.departmentId);
        if (foundDept) {
          departmentName = foundDept.dept_name;
          branchId = foundDept.branchId || foundDept.branch_name;
          branchName = foundDept.branch_name;
          displayDepartment = foundDept.dept_name;
        }
      }

      const isLate = this.isLateCheckIn(item.lateCheckInTime);

      // FIXED: Ensure attendanceDate is properly preserved
      let attendanceDate = this.safeString(item?.attendanceDate);
      
      // Additional validation for date format
      if (attendanceDate && !this.isValidDate(attendanceDate)) {
        console.warn('Invalid date detected:', attendanceDate, 'for record:', item);
        // Try to fix common date format issues
        attendanceDate = this.normalizeDate(attendanceDate);
      }

      const processedItem: EmployeeAttendance = {
        ...item,
        empCode: item?.empCode || '--',
        name: this.getEmployeeFullName(item),
        firstName: item?.firstName || '',
        lastName: item?.lastName || '',
        department: departmentName,
        displayDepartment: displayDepartment,
        departmentId: item?.departmentId,
        branchId: branchId,
        branchName: branchName,
        attendanceDate: attendanceDate, // FIXED: Properly preserve date
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
        isLate: isLate,
        attendanceGroup: item?.attendanceGroup || ''
      };

      return processedItem;
    }).filter(item => item !== null);
  }

  // FIXED: Add date validation helper methods
  private isValidDate(dateString: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  private normalizeDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      // Try to parse and format the date
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
      }
    } catch (error) {
      console.warn('Error normalizing date:', dateString, error);
    }
    
    return dateString; // Return original if can't normalize
  }

  // ===============================
  // UTILITY METHODS
  // ===============================

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

  formatDateForDisplay(dateString: string): string {
    try {
      const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch {
      return dateString;
    }
  }

  // ===============================
  // DATE FILTER METHODS - FIXED
  // ===============================

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

  private formatDateForInput(date: Date | string): string {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // FIXED: Apply date filter method
  applyDateFilter(): void {
    if (!this.canFilterByDate) return;

    const selectedDate = this.dateFilterForm.get('filterDate')?.value;
    this.currentFilterDate = selectedDate ? this.formatDate(new Date(selectedDate)) : null;
    this.showDateFilter = false;
    this.currentPage = 1;
    this.updateFilterCount();
    
    console.log('Date filter applied:', this.currentFilterDate);
    
    // FIXED: Reload data with the new date filter
    this.loadAttendanceData();
  }

  clearDateFilter(): void {
    if (!this.canFilterByDate) return;

    this.currentFilterDate = null;
    this.dateFilterForm.reset();
    this.showDateFilter = false;
    this.currentPage = 1;
    this.updateFilterCount();
    
    console.log('Date filter cleared, reloading data');
    
    // FIXED: Reload data without date filter
    this.loadAttendanceData();
  }

  // ===============================
  // FILTER MANAGEMENT METHODS
  // ===============================

  hasAppliedFilters(): boolean {
    if (this.authService.isEmployee()) {
      return this.currentFilterDate !== null ||
        (this.selectedStatus !== 'All Status' && this.canFilterByStatus);
    }

    if (this.isManager) {
      return this.currentFilterDate !== null ||
        (this.searchQuery.trim() !== '' && this.canSearch);
    }

    return this.currentFilterDate !== null ||
      (this.selectedBranchId !== '' && this.canViewAllBranches) ||
      (this.activeTab !== 'All Employee' && this.canViewAllDepartments) ||
      (this.selectedStatus !== 'All Status' && this.canFilterByStatus) ||
      (this.searchQuery.trim() !== '' && this.canSearch);
  }

  private updateFilterCount(): void {
    let count = 0;

    if (this.authService.isEmployee()) {
      if (this.selectedStatus !== 'All Status' && this.canFilterByStatus) count++;
      if (this.currentFilterDate) count++;
    } else if (this.isManager) {
      if (this.searchQuery.trim() !== '' && this.canSearch) count++;
      if (this.currentFilterDate) count++;
    } else {
      if (this.activeTab !== 'All Employee' && this.canViewAllDepartments) count++;
      if (this.selectedStatus !== 'All Status' && this.canFilterByStatus) count++;
      if (this.selectedBranchId !== '' && this.canViewAllBranches) count++;
      if (this.currentFilterDate) count++;
      if (this.searchQuery.trim() !== '' && this.canSearch) count++;
    }

    this.filterCount = count;
  }

  clearAllFilters(): void {
    console.log('Clearing all filters for role:', this.currentUserRole);

    if (this.canFilterByDate) {
      this.currentFilterDate = null;
      this.dateFilterForm.reset();
    }

    if (this.canSearch) {
      this.searchQuery = '';
    }

    if (!this.isManager) {
      if (this.canViewAllBranches) {
        this.selectedBranchId = '';
      }

      if (this.canViewAllDepartments) {
        this.activeTab = 'All Employee';
        this.selectedDivision = 'All Employee';
      }

      if (this.canFilterByStatus) {
        this.selectedStatus = 'All Status';
      }
    }

    this.currentPage = 1;
    this.updateFilterCount();
    
    this.errorMessage = '';

    if (this.authService.isEmployee()) {
      console.log('Employee - reloading data with default (latest available month)');
      this.loadAttendanceData();
    } else if (this.isManager) {
      console.log('Manager - reloading department data');
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

  // ===============================
  // DISPLAY AND UI METHODS
  // ===============================

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
    if (this.errorMessage && !this.errorMessage.includes('No')) return '';
    if (this.isLoading) return '';

    if (this.authService.isEmployee()) {
      if (this.currentFilterDate) {
        return `No attendance record found for ${this.formatDateForDisplay(this.currentFilterDate)}.`;
      }
      return 'No attendance records found for your profile.';
    }

    if (this.isManager) {
      if (this.currentFilterDate) {
        const filterDate = new Date(this.currentFilterDate);
        const monthName = filterDate.toLocaleString('default', { month: 'long' });
        const year = filterDate.getFullYear();
        return `No employee attendance records found in ${this.managerDepartmentName} for ${monthName} ${year}.`;
      }

      const filtersApplied = [];
      if (this.searchQuery.trim() !== '' && this.canSearch) filtersApplied.push('search');

      if (filtersApplied.length > 0) {
        return `No employees found in ${this.managerDepartmentName} matching the search criteria.`;
      }

      return `No recent attendance records found for employees in ${this.managerDepartmentName}.`;
    }

    if (this.currentFilterDate) {
      const filterDate = new Date(this.currentFilterDate);
      const monthName = filterDate.toLocaleString('default', { month: 'long' });
      const year = filterDate.getFullYear();
      return `No employee attendance records found for ${monthName} ${year}.`;
    }

    const filtersApplied = [];
    if (this.selectedBranchId !== '' && this.canViewAllBranches) filtersApplied.push('branch');
    if (this.activeTab !== 'All Employee' && this.canViewAllDepartments) filtersApplied.push('department');
    if (this.selectedStatus !== 'All Status' && this.canFilterByStatus) filtersApplied.push('status');
    if (this.searchQuery.trim() !== '' && this.canSearch) filtersApplied.push('search');

    if (filtersApplied.length > 0) {
      return `No employees found matching the applied ${filtersApplied.join(', ')} filter(s).`;
    }

    return 'No employee attendance records found.';
  }

  get filteredAttendance(): EmployeeAttendance[] {
    if (!this.attendanceData?.length) return [];

    let filtered = [...this.attendanceData];

    if (this.canFilterByStatus && this.selectedStatus !== 'All Status') {
      filtered = filtered.filter(item => item.status === this.selectedStatus);
    }

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

  // ===============================
  // PAGINATION METHODS
  // ===============================

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

  // ===============================
  // SEARCH AND FILTER METHODS
  // ===============================

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

  // ===============================
  // BRANCH AND DEPARTMENT METHODS
  // ===============================

  async loadBranches(): Promise<void> {
    // Reset any previous error messages
    this.errorMessage = '';
    
    // If branches are already loaded, return early
    if (this.branches && this.branches.length > 0) {
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
      
      // Extract branches data from response
      this.branches = response?.data || [];
      
      // Optional: Sort branches by name
      this.branches.sort((a, b) => a.name?.localeCompare(b.name) || 0);
      
    } catch (error) {
      console.error('Unexpected error loading branches:', error);
      this.errorMessage = 'An unexpected error occurred while loading branches.';
      this.branches = [];
    }
  }

  private loadDepartments(branchId?: string): Promise<void> {
    if (!this.canViewAllDepartments && !this.isManager) {
      this.formDepartments = [];
      this.filteredDepartments = [];
      this.tabDepartments = ['My Attendance'];
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      let url = this.deptApiUrl;
      
      if (this.isManager && this.managerDepartmentId) {
        url = `${this.deptApiUrl}/${this.managerDepartmentId}`;
      } else if (branchId) {
        url = `${this.deptApiUrl}/branch/${branchId}`;
      }

      this.http.get<{ success: boolean, message: string, data: any }>(url, this.httpOptions)
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
            if (response.success) {
              if (this.isManager && this.managerDepartmentId) {
                this.formDepartments = [response.data];
                this.filteredDepartments = [response.data];
                this.departmentMap = {
                  [response.data.dept_id]: response.data.dept_name
                };
                this.tabDepartments = [response.data.dept_name];
                this.activeTab = response.data.dept_name;
              } else if (Array.isArray(response.data)) {
                this.formDepartments = response.data;
                this.filteredDepartments = [...response.data];
                this.departmentMap = {};
                this.tabDepartments = ['All Employee', ...response.data.map(dept => dept.dept_name)];
                response.data.forEach(dept => {
                  this.departmentMap[dept.dept_id] = dept.dept_name;
                });
              }
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

  // ===============================
  // PDF EXPORT METHOD
  // ===============================

  exportToPdf(): void {
    if (!this.canExport) return;

    const doc = new jsPDF({ orientation: 'landscape' });

    let title = '';

    if (this.currentUserRole === 'EMPLOYEE') {
      title = 'My Attendance Report';

      if (this.currentFilterDate) {
        const formattedDate = this.formatDateForDisplay(this.currentFilterDate);
        title += ` - ${formattedDate}`;
      } else {
        const monthName = this.currentDate.toLocaleString('default', { month: 'long' });
        const year = this.currentDate.getFullYear();
        title += ` - ${monthName} ${year}`;
      }
    } else if (this.isManager) {
      title = `${this.managerDepartmentName} Department Attendance Report`;
      
      if (this.searchQuery) title += ` [Search: "${this.searchQuery}"]`;

      if (this.currentFilterDate) {
        const filterDate = new Date(this.currentFilterDate);
        const monthName = filterDate.toLocaleString('default', { month: 'long' });
        const year = filterDate.getFullYear();
        title += ` [${monthName} ${year}]`;
      }
    } else {
      title = 'Employee Attendance Report';
      
      if (this.activeTab !== 'All Employee') title += ` - ${this.activeTab}`;
      if (this.selectedStatus !== 'All Status') title += ` (${this.selectedStatus})`;
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

    if (this.isManager) {
      doc.setFontSize(12);
      doc.setTextColor(50);
      doc.text(`Department: ${this.managerDepartmentName}`, 14, 28);
      doc.text(`Manager: ${this.currentUserName || 'N/A'}`, 14, 34);
    }

    const columns = [];

    if (this.currentUserRole === 'EMPLOYEE') {
      columns.push({ header: 'Employee', dataKey: 'employeeName' });
      columns.push({ header: 'Emp Code', dataKey: 'empCode' });
      columns.push({ header: 'Date', dataKey: 'attendanceDate' });
      columns.push({ header: 'Clock In', dataKey: 'actualCheckInTime' });
      columns.push({ header: 'Clock Out', dataKey: 'actualCheckOutTime' });
      columns.push({ header: 'Late Check-In', dataKey: 'lateCheckInTime' });
      columns.push({ header: 'Over Time', dataKey: 'overTime' });
    } else {
      columns.push({ header: 'Emp ID', dataKey: 'empCode' });
      columns.push({ header: 'Employee', dataKey: 'employeeName' });
      columns.push({ header: 'Department', dataKey: 'department' });
      columns.push({ header: 'Date', dataKey: 'attendanceDate' });
      columns.push({ header: 'Shift', dataKey: 'timePeriod' });
      columns.push({ header: 'Status', dataKey: 'status' });
      columns.push({ header: 'Clock In', dataKey: 'actualCheckInTime' });
      columns.push({ header: 'Clock Out', dataKey: 'actualCheckOutTime' });
      columns.push({ header: 'Late Check-In', dataKey: 'lateCheckInTime' });
      columns.push({ header: 'Over Time', dataKey: 'overTime' });
    }

    const tableData = this.filteredAttendance.map(item => {
      const data: any = {
        empCode: String(item.empCode || '--'),
        employeeName: String(this.getEmployeeFullName(item)),
        department: String(item.displayDepartment || item.department || 'Unassigned'),
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
      startY: this.isManager ? 40 : 30,
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
        }
      }
    });

    let filename = '';

    if (this.currentUserRole === 'EMPLOYEE') {
      filename = 'My_Attendance';
    } else if (this.isManager) {
      filename = `${this.managerDepartmentName.replace(/[^a-zA-Z0-9]/g, '_')}_Department_Attendance`;
      if (this.searchQuery) filename += `_Search_${this.searchQuery.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}`;
    } else {
      filename = 'Employee_Attendance';
      if (this.activeTab !== 'All Employee') filename += `_${this.activeTab.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (this.selectedStatus !== 'All Status') filename += `_${this.selectedStatus.replace(/[^a-zA-Z0-9]/g, '_')}`;
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
      const day = filterDate.getDate().toString().padStart(2, '0');
      filename += `_${year}_${month}_${day}`;
    } else if (this.currentUserRole === 'EMPLOYEE') {
      const year = this.currentDate.getFullYear();
      const month = (this.currentDate.getMonth() + 1).toString().padStart(2, '0');
      filename += `_${year}_${month}`;
    }

    filename += `_${new Date().toISOString().slice(0, 10)}.pdf`;

    doc.save(filename);
  }

  // ===============================
  // ENHANCED HELPER METHODS
  // ===============================

  /**
   * Get appropriate search placeholder text based on user role
   */
  getSearchPlaceholder(): string {
    if (this.isManager && this.managerDepartmentName) {
      return `Search employees in ${this.managerDepartmentName}...`;
    } else if (this.isManager) {
      return 'Search unavailable - no department assigned';
    } else if (this.currentUserRole === 'EMPLOYEE') {
      return 'Search your attendance records...';
    } else {
      return 'Search by name, ID, or department...';
    }
  }

  /**
   * TrackBy function for better Angular performance in *ngFor
   */
  trackByEmployee(index: number, emp: EmployeeAttendance): any {
    return emp.employeeId || emp.empCode || emp.id || index;
  }

  /**
   * Get status badge class for consistent styling
   */
  getStatusBadgeClass(status: string): string {
    const statusClasses: { [key: string]: string } = {
      'Present': 'bg-success',
      'Late': 'bg-warning text-dark',
      'Absent': 'bg-danger',
      'Early Departure': 'bg-secondary',
      'Leave': 'bg-info',
      'Holiday': 'bg-primary',
      'Weekend': 'bg-light text-dark'
    };
    
    return statusClasses[status] || 'bg-light text-dark';
  }

  /**
   * Get current month name for display
   */
  getCurrentMonthDisplay(): string {
    const date = this.currentFilterDate ? new Date(this.currentFilterDate) : this.currentDate;
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  // ===============================
  // DEBUG METHODS
  // ===============================

  debugDepartmentFiltering(): void {
    if (environment.production) return;
    
    console.log('=== DEPARTMENT FILTERING DEBUG ===');
    console.log('Manager Department Name:', this.managerDepartmentName);
    console.log('Manager Department ID:', this.managerDepartmentId);
    console.log('Manager Department Code:', this.managerDepartmentCode);
    
    const testDepartments = [
      'All Departments>Drivers',
      'Drivers',
      'drivers',
      'All Departments>Finance',
      'Finance',
      'HR Department'
    ];
    
    testDepartments.forEach(dept => {
      const matches = this.isDepartmentMatch(dept, this.managerDepartmentName);
      console.log(`"${dept}" matches "${this.managerDepartmentName}": ${matches}`);
    });
  }

  debugUserPermissions(): void {
    if (environment.production) return;
    
    const user = this.authService.getCurrentUser();
    console.log('=== USER PERMISSIONS DEBUG ===');
    console.log('Current User:', user);
    console.log('Access Level:', this.authService.getUserAccessLevel());
    console.log('Role Checks:', {
      isAdmin: this.authService.isAdmin(),
      isCTO: this.authService.isCTO(),
      isEmployee: this.authService.isEmployee(),
      isManager: this.authService.isManager(),
      isManagerDeptHead: this.authService.isManagerDeptHead(),
      canManagerAccess: this.authService.canManagerAccessDepartment(),
      hasAdminAccess: this.authService.hasAdminAccess(),
      canViewAllEmployees: this.authService.canViewAllEmployees(),
      canExportData: this.authService.canExportData()
    });
    console.log('Component Permissions:', {
      canViewAllBranches: this.canViewAllBranches,
      canViewAllDepartments: this.canViewAllDepartments,
      canViewAllEmployees: this.canViewAllEmployees,
      canSearch: this.canSearch,
      canExport: this.canExport,
      canFilterByStatus: this.canFilterByStatus,
      canFilterByDate: this.canFilterByDate
    });
    console.log('Manager Details:', {
      isManager: this.isManager,
      managerDepartmentId: this.managerDepartmentId,
      managerDepartmentName: this.managerDepartmentName
    });
  }

  // ===============================
  // EVENT LISTENERS
  // ===============================

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