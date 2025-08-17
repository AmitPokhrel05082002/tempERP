import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-employee-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="attendance-card">
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
      // gap: 40px;
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
export class EmployeeOverviewComponent {
  @Input() title = 'Employee Overview';
  @Input() currentAttendance = 120;
  @Input() totalCapacity = 154;
  @Input() percentage = 2.1;
  @Input() isPositive = true;
  @Input() viewDetailsText = 'View Details';

  get percentagePrefix(): string {
    return this.isPositive ? '+' : '';
  }

  onViewDetails(): void {
    // Emit event or handle navigation
    console.log('View details clicked');
  }
}
