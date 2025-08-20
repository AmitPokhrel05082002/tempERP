// clock-in-out.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

interface Employee {
  id: string;
  name: string;
  position: string;
  avatar: string;
  clockInTime: string;
  clockOutTime: string;
  productionTime: string;
  isLate: boolean;
  lateMinutes?: number;
  clockInStatus: 'on-time' | 'late';
  isExpanded: boolean;
  empCode: string;
}

interface ClockInOutApiResponse {
  totalDuration: string;
  actualCheckInTime: string;
  empCode: string;
  isLate: boolean;
  name: string;
  clockInStatus: 'on-time' | 'late';
  position: string;
  avatar: string;
  actualCheckOutTime: string;
}

@Component({
  selector: 'app-clock-in-out',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './clock-in-out.component.html',
  styleUrls: ['./clock-in-out.component.scss']
})
export class ClockInOutComponent implements OnInit {
  selectedDepartment: string = 'All Departments';
  selectedDate: string = '';
  currentDate: string = '';
  isLoading: boolean = true;
  error: string | null = null;

  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];

  // Available avatar images
  private availableAvatars: string[] = [
    'assets/leki.jpg',
    'assets/amit.jpg',
    'assets/cto.jpg',
    'assets/ganesh.jpg',
    'assets/pema.jpg'
  ];

  departments: string[] = [
    'All Departments',
    'DIMSD',
    'E-Centric',
    'SMD',
    'Design',
    'Development',
    'Marketing',
    'Management'
  ];

  dateOptions: string[] = [
    'Today',
    'Yesterday',
    'This Week',
    'Last Week'
  ];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.currentDate = this.getCurrentDate();
    this.selectedDate = 'Today';
    this.loadClockInOutData();
  }

  getCurrentDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }

  getDateForSelection(selection: string): string {
    const today = new Date();

    switch(selection) {
      case 'Today':
        return today.toISOString().split('T')[0];
      case 'Yesterday':
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
      case 'This Week':
        // For this week, we'll use today's date
        // You might want to modify the API to handle week ranges
        return today.toISOString().split('T')[0];
      case 'Last Week':
        // For last week, we'll use a date from last week
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        return lastWeek.toISOString().split('T')[0];
      default:
        return today.toISOString().split('T')[0];
    }
  }

  loadClockInOutData(): void {
    this.isLoading = true;
    this.error = null;

    // const dateToUse = this.getDateForSelection(this.selectedDate);
    const apiUrl = `http://localhost:8080/api/dashboard/latest-clock-in-out?date=2025-07-02`;

    this.http.get<ClockInOutApiResponse[]>(apiUrl).subscribe({
      next: (response) => {
        this.processClockInOutData(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching clock in/out data:', error);
        this.error = 'Failed to load clock in/out data';
        this.isLoading = false;
        this.employees = [];
        this.filteredEmployees = [];
      }
    });
  }

  processClockInOutData(data: ClockInOutApiResponse[]): void {
    this.employees = data.map((item, index) => ({
      id: item.empCode,
      name: item.name.trim(), // Remove extra spaces
      position: item.position,
      avatar: this.getRandomAvatar(index), // Assign random avatar
      clockInTime: item.actualCheckInTime,
      clockOutTime: item.actualCheckOutTime === 'Not Checked Out' ? 'Not Checked Out' : item.actualCheckOutTime,
      productionTime: item.totalDuration,
      isLate: item.isLate,
      lateMinutes: item.isLate ? this.calculateLateMinutes(item.actualCheckInTime) : undefined,
      clockInStatus: item.clockInStatus as 'on-time' | 'late',
      isExpanded: false,
      empCode: item.empCode
    }));

    // Apply current department filter
    this.applyDepartmentFilter();
  }

  calculateLateMinutes(clockInTime: string): number {
    // Assuming standard work start time is 9:00 AM
    // You might want to make this configurable or get it from the API
    const standardStartTime = '09:00 am';

    try {
      const startTime = this.parseTime(standardStartTime);
      const actualTime = this.parseTime(clockInTime);

      if (actualTime > startTime) {
        return Math.floor((actualTime - startTime) / (1000 * 60)); // Convert to minutes
      }
    } catch (error) {
      console.warn('Error calculating late minutes:', error);
    }

    return 0;
  }

  parseTime(timeString: string): number {
    // Parse time string like "09:15 am" to Date object for comparison
    const [time, period] = timeString.toLowerCase().split(' ');
    const [hours, minutes] = time.split(':').map(Number);

    let adjustedHours = hours;
    if (period === 'pm' && hours !== 12) {
      adjustedHours += 12;
    } else if (period === 'am' && hours === 12) {
      adjustedHours = 0;
    }

    const today = new Date();
    today.setHours(adjustedHours, minutes, 0, 0);
    return today.getTime();
  }

  applyDepartmentFilter(): void {
    if (this.selectedDepartment === 'All Departments') {
      this.filteredEmployees = [...this.employees];
    } else {
      this.filteredEmployees = this.employees.filter(emp =>
        emp.position.toLowerCase().includes(this.selectedDepartment.toLowerCase()) ||
        emp.position === this.selectedDepartment
      );
    }
  }

  toggleEmployeeDetails(employee: Employee): void {
    // Reset all other employees
    this.employees.forEach(emp => {
      if (emp.id !== employee.id) {
        emp.isExpanded = false;
      }
    });

    // Toggle the selected employee
    employee.isExpanded = !employee.isExpanded;
  }

  changeDepartment(department: string): void {
    this.selectedDepartment = department;
    this.applyDepartmentFilter();
  }

  changeDate(date: string): void {
    this.selectedDate = date;
    this.loadClockInOutData(); // Reload data with new date
  }

  // Method to refresh data
  refreshData(): void {
    this.loadClockInOutData();
  }

  // Helper methods for template
  getOnTimeEmployeesCount(): number {
    return this.filteredEmployees.filter(emp => !emp.isLate).length;
  }

  getLateEmployeesCount(): number {
    return this.filteredEmployees.filter(emp => emp.isLate).length;
  }

  getNotCheckedOutCount(): number {
    return this.filteredEmployees.filter(emp => emp.clockOutTime === 'Not Checked Out').length;
  }

  getTotalEmployeesCount(): number {
    return this.filteredEmployees.length;
  }

  // Format time for display
  formatTime(timeString: string): string {
    if (timeString === 'Not Checked Out') {
      return timeString;
    }
    return timeString;
  }

  // Get status class for styling
  getStatusClass(employee: Employee): string {
    if (employee.clockOutTime === 'Not Checked Out') {
      return 'status-active';
    } else if (employee.isLate) {
      return 'status-late';
    } else {
      return 'status-on-time';
    }
  }

  // Get late minutes display
  getLateMinutesDisplay(employee: Employee): string {
    if (employee.isLate && employee.lateMinutes) {
      return `${employee.lateMinutes} min late`;
    }
    return '';
  }

  // TrackBy function for better performance
  trackByEmployeeId(index: number, employee: Employee): string {
    return employee.empCode;
  }

  // Get random avatar for employee
  getRandomAvatar(index: number): string {
    // Use employee index to ensure consistency across re-renders
    // but still provide variety
    return this.availableAvatars[index % this.availableAvatars.length];
  }

  // Alternative method: truly random assignment (use this if you want different images each time)
  getRandomAvatarTruly(): string {
    const randomIndex = Math.floor(Math.random() * this.availableAvatars.length);
    return this.availableAvatars[randomIndex];
  }
}
