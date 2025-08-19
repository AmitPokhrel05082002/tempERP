import { Component, OnInit, ViewChild, ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
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
  department: string; // Add department field
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
    this.currentUser = this.authService.getCurrentUser();
    this.currentUserRoleBasedId = this.authService.roleBasedId;
    
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

  private initializeFilters(): void {
    const currentDate = new Date();
    // Set to previous month by default to show historical data
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    this.selectedYear = previousMonth.getFullYear();
    this.selectedMonth = previousMonth.getMonth() + 1;
    this.selectedDepartment = 'All Departments';
    this.currentYear = this.selectedYear;
    this.currentMonth = previousMonth.toLocaleString('default', { month: 'long' });
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
    this.currentDepartment = this.selectedDepartment === 'All Departments' ? 'All Departments' : this.selectedDepartment;
    this.loadAttendanceData();
  }

  resetFilters(): void {
    const currentDate = new Date();
    // Reset to previous month instead of current month
    const previousMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    
    this.selectedYear = previousMonth.getFullYear();
    this.selectedMonth = previousMonth.getMonth() + 1;
    this.selectedDepartment = 'All Departments';
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
    
    // Always generate headers first
    this.generateMonthHeaders(this.selectedMonth, this.selectedYear);

    // Determine what data to load based on role
    let loadData$;
    
    if (this.isEmployeeRole() && this.currentUserRoleBasedId) {
      // Employee role - load only their data
      loadData$ = this.attendanceService.getEmployeeAttendanceData(
        this.currentUserRoleBasedId,
        this.selectedYear,
        this.selectedMonth
      ).pipe(
        map(data => data ? [data] : []), // Wrap single employee data in array
        catchError(error => {
          console.warn('Employee API call failed:', error);
          return of([]);
        })
      );
    } else if (this.canViewAllEmployees()) {
      // HR, Manager, Admin roles - load all data
      loadData$ = this.attendanceService.getAllAttendanceData(
        this.selectedYear,
        this.selectedMonth,
        this.selectedDepartment === 'All Departments' ? undefined : this.selectedDepartment
      ).pipe(
        catchError(error => {
          console.warn('API call failed:', error);
          return of([]);
        })
      );
    } else {
      // No access
      this.errorMessage = 'You do not have permission to view attendance data.';
      this.isLoading = false;
      return;
    }

    const sub = loadData$.subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.processAttendanceData(data);
          this.applyFilters(); // Apply search filters after loading data
          this.updateChartData();
          this.hasError = false;
        } else {
          // Try to load latest available data
          this.loadLatestAvailableData();
          return; // Don't complete loading here
        }
        this.isLoading = false;
      },
      error: () => {
        this.loadLatestAvailableData();
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
          : 'No attendance data available for any recent months.';
        this.employees = [];
        this.filteredEmployees = [];
        this.updateChartData();
      },
      complete: () => this.isLoading = false
    });

    this.subscription.add(sub);
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
      this.departments = ['All Departments', ...sortedDepartments];

      data.forEach(employeeData => {
        if (employeeData.attendanceList && employeeData.attendanceList.length > 0) {
          const attendanceGroup = employeeData.attendanceList[0]?.attendanceGroup?.trim() || '';
          
          // For employees, they can only see their own data
          if (this.isEmployeeRole()) {
            const employeeId = employeeData.employeeId || employeeData.attendanceList[0]?.employeeId || '';
            if (employeeId === this.currentUserRoleBasedId) {
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
      this.departments = ['All Departments'];
    }

    this.updateSummary();
  }

  private processEmployeeAttendance(employeeData: any) {
    // Extract department information - prioritize attendanceGroup, then department field
    let departmentName = 'Not specified';
    if (employeeData.attendanceList && employeeData.attendanceList.length > 0) {
      const attendance = employeeData.attendanceList[0];
      
      // Debug: Log available fields to understand data structure
      console.log('Employee Data Structure:', {
        attendanceGroup: attendance.attendanceGroup,
        department: attendance.department,
        firstName: attendance.firstName,
        lastName: attendance.lastName
      });
      
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
          department: this.selectedDepartment === 'All' ? undefined : this.selectedDepartment
        }
      });
    } else {
      // Navigate to view all employees - pass the current context data
      this.router.navigate(['/employees/all'], {
        queryParams: {
          year: this.selectedYear,
          month: this.selectedMonth,
          department: this.selectedDepartment === 'All' ? undefined : this.selectedDepartment,
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
}