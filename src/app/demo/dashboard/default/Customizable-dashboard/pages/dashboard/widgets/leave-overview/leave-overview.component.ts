import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-leave-overview',
  standalone: true,
    imports: [CommonModule],
    template: `
      <div class="attendance-card">
        <div class="top-section">
          <div class="icon-container">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="20" fill="#10B981"/>
            <path d="M29 24V14C29 13.4477 28.5523 13 28 13H12C11.4477 13 11 13.4477 11 14V24C11 24.5523 11.4477 25 12 25H28C28.5523 25 29 24.5523 29 24Z" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M15 13V11C15 10.4477 15.4477 10 16 10H24C24.5523 10 25 10.4477 25 11V13" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M18 17L20 19L22 17" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
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
export class LeaveOverviewComponent {
@Input() title = 'Leave Overview';
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
