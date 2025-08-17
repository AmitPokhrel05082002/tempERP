import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AttendanceSheetService } from 'src/app/services/attendance-sheet.service';
import { CsvExportService } from 'src/app/demo/dashboard/csv-export.service';
import { AuthService } from '../../../core/services/auth.service';
import { Subscription, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

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
    // Get current user info
    this.currentUser = this.authService.getCurrentUser();
    this.currentUserRoleBasedId = this.authService.roleBasedId;

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

  // Role-based access control methods
  canViewAllEmployees(): boolean {
    if (!this.currentUser) return false;
    const role = this.currentUser.roleName;
    return ['Admin', 'HR', 'Manager'].includes(role);
  }

  isEmployeeRole(): boolean {
    if (!this.currentUser) return false;
    return this.currentUser.roleName === 'Employee';
  }

  getCurrentEmployeeName(): string {
    if (this.employees.length > 0) {
      return this.employees[0].name;
    }
    return 'Unknown';
  }

  // Pagination for employees
  get paginatedEmployees(): EmployeeAttendanceData[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.employees.slice(startIndex, endIndex);
  }

  private loadAttendanceDataWithFallback(): void {
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
    } else if (this.isViewAll && this.canViewAllEmployees()) {
      // Load all employees data
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
    } else if (!this.isViewAll && this.canViewAllEmployees()) {
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
          this.availableDepartments = departments;
        },
        error: () => {
          this.availableDepartments = ['All', 'HR', 'IT', 'Finance', 'Marketing'];
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
    } else if (this.isViewAll && this.canViewAllEmployees()) {
      // Load all employees data
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
    } else if (!this.isViewAll && this.canViewAllEmployees()) {
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
          'No attendance data found for any employees in the last 12 months' : 
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
    } else if (this.isViewAll && this.canViewAllEmployees()) {
      loadData$ = this.attendanceService.getAllAttendanceData(
        year, 
        month, 
        this.selectedDepartment === 'All' ? undefined : this.selectedDepartment
      ).pipe(
        map(data => ({ data, year, month })),
        catchError(() => of({ data: [], year, month }))
      );
    } else if (!this.isViewAll && this.canViewAllEmployees()) {
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
    if (this.isViewAll && this.canViewAllEmployees()) {
      // Load all employees
      this.employees = data
        .filter((emp: any) => emp.attendanceList && emp.attendanceList.length > 0)
        .map((emp: any) => this.processEmployeeData(emp));
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
    this.selectedDepartment = 'All';
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
}