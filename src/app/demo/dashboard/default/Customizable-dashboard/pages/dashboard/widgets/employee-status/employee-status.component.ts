// employee-status.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface EmployeeStatus {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

interface TopPerformer {
  name: string;
  position: string;
  performance: number;
  avatar: string;
}

interface EmployeeStatusApiResponse {
  employeeTypeData: {
    statuses: {
      employeeType: string;
      percentage: number;
      count: number;
    }[];
    totalEmployees: number;
  };
  timePeriod: string;
}

@Component({
  selector: 'app-employee-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-status.component.html',
  styleUrls: ['./employee-status.component.scss']
})
export class EmployeeStatusComponent implements OnInit {
  totalEmployees: number = 0;
  isLoading: boolean = true;
  error: string | null = null;
  currentTimePeriod: string = 'monthly';

  // Employee status categories - will be populated from API
  employeeStatuses: EmployeeStatus[] = [];

  // Color mapping for different employee types
  private colorMap: { [key: string]: string } = {
    'Regular': '#ffcc00',
    'Fulltime': '#ffcc00',
    'Contract': '#3e7788',
    'Probation': '#e63946',
    'WFH': '#ee59a1',
    'Part-time': '#17a2b8',
    'Intern': '#6f42c1',
    'Temporary': '#fd7e14'
  };

  // Default colors for unknown types
  private defaultColors: string[] = [
    '#ffcc00', '#3e7788', '#e63946', '#ee59a1',
    '#17a2b8', '#6f42c1', '#fd7e14', '#20c997'
  ];

  // Top performer - keeping static for now since API doesn't provide this
  topPerformer: TopPerformer = {
    name: 'Daniel Esbella',
    position: 'iOS Developer',
    performance: 99,
    avatar: 'assets/avatar.jpg'
  };

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadEmployeeStatusData();
  }

  loadEmployeeStatusData(): void {
    this.isLoading = true;
    this.error = null;

    const apiUrl = `http://localhost:8080/api/dashboard/employee-status`;

    this.http.get<EmployeeStatusApiResponse>(apiUrl).subscribe({
      next: (response) => {
        this.processEmployeeStatusData(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching employee status data:', error);
        this.error = 'Failed to load employee status data';
        this.isLoading = false;
        // Fallback to empty data
        this.employeeStatuses = [];
        this.totalEmployees = 0;
      }
    });
  }

  processEmployeeStatusData(data: EmployeeStatusApiResponse): void {
    this.totalEmployees = data.employeeTypeData.totalEmployees;
    this.currentTimePeriod = data.timePeriod;

    // Convert API data to component format
    this.employeeStatuses = data.employeeTypeData.statuses.map((status, index) => ({
      category: status.employeeType,
      count: status.count,
      percentage: status.percentage,
      color: this.getColorForEmployeeType(status.employeeType, index)
    }));

    // If API returns less than 4 categories, pad with empty ones to maintain template structure
    while (this.employeeStatuses.length < 4) {
      this.employeeStatuses.push({
        category: 'N/A',
        count: 0,
        percentage: 0,
        color: '#e0e0e0'
      });
    }

    // Recalculate percentages to ensure they add up to 100%
    this.recalculatePercentages();
  }

  getColorForEmployeeType(employeeType: string, index: number): string {
    // First try to get color from predefined mapping
    if (this.colorMap[employeeType]) {
      return this.colorMap[employeeType];
    }

    // Fallback to default colors based on index
    return this.defaultColors[index % this.defaultColors.length];
  }

  recalculatePercentages(): void {
    if (this.employeeStatuses.length === 0) return;

    const totalCount = this.employeeStatuses.reduce((sum, status) => sum + status.count, 0);

    if (totalCount > 0) {
      this.employeeStatuses.forEach(status => {
        status.percentage = Math.round((status.count / totalCount) * 100);
      });

      // Ensure percentages add up to 100% (handle rounding differences)
      const totalPercentage = this.employeeStatuses.reduce((sum, status) => sum + status.percentage, 0);
      if (totalPercentage !== 100 && this.employeeStatuses.length > 0) {
        const difference = 100 - totalPercentage;
        this.employeeStatuses[0].percentage += difference;
      }
    }
  }

  updateTimePeriod(period: string): void {
    console.log(`Switched to ${period}`);
    this.currentTimePeriod = period;

    // If your API supports different time periods, you can modify the API call
    // For now, we'll just reload the same data
    // In a real implementation, you might need to modify the API endpoint
    // to accept time period parameters like:
    // `http://localhost:8080/api/dashboard/employee-status?period=${period}`

    this.loadEmployeeStatusData();
  }

  viewAllEmployees(): void {
    this.router.navigate(['/emp-det']);
    console.log('View all employees clicked');
  }

  // Method to refresh data manually
  refreshData(): void {
    this.loadEmployeeStatusData();
  }

  // Helper method to get status by category
  getStatusByCategory(category: string): EmployeeStatus | undefined {
    return this.employeeStatuses.find(status => status.category === category);
  }

  // Helper method to get total count
  getTotalCount(): number {
    return this.employeeStatuses.reduce((sum, status) => sum + status.count, 0);
  }
}
