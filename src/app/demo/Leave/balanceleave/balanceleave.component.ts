import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
// Define LeaveRequest interface locally since we're not using the employee constants anymore
interface LeaveRequest {
  id?: string;
  empCode?: string;
  name?: string;
  department?: string;
  image?: string;
  date?: string;
  duration?: string;
  status?: string;
  requestedDate?: Date;
  reason?: string;
  leaveBalances?: LeaveBalances;
  leaveHistory?: LeaveHistoryItem[];
}
import { LeaveService } from '../../../services/leave.service';
import { finalize } from 'rxjs/operators';
import { FormsModule } from '@angular/forms';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

interface LeaveBalance {
  used: number;
  total: number;
  remaining: number;
}

interface LeaveBalances {
  [key: string]: LeaveBalance;
}

interface LeaveHistoryItem {
  name: string;
  type: string;
  reason: string;
  submittedOn: string;
  appliedDate?: string;
  status: string; // Changed to string to handle various status values
  duration: string;
  empCode?: string; // Add empCode as optional
  leaveId?: string; // Add leaveId as optional
  [key: string]: any; // Allow additional properties
}

interface FilterOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-balanceleave',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './balanceleave.component.html',
  styleUrls: ['./balanceleave.component.scss']
})
export class BalanceleaveComponent implements OnInit {
  @ViewChild('exportDiv', { static: false }) exportDiv!: ElementRef;
  
  employee?: LeaveRequest;
  isSingleView = false;
  employeeName = '';
  employeeCode = ''; // Add employeeCode property
  currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  leaveBalances: LeaveBalances = {};
  leaveHistory: LeaveHistoryItem[] = [];

  statusFilters: FilterOption[] = [
    { label: 'All Statuses', value: 'all' },
    { label: 'Approved', value: 'APPROVED' },
    { label: 'Rejected', value: 'REJECTED' }
  ];

  typeFilters: FilterOption[] = [
    { label: 'Leave Type', value: 'all' },
    { label: 'Sick Leave', value: 'Sick Leave' },
    { label: 'Vacation', value: 'Vacation' },
    { label: 'Casual Leave', value: 'Casual Leave' },
    { label: 'Maternity/Paternity', value: 'Maternity/Paternity' }
  ];

  selectedStatus: string = 'all';
  selectedType: string = 'all';
  filteredHistory: LeaveHistoryItem[] = [];
  showStatusDropdown = false;
  showTypeDropdown = false;
  
  // Leave management properties
  selectedLeave: any = null;
  isProcessing = false;

