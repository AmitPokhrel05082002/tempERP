import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface EmployeeOverviewApiResponse {
  totalActiveEmployees: number;
  employmentStatus: string;
  timestamp: string;
}

@Component({
  selector: 'app-employee-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- Loading State -->
    <div *ngIf="isLoading" class="loading-state">
      <div class="loading-spinner"></div>
    </div>

    <!-- Error State -->
    <div *ngIf="error && !isLoading" class="error-state">
      <div class="error-icon">⚠️</div>
      <div class="error-text">Error loading data</div>
    </div>

    <!-- Main Content -->
    <div *ngIf="!isLoading && !error" class="attendance-card">
      <div class="top-section">
        <div class="icon-container">
         <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#3B82F6"/>
            <path d="M28 29V27C28 25.9391 27.5786 24.9217 26.8284 24.1716C26.0783 23.4214 25.0609 23 24 23H16C14.9391 23 13.9217 23.4214 13.1716 24.1716C12.4214 24.9217 12 25.9391 12 27V29" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="20" cy="15" r="4" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <h3 class="title">{{ title }}</h3>
      </div>

      <div class="stats-container">
        <div>
          <span class="attendance-numbers">{{ currentAttendance }}/{{ totalCapacity }}</span>
          <span class="percentage" [ngClass]="{'positive': isPositive, 'negative': !isPositive}">
            {{ percentagePrefix }}{{ percentage }}%
          </span>
        </div>
        <div>
        <button class="view-details-btn" (click)="onViewDetails()">
          {{ viewDetailsText }}
        </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
      height: 100%;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 150px;
      color: #666;
    }

    .loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3B82F6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 8px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    .error-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 150px;
      color: #dc3545;
      text-align: center;
    }

    .error-icon {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .error-text {
      font-size: 12px;
    }

    .attendance-card {
      background: transparent;
      border-radius: 0;
      padding: 0;
      box-shadow: none;
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 150px;
    }

    .top-section {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .icon-container {
      width: 40px;
      height: 40px;
      background: #FF6B35;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .title {
      color: #6B7280;
      font-size: 13px;
      font-weight: 500;
      margin: 0;
      flex-shrink: 0;
    }

    .stats-container {
      display: flex;
      align-items: baseline;
      margin: 8px 0;
      flex-grow: 1;
      justify-content: space-between;
    }

    .attendance-numbers {
      color: #1F2937;
      font-size: 17px;
      font-weight: 700;
      line-height: 1;
    }

    .percentage {
      font-size: 12px;
      font-weight: 600;
      margin-left: 2px;
    }

    .percentage.positive {
      color: #10B981;
    }

    .percentage.negative {
      color: #EF4444;
    }

    .view-details-btn {
      background: none;
      border: none;
      color: #6B7280;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      padding: 0;
      text-decoration: underline;
      transition: color 0.2s ease;
      text-align: left;
      flex-shrink: 0;
      margin-top: auto;
    }

    .view-details-btn:hover {
      color: #374151;
    }

    .view-details-btn:focus {
      outline: none;
      color: #374151;
    }
  `]
})
export class EmployeeOverviewComponent implements OnInit {
  @Input() title = 'Employee Overview';
  @Input() totalCapacity = 154; // You can still pass this as input or make it configurable
  @Input() viewDetailsText = 'View Details';

  // API-driven properties
  currentAttendance = 0;
  percentage = 0;
  isPositive = true;
  isLoading = true;
  error: string | null = null;

  constructor(private http: HttpClient) { }

  ngOnInit(): void {
    this.loadEmployeeOverviewData();
  }

  loadEmployeeOverviewData(): void {
    this.isLoading = true;
    this.error = null;

    const apiUrl = 'http://localhost:8080/api/dashboard/total-active-employees';

    this.http.get<EmployeeOverviewApiResponse>(apiUrl).subscribe({
      next: (response) => {
        this.processEmployeeOverviewData(response);
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching employee overview data:', error);
        this.error = 'Failed to load employee data';
        this.isLoading = false;
        // Fallback values
        this.currentAttendance = 0;
        this.percentage = 0;
      }
    });
  }

  processEmployeeOverviewData(data: EmployeeOverviewApiResponse): void {
    this.currentAttendance = data.totalActiveEmployees;

    // Calculate percentage based on current vs total capacity
    if (this.totalCapacity > 0) {
      const calculatedPercentage = (this.currentAttendance / this.totalCapacity) * 100;
      this.percentage = Math.round(calculatedPercentage * 10) / 10; // Round to 1 decimal place

      // Determine if it's positive (above 90%) or negative
      this.isPositive = calculatedPercentage >= 90;
    } else {
      this.percentage = 0;
      this.isPositive = true;
    }
  }

  get percentagePrefix(): string {
    return this.isPositive ? '+' : '';
  }

  onViewDetails(): void {
    // Emit event or handle navigation
    console.log('View details clicked');
  }

  // Method to refresh data manually
  refreshData(): void {
    this.loadEmployeeOverviewData();
  }

  // Method to update total capacity if needed
  updateTotalCapacity(newCapacity: number): void {
    this.totalCapacity = newCapacity;
    // Recalculate percentage with new capacity
    if (this.currentAttendance > 0) {
      const calculatedPercentage = (this.currentAttendance / this.totalCapacity) * 100;
      this.percentage = Math.round(calculatedPercentage * 10) / 10;
      this.isPositive = calculatedPercentage >= 90;
    }
  }
}
