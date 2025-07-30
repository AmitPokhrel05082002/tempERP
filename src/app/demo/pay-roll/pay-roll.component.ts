import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpClientModule, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-pay-roll',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HttpClientModule],
  templateUrl: './pay-roll.component.html',
  styleUrls: ['./pay-roll.component.scss']
})
export class PayRollComponent implements OnInit {

  employees: any[] = [];
  filteredEmployees: any[] = [];
  activeFilter: string = 'all';
  searchQuery: string = '';

  selectedYear: string;
  selectedMonth: string;

  years: string[] = [];
  months = [
    { value: '01', name: 'January' },
    { value: '02', name: 'February' },
    { value: '03', name: 'March' },
    { value: '04', name: 'April' },
    { value: '05', name: 'May' },
    { value: '06', name: 'June' },
    { value: '07', name: 'July' },
    { value: '08', name: 'August' },
    { value: '09', name: 'September' },
    { value: '10', name: 'October' },
    { value: '11', name: 'November' },
    { value: '12', name: 'December' },
  ];

  constructor(private http: HttpClient) {
    const now = new Date();
    this.selectedYear = now.getFullYear().toString();

    let prevMonth = now.getMonth();
    if (prevMonth === 0) {
      prevMonth = 12;
      this.selectedYear = (now.getFullYear() - 1).toString();
    }
    this.selectedMonth = prevMonth.toString().padStart(2, '0');

    const currentYear = now.getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
      this.years.push(y.toString());
    }
  }

  ngOnInit() {
    this.loadEmployees();
  }

  loadEmployees() {
    const url = `${environment.apiUrl}/api/payRoll/getAllPayRoll`;

    const params = new HttpParams()
      .set('year', this.selectedYear)
      .set('month', this.selectedMonth);

    console.log(`Fetching payroll data from: ${url}?year=${this.selectedYear}&month=${this.selectedMonth}`);

    this.http.get<any[]>(url, { params }).subscribe({
      next: (data) => {
        console.log('Payroll data received:', data);
        this.employees = data.map(emp => ({
          id: emp.empId,
          empCode: emp.empCode,
          name: [emp.firstName, emp.middleName, emp.lastName].filter(n => n).join(' '),
          netSalary: emp.netSalary,
          salaryMonth: emp.salaryMonth,
          status: emp.employmentStatus.toLowerCase(),
          overtime: emp.overtime || '0'
        }));
        this.filterEmployees(this.activeFilter); // Apply current filter
      },
      error: (err) => {
        console.error('Failed to load payroll data:', err);
        this.employees = [];
        this.filteredEmployees = [];
      }
    });
  }

  onYearChange(event: string) {
    this.selectedYear = event;
    this.loadEmployees();
  }

  onMonthChange(event: string) {
    this.selectedMonth = event;
    this.loadEmployees();
  }

  getStatusText(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  filterEmployees(type: string) {
    this.activeFilter = type;
    if (type === 'all') {
      this.filteredEmployees = [...this.employees];
    } else {
      this.filteredEmployees = this.employees.filter(emp =>
        emp.status === type.toLowerCase()
      );
    }

    // Also apply search again if query exists
    if (this.searchQuery) {
      this.searchEmployees();
    }
  }

  searchEmployees() {
    if (!this.searchQuery) {
      this.filterEmployees(this.activeFilter);
      return;
    }
    const query = this.searchQuery.toLowerCase();
    this.filteredEmployees = this.filteredEmployees.filter(emp =>
      emp.name.toLowerCase().includes(query)
    );
  }
}
