import { Component, OnInit } from '@angular/core';
import { CalendarDataService } from '../../../services/calendar-data.service';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { mapHolidaysToMarkedDays } from '../../../services/calendar-data.service';

@Component({
  selector: 'app-calendar-details',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-details.component.html',
  styleUrls: ['./calendar-details.component.scss']
})
export class CalendarDetailsComponent implements OnInit {
  organizationList: { id: string; name: string }[] = [];
  branchList: { id: string; name: string }[] = [];
  yearList = [2024, 2025, 2026, 2027];
  loading = true;

  selectedOrg = '';
  selectedBranchId: string = '';
  selectedBranchName: string = '';
  selectedYear: number = new Date().getFullYear();

  months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];
  daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  markedDaysByMonth: { [monthIndex: number]: { [day: number]: { type: 'full' | 'half', name: string } } } = {};
  weekends: { [monthIndex: number]: number[] } = {}; // Store weekend days for each month

  constructor(
    private calendarDataService: CalendarDataService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.loadOrganizations();
  }

  private loadOrganizations() {
    this.loading = true;
    this.calendarDataService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizationList = orgs;
        if (this.organizationList.length > 0) {
          this.selectedOrg = this.organizationList[0].id;
          this.loadBranches();
        } else {
          this.loading = false;
        }
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  private loadBranches() {
    this.loading = true;
    
    // Use getBranches to fetch all branches
    this.calendarDataService.getBranches().subscribe({
      next: (branches) => {
        this.branchList = branches.map(branch => ({
          id: branch.id,
          name: branch.name
        }));
        
        // Process route params after branches are loaded
        this.processRouteParams();
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.loading = false;
      }
    });
  }
  
  private processRouteParams() {
    this.route.params.subscribe(params => {
      // Get year from URL if available
      if (params['year']) {
        this.selectedYear = +params['year'];
      }
      // Get branch identifier from URL if available
      const branchIdentifier = params['branchId'] || params['branch'];
      if (branchIdentifier) {
        // First try to find by ID (if it's a valid ID)
        let branch = this.branchList.find(b => b.id === branchIdentifier);
        // If not found by ID, try by name (for backward compatibility)
        if (!branch) {
          const branchName = decodeURIComponent(branchIdentifier);
          branch = this.branchList.find(b => b.name === branchName);
        }
        if (branch) {
          this.selectedBranchId = branch.id;
          this.selectedBranchName = branch.name;
          this.calculateWeekends();
          this.fetchMarkedDates();
        } else if (this.branchList.length > 0) {
          // If branch not found, use the first one
          this.selectedBranchId = this.branchList[0].id;
          this.selectedBranchName = this.branchList[0].name;
          this.calculateWeekends();
          this.fetchMarkedDates();
        }
      } else if (this.branchList.length > 0) {
        // If no branch in URL, use the first branch
        this.selectedBranchId = this.branchList[0].id;
        this.selectedBranchName = this.branchList[0].name;
        this.calculateWeekends();
        this.fetchMarkedDates();
      } else {
        this.loading = false;
      }
    });
  }

  fetchMarkedDates() {
    if (!this.selectedBranchId) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.calendarDataService.getHolidaysByBranchId(this.selectedBranchId, this.selectedYear).subscribe({
      next: (holidays) => {
        // Use shared mapping function
        this.markedDaysByMonth = mapHolidaysToMarkedDays(holidays);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching holidays:', error);
        this.loading = false;
      }
    });
  }

  getDayType(monthIndex: number, day: number): string {
    // Check if it's a holiday or half day first
    if (this.markedDaysByMonth[monthIndex] && this.markedDaysByMonth[monthIndex][day]) {
      return this.markedDaysByMonth[monthIndex][day].type;
    }
    
    // Check if it's a weekend
    if (this.weekends[monthIndex] && this.weekends[monthIndex].includes(day)) {
      return 'weekend';
    }
    
    return '';
  }

  // Get the display name of the selected organization
  getSelectedOrgName(): string {
    const org = this.organizationList.find(org => org.id === this.selectedOrg);
    return org ? org.name : 'N/A';
  }

  // Get first half of holiday days for a month (days 1-15)
  getFirstHalfHolidayDays(monthIndex: number): number[] {
    if (!this.markedDaysByMonth[monthIndex]) return [];
    
    return Object.keys(this.markedDaysByMonth[monthIndex])
      .map(day => parseInt(day))
      .filter(day => day >= 1 && day <= 15)
      .sort((a, b) => a - b);
  }

  // Get second half of holiday days for a month (days 16-31)
  getSecondHalfHolidayDays(monthIndex: number): number[] {
    if (!this.markedDaysByMonth[monthIndex]) return [];
    
    return Object.keys(this.markedDaysByMonth[monthIndex])
      .map(day => parseInt(day))
      .filter(day => day >= 16)
      .sort((a, b) => a - b);
  }
  
  calculateWeekends() {
    // Calculate weekends for each month of the selected year
    this.months.forEach((_, monthIndex) => {
      const daysInMonth = new Date(this.selectedYear, monthIndex + 1, 0).getDate();
      this.weekends[monthIndex] = [];
      
      for (let day = 1; day <= daysInMonth; day++) {
        const dayOfWeek = new Date(this.selectedYear, monthIndex, day).getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
          this.weekends[monthIndex].push(day);
        }
      }
    });
  }

  getCalendarDays(monthIndex: number): number[] {
    const daysInMonth = new Date(this.selectedYear, monthIndex + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  getStartDayOfMonth(monthIndex: number): number {
    return new Date(this.selectedYear, monthIndex, 1).getDay();
  }
}
