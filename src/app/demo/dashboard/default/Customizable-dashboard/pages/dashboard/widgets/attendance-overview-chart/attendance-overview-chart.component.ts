import { Component, OnInit, AfterViewInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js';

// Register the required Chart.js components
Chart.register(ArcElement, Tooltip, Legend);

interface AttendanceStatus {
  label: string;
  value: number;
  percentage: number;
  color: string;
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

  totalAttendance: number = 120;
  chart: Chart | null = null;

  // Attendance status data
  attendanceStatuses: AttendanceStatus[] = [
    { label: 'Present', value: 71, percentage: 59, color: '#00c853' },
    { label: 'Late', value: 25, percentage: 21, color: '#0c5460' },
    { label: 'Permission', value: 2, percentage: 2, color: '#ffc107' },
    { label: 'Absent', value: 18, percentage: 15, color: '#dc3545' }
  ];

  constructor() { }

  ngOnInit(): void {
    // Calculate totals and percentages if needed
    this.calculatePercentages();
  }

  ngAfterViewInit(): void {
    this.createChart();
  }

  calculatePercentages(): void {
    const total = this.attendanceStatuses.reduce((sum, status) => sum + status.value, 0);
    this.totalAttendance = total;

    this.attendanceStatuses.forEach(status => {
      status.percentage = Math.round((status.value / total) * 100);
    });
  }

  createChart(): void {
    const ctx = this.chartCanvas.nativeElement.getContext('2d');

    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    this.chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
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
            enabled: false
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
    // In a real app, this would fetch new data based on the period
  }
}
