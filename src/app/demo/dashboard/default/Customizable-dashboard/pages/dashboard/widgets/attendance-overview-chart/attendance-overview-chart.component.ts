import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

// Register the required Chart.js components
Chart.register(ArcElement, Tooltip, Legend);

interface AttendanceStatus {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface AttendanceApiResponse {
  date: string;
  absentEmployees: number;
  attendancePercentage: number;
  presentEmployees: number;
  totalEmployees: number;
}

@Component({
  selector: 'app-attendance-overview-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attendance-overview-chart.component.html',
  styleUrl: './attendance-overview-chart.component.scss'
})
export class AttendanceOverviewChartComponent implements OnInit, AfterViewInit {
  @ViewChild('attendanceChart') chartCanvas!: ElementRef<HTMLCanvasElement>;

  totalAttendance: number = 0;
  chart: Chart | null = null;
  currentDate: string = '';
  isLoading: boolean = true;
  error: string | null = null;

  // Attendance status data - will be populated from API
  attendanceStatuses: AttendanceStatus[] = [];

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.currentDate = this.getCurrentDate();
    this.loadAttendanceData();
  }

  ngAfterViewInit(): void {
    // Chart will be created after data is loaded
  }

  getCurrentDate(): string {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }

  loadAttendanceData(): void {
    this.isLoading = true;
    this.error = null;

    // const apiUrl = `http://localhost:8080/api/dashboard/attendance-percentage?date=${this.currentDate}`;
    const apiUrl = `http://localhost:8080/api/dashboard/attendance-percentage?date=2025-07-01`;

    this.http.get<AttendanceApiResponse>(apiUrl).subscribe({
      next: (response) => {
        this.processAttendanceData(response);
        this.isLoading = false;
        // Create chart after data is loaded and view is initialized
        if (this.chartCanvas) {
          this.createChart();
        }
      },
      error: (error) => {
        console.error('Error fetching attendance data:', error);
        this.error = 'Failed to load attendance data';
        this.isLoading = false;
      }
    });
  }

  processAttendanceData(data: AttendanceApiResponse): void {
    this.totalAttendance = data.totalEmployees;

    // Calculate absent percentage
    const absentPercentage = Math.round((data.absentEmployees / data.totalEmployees) * 100);
    const presentPercentage = Math.round((data.presentEmployees / data.totalEmployees) * 100);

    // Note: The API only provides present/absent data
    // You might need to modify this based on your actual requirements
    this.attendanceStatuses = [
      {
        label: 'Present',
        value: data.presentEmployees,
        percentage: presentPercentage,
        color: '#00c853'
      },
      {
        label: 'Absent',
        value: data.absentEmployees,
        percentage: absentPercentage,
        color: '#dc3545'
      }
    ];

    // If you need to include Late and Permission categories,
    // you'll need to modify your API to provide this data
    // For now, I'm commenting out the static data approach:
    /*
    this.attendanceStatuses = [
      { label: 'Present', value: 71, percentage: 59, color: '#00c853' },
      { label: 'Late', value: 25, percentage: 21, color: '#0c5460' },
      { label: 'Permission', value: 2, percentage: 2, color: '#ffc107' },
      { label: 'Absent', value: 18, percentage: 15, color: '#dc3545' }
    ];
    */
  }

  createChart(): void {
    if (!this.chartCanvas) {
      console.error('Chart canvas not available');
      return;
    }

    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    // Destroy existing chart if it exists
    if (this.chart) {
      this.chart.destroy();
    }

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: this.attendanceStatuses.map(status => status.label),
        datasets: [{
          data: this.attendanceStatuses.map(status => status.percentage),
          backgroundColor: this.attendanceStatuses.map(status => status.color),
          borderWidth: 0,
          circumference: 180,
          rotation: 270,
          borderRadius: 5,
          spacing: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            callbacks: {
              label: (context) => {
                const status = this.attendanceStatuses[context.dataIndex];
                return `${status.label}: ${status.value} (${status.percentage}%)`;
              }
            }
          }
        },
        layout: {
          padding: 15
        }
      }
    });
  }

  updateTimePeriod(period: string): void {
    console.log(`Switched to ${period}`);
    // You can modify this to change the date based on the period
    // For example:
    let newDate = this.currentDate;

    switch(period) {
      case 'today':
        newDate = this.getCurrentDate();
        break;
      case 'yesterday':
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        newDate = yesterday.toISOString().split('T')[0];
        break;
      case 'week':
        // You might want to modify the API to accept week parameters
        newDate = this.getCurrentDate();
        break;
      // Add more cases as needed
    }

    if (newDate !== this.currentDate) {
      this.currentDate = newDate;
      this.loadAttendanceData();
    }
  }

  // Method to refresh data
  refreshData(): void {
    this.loadAttendanceData();
  }

  // Cleanup method
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
    }
  }
}
