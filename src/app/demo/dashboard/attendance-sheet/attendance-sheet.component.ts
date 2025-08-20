import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';

// Export the component as default for lazy loading
export { AttendanceSheetComponent as default };
import { Router } from '@angular/router';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceSheetService } from '../../../services/attendance-sheet.service';
import { CsvExportService } from '../../../demo/dashboard/csv-export.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, of, from } from 'rxjs';
import { catchError, finalize, tap, filter, take, map, concatMap } from 'rxjs/operators';

Chart.register(...registerables);

interface EmployeeSummary {
  employeeId: string;
  name: string;
  designation: string;
  department: string;
  totals: {
    fullDay: number;
    halfDay: number;
    presentDay: number;
    absentDay: number;
    leaves: number;
    lateDays: number;
    holidays: number;
    earlyDays: number;
    latePenalty: number;
    penalty: number;
    extraHours: number;
    totalWorkHours: number;
  };
}

@Component({
  selector: 'app-attendance-sheet',
  templateUrl: './attendance-sheet.component.html',
  styleUrls: ['./attendance-sheet.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class AttendanceSheetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('attendanceChart', { static: false }) chartRef!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;
  private subscription: Subscription = new Subscription();

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

  // Configuration
  currentDepartment = 'All Departments';
  currentYear = new Date().getFullYear();
  currentMonth = new Date().toLocaleString('default', { month: 'long' });

  // Loading states
  isLoading = false;
  hasError = false;
  errorMessage = '';

  // Filter properties
  selectedDepartment = 'All Departments';
  selectedYear = this.currentYear;
  selectedMonth = new Date().getMonth() + 1;

  // Search properties
  searchName = '';
  searchDepartment = '';

  // Available filter options
  availableYears: number[] = [];
  availableMonths: { value: number, name: string }[] = [];
  departments: string[] = ['All Departments'];

  // Statistics
  attendanceRatio = 0;
  dailyAttendanceData: number[] = [];
  daysInMonth = 31;
  dynamicDateHeaders: number[] = [];

  // Summary data
  summary: any = {};
  employees: EmployeeSummary[] = [];
  filteredEmployees: EmployeeSummary[] = [];

  // Pagination
  currentPage = 1;
  itemsPerPage = 6;
  totalItems = 0;

  // Current user info
  currentUser: any = null;
  currentUserRoleBasedId: string | null = null;

  constructor(
    private attendanceService: AttendanceSheetService, 
    private csvExportService: CsvExportService, 
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.initializeUserRoleAndPermissions();
    this.initializeFilters();
    this.loadAvailableDates();
    this.loadAttendanceData();
  }

  ngAfterViewInit() {
    setTimeout(() => this.initChart(), 100);
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    this.subscription.unsubscribe();
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

        if (!this.managerDepartmentId) {
          console.warn('Manager has no department assigned');
          this.errorMessage = 'Access restricted: No department assigned to your manager account.';
          this.isLoading = false;
          return;
        }

        // Load manager department details
        this.loadManagerDepartmentDetails();
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
    if (!this.managerDepartmentId) {
      this.errorMessage = 'No department assigned to your manager account.';
      this.isLoading = false;
      return;
    }

    console.log('Loading manager department details for ID:', this.managerDepartmentId);
    
    const sub = this.attendanceService.getDepartmentById(this.managerDepartmentId).subscribe({
      next: (response) => {
        console.log('Manager department response:', response);
        
        if (response && response.success && response.data) {
          this.managerDepartmentName = response.data.dept_name || response.data.name || 'My Department';
          this.managerDepartmentCode = response.data.dept_code || this.managerDepartmentName;
          
          console.log('Manager department loaded:', {
            name: this.managerDepartmentName,
            code: this.managerDepartmentCode,
            id: this.managerDepartmentId
          });
          
          // Update current department display
          this.currentDepartment = this.managerDepartmentName;
          this.selectedDepartment = this.managerDepartmentName;
          this.departments = [this.managerDepartmentName];
        } else if (response && (response.dept_name || response.name)) {
          // Direct response format
          this.managerDepartmentName = response.dept_name || response.name || 'My Department';
          this.managerDepartmentCode = response.dept_code || this.managerDepartmentName;
          this.currentDepartment = this.managerDepartmentName;
          this.selectedDepartment = this.managerDepartmentName;
          this.departments = [this.managerDepartmentName];
        } else {
          console.error('Invalid department response:', response);
          this.managerDepartmentName = 'My Department';
          this.currentDepartment = this.managerDepartmentName;
          this.selectedDepartment = this.managerDepartmentName;
          this.departments = [this.managerDepartmentName];
        }
      },
      error: (error) => {
        console.error('Error loading manager department:', error);
        this.managerDepartmentName = 'My Department';
        this.currentDepartment = this.managerDepartmentName;
        this.selectedDepartment = this.managerDepartmentName;
        this.departments = [this.managerDepartmentName];
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
          this.processEmployeeData(employeeData.data);
        }
      },
      error: (error) => {
        console.error('Error fetching employee details from auth service:', error);
        this.currentUserName = 'Employee';
      }
    });
  }

  private processEmployeeData(employeeData: any): void {
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
  canViewAllEmployees(): boolean {
    if (!this.currentUser && !this.authService.getCurrentUser()) return false;
    
    if (this.authService.hasAdminAccess()) return true;
    if (this.authService.isHR()) return true;
    if (this.authService.isManager() && this.managerDepartmentId) return true; // Can view department employees
    
    return false;
  }

  isEmployeeRole(): boolean {
    return this.authService.isEmployee();
  }

  private initializeFilters(): void {
    const currentDate = new Date();
    // Set to previous month by default to show historical data
    // const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    this.selectedYear = currentDate.getFullYear();
    this.selectedMonth = currentDate.getMonth() + 1;
    
    // For managers, set department filter
    if (this.isManager && this.managerDepartmentName) {
      this.selectedDepartment = this.managerDepartmentName;
      this.currentDepartment = this.managerDepartmentName;
    } else {
      this.selectedDepartment = 'All Departments';
      this.currentDepartment = 'All Departments';
    }
    
    this.currentYear = this.selectedYear;
    this.currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  }

  private loadAvailableDates(): void {
    const sub = this.attendanceService.getAvailableDates().subscribe({
      next: (data) => {
        this.availableYears = data.years;
        this.availableMonths = data.months;
        
        if (!this.selectedYear && this.availableYears.length > 0) {
          this.selectedYear = this.availableYears[this.availableYears.length - 1];
        }
        
        if (!this.selectedMonth && this.availableMonths.length > 0) {
          this.selectedMonth = this.availableMonths[0].value;
        }
        
        const selectedMonthObj = this.availableMonths.find(m => m.value === this.selectedMonth);
        this.currentMonth = selectedMonthObj ? selectedMonthObj.name : this.currentMonth;
      },
      error: () => {
        this.availableYears = [this.currentYear - 3, this.currentYear - 2, this.currentYear - 1, this.currentYear, this.currentYear + 1];
        this.availableMonths = [
          { value: 1, name: 'January' }, { value: 2, name: 'February' }, { value: 3, name: 'March' },
          { value: 4, name: 'April' }, { value: 5, name: 'May' }, { value: 6, name: 'June' },
          { value: 7, name: 'July' }, { value: 8, name: 'August' }, { value: 9, name: 'September' },
          { value: 10, name: 'October' }, { value: 11, name: 'November' }, { value: 12, name: 'December' }
        ];
      }
    });
    this.subscription.add(sub);
  }

  onFilterChange(): void {
    this.currentYear = this.selectedYear;
    const selectedMonthObj = this.availableMonths.find(m => m.value === this.selectedMonth);
    this.currentMonth = selectedMonthObj ? selectedMonthObj.name : 'Month';
    
    // For managers, maintain their department selection
    if (this.isManager && this.managerDepartmentName) {
      this.currentDepartment = this.managerDepartmentName;
    } else {
      this.currentDepartment = this.selectedDepartment === 'All Departments' ? 'All Departments' : this.selectedDepartment;
    }
    
    this.loadAttendanceData();
  }

  resetFilters(): void {
    const currentDate = new Date();
    // Reset to previous month instead of current month
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    this.selectedYear = previousMonth.getFullYear();
    this.selectedMonth = previousMonth.getMonth() + 1;
    
    // For managers, keep their department
    if (this.isManager && this.managerDepartmentName) {
      this.selectedDepartment = this.managerDepartmentName;
      this.currentDepartment = this.managerDepartmentName;
    } else {
      this.selectedDepartment = 'All Departments';
      this.currentDepartment = 'All Departments';
    }
    
    this.clearSearch();
    this.onFilterChange();
  }

  // Search functionality
  onSearchChange(): void {
    this.currentPage = 1; // Reset to first page when searching
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchName = '';
    this.searchDepartment = '';
    this.applyFilters();
  }

  private applyFilters(): void {
    this.filteredEmployees = this.employees.filter(employee => {
      const nameMatch = !this.searchName || 
        employee.name.toLowerCase().includes(this.searchName.toLowerCase());
      
      const deptMatch = !this.searchDepartment || 
        employee.designation.toLowerCase().includes(this.searchDepartment.toLowerCase()) ||
        employee.department.toLowerCase().includes(this.searchDepartment.toLowerCase());
      
      return nameMatch && deptMatch;
    });
    
    this.totalItems = this.filteredEmployees.length;
  }

  // Pagination for filtered employees
  get paginatedEmployees(): EmployeeSummary[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredEmployees.slice(startIndex, endIndex);
  }

  private loadAttendanceData(): void {
    this.isLoading = true;
    this.hasError = false;
    this.errorMessage = '';
    this.currentPage = 1;
    this.employees = [];
    this.filteredEmployees = [];
    this.summary = {};
    
    // Update current year and month based on selection
    this.currentYear = this.selectedYear;
    const selectedMonthObj = this.availableMonths.find(m => m.value === this.selectedMonth);
    this.currentMonth = selectedMonthObj ? selectedMonthObj.name : 'Month';
    
    // Always generate headers first with the selected month and year
    this.generateMonthHeaders(this.selectedMonth, this.selectedYear);

    // Determine what data to load based on role
    let loadData$;
    
    console.log('=== ATTENDANCE SHEET LOAD DEBUG ===');
    console.log('Loading data for:', {
      year: this.selectedYear,
      month: this.selectedMonth,
      monthName: this.currentMonth,
      role: this.currentUserRole,
      empId: this.currentUserEmpId,
      isManager: this.isManager,
      managerDepartmentId: this.managerDepartmentId
    });

    if (this.isEmployeeRole() && this.currentUserRoleBasedId) {
      console.log('🔒 Employee detected - loading employee data...');
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.currentUserRoleBasedId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => {
          console.log('Employee data received:', data);
          return data ? [data] : [];
        }),
        catchError(error => {
          console.warn('Employee API call failed:', error);
          return of([]);
        })
      );
    } else if (this.isManager) {
      console.log('👔 Manager detected - checking access permissions...');
      
      if (!this.authService.canManagerAccessDepartment()) {
        this.errorMessage = 'Access restricted: No department assigned to your manager account.';
        this.isLoading = false;
        return;
      }
      
      console.log('✅ Manager access verified - loading department employee data');
      loadData$ = this.attendanceService.getAllAttendanceData(
        this.selectedYear,
        this.selectedMonth,
        undefined // Don't filter by attendanceGroup parameter, we'll filter manually
      ).pipe(
        map(data => {
          console.log(`Manager data received for ${this.selectedMonth}/${this.selectedYear}:`, data);
          return data || [];
        }),
        catchError(error => {
          console.warn('Manager API call failed:', error);
          return of([]);
        })
      );
    } else if (this.canViewAllEmployees()) {
      console.log('👥 Admin/HR detected - loading all employee data');
      loadData$ = this.attendanceService.getAllAttendanceData(
        this.selectedYear,
        this.selectedMonth,
        this.selectedDepartment === 'All Departments' ? undefined : this.selectedDepartment
      ).pipe(
        map(data => {
          console.log(`Admin/HR data received for ${this.selectedMonth}/${this.selectedYear}:`, data);
          return data || [];
        }),
        catchError(error => {
          console.warn('API call failed:', error);
          return of([]);
        })
      );
    } else {
      this.errorMessage = 'You do not have permission to view attendance data.';
      this.isLoading = false;
      return;
    }

    const sub = loadData$.subscribe({
      next: (data) => {
        console.log('Processing attendance data:', data);
        if (data && data.length > 0) {
          this.processAttendanceData(data);
          this.applyFilters();
          this.updateChartData();
          this.hasError = false;
        } else {
          console.log(`No data found for ${this.selectedMonth}/${this.selectedYear}`);
          this.hasError = true;
          this.errorMessage = `No attendance data available for the selected period (${this.availableMonths[this.selectedMonth - 1]?.name || 'Month'} ${this.selectedYear}).`;
          this.employees = [];
          this.filteredEmployees = [];
          this.summary = {};
          this.updateChartData();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading attendance data:', error);
        this.hasError = true;
        this.errorMessage = 'An error occurred while loading attendance data. Please try again later.';
        this.employees = [];
        this.filteredEmployees = [];
        this.summary = {};
        this.updateChartData();
        this.isLoading = false;
      }
    });
    
    this.subscription.add(sub);
  }

  private loadLatestAvailableData(): void {
    // Always generate headers for current selection first
    this.generateMonthHeaders(this.selectedMonth, this.selectedYear);
    
    const currentDate = new Date();
    const monthsToCheck = Array.from({ length: 12 }, (_, i) => {
      const checkDate = new Date();
      checkDate.setMonth(checkDate.getMonth() - i);
      return { year: checkDate.getFullYear(), month: checkDate.getMonth() + 1 };
    });

    const sub = from(monthsToCheck).pipe(
      concatMap(({ year, month }) => {
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
        } else if (this.isManager) {
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
            this.selectedDepartment === 'All Departments' ? undefined : this.selectedDepartment
          ).pipe(
            map(data => ({ data, year, month })),
            catchError(() => of({ data: [], year, month }))
          );
        }
        
        return loadData$;
      }),
      filter((result: { data: any[], year: number, month: number }) => result.data && result.data.length > 0),
      take(1)
    ).subscribe({
      next: (result: { data: any[], year: number, month: number }) => {
        // Found data! Update to show the actual month with data
        this.selectedYear = result.year;
        this.selectedMonth = result.month;
        this.currentYear = result.year;
        
        const monthObj = this.availableMonths.find(m => m.value === result.month);
        this.currentMonth = monthObj ? monthObj.name : new Date(result.year, result.month - 1, 1).toLocaleString('default', { month: 'long' });
        
        this.generateMonthHeaders(result.month, result.year);
        this.processAttendanceData(result.data);
        this.applyFilters();
        this.updateChartData();
        this.hasError = false;
      },
      error: () => {
        // Even on error, show the headers with empty data
        this.hasError = true;
        this.errorMessage = this.isEmployeeRole() 
          ? 'No attendance data available for your account in recent months.'
          : this.isManager
          ? `No attendance data available for ${this.managerDepartmentName} department in recent months.`
          : 'No attendance data available for any recent months.';
        this.employees = [];
        this.filteredEmployees = [];
        this.updateChartData();
      },
      complete: () => this.isLoading = false
    });

    this.subscription.add(sub);
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

  private processAttendanceData(data: any[]) {
    this.employees = [];
    
    if (data && data.length > 0) {
      const uniqueAttendanceGroups = new Set<string>();
      
      data.forEach(employeeData => {
        if (employeeData.attendanceList && employeeData.attendanceList.length > 0) {
          const attendanceGroup = employeeData.attendanceList[0]?.attendanceGroup;
          if (attendanceGroup && attendanceGroup.trim() !== '') {
            uniqueAttendanceGroups.add(attendanceGroup.trim());
          }
        }
      });

      const sortedDepartments = Array.from(uniqueAttendanceGroups).sort();
      
      // For managers, only show their department
      if (this.isManager && this.managerDepartmentName) {
        this.departments = [this.managerDepartmentName];
      } else {
        this.departments = ['All Departments', ...sortedDepartments];
      }

      data.forEach(employeeData => {
        if (employeeData.attendanceList && employeeData.attendanceList.length > 0) {
          const attendanceGroup = employeeData.attendanceList[0]?.attendanceGroup?.trim() || '';
          
          // For employees, they can only see their own data
          if (this.isEmployeeRole()) {
            const employeeId = employeeData.employeeId || employeeData.attendanceList[0]?.employeeId || '';
            if (employeeId === this.currentUserRoleBasedId) {
              this.processEmployeeAttendance(employeeData);
            }
          } else if (this.isManager) {
            // For managers, filter by department match
            const shouldInclude = this.isDepartmentMatch(attendanceGroup, this.managerDepartmentName);
            console.log(`Manager filter: ${attendanceGroup} matches ${this.managerDepartmentName}:`, shouldInclude);
            
            if (shouldInclude) {
              this.processEmployeeAttendance(employeeData);
            }
          } else {
            // For HR, Manager, Admin - apply department filter
            const shouldInclude = !this.selectedDepartment || 
              this.selectedDepartment === 'All Departments' || 
              attendanceGroup === this.selectedDepartment;

            if (shouldInclude) {
              this.processEmployeeAttendance(employeeData);
            }
          }
        }
      });
    } else {
      // For managers, show their department even if no data
      if (this.isManager && this.managerDepartmentName) {
        this.departments = [this.managerDepartmentName];
      } else {
        this.departments = ['All Departments'];
      }
    }

    this.updateSummary();
  }

  private processEmployeeAttendance(employeeData: any) {
    // Extract department information - prioritize attendanceGroup, then department field
    let departmentName = 'Not specified';
    if (employeeData.attendanceList && employeeData.attendanceList.length > 0) {
      const attendance = employeeData.attendanceList[0];
      
      departmentName = attendance.attendanceGroup || 
                     attendance.department || 
                     'Not specified';
    }

    const employee: EmployeeSummary = {
      employeeId: employeeData.employeeId || employeeData.attendanceList[0]?.employeeId || '',
      name: `${employeeData.attendanceList[0]?.firstName || ''} ${employeeData.attendanceList[0]?.lastName || ''}`.trim(),
      designation: employeeData.attendanceList[0]?.department?.split('>').pop() || '',
      department: departmentName,
      totals: {
        fullDay: 0, halfDay: 0, presentDay: 0, absentDay: 0, leaves: 0,
        lateDays: 0, holidays: 0, earlyDays: 0, latePenalty: 0, penalty: 0,
        extraHours: 0, totalWorkHours: 0
      }
    };

    const daysInMonth = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
    
    if (employeeData.attendanceList && Array.isArray(employeeData.attendanceList)) {
      employeeData.attendanceList.forEach(attendance => {
        const attendanceDate = new Date(attendance.attendanceDate);
        const dayOfWeek = attendanceDate.getDay();
        
        if (dayOfWeek === 0) { // Sunday
          employee.totals.holidays++;
          return;
        }

        let dayStatus = 'AA';
        if (attendance.actualCheckInTime && attendance.actualCheckOutTime &&
            attendance.actualCheckInTime !== '00:00:00' && attendance.actualCheckOutTime !== '00:00:00') {
          const workingHours = this.parseTimeToMinutes(attendance.totalDuration);
          
          if (dayOfWeek === 6) { // Saturday
            dayStatus = workingHours >= 240 ? 'PP' : 'AA';
          } else {
            if (workingHours >= 480) dayStatus = 'PP';
            else if (workingHours >= 240) dayStatus = 'PA';
            else dayStatus = 'AA';
          }
        }

        this.updateEmployeeTotals(employee, dayStatus, attendance);
      });
    }

    this.employees.push(employee);
  }

  private updateEmployeeTotals(employee: EmployeeSummary, dayStatus: string, attendance: any) {
    switch (dayStatus) {
      case 'PP':
        employee.totals.presentDay++;
        employee.totals.fullDay++;
        break;
      case 'PA':
        employee.totals.presentDay++;
        employee.totals.halfDay++;
        break;
      case 'AA':
        employee.totals.absentDay++;
        break;
    }

    if (attendance.lateCheckInTime && attendance.lateCheckInTime !== '00:00:00') {
      employee.totals.lateDays++;
      employee.totals.latePenalty += this.parseTimeToMinutes(attendance.lateCheckInTime);
    }

    if (attendance.earlyTime && attendance.earlyTime !== '00:00:00') {
      employee.totals.earlyDays++;
      employee.totals.latePenalty += this.parseTimeToMinutes(attendance.earlyTime);
    }

    if (attendance.totalDuration && attendance.totalDuration !== '00:00:00') {
      employee.totals.totalWorkHours += this.parseTimeToMinutes(attendance.totalDuration) / 60;
    }

    if (attendance.overTime && attendance.overTime !== '00:00:00') {
      employee.totals.extraHours += this.parseTimeToMinutes(attendance.overTime) / 60;
    }
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

  private updateSummary() {
    this.summary = {
      fullDays: this.employees.reduce((sum, emp) => sum + emp.totals.fullDay, 0),
      halfDays: this.employees.reduce((sum, emp) => sum + emp.totals.halfDay, 0),
      presentDays: this.employees.reduce((sum, emp) => sum + emp.totals.presentDay, 0),
      absentDays: this.employees.reduce((sum, emp) => sum + emp.totals.absentDay, 0),
      leaves: 0,
      lateDays: this.employees.reduce((sum, emp) => sum + emp.totals.lateDays, 0),
      holidays: this.employees.reduce((sum, emp) => sum + emp.totals.holidays, 0),
      earlyDays: this.employees.reduce((sum, emp) => sum + emp.totals.earlyDays, 0),
      totalLateEarlyPenalty: this.employees.reduce((sum, emp) => sum + emp.totals.latePenalty, 0),
      appliedPenalty: 0,
      overTime: this.employees.reduce((sum, emp) => sum + emp.totals.extraHours, 0),
      totalWorkHours: this.employees.reduce((sum, emp) => sum + emp.totals.totalWorkHours, 0)
    };

    const totalWorkingDays = this.calculateWorkingDays(this.selectedMonth, this.selectedYear);
    const presentDays = this.summary.presentDays;
    const totalPossibleDays = totalWorkingDays * Math.max(1, this.employees.length);
    
    let ratio = 0;
    if (totalPossibleDays > 0 && !isNaN(presentDays)) {
      ratio = (presentDays / totalPossibleDays) * 100;
    }
    
    this.attendanceRatio = isNaN(ratio) ? 0 : Math.min(Math.max(0, Math.round(ratio)), 100);
  }

  private calculateWorkingDays(month: number, year: number): number {
    let workingDays = 0;
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    return workingDays;
  }

  private generateMonthHeaders(month?: number, year?: number): void {
    const selectedMonth = month || this.selectedMonth;
    const selectedYear = year || this.selectedYear;
    this.daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    this.dynamicDateHeaders = Array.from({ length: this.daysInMonth }, (_, i) => i + 1);
  }

  private updateChartData() {
    this.dailyAttendanceData = [];
    
    for (let i = 0; i < this.daysInMonth; i++) {
      let dailyCount = 0;
      this.employees.forEach(employee => {
        const baseAttendance = 8;
        const variation = Math.floor(Math.random() * 3) - 1;
        dailyCount = Math.max(6, Math.min(10, baseAttendance + variation));
      });
      this.dailyAttendanceData.push(dailyCount);
    }

    if (this.chart) {
      this.chart.data.labels = this.dynamicDateHeaders;
      this.chart.data.datasets[0].data = this.dailyAttendanceData;
      this.chart.update();
    }
  }

  initChart() {
    if (this.chart) this.chart.destroy();
    if (!this.chartRef?.nativeElement) return;

    const ctx = this.chartRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.dynamicDateHeaders,
        datasets: [{
          label: 'Daily Attendance',
          data: this.dailyAttendanceData,
          backgroundColor: 'rgba(121, 134, 203, 1)',
          borderColor: 'rgba(121, 134, 203, 1)',
          borderWidth: 1,
          borderRadius: 4,
          maxBarThickness: 20
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, max: 10, ticks: { stepSize: 2 }, grid: { display: false } },
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } }
        },
        plugins: { legend: { display: false } }
      }
    });
  }

  // View functions
  viewEmployeeDetails(employeeId?: string): void {
    if (employeeId) {
      // Navigate to individual employee view with the current loaded data context
      this.router.navigate(['/employees', employeeId], {
        queryParams: {
          year: this.selectedYear,
          month: this.selectedMonth,
          department: this.selectedDepartment === 'All Departments' ? undefined : this.selectedDepartment
        }
      });
    } else {
      // Navigate to view all employees - pass the current context data
      this.router.navigate(['/employees/all'], {
        queryParams: {
          year: this.selectedYear,
          month: this.selectedMonth,
          department: this.selectedDepartment === 'All Departments' ? undefined : this.selectedDepartment,
          // Add a flag to indicate we have data loaded
          hasData: this.employees.length > 0 ? 'true' : 'false'
        }
      });
    }
  }

  // Utility functions
  formatTimeDisplay(hours: number): string {
    const totalMinutes = Math.round(hours * 60);
    if (totalMinutes < 60) return `${totalMinutes} min`;
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return mins === 0 ? `${hrs} hrs` : `${hrs}.${Math.round((mins / 60) * 10)} hrs`;
  }

  calculateAppliedPenalty(totalPenaltyMinutes: number): string {
    const penaltyDays = Math.floor((totalPenaltyMinutes / 60) / 8);
    return penaltyDays > 0 ? (penaltyDays === 1 ? '1 Day' : `${penaltyDays} Days`) : '--';
  }

  exportToExcel() { 
    if (!this.filteredEmployees || this.filteredEmployees.length === 0) {
      alert('No data available to export');
      return;
    }

    const monthName = this.availableMonths[this.selectedMonth - 1]?.name || 'Unknown';
    
    // Export filtered employees based on search
    this.csvExportService.exportSummaryToCSV(
      this.filteredEmployees,
      monthName,
      this.selectedYear,
      this.selectedDepartment
    );
  }

  exportToPDF() { 
    console.log('Exporting to PDF...'); 
  }

  printReport() { 
    window.print(); 
  }

  // Pagination
  get totalPages(): number {
    return this.totalItems > 0 ? Math.ceil(this.totalItems / this.itemsPerPage) : 1;
  }

  get pageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  // Helper method for no data message
  getNoDataMessage(): string {
    if (this.searchName || this.searchDepartment) {
      if (this.isManager) {
        return `No employees found in ${this.managerDepartmentName} matching your search criteria`;
      }
      return 'No employees found matching your search criteria';
    }
    
    if (this.isEmployeeRole()) {
      return 'No attendance data available for your account for the selected period';
    } else if (this.isManager) {
      return `No attendance data available for ${this.managerDepartmentName} department for the selected period`;
    } else {
      return 'No attendance data available for the selected period';
    }
  }
}
  // Override canViewAllEmployees method for template usage
  // canViewAllEmployees(): boolean {
  //   return this.canViewAllEmployeesCheck();
  // }