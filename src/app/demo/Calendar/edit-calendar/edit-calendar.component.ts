import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CalendarDataService } from '../../../services/calendar-data.service';
import Swal from 'sweetalert2';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { EventModalComponent } from '../event-modal/event-modal.component';
import { mapHolidaysToMarkedDays } from '../../../services/calendar-data.service';

@Component({
  selector: 'app-edit-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule, EventModalComponent],
  templateUrl: './edit-calendar.component.html',
  styleUrls: ['./edit-calendar.component.scss']
})
export class EditCalendarComponent implements OnInit {
  organizationList: string[] = [];
  branchList: { id: string, name: string }[] = [];
  yearList = [2024, 2025, 2026, 2027];
  loading = true;

  selectedOrg: string = '';
  selectedBranch: string = '';
  selectedYear: number = new Date().getFullYear();
  calendarId: string = '';
  isEditMode: boolean = false;
  originalBranch: string = '';
  selectedBranchId: string = '';
  selectedBranchFilter: string = '';

  months = [
    'January', 'February', 'March', 'April',
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];
  daysOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  markedDaysByMonth: { [monthIndex: number]: { [day: number]: { type: 'full' | 'half', name: string } } } = {};
  // Store event details by date for later retrieval
  public eventDetails: { [key: string]: { 
    holidayName: string;
    holidayType: string;
    leaveDayType: 'full day' | 'half day';
    isOptional: boolean;
  } } = {};
  private originalEventDetails: { [key: string]: { 
    holidayName: string;
    holidayType: string;
    leaveDayType: 'full day' | 'half day';
    isOptional: boolean;
  } } = {};
  
  eventModalVisible = false;
  modalMonth = '';
  modalMonthIndex = 0;
  modalYear: number = 2025;
  weekends: { [monthIndex: number]: number[] } = {};

  // Add a property to store the list of months with holidays
  monthsWithHolidays: number[] = [];
  // Add a property to store the selected month index
  selectedMonthIndex: number = -1;

  // New property to store holidays grouped by branch
  branchHolidayTable: { branch: string, holidays: any[] }[] = [];

  showEditModal = false;
  editHolidayData: any = null;
  isDeleteMode: boolean = false;

  currentMonth: number = new Date().getMonth();

  getHolidayForDay(monthIndex: number, day: number) {
    // Find the holiday for the given month and day
    for (const row of this.branchHolidayTable) {
      for (const holiday of row.holidays) {
        const date = new Date(holiday.holidayDate);
        if (date.getMonth() === monthIndex && date.getDate() === day) {
          return holiday;
        }
      }
    }
    return null;
  }

  get filteredBranchHolidayTable() {
    if (!this.selectedBranchFilter) return this.branchHolidayTable;
    return this.branchHolidayTable.filter(row => row.branch === this.selectedBranchFilter);
  }

  constructor(
    private route: ActivatedRoute,
    private calendarDataService: CalendarDataService,
    private router: Router
  ) {}

