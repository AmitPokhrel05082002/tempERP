// employee-chart.component.ts
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Chart } from 'chart.js/auto';

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

  // Department data
  departments: string[] = ['UI/UX', 'Development', 'Management', 'HR', 'Testing', 'Marketing'];
  employeeCounts: number[] = [80, 120, 85, 30, 70, 110];

  constructor() {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    this.createChart();
  }

  createChart(): void {
    // Using 'any' type to bypass TypeScript errors - not ideal for type safety
    // but effective for bypassing version compatibility issues
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
            max: 130
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
  }
}