  // Export the leave balance to PDF
  exportToPDF() {
    const element = document.getElementById('exportContent');
    if (!element) return;

    const options = {
      scale: 2,
      useCORS: true,
      logging: true,
      scrollX: 0,
      scrollY: 0
    };

    html2canvas(element, options).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 208;
      const pageHeight = 295;
      const imgHeight = canvas.height * imgWidth / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save('leave-balance.pdf');
    });
  }

  // Filter leave history by status
  filterByStatus(status: string) {
    this.selectedStatus = status;
    this.applyFilters();
  }

  // Approve a leave request
  approveLeave(leave: LeaveHistoryItem) {
    if (!leave.empCode || !leave.leaveId) {
      console.error('Employee code and leave ID are required');
      return;
    }
    
    this.isProcessing = true;
    
    this.leaveService.updateLeaveStatus(
      leave.leaveId,  // id
      true,           // approved
      'Approved by manager'  // reason
    ).pipe(
      finalize(() => this.isProcessing = false)
    ).subscribe({
      next: () => {
        // Update the local state
        leave.status = 'APPROVED';
        // Refresh the view
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error approving leave:', error);
        // Handle error (e.g., show error message)
      }
    });
  }



  constructor(
    private route: ActivatedRoute,
    private leaveService: LeaveService,
    private elementRef: ElementRef
  ) {}

  // Load employee data from the API
  private loadEmployeeData(empCode: string): void {
    if (!empCode) {
      console.error('No employee code provided');
      this.loadDefaultData();
      return;
    }
    
    this.loadEmployeeLeaveDetails(empCode);
  }

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      console.log('Route param id:', id);
      
      if (id) {
        this.isSingleView = true;
        this.employeeCode = id;
        this.loadEmployeeData(id);
      } else {
        this.loadDefaultData();
      }
    });
  }

  // Load employee leave details from the API
  private loadEmployeeLeaveDetails(empCode: string): void {
  this.isProcessing = true;
  
  // First get the employee details and leave history
  this.leaveService.getLeaveHistory(empCode)
    .pipe(
      finalize(() => this.isProcessing = false)
    )
    .subscribe({
      next: (leaveHistory: any[]) => {
        if (leaveHistory && Array.isArray(leaveHistory)) {
          // Map the API response to our LeaveHistoryItem format
          this.leaveHistory = leaveHistory.map((item: any) => ({
            id: item.id || '',
            leaveId: item.leaveId || '',
            empCode: item.empCode || '',
            name: item.employeeName || item.name || 'Unknown',
            type: item.leaveType || item.leaveName || 'Unknown',
            reason: item.reason || 'No reason provided',
            appliedDate: item.appliedDate || item.date || new Date().toISOString(),
            submittedOn: item.appliedDate || item.date || new Date().toISOString(),
            status: (item.status || 'PENDING').toUpperCase(),
            duration: item.duration || '1 day',
            ...item // Include all other properties from the response
          }));
          
          // If we have history but no employee name, try to get it from the first record
          if (leaveHistory.length > 0) {
            this.employeeName = leaveHistory[0].employeeName || leaveHistory[0].name || 'Employee';
            // Store the employee code if available
            if (leaveHistory[0].empCode) {
              this.employeeCode = leaveHistory[0].empCode;
            } else if (empCode) {
              // Use the provided empId as the code if no code is in the response
              this.employeeCode = empCode;
            }
          }
          
          // Update leave balances
          const leaveBalances: LeaveBalances = {
            sickLeave: {
              used: leaveHistory.reduce((acc, item) => acc + (item.type === 'Sick Leave' ? 1 : 0), 0),
              total: 7,
              remaining: 7 - leaveHistory.reduce((acc, item) => acc + (item.type === 'Sick Leave' ? 1 : 0), 0)
            },
            vacation: {
              used: leaveHistory.reduce((acc, item) => acc + (item.type === 'Vacation' ? 1 : 0), 0),
              total: 14,
              remaining: 14 - leaveHistory.reduce((acc, item) => acc + (item.type === 'Vacation' ? 1 : 0), 0)
            },
            casualLeave: {
              used: leaveHistory.reduce((acc, item) => acc + (item.type === 'Casual Leave' ? 1 : 0), 0),
              total: 7,
              remaining: 7 - leaveHistory.reduce((acc, item) => acc + (item.type === 'Casual Leave' ? 1 : 0), 0)
            },
            maternityPaternity: {
              used: leaveHistory.reduce((acc, item) => acc + (item.type === 'Maternity/Paternity' ? 1 : 0), 0),
              total: 0,
              remaining: 0 - leaveHistory.reduce((acc, item) => acc + (item.type === 'Maternity/Paternity' ? 1 : 0), 0)
            }
          };
          this.leaveBalances = leaveBalances;
          
          this.applyFilters();
        } else {
          // If no history data, ensure we have an empty array
          this.leaveHistory = [];
        }
      },
      error: (error) => {
        console.error('Error loading leave history:', error);
        this.leaveHistory = [];
      }
    });
  }

  // Load default data when no employee is selected
  private loadDefaultData(): void {
    this.employee = undefined;
    this.employeeName = 'No Employee Selected';
    this.employeeCode = '';
    this.leaveBalances = {};
    this.leaveHistory = [];
    this.filteredHistory = [];
  }

  // Update the view data after loading employee details
  private updateViewData(): void {
    this.applyFilters();
  }

  // Reject a leave request
  rejectLeave(leave: LeaveHistoryItem): void {
    if (!leave.empCode) {
      console.error('Employee code is required');
      return;
    }
    
    const reason = prompt('Please enter the reason for rejection:');
    if (reason === null) {
      return; // User cancelled
    }

    this.isProcessing = true;
    
    this.leaveService.updateLeaveStatus({
      empCode: leave.empCode,
      id: leave.leaveId || '',
      approved: false,
      reason: reason
    }).pipe(
      finalize(() => this.isProcessing = false)
    ).subscribe({
      next: () => {
        // Update the local state
        leave.status = 'REJECTED';
        // Refresh the view
        this.applyFilters();
      },
      error: (error) => {
        console.error('Error rejecting leave:', error);
        // Handle error (e.g., show error message)
      }
    });
  }



  filterByType(type: string): void {
    this.selectedType = type;
    this.showTypeDropdown = false;
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.leaveHistory) {
      this.filteredHistory = [];
      return;
    }
    this.filteredHistory = this.leaveHistory.filter(item => {
      // Handle status filtering
      const statusMatch = 
        this.selectedStatus === 'all' || 
        item.status === this.selectedStatus ||
        (item.status && item.status.toLowerCase() === this.selectedStatus.toLowerCase());
      
      // Handle type filtering
      const typeMatch = 
        this.selectedType === 'all' || 
        (item.type && item.type.toLowerCase().includes(this.selectedType.toLowerCase()));
      
      return statusMatch && typeMatch;
    });
  }

  toggleStatusDropdown(): void {
    this.showStatusDropdown = !this.showStatusDropdown;
    this.showTypeDropdown = false;
  }

  toggleTypeDropdown(): void {
    this.showTypeDropdown = !this.showTypeDropdown;
    this.showStatusDropdown = false;
  }

  getStatusLabel(value: string): string {
    if (!value) return 'Pending';
    const status = value.toLowerCase();
    switch(status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Pending';
      default: return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
    }
  }



  getTypeLabel(value: string): string {
    return this.typeFilters.find(f => f.value === value)?.label || 'Select Type';
  }

  getTypeIconClass(type: string): string {
    switch(type) {
      case 'Sick Leave': return 'bi-heart-pulse text-danger';
      case 'Vacation': return 'bi-airplane text-primary';
      case 'Casual Leave': return 'bi-cup-hot text-warning';
      case 'Maternity/Paternity': return 'bi-people-fill text-info';
      default: return 'bi-question-circle';
    }
  }

  getStatusIconClass(status: string): string {
    if (!status) return 'bi-hourglass-split text-warning';
    const statusLower = status.toLowerCase();
    switch(statusLower) {
      case 'approved': return 'bi-check-circle-fill text-success';
      case 'rejected': return 'bi-x-circle-fill text-danger';
      case 'pending': return 'bi-hourglass-split text-warning';
      default: return 'bi-question-circle text-secondary';
    }
  }

  getStatusClass(status: string): string {
    if (!status) return 'pending';
    const statusLower = status.toLowerCase();
    return statusLower === 'pending' ? 'pending' : statusLower;
  }
}