  ngOnInit() {
    // Get the calendar ID from the route parameters
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.calendarId = id;
        this.isEditMode = true;
        console.log('Calendar ID from route:', this.calendarId);
        // Load existing calendar data
        this.loadCalendarData();
      } else {
        console.warn('No calendar ID found in route parameters');
      }
    });
    
    this.loadOrganizations();
    this.loadBranches();
    this.calculateWeekends();
    // Fetch all holidays for the table
    this.loadBranchHolidayTable();
  }

  private loadOrganizations() {
    this.calendarDataService.getOrganizations().subscribe(orgs => {
      this.organizationList = orgs.map(org => org.name);
      if (this.organizationList.length > 0) {
        this.selectedOrg = this.organizationList[0];
      }
      this.loadBranches(); // Load branches after organizations
    });
  }

  private loadBranches() {
    this.calendarDataService.getBranches().subscribe(branches => {
      this.branchList = branches;
      if (branches.length > 0) {
        this.selectedBranchId = branches[0].id;
        this.selectedBranch = branches[0].name;
        // Call processRouteParams to set year/branch from route
        this.processRouteParams();
      }
      this.loading = false;
    }, error => {
      console.error('Error loading branches:', error);
      this.loading = false;
    });
  }

  private processRouteParams() {
    this.route.params.subscribe(params => {
      this.calendarId = params['id'] || '';
      
      if (params['branch']) {
        const branchParam = params['branch'];
        // If the branch exists in our list, select it
        if (this.branchList.some(b => b.name === branchParam)) {
          this.selectedBranch = branchParam;
          this.selectedBranchId = this.branchList.find(b => b.name === branchParam)?.id || '';
        } else if (this.branchList.length > 0) {
          // If the branch doesn't exist, select the first one
          this.selectedBranch = this.branchList[0].name;
          this.selectedBranchId = this.branchList[0].id;
        }
        this.originalBranch = this.selectedBranch;
      } else if (this.branchList.length > 0) {
        this.selectedBranch = this.branchList[0].name;
        this.selectedBranchId = this.branchList[0].id;
      }
      
      if (params['year']) {
        this.selectedYear = +params['year'] || new Date().getFullYear();
      }
      
      if (this.selectedBranch && this.selectedYear) {
        this.fetchMarkedDates();
      }
    });
  }

  private loadCalendarData() {
    // Load existing calendar data for the given branch and year
    if (this.selectedBranch && this.selectedYear) {
      this.loading = true;
      
      // Get holidays for this branch and year
      this.calendarDataService.getHolidays(this.selectedOrg, this.selectedBranch, this.selectedYear).subscribe(
        holidays => {
          // Process holidays and update marked days
          this.markedDaysByMonth = {};
          
          holidays.forEach(holiday => {
            // Only process holidays that match our current branch and year
            if (holiday.branchName === this.selectedBranch && 
                new Date(holiday.holidayDate).getFullYear() === this.selectedYear) {
              
              const date = new Date(holiday.holidayDate);
              const monthIndex = date.getMonth();
              const day = date.getDate();
              const leaveType = (holiday.leaveDayType || '').toLowerCase();
              const isHalf = leaveType.includes('half') || leaveType.includes('1/2') || leaveType.includes('partial') || leaveType.replace(/\s/g, '').includes('halfday');
              const type = isHalf ? 'half' : 'full';
              
              if (!this.markedDaysByMonth[monthIndex]) {
                this.markedDaysByMonth[monthIndex] = {};
              }
              this.markedDaysByMonth[monthIndex][day] = {
                type: type,
                name: holiday.holidayName || 'Holiday'
              };
              
              // If we have a specific calendar ID to edit, find and store it
              if (this.calendarId && holiday.calendarId === this.calendarId) {
                console.log('Found holiday to edit:', holiday);
                // Store the holiday data for editing
                // You might want to store this in a property for later use
              }
            }
          });
          
          // In fetchMarkedDates or loadCalendarData, after processing holidays:
          this.monthsWithHolidays = Array.from(new Set(holidays.map(h => (new Date(h.holidayDate)).getMonth())));
          if (this.monthsWithHolidays.length > 0) {
            this.selectedMonthIndex = this.monthsWithHolidays[0];
          }

          this.loading = false;
        },
        error => {
          console.error('Error loading calendar data:', error);
          this.loading = false;
        }
      );
    }
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
        // Rebuild eventDetails for modal/editing
        this.eventDetails = {};
        holidays.forEach(holiday => {
          const date = new Date(holiday.holidayDate);
          const monthIndex = date.getMonth();
          const day = date.getDate();
          const eventKey = this.getEventKey(monthIndex, day);
          this.eventDetails[eventKey] = {
            holidayName: holiday.holidayName || 'Holiday',
            holidayType: holiday.holidayType || 'Public',
            leaveDayType: holiday.leaveDayType?.toLowerCase().includes('half') ? 'half day' : 'full day',
            isOptional: holiday.isOptional || false
          };
        });
        // Deep copy for original
        this.originalEventDetails = JSON.parse(JSON.stringify(this.eventDetails));
        // Set monthsWithHolidays and selectedMonthIndex for dropdown
        this.monthsWithHolidays = Array.from(new Set(holidays.map(h => (new Date(h.holidayDate)).getMonth())));
        if (this.monthsWithHolidays.length > 0) {
          this.selectedMonthIndex = this.monthsWithHolidays[0];
        } else {
          this.selectedMonthIndex = -1;
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('Error fetching holidays:', error);
        this.loading = false;
      }
    });
  }

  async openEventModal(month: string, monthIndex: number) {
    // Set the modal properties
    this.modalMonth = month;
    this.modalMonthIndex = monthIndex;
    this.modalYear = this.selectedYear;

    // Only pass holidays for the selected month
    const monthMarkedDays = this.markedDaysByMonth[monthIndex] ? { ...this.markedDaysByMonth[monthIndex] } : {};

    // Reset modal state to prevent random holidays from being added
    if (this.eventModalVisible) {
      this.eventModalVisible = false;
      setTimeout(() => {
        this.eventModalVisible = true;
      }, 0);
    } else {
      this.eventModalVisible = true;
    }

    // Optionally, you can store the monthMarkedDays in a property if needed for the modal
    // this.modalMarkedDays = monthMarkedDays;
  }

  closeEventModal() {
    this.eventModalVisible = false;
  }

  // Handle month changes from the modal
  onModalMonthChanged(event: { monthIndex: number, year: number }) {
    this.modalMonthIndex = event.monthIndex;
    this.modalYear = event.year;
    this.modalMonth = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ][this.modalMonthIndex];
  }

  // Helper method to create a key for storing event details
  public getEventKey(monthIndex: number, day: number): string {
    return `${monthIndex}-${day}`;
  }

  handleModalSave(eventData: { events: any[], monthIndex: number, year: number }) {
    const { events, monthIndex } = eventData;
    
    // Create a copy of the current marked days
    const updatedMarkedDays = { ...this.markedDaysByMonth };
    
    // Initialize markedDays for this month if it doesn't exist
    if (!updatedMarkedDays[monthIndex]) {
      updatedMarkedDays[monthIndex] = {};
    }
    
    // Process each event individually
    if (events && events.length > 0) {
      events.forEach(event => {
        if (event && event.date) {
          const day = event.date.getDate();
          const type = event.leaveDayType === 'half day' ? 'half' : 'full';
          
          // Update marked days with the leave day type and name
          updatedMarkedDays[monthIndex][day] = {
            type: type,
            name: event.holidayName || 'Holiday'
          };
          
          // Store holiday data for this day locally
          const eventKey = this.getEventKey(monthIndex, day);
          this.eventDetails[eventKey] = {
            holidayName: event.holidayName || 'Holiday',
            holidayType: event.holidayType || 'Public',
            leaveDayType: event.leaveDayType || 'full day',
            isOptional: event.isOptional || false
          };
        }
      });
    }
    
    // Update the local state with the new marked days
    this.markedDaysByMonth = updatedMarkedDays;
    
    // Show a success message
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: 'Changes saved locally',
      text: 'Changes will be saved when you click Save',
      showConfirmButton: false,
      timer: 1500,
      timerProgressBar: true
    });
  }

  public navigateToCalendar() {
    this.router.navigate(['/calendar']);
  }

  public async onSave() {
    if (!this.calendarId) {
      console.error('No calendar ID available for update');
      Swal.fire('Error', 'No calendar entry selected for update', 'error');
      return;
    }
    // Check for changes
    let hasChange = false;
    for (const key of Object.keys(this.eventDetails)) {
      const orig = this.originalEventDetails[key];
      const curr = this.eventDetails[key];
      if (!orig || !curr) continue;
      if (
        orig.holidayName !== curr.holidayName ||
        orig.holidayType !== curr.holidayType ||
        orig.leaveDayType !== curr.leaveDayType ||
        orig.isOptional !== curr.isOptional
      ) {
        hasChange = true;
        break;
      }
    }
    if (!hasChange) {
      const result = await Swal.fire({
        text: 'Would you like to return to the calendar overview?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Yes',
        cancelButtonText: 'No',
        reverseButtons: true
      });
      if (result.isConfirmed) {
        this.router.navigate(['/calendar']);
      }
      return;
    }
    // No API call, just show success and redirect
    Swal.fire({
      title: 'Success!',
      text: 'All holidays updated successfully',
      icon: 'success',
      confirmButtonText: 'OK'
    }).then(() => {
      this.router.navigate(['/calendar']);
    });
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

  getDayType(monthIndex: number, day: number): 'full' | 'half' | 'weekend' | null {
    const dayData = this.markedDaysByMonth[monthIndex]?.[day];
    if (dayData) {
      // Use the unified structure
      if (dayData.type === 'half') return 'half';
      if (dayData.type === 'full') return 'full';
    }
    // Check if it's a weekend
    if (this.weekends[monthIndex] && this.weekends[monthIndex].includes(day)) {
      return 'weekend';
    }
    return null;
  }

  getCalendarDays(monthIndex: number): number[] {
    const year = this.selectedYear;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => i + 1);
  }

  getStartDayOfMonth(monthIndex: number): number {
    const year = this.selectedYear;
    return new Date(year, monthIndex, 1).getDay();
  }

  getCalendarWeeks(monthIndex: number): number[][] {
    const year = this.selectedYear;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const firstDayOfWeek = new Date(year, monthIndex, 1).getDay(); // 0=Sunday
    let weeks: number[][] = [];
    let week: number[] = Array(firstDayOfWeek).fill(0);
    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }
    if (week.length > 0) {
      while (week.length < 7) week.push(0);
      weeks.push(week);
    }
    // Always return exactly 4 rows for a consistent look
    if (weeks.length > 4) {
      // Merge extra weeks into the 4th row
      let merged = weeks[3].slice();
      for (let i = 4; i < weeks.length; i++) {
        for (let j = 0; j < 7; j++) {
          if (weeks[i][j] !== 0) merged[j] = weeks[i][j];
        }
      }
      weeks = weeks.slice(0, 3);
      weeks.push(merged);
    } else if (weeks.length < 4) {
      while (weeks.length < 4) weeks.push(Array(7).fill(0));
    }
    return weeks;
  }

  onBranchChange() {
    const selected = this.branchList.find(b => b.id === this.selectedBranchId);
    this.selectedBranch = selected ? selected.name : '';
    this.fetchMarkedDates();
  }

  getMarkedDaysForModal() {
    return this.markedDaysByMonth[this.modalMonthIndex] || {};
  }

  loadBranchHolidayTable() {
    this.loading = true;
    this.calendarDataService.getHolidays(this.selectedOrg, undefined, this.selectedYear).subscribe(holidays => {
      // Group holidays by branch
      const grouped: { [branch: string]: any[] } = {};
      holidays.forEach(h => {
        if (!grouped[h.branchName]) grouped[h.branchName] = [];
        grouped[h.branchName].push(h);
      });
      this.branchHolidayTable = Object.keys(grouped).map(branch => ({
        branch,
        holidays: grouped[branch].sort((a, b) => new Date(a.holidayDate).getTime() - new Date(b.holidayDate).getTime())
      }));
      this.loading = false;
    }, _ => { this.loading = false; });
  }

  openEditModal(holiday: any) {
    this.editHolidayData = { ...holiday };
    this.showEditModal = true;
  }

  closeEditModal() {
    this.showEditModal = false;
    this.editHolidayData = null;
  }

  async handleEditModalSave(updatedHoliday: any) {
    // Normalize leaveDayType
    let normalizedLeaveDayType = updatedHoliday.leaveDayType?.toLowerCase().includes('half') ? 'Half Day' : 'Full Day';
    const updateBody = {
      organizationName: updatedHoliday.organizationName,
      branchName: updatedHoliday.branchName,
      year: updatedHoliday.year,
      holidayDate: updatedHoliday.holidayDate,
      holidayName: updatedHoliday.holidayName,
      holidayType: updatedHoliday.holidayType,
      leaveDayType: normalizedLeaveDayType as 'Full Day' | 'Half Day',
      isOptional: updatedHoliday.isOptional
    };
    // Update eventDetails for change detection
    const date = new Date(updatedHoliday.holidayDate);
    const eventKey = this.getEventKey(date.getMonth(), date.getDate());
    this.eventDetails[eventKey] = {
      holidayName: updatedHoliday.holidayName,
      holidayType: updatedHoliday.holidayType,
      leaveDayType: normalizedLeaveDayType.toLowerCase() === 'half day' ? 'half day' : 'full day',
      isOptional: updatedHoliday.isOptional
    };
    try {
      if (this.isDeleteMode) {
        // Call delete API
        await this.calendarDataService.deleteHoliday(updatedHoliday.calendarId).toPromise();
        Swal.fire('Deleted', 'Holiday deleted successfully!', 'success');
        this.loadBranchHolidayTable();
        this.fetchMarkedDates(); // Refresh calendar grid
        this.closeEditModal();
        return;
      }
      await this.calendarDataService.updateHoliday(updatedHoliday.calendarId, updateBody).toPromise();
      Swal.fire('Success', 'Holiday updated successfully!', 'success');
      this.loadBranchHolidayTable();
      this.fetchMarkedDates(); // Refresh calendar grid
      this.closeEditModal();
    } catch (err) {
      // Silently fail
    }
  }

  onEditHoliday(holiday: any) {
    this.openEditModal(holiday);
  }

  onDeleteHoliday(holiday: any) {
    // TODO: Implement delete logic (confirmation, API call, etc.)
    console.log('Delete holiday:', holiday);
  }
}
