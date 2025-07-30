import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventModalComponent } from '../event-modal/event-modal.component';
import { CalendarDataService } from '../../../services/calendar-data.service';
import { Router } from '@angular/router';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-calendar-add',
  standalone: true,
  imports: [CommonModule, FormsModule, EventModalComponent],
  templateUrl: './add-calendar.component.html',
  styleUrls: ['./add-calendar.component.scss'],
})
export class AddCalendarComponent {
  eventModalVisible = false;

  constructor(
    private calendarDataService: CalendarDataService,
    private router: Router
  ) {}

  modalMonth = '';
  modalMonthIndex = 0;
  modalYear: number;

  ngOnInit() {
    this.loadOrganizations();
    this.loadBranches();
    this.modalYear = this.selectedYear;
    this.loading = false; // Set loading to false once initialization is complete
  }
  
  private loadOrganizations() {
    this.calendarDataService.getOrganizations().subscribe(orgs => {
      this.organizationList = orgs.map(org => org.name);
      if (this.organizationList.length > 0) {
        this.selectedOrg = this.organizationList[0];
      }
    });
  }

  loadBranches() {
    this.loading = true;
    this.calendarDataService.getHolidays(this.selectedOrg).subscribe({
      next: (holidays) => {
        // Get unique branch names from holidays
        this.branchList = [...new Set(holidays.map(h => h.branchName))];
        
        if (this.branchList.length > 0) {
          this.selectedBranch = this.branchList[0];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading branches:', error);
        this.loading = false;
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: 'Failed to load branches. Please try again later.'
        });
      }
    });
  }

  // Kept for future use if organization selection is needed
  onOrganizationChange() {
    // Currently using a single organization
  }

  openEventModal(month: string, monthIndex: number) {
    this.modalMonth = month;
    this.modalMonthIndex = monthIndex;
    this.modalYear = this.selectedYear;
    
    // No need to load marked dates here as we're using local state
    this.eventModalVisible = true;
  }
  closeEventModal() {
    this.eventModalVisible = false;
  }
  markedDaysByMonth: { [monthIndex: number]: { [day: number]: { type: 'full' | 'half', name: string } } } = {};

  // Handle month changes from the modal
  onModalMonthChanged(event: { monthIndex: number, year: number }) {
    this.modalMonthIndex = event.monthIndex;
    this.modalYear = event.year;
    this.modalMonth = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][this.modalMonthIndex];
  }

  // Store event details by date for later retrieval
  private eventDetails: { [key: string]: { holidayType: string, isOptional: boolean, holidayName: string } } = {};

  // Helper method to create a key for storing event details
  private getEventKey(monthIndex: number, day: number): string {
    return `${this.selectedYear}-${monthIndex}-${day}`;
  }

  handleModalSave(eventData: { events: any[], monthIndex: number, year: number }) {
    const { events, monthIndex } = eventData;
    
    if (monthIndex != null && events) {
      // Initialize markedDays for this month if it doesn't exist
      if (!this.markedDaysByMonth[monthIndex]) {
        this.markedDaysByMonth[monthIndex] = {};
      }
      
      // First, clear any existing marked days for this month
      this.markedDaysByMonth[monthIndex] = {};
      
      // Process each event individually
      events.forEach(event => {
        if (!event || !event.date) return;
        
        const day = event.date.getDate();
        const eventKey = this.getEventKey(monthIndex, day);
        
        // Store complete event details
        this.eventDetails[eventKey] = {
          holidayType: event.holidayType || 'Public',
          isOptional: event.isOptional || false,
          holidayName: event.holidayName || event.text || 'Holiday'
        };
        
        // Only update if we have a valid type
        if (event.type === 'full' || event.type === 'half') {
          this.markedDaysByMonth[monthIndex][day] = { type: event.type, name: event.holidayName || event.text || 'Holiday' };
        }
      });
    }
    // Don't close the modal here - let the user continue working
  }

  getDayType(monthIndex: number, day: number): 'full' | 'half' | null {
    return this.markedDaysByMonth[monthIndex]?.[day]?.type || null;
  }

  async onSaveCalendar() {
    try {
      // Prepare holidays data from marked days
      const holidays: any[] = [];
      
      // Process each month
      Object.entries(this.markedDaysByMonth).forEach(([monthIndex, days]) => {
        Object.entries(days).forEach(([day, dayData]) => {
          const dayNum = parseInt(day);
          const monthIdx = parseInt(monthIndex);
          
          // Create date in local timezone to avoid timezone issues
          const date = new Date(this.selectedYear, monthIdx, dayNum);
          
          // Format date as YYYY-MM-DD in local timezone
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const dayOfMonth = String(date.getDate()).padStart(2, '0');
          const formattedDate = `${year}-${month}-${dayOfMonth}`;
          
          // Get the stored event details or use defaults
          const eventKey = this.getEventKey(monthIdx, dayNum);
          const eventDetails = this.eventDetails[eventKey] || {
            holidayType: 'Public',
            holidayName: 'Holiday',
            isOptional: false
          };
          
          // Create holiday object with all required fields
          const holiday = {
            organizationName: this.selectedOrg || 'NGN Technologies',
            branchName: this.selectedBranch,
            year: this.selectedYear,
            holidayDate: formattedDate,
            holidayName: (eventDetails.holidayName || 'Holiday').trim(),
            holidayType: eventDetails.holidayType,
            leaveDayType: dayData.type === 'half' ? 'Half Day' : 'Full Day',
            isOptional: eventDetails.isOptional
          };
          
          holidays.push(holiday);
        });
      });
      
      if (holidays.length === 0) {
        await Swal.fire({
          icon: 'warning',
          title: 'No Holidays',
          text: 'Please add at least one holiday before saving.',
          confirmButtonColor: '#3085d6'
        });
        return;
      }
      
      // Show loading
      const loadingSwal = Swal.fire({
        title: 'Saving...',
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });
      
      // Save holidays
      this.calendarDataService.insertLeaveCalendar(holidays).subscribe({
        next: async () => {
          // Clear any cached holidays to force a refresh
          this.calendarDataService.clearHolidaysCache();
          
          // Close the loading dialog by showing a new alert
          await Swal.fire({
            icon: 'success',
            title: 'Success',
            text: 'Calendar saved successfully!',
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'OK'
          });
          
          // Navigate back to the calendar overview
          // Using navigate with query params to force a reload
          this.router.navigate(['/calendar'], {
            queryParams: { refresh: new Date().getTime() },
            replaceUrl: true
          });
        },
        error: async (error) => {
          console.error('Error saving calendar:', error);
          // Close the loading dialog by showing a new alert
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to save calendar. Please try again.',
            confirmButtonColor: '#3085d6'
          });
        }
      });
      
    } catch (error) {
      console.error('Error in onSaveCalendar:', error);
      await Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred. Please try again.',
        confirmButtonColor: '#3085d6'
      });
    }
  }

  organizationList: string[] = [];
  branchList: string[] = [];
  yearList = [2024, 2025, 2026, 2027];
  loading = true;
  
  selectedOrg = '';
  selectedBranch: string = '';
  selectedYear: number = new Date().getFullYear();

  months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  getCalendarDays(monthIndex: number): number[] {
    const daysInMonth = new Date(this.selectedYear, monthIndex + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  getStartDayOfMonth(monthIndex: number): number {
    return new Date(this.selectedYear, monthIndex, 1).getDay();
  }
}
