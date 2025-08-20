import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AttendanceSheetService } from 'src/app/services/attendance-sheet.service';
import { CsvExportService } from 'src/app/demo/dashboard/csv-export.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface AttendanceRecord {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  attendanceGroup: string;
  attendanceDate: string;
  dayOfWeek: string;
  timePeriod: string;
  requiredCheckInDate: string;
  requiredCheckInTime: string;
  requiredCheckOutDate: string;
  requiredCheckOutTime: string;
  actualCheckInTime: string;
  actualCheckOutTime: string;
  totalDuration: string;
  empCode: string;
  employeeId: string;
  graceCheckInTime: string;
  lateCheckInTime: string;
  earlyTime: string;
  overTime: string;
}

interface EmployeeAttendanceData {
  employeeId: string;
  name: string;
  designation: string;
  records: AttendanceDisplayRecord[];
}

interface AttendanceDisplayRecord {
  date: number;
  day: string;
  shift: string;
  dayStatus: 'PP' | 'AA' | 'XX' | 'PA' | '--' | '';
  checkIn: string;
  checkOut: string;
  breakTime: string;
  workingHours: string;
  extraHours: string;
  lateTime: string;
  earlyTime: string;
}

@Component({
  selector: 'app-view-employee',
  templateUrl: './view-employee.component.html',
  styleUrls: ['./view-employee.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class ViewEmployeeComponent implements OnInit, OnDestroy {
  private subscription = new Subscription();
  
  // Role-based access properties
  currentUserRole: string = 'EMPLOYEE';
  currentUserId: string = '';
  currentUserEmpId: string = '';
  currentUserName: string = '';

  // Permission flags
  canViewAllEmployeesFlag: boolean = false;
  canViewAllDepartments: boolean = false;
  canSearch: boolean = false;
  canExport: boolean = false;
  canFilterByDate: boolean = false;

  // Manager specific properties
  isManager: boolean = false;
  managerDepartmentId: string = '';
  managerDepartmentName: string = '';
  managerDepartmentCode: string = '';
  
  // Component state
  employeeId: string = '';
  isViewAll: boolean = false;
  employees: EmployeeAttendanceData[] = [];
  
  // UI state
  isLoading: boolean = true;
  errorMessage: string = '';
  currentPage: number = 1;
  itemsPerPage: number = 10;
  totalItems: number = 0;
  
  // Date filters from query params
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number = new Date().getMonth() + 1;
  selectedDepartment: string = 'All';
  currentMonthName: string = '';
  
  // Calendar headers
  dynamicWeekHeaders: string[] = [];
  dynamicDateHeaders: number[] = [];
  daysInMonth: number = 31;
  weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  // Available options for filters
  availableYears: number[] = [];
  availableDepartments: string[] = ['All'];
  availableMonths = [
    { name: 'January', value: 1 }, { name: 'February', value: 2 }, { name: 'March', value: 3 },
    { name: 'April', value: 4 }, { name: 'May', value: 5 }, { name: 'June', value: 6 },
    { name: 'July', value: 7 }, { name: 'August', value: 8 }, { name: 'September', value: 9 },
    { name: 'October', value: 10 }, { name: 'November', value: 11 }, { name: 'December', value: 12 }
  ];

  // Current user info
  currentUser: any = null;
  currentUserRoleBasedId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private attendanceService: AttendanceSheetService,
    private csvExportService: CsvExportService,
    private authService: AuthService
  ) {
    // Initialize available years - include more previous years for historical data
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 3; year <= currentYear + 1; year++) {
      this.availableYears.push(year);
    }
  }

  ngOnInit(): void {
    this.initializeUserRoleAndPermissions();
    
    // Get route parameters
    this.employeeId = this.route.snapshot.paramMap.get('id') || '';
    this.isViewAll = this.employeeId === 'all';
    
    // For employees, they can only view their own data
    if (this.isEmployeeRole() && this.employeeId !== this.currentUserRoleBasedId) {
      if (this.isViewAll) {
        // Redirect to their own data instead of all employees
        this.router.navigate(['/employees', this.currentUserRoleBasedId], {
          queryParams: this.route.snapshot.queryParams
        });
        return;
      } else {
        // They're trying to view someone else's data
        this.errorMessage = 'You can only view your own attendance data.';
        this.isLoading = false;
        return;
      }
    }

    // For managers, restrict access based on department
    if (this.isManager && !this.managerDepartmentId) {
      this.errorMessage = 'Access restricted: No department assigned to your manager account.';
      this.isLoading = false;
      return;
    }
    
    // Get query parameters
    const queryParams = this.route.snapshot.queryParams;
    this.selectedYear = queryParams['year'] ? parseInt(queryParams['year']) : new Date().getFullYear();
    this.selectedMonth = queryParams['month'] ? parseInt(queryParams['month']) : new Date().getMonth() + 1;
    this.selectedDepartment = queryParams['department'] || 'All';
    const hasData = queryParams['hasData'] === 'true';
    
    this.currentMonthName = this.availableMonths[this.selectedMonth - 1]?.name || '';
    
    // Always generate headers first, even before loading data
    this.generateMonthHeaders();
    
    // Load available departments
    this.loadAvailableDepartments();
    
    // Load data based on route - if coming from summary with data, use the same logic
    if (hasData) {
      // Use the same loading strategy as the attendance sheet
      this.loadAttendanceDataWithFallback();
    } else {
      // Regular data loading
      this.loadAttendanceData();
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
      this.currentUserName = currentUser.username || '';

      // Manager checks
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

        if (this.managerDepartmentId) {
          this.loadManagerDepartmentDetails();
        }
      }

      // Get current user based ID
      this.currentUserRoleBasedId = this.authService.roleBasedId;

      console.log('User initialized:', {
        role: this.currentUserRole,
        userId: this.currentUserId,
        empId: this.currentUserEmpId,
        isManager: this.isManager,
        managerDepartmentId: this.managerDepartmentId,
        roleBasedId: this.currentUserRoleBasedId
      });

      if (this.currentUserRole === 'EMPLOYEE' && this.currentUserEmpId) {
        this.loadEmployeeDetails(this.currentUserEmpId);
      }
    } else {
      this.currentUserRole = 'EMPLOYEE';
      console.warn('No user found in auth service, defaulting to EMPLOYEE role');
    }

    this.setPermissionsBasedOnRole();
  }

  private setPermissionsBasedOnRole(): void {
    if (this.authService.hasAdminAccess()) {
      this.canViewAllEmployeesFlag = true;
      this.canViewAllDepartments = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByDate = true;
    } else if (this.authService.isHR()) {
      this.canViewAllEmployeesFlag = true;
      this.canViewAllDepartments = true;
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByDate = true;
    } else if (this.authService.isManager() && this.managerDepartmentId) {
      this.canViewAllEmployeesFlag = false; // Can only view department employees
      this.canViewAllDepartments = false; // Can only view their department
      this.canSearch = true;
      this.canExport = true;
      this.canFilterByDate = true;
    } else if (this.authService.isManager() && !this.managerDepartmentId) {
      this.canViewAllEmployeesFlag = false;
      this.canViewAllDepartments = false;
      this.canSearch = false;
      this.canExport = false;
      this.canFilterByDate = false;
    } else if (this.authService.isEmployee()) {
      this.canViewAllEmployeesFlag = false;
      this.canViewAllDepartments = false;
      this.canSearch = false;
      this.canExport = true;
      this.canFilterByDate = true;
    } else {
      this.canViewAllEmployeesFlag = false;
      this.canViewAllDepartments = false;
      this.canSearch = false;
      this.canExport = false;
      this.canFilterByDate = false;
    }
  }

  private loadManagerDepartmentDetails(): void {
    if (!this.managerDepartmentId) return;

    console.log('Loading manager department details for ID:', this.managerDepartmentId);
    
    const sub = this.attendanceService.getDepartmentById(this.managerDepartmentId).subscribe({
      next: (response) => {
        console.log('Manager department response:', response);
        
        if (response && response.success && response.data) {
          this.managerDepartmentName = response.data.dept_name || response.data.name || 'My Department';
          this.managerDepartmentCode = response.data.dept_code || this.managerDepartmentName;
        } else if (response && (response.dept_name || response.name)) {
          // Direct response format
          this.managerDepartmentName = response.dept_name || response.name || 'My Department';
          this.managerDepartmentCode = response.dept_code || this.managerDepartmentName;
        } else {
          console.error('Invalid department response:', response);
          this.managerDepartmentName = 'My Department';
          this.managerDepartmentCode = this.managerDepartmentName;
        }
        
        console.log('Manager department loaded:', {
          name: this.managerDepartmentName,
          code: this.managerDepartmentCode,
          id: this.managerDepartmentId
        });
      },
      error: (error) => {
        console.error('Error loading manager department:', error);
        this.managerDepartmentName = 'My Department';
        this.managerDepartmentCode = this.managerDepartmentName;
      }
    });
    
    this.subscription.add(sub);
  }

  private loadEmployeeDetails(empId: string): void {
    console.log('Loading employee details for empId:', empId);
    
    this.authService.getEmployeeByEmpId(empId).subscribe({
      next: (employeeData) => {
        console.log('Employee data from auth service:', employeeData);
        
        if (employeeData?.data) {
          this.processEmployeeDataForDetails(employeeData.data);
        }
      },
      error: (error) => {
        console.error('Error fetching employee details from auth service:', error);
        this.currentUserName = 'Employee';
      }
    });
  }

  private processEmployeeDataForDetails(employeeData: any): void {
    console.log('Processing employee data:', employeeData);
    
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

    this.currentUserName = employeeName || this.currentUserName || 'Employee';

    console.log('Employee details processed:', {
      empId: this.currentUserEmpId,
      name: this.currentUserName
    });
  }

  // Role-based access control methods
  canViewAllEmployeesCheck(): boolean {
    if (!this.currentUser && !this.authService.getCurrentUser()) return false;
    
    if (this.authService.hasAdminAccess()) return true;
    if (this.authService.isHR()) return true;
    if (this.authService.isManager() && this.managerDepartmentId) return true; // Can view department employees
    
    return false;
  }

  isEmployeeRole(): boolean {
    return this.authService.isEmployee();
  }

  getCurrentEmployeeName(): string {
    if (this.employees.length > 0) {
      return this.employees[0].name;
    }
    return this.currentUserName || 'Unknown';
  }

  // Pagination for employees
  get paginatedEmployees(): EmployeeAttendanceData[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.employees.slice(startIndex, endIndex);
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

  private loadAttendanceDataWithFallback(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Determine what data to load based on role and route
    let loadData$;
    
    console.log('=== VIEW EMPLOYEE LOAD DEBUG ===');
    console.log('Current User:', {
      role: this.currentUserRole,
      empId: this.currentUserEmpId,
      userId: this.currentUserId,
      isEmployee: this.authService.isEmployee(),
      isManager: this.isManager,
      managerDepartmentId: this.managerDepartmentId,
      isViewAll: this.isViewAll,
      employeeId: this.employeeId
    });
    
    if (this.isEmployeeRole() && this.currentUserRoleBasedId) {
      // Employee role - load only their data
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.currentUserRoleBasedId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => data ? [data] : []),
        catchError(error => {
          console.warn('Employee API call failed:', error);
          return of([]);
        })
      );
    } else if (this.isViewAll && this.canViewAllEmployeesCheck()) {
      if (this.isManager) {
        // Manager viewing all employees in their department
        loadData$ = this.attendanceService.getAllAttendanceData(
          this.selectedYear, 
          this.selectedMonth, 
          undefined // Load all and filter by department manually
        ).pipe(
          catchError(error => {
            console.warn('API call failed for manager viewing all:', error);
            return of([]);
          })
        );
      } else {
        // Admin/HR viewing all employees
        loadData$ = this.attendanceService.getAllAttendanceData(
          this.selectedYear, 
          this.selectedMonth, 
          this.selectedDepartment === 'All' ? undefined : this.selectedDepartment
        ).pipe(
          catchError(error => {
            console.warn('API call failed for selected month:', error);
            return of([]);
          })
        );
      }
    } else if (!this.isViewAll && this.canViewAllEmployeesCheck()) {
      // Load specific employee data (Admin/HR/Manager viewing specific employee)
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.employeeId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => data ? [data] : []),
        catchError(error => {
          console.warn('API call failed for specific employee:', error);
          return of([]);
        })
      );
    } else {
      // No access
      this.errorMessage = 'You do not have permission to view this attendance data.';
      this.isLoading = false;
      return;
    }

    const sub = loadData$.subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          this.processLoadedData(data);
          this.isLoading = false;
        } else {
          // No data for selected month, try to find latest available data
          this.loadLatestAvailableDataLikeSheet();
        }
      },
      error: (error) => {
        console.error('Error loading attendance data:', error);
        this.loadLatestAvailableDataLikeSheet();
      }
    });
    
    this.subscription.add(sub);
  }

  private loadLatestAvailableDataLikeSheet(): void {
    // Always generate headers for current selection first
    this.generateMonthHeaders();
    
    const currentDate = new Date();
    const monthsToCheck = Array.from({ length: 12 }, (_, i) => {
      const checkDate = new Date();
      checkDate.setMonth(checkDate.getMonth() - i);
      return { year: checkDate.getFullYear(), month: checkDate.getMonth() + 1 };
    });

    // Try each month to find available data (same logic as attendance sheet)
    this.tryLoadMonthData(monthsToCheck, 0);
  }

  private loadAvailableDepartments(): void {
    // Load departments for the current filters
    const sub = this.attendanceService.getAttendanceGroups(this.selectedYear, this.selectedMonth)
      .subscribe({
        next: (departments) => {
          if (this.isManager && this.managerDepartmentName) {
            this.availableDepartments = [this.managerDepartmentName];
          } else {
            this.availableDepartments = departments;
          }
        },
        error: () => {
          if (this.isManager && this.managerDepartmentName) {
            this.availableDepartments = [this.managerDepartmentName];
          } else {
            this.availableDepartments = ['All', 'HR', 'IT', 'Finance', 'Marketing'];
          }
        }
      });
    this.subscription.add(sub);
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  private generateMonthHeaders(): void {
    this.daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    this.dynamicDateHeaders = [];
    this.dynamicWeekHeaders = [];

    for (let day = 1; day <= this.daysInMonth; day++) {
      const date = new Date(this.selectedYear, this.selectedMonth - 1, day);
      const dayOfWeek = this.weekDays[date.getDay()];
      
      this.dynamicDateHeaders.push(day);
      this.dynamicWeekHeaders.push(dayOfWeek);
    }
  }

  private loadAttendanceData(): void {
    this.isLoading = true;
    this.errorMessage = '';

    // Determine what data to load based on role and route
    let loadData$;
    
    if (this.isEmployeeRole() && this.currentUserRoleBasedId) {
      // Employee role - load only their data
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.currentUserRoleBasedId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => data ? [data] : []),
        catchError(error => {
          console.warn('Employee API call failed:', error);
          return of([]);
        })
      );
    } else if (this.isViewAll && this.canViewAllEmployeesCheck()) {
      if (this.isManager) {
        // Manager viewing all employees in their department
        loadData$ = this.attendanceService.getAllAttendanceData(
          this.selectedYear, 
          this.selectedMonth, 
          undefined // Load all and filter by department manually
        ).pipe(
          catchError(error => {
            console.warn('API call failed for manager viewing all:', error);
            return of([]);
          })
        );
      } else {
        // Admin/HR viewing all employees
        loadData$ = this.attendanceService.getAllAttendanceData(
          this.selectedYear, 
          this.selectedMonth, 
          this.selectedDepartment === 'All' ? undefined : this.selectedDepartment
        ).pipe(
          catchError(error => {
            console.warn('API call failed for selected month:', error);
            return of([]);
          })
        );
      }
    } else if (!this.isViewAll && this.canViewAllEmployeesCheck()) {
      // Load specific employee data
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.employeeId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => data ? [data] : []),
        catchError(error => {
          console.warn('API call failed for specific employee:', error);
          return of([]);
        })
      );
    } else {
      // No access
      this.errorMessage = 'You do not have permission to view this attendance data.';
      this.isLoading = false;
      return;
    }

    const sub = loadData$.subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          this.processLoadedData(data);
          this.isLoading = false;
        } else {
          // No data for selected month, try to find latest available data
          this.loadLatestAvailableData();
        }
      },
      error: (error) => {
        console.error('Error loading attendance data:', error);
        this.loadLatestAvailableData();
      }
    });
    
    this.subscription.add(sub);
  }

  private loadLatestAvailableData(): void {
    // Always generate headers for current selection first
    this.generateMonthHeaders();
    
    const currentDate = new Date();
    const monthsToCheck = Array.from({ length: 12 }, (_, i) => {
      const checkDate = new Date();
      checkDate.setMonth(checkDate.getMonth() - i);
      return { year: checkDate.getFullYear(), month: checkDate.getMonth() + 1 };
    });

    // Try each month to find available data
    this.tryLoadMonthData(monthsToCheck, 0);
  }

  private tryLoadMonthData(monthsToCheck: {year: number, month: number}[], index: number): void {
    if (index >= monthsToCheck.length) {
      // No data found in any month
      this.errorMessage = this.isEmployeeRole() ? 
        'No attendance data found for your account in the last 12 months' : 
        (this.isViewAll ? 
          (this.isManager ? `No attendance data found for ${this.managerDepartmentName} department in the last 12 months` : 'No attendance data found for any employees in the last 12 months') : 
          'No attendance data found for this employee in the last 12 months');
      this.employees = [];
      this.isLoading = false;
      return;
    }

    const { year, month } = monthsToCheck[index];
    
    // Determine what data to load based on role and route
    let loadData$;
    
    if (this.isEmployeeRole() && this.currentUserRoleBasedId) {
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.currentUserRoleBasedId,
        year,
        month
      ).pipe(
        map(data => ({ data: data ? [data] : [], year, month })),
        catchError(() => of({ data: [], year, month }))
      );
    } else if (this.isViewAll && this.canViewAllEmployeesCheck()) {
      if (this.isManager) {
        loadData$ = this.attendanceService.getAllAttendanceData(
          year, 
          month, 
          undefined // Load all and filter manually
        ).pipe(
          map(data => ({ data, year, month })),
          catchError(() => of({ data: [], year, month }))
        );
      } else {
        loadData$ = this.attendanceService.getAllAttendanceData(
          year, 
          month, 
          this.selectedDepartment === 'All' ? undefined : this.selectedDepartment
        ).pipe(
          map(data => ({ data, year, month })),
          catchError(() => of({ data: [], year, month }))
        );
      }
    } else if (!this.isViewAll && this.canViewAllEmployeesCheck()) {
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.employeeId,
        year,
        month
      ).pipe(
        map(data => ({ data: data ? [data] : [], year, month })),
        catchError(() => of({ data: [], year, month }))
      );
    } else {
      this.errorMessage = 'You do not have permission to view this attendance data.';
      this.isLoading = false;
      return;
    }
    
    const sub = loadData$.subscribe({
      next: ({ data, year, month }) => {
        if (data && data.length > 0) {
          // Found data! Update the selected month/year and process (same as attendance sheet)
          this.selectedYear = year;
          this.selectedMonth = month;
          this.currentMonthName = this.availableMonths[month - 1]?.name || '';
          this.generateMonthHeaders();
          this.processLoadedData(data);
          this.isLoading = false;
        } else {
          // Try next month
          this.tryLoadMonthData(monthsToCheck, index + 1);
        }
      },
      error: () => {
        // Try next month on error
        this.tryLoadMonthData(monthsToCheck, index + 1);
      }
    });
    
    this.subscription.add(sub);
  }

  private processLoadedData(data: any[]): void {
    if (this.isViewAll && this.canViewAllEmployeesCheck()) {
      // Load all employees - apply manager department filter if needed
      if (this.isManager) {
        const filteredData = data.filter((emp: any) => {
          if (emp.attendanceList && emp.attendanceList.length > 0) {
            const attendanceGroup = emp.attendanceList[0]?.attendanceGroup?.trim() || '';
            return this.isDepartmentMatch(attendanceGroup, this.managerDepartmentName);
          }
          return false;
        });
        
        this.employees = filteredData
          .filter((emp: any) => emp.attendanceList && emp.attendanceList.length > 0)
          .map((emp: any) => this.processEmployeeData(emp));
      } else {
        this.employees = data
          .filter((emp: any) => emp.attendanceList && emp.attendanceList.length > 0)
          .map((emp: any) => this.processEmployeeData(emp));
      }
    } else {
      // Load specific employee data
      if (this.isEmployeeRole()) {
        // For employees, find their own data
        const employeeData = data.find((emp: any) => emp.employeeId === this.currentUserRoleBasedId);
        if (employeeData && employeeData.attendanceList) {
          this.employees = [this.processEmployeeData(employeeData)];
        } else {
          this.errorMessage = `No attendance data found for your account.`;
          this.employees = [];
        }
      } else {
        // For HR/Manager/Admin viewing specific employee
        const employeeData = data.find((emp: any) => emp.employeeId === this.employeeId);
        if (employeeData && employeeData.attendanceList) {
          // For managers, check if this employee belongs to their department
          if (this.isManager) {
            const attendanceGroup = employeeData.attendanceList[0]?.attendanceGroup?.trim() || '';
            if (!this.isDepartmentMatch(attendanceGroup, this.managerDepartmentName)) {
              this.errorMessage = `Employee not found in your department (${this.managerDepartmentName}).`;
              this.employees = [];
              return;
            }
          }
          this.employees = [this.processEmployeeData(employeeData)];
        } else {
          this.errorMessage = `No attendance data found for employee ID: ${this.employeeId}`;
          this.employees = [];
        }
      }
    }
    this.totalItems = this.employees.length;
  }

  private processEmployeeData(employeeData: any): EmployeeAttendanceData {
    const employee: EmployeeAttendanceData = {
      employeeId: employeeData.employeeId || '',
      name: `${employeeData.attendanceList[0]?.firstName || ''} ${employeeData.attendanceList[0]?.lastName || ''}`.trim(),
      designation: employeeData.attendanceList[0]?.attendanceGroup || employeeData.attendanceList[0]?.department?.split('>').pop() || 'Not specified',
      records: new Array(this.daysInMonth).fill(null).map((_, index) => {
        const date = new Date(this.selectedYear, this.selectedMonth - 1, index + 1);
        const isFutureDate = date > new Date();
        const isSunday = date.getDay() === 0;

        if (isSunday) {
          return {
            date: index + 1,
            day: 'Sun',
            shift: '--',
            dayStatus: '--',
            checkIn: '--',
            checkOut: '--',
            breakTime: '--',
            workingHours: '--',
            extraHours: '--',
            lateTime: '--',
            earlyTime: '--'
          };
        }

        if (isFutureDate) {
          return {
            date: index + 1,
            day: this.weekDays[date.getDay()],
            shift: '',
            dayStatus: '',
            checkIn: '',
            checkOut: '',
            breakTime: '',
            workingHours: '',
            extraHours: '',
            lateTime: '',
            earlyTime: ''
          };
        }

        return {
          date: index + 1,
          day: this.weekDays[date.getDay()],
          shift: '1',
          dayStatus: 'AA',
          checkIn: '00:00',
          checkOut: '00:00',
          breakTime: '00:00',
          workingHours: '00:00',
          extraHours: '00:00',
          lateTime: '00:00',
          earlyTime: '00:00'
        };
      })
    };

    // Process actual attendance data
    if (employeeData.attendanceList && Array.isArray(employeeData.attendanceList)) {
      employeeData.attendanceList.forEach(attendance => {
        const attendanceDate = new Date(attendance.attendanceDate);
        const dayOfMonth = attendanceDate.getDate() - 1;

        if (dayOfMonth >= 0 && dayOfMonth < this.daysInMonth) {
          const dayOfWeek = this.weekDays[attendanceDate.getDay()];
          
          if (dayOfWeek === 'Sun') return;

          let dayStatus = 'AA';
          if (attendance.actualCheckInTime && attendance.actualCheckOutTime &&
              attendance.actualCheckInTime !== '00:00:00' && attendance.actualCheckOutTime !== '00:00:00') {
            const workingHours = this.parseTimeToMinutes(attendance.totalDuration);
            
            if (dayOfWeek === 'Sat') {
              dayStatus = workingHours >= 240 ? 'PP' : 'AA';
            } else {
              if (workingHours >= 480) dayStatus = 'PP';
              else if (workingHours >= 240) dayStatus = 'PA';
              else dayStatus = 'AA';
            }
          }

          employee.records[dayOfMonth] = {
            date: dayOfMonth + 1,
            day: dayOfWeek,
            shift: '1',
            dayStatus: dayStatus as any,
            checkIn: this.formatTime(attendance.actualCheckInTime || '00:00:00'),
            checkOut: this.formatTime(attendance.actualCheckOutTime || '00:00:00'),
            breakTime: '00:00',
            workingHours: this.formatTime(attendance.totalDuration || '00:00:00'),
            extraHours: this.formatTime(attendance.overTime || '00:00:00'),
            lateTime: this.formatTime(attendance.lateCheckInTime || '00:00:00'),
            earlyTime: this.formatTime(attendance.earlyTime || '00:00:00')
          };
        }
      });
    }

    return employee;
  }

  private parseTimeToMinutes(timeString: string): number {
    if (!timeString) return 0;
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      return hours * 60 + minutes;
    }
    return 0;
  }

  private formatTime(timeString: string): string {
    if (!timeString) return '00:00';
    const parts = timeString.split(':');
    if (parts.length >= 2) {
      return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
    }
    return '00:00';
  }

  // Filter change handlers
  onFilterChange(): void {
    this.currentPage = 1;
    this.currentMonthName = this.availableMonths[this.selectedMonth - 1]?.name || '';
    this.generateMonthHeaders();
    this.loadAttendanceData();
  }

  resetFilters(): void {
    const today = new Date();
    // Reset to previous month instead of current month for better data availability
    const previousMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    
    this.selectedYear = previousMonth.getFullYear();
    this.selectedMonth = previousMonth.getMonth() + 1;
    
    // For managers, keep their department
    if (this.isManager && this.managerDepartmentName) {
      this.selectedDepartment = this.managerDepartmentName;
    } else {
      this.selectedDepartment = 'All';
    }
    
    this.currentPage = 1;
    this.currentMonthName = this.availableMonths[this.selectedMonth - 1]?.name || '';
    this.generateMonthHeaders();
    this.loadAttendanceData();
  }

  // Pagination
  get totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    window.scrollTo(0, 0);
  }

  // Utility methods
  getStatusClass(status: string): string {
    switch (status) {
      case 'AA': return 'status-absent';
      case 'XX': return 'status-irregular';
      case 'PA': return 'status-half';
      case 'PP': return 'status-present';
      case '--': return 'status-holiday';
      default: return '';
    }
  }

  // Export methods
  exportToExcel(): void {
    if (!this.employees || this.employees.length === 0) {
      alert('No data available to export');
      return;
    }

    const monthName = this.availableMonths[this.selectedMonth - 1]?.name || 'Unknown';
    
    this.csvExportService.exportAttendanceToCSV(
      this.employees,
      this.dynamicDateHeaders,
      this.dynamicWeekHeaders,
      monthName,
      this.selectedYear,
      this.selectedDepartment
    );
  }

  exportToPDF(): void {
    console.log('PDF export functionality to be implemented');
    // TODO: Implement PDF export using libraries like jsPDF
  }

  // Navigation
  goBack(): void {
    this.router.navigate(['/attendence/attendance-sheet']);
  }

  // Helper method for getting appropriate error/no data messages
  getNoDataMessage(): string {
    if (this.isEmployeeRole()) {
      return 'No attendance data available for your account for the selected period';
    } else if (this.isManager) {
      if (this.isViewAll) {
        return `No attendance data available for employees in ${this.managerDepartmentName} for the selected period`;
      } else {
        return `No attendance data available for this employee in ${this.managerDepartmentName} for the selected period`;
      }
    } else {
      if (this.isViewAll) {
        return 'No attendance data available for any employees for the selected period';
      } else {
        return 'No attendance data available for this employee for the selected period';
      }
    }
  }
}