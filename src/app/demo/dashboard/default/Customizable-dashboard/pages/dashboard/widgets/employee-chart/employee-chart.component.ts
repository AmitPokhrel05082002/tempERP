// employee-chart.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Chart } from 'chart.js/auto';

interface DepartmentData {
  departmentData: {
    departments: string[];
    employeeCounts: number[];
  };
}

@Component({
  selector: 'app-employee-chart',
  standalone: true,
  imports: [],
  templateUrl: './employee-chart.component.html',
  styleUrl: './employee-chart.component.scss'
})
export class EmployeeChartComponent implements OnInit, AfterViewInit {
  @ViewChild('employeeChart') chartCanvas!: ElementRef;
  chart!: Chart;

  // Will be populated from API
  departments: string[] = [];
  employeeCounts: number[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  private readonly API_URL = 'http://localhost:8080/api/dashboard/department-data';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadDepartmentData();
  }

  ngAfterViewInit(): void {
    // Chart will be created after data is loaded
  }

  loadDepartmentData(): void {
    this.isLoading = true;
    this.error = null;

    this.http.get<DepartmentData>(this.API_URL).subscribe({
      next: (response) => {
        this.departments = this.formatDepartmentNames(response.departmentData.departments);
        this.employeeCounts = response.departmentData.employeeCounts;
        this.isLoading = false;

        // Create chart after data is loaded and view is initialized
        if (this.chartCanvas) {
          this.createChart();
        }
      },
      error: (error) => {
        console.error('Error fetching department data:', error);
        this.error = 'Failed to load department data';
        this.isLoading = false;

        // Fallback to create chart with empty data or show error
        this.handleLoadError();
      }
    });
  }

  private formatDepartmentNames(departments: string[]): string[] {
    // Remove "All Departments>" prefix and clean up names
    return departments.map(dept =>
      dept.replace('All Departments>', '').trim()
    );
  }

  private handleLoadError(): void {
    // You can either show an error message or use fallback data
    // Option 1: Use fallback static data
    this.departments = ['UI/UX', 'Development', 'Management', 'HR', 'Testing', 'Marketing'];
    this.employeeCounts = [80, 120, 85, 30, 70, 110];

    if (this.chartCanvas) {
      this.createChart();
    }
  }

  createChart(): void {
    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    // Calculate max value for better scaling
    const maxCount = Math.max(...this.employeeCounts);
    const chartMax = Math.ceil(maxCount * 1.1); // Add 10% padding

    const config: any = {
      type: 'bar',
      data: {
        labels: this.departments,
        datasets: [{
          data: this.employeeCounts,
          backgroundColor: '#FF6831',
          barThickness: 15,
          borderRadius: 4,
          borderSkipped: false
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                return `${context.parsed.x} employees`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false,
              color: 'transparent',
              borderColor: 'transparent',
              drawBorder: false
            },
            border: {
              display: false
            },
            ticks: {
              color: '#666',
              font: {
                size: 12
              }
            },
            max: chartMax
          },
          y: {
            grid: {
              display: true,
              color: '#f0f0f0',
              lineWidth: 1,
              borderColor: 'transparent',
              drawBorder: false
            },
            border: {
              display: false
            },
            ticks: {
              color: '#333',
              font: {
                size: 14,
                weight: 500
              }
            }
          }
        }
      }
    };

    // Create chart instance
    this.chart = new Chart(
      this.chartCanvas.nativeElement,
      config
    );
  }

  updateTimePeriod(period: string): void {
    console.log(`Switched to ${period}`);
    // You might want to reload data based on the time period
    // this.loadDepartmentData();
  }

  // Method to refresh data manually
  refreshData(): void {
    this.loadDepartmentData();
  }

  ngOnDestroy(): void {
    // Clean up chart instance
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
