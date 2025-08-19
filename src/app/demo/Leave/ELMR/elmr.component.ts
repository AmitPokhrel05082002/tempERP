import { Component, ElementRef, ViewChild, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { LeaveService, LeaveRequest, LeaveType } from '../../../services/leave.service';
import { AuthService } from '../../../core/services/auth.service';
import { finalize } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Swal from 'sweetalert2';
import { LeaveFormComponent } from '../leave-form/leave-form.component';
import { QRCodeComponent } from 'angularx-qrcode';
import { DepartmentService } from '../../../services/department.service';

interface LeaveRequestUI {
  id: string;
  empId: string;
  empCode: string;
  name: string;
  division?: string;
  department: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  reason: string;
  status: string;
  image: string;
  leaveBalances: any;
  leaveHistory: any[];
  date: string;
  rawDate: string;
  duration: string;
}

@Component({
  selector: 'app-elmr',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, QRCodeComponent],
  templateUrl: './elmr.component.html',
  styleUrls: ['./elmr.component.scss'],
  providers: [LeaveService, DepartmentService]
})
export class ELMRComponent implements OnInit {
  @ViewChild('exportDiv', { static: false }) exportDiv!: ElementRef;
  @ViewChild('dateInput') dateInput!: ElementRef;

  // UI State
  showRequestModal = false;
  isLoading = false;
  errorMessage: string | null = null;
  showQRCodeModal = false;
  showLeaveForm = false;
  qrData = window.location.origin + '/leave-form';
  qrCodeImage = 'assets/frame (2).png';
  searchTerm = '';
  departments: string[] = [];
  selectedDepartment = 'All Departments';
  selectedDate: string | null = null;
  showDatePicker = false;
  showFilter = false;
  filterName = '';
  filterDate = '';
  filterDepartment = '';
  filterCount = 0;
  showFilters = false;
  statuses = ['Pending', 'Approved', 'Rejected'];
  selectedStatus = '';
  filterStartDate = '';
  filterEndDate = '';

  // Data Stores
  leaveRequests: LeaveRequestUI[] = [];
  allLeaveRequests: LeaveRequestUI[] = [];
  managerDepartment: string | null = null;
  
  isCurrentUserEmployee(): boolean {
    return this.authService.isEmployee();
  }

  // Services
  private http = inject(HttpClient);
  private leaveService = inject(LeaveService);
  private router = inject(Router);
  authService = inject(AuthService);  // Made public for template access
  private departmentService = inject(DepartmentService);

  ngOnInit(): void {
    this.loadDepartments();
    this.loadLeaveRequests();
    this.setupManagerDepartment();
  }

  private setupManagerDepartment(): void {
    if (this.authService.isManager()) {
      const user = this.authService.currentUserValue;
      const deptId = user?.deptId || user?.deptID;
      
      if (deptId) {
        this.departmentService.getDepartmentById(deptId).subscribe({
          next: (response) => {
            if (response && response.success) {
              this.managerDepartment = response.data?.dept_name || 'Department';
              // Set the department filter internally but don't show the filter UI
              this.selectedDepartment = response.data?.dept_name || 'All Departments';
              // Force load the leave requests for this department
              this.loadLeaveRequests();
            } else {
              this.managerDepartment = 'Department';
              this.loadLeaveRequests();
            }
          },
          error: (error) => {
                    this.managerDepartment = 'Department';
            this.loadLeaveRequests();
          }
        });
      } else {
        this.managerDepartment = 'Department';
        this.loadLeaveRequests();
      }
    }
  }

  canSeeDepartmentControls(): boolean {
    return this.authService.isAdmin() || this.authService.hasPermission('HR_MANAGER') || this.authService.isManager();
  }

  applyFiltersAndClose(): void {
    this.applyFilters();
    this.showFilters = false;
  }
  
  canManageLeaves(): boolean {
    return this.authService.isAdmin() || this.authService.isCTO() || this.authService.isManager();
  }

  loadDepartments(): void {
    // Only load departments if user can see department controls
    if (!this.canSeeDepartmentControls() || this.isCurrentUserEmployee()) {
      this.departments = ['All Departments'];
      return;
    }

    this.departmentService.getDepartments().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          // Remove any existing 'All Departments' and duplicates
          const uniqueDepartments = new Set<string>();
          
          // Add 'All Departments' first
          uniqueDepartments.add('All Departments');
          
          // Add all departments from the response
          response.data.forEach((dept: any) => {
            if (dept.dept_name) {
              uniqueDepartments.add(dept.dept_name);
            }
          });
          
          this.departments = Array.from(uniqueDepartments);
        } else {
          // Fallback to just 'All Departments' if no data
          this.departments = ['All Departments'];
        }
      },
      error: (error) => {
        this.departments = ['All Departments'];
      }
    });
  }

  loadLeaveRequests(): void {
    this.isLoading = true;
    this.errorMessage = null;
    
    if (this.isCurrentUserEmployee()) {
      // For employees, only load their own requests
      this.leaveService.getLeaveRequests('current').pipe(
        finalize(() => {
          this.isLoading = false;
        })
      ).subscribe({
        next: (currentData) => {
          const currentLeaves = Array.isArray(currentData) ? currentData : [];
          const filteredCurrentLeaves = this.filterLeavesByUserRole(currentLeaves);
          this.leaveRequests = this.mapApiResponseToUI(filteredCurrentLeaves);
          this.allLeaveRequests = this.leaveRequests; // For employees, both are the same
        },
        error: (error) => {
          this.handleLoadError(error);
        }
      });
    } else {
      // For admins/managers, first get the manager's department
      const currentUser = this.authService.currentUserValue;
      if (currentUser?.deptId) {
        this.departmentService.getDepartmentById(currentUser.deptId).subscribe({
          next: (deptResponse: any) => {
            if (deptResponse.success && deptResponse.data) {
              this.managerDepartment = deptResponse.data.dept_name;
              
              // Now load both current and all requests
              combineLatest([
                this.leaveService.getLeaveRequests('current'),
                this.leaveService.getLeaveRequests('all')
              ]).pipe(
                finalize(() => {
                  this.isLoading = false;
                })
              ).subscribe({
                next: ([currentData, allData]) => {
                  // First map to UI model to ensure consistent data structure
                  let currentLeaves = this.mapApiResponseToUI(Array.isArray(currentData) ? currentData : []);
                  let allLeaves = this.mapApiResponseToUI(Array.isArray(allData) ? allData : []);
                  
                  // Filter by department if manager
                  if (this.authService.isManager() && this.managerDepartment) {
                    const managerDeptLower = this.managerDepartment.toLowerCase().trim();
                  
        
                    // First, check if any leaves have the department/division set
                    currentLeaves = currentLeaves.filter(leave => {
                      const leaveDept = String(leave.department || '').toLowerCase().trim();
                      const leaveDivision = String(leave.division || '').toLowerCase().trim();
                      
                      const matches = leaveDept === managerDeptLower || 
                                    leaveDivision === managerDeptLower ||
                                    (leaveDept.includes(managerDeptLower) || 
                                     managerDeptLower.includes(leaveDept) ||
                                     leaveDivision.includes(managerDeptLower) ||
                                     managerDeptLower.includes(leaveDivision));
                    
                      
                      return matches;
                    });
                    
                    allLeaves = allLeaves.filter(leave => {
                      const leaveDept = String(leave.department || '').toLowerCase().trim();
                      const leaveDivision = String(leave.division || '').toLowerCase().trim();
                      
                      return leaveDept === managerDeptLower || 
                             leaveDivision === managerDeptLower ||
                             (leaveDept.includes(managerDeptLower) || 
                              managerDeptLower.includes(leaveDept) ||
                              leaveDivision.includes(managerDeptLower) ||
                              managerDeptLower.includes(leaveDivision));
                    });
            
                    
                    if (currentLeaves.length === 0) {
                    }
                  }
                  
                  this.leaveRequests = currentLeaves;
                  this.allLeaveRequests = allLeaves;
                },
                error: (error) => {
                  this.handleLoadError(error);
                }
              });
            } else {
              this.isLoading = false;
              this.handleLoadError(new Error('Failed to load department information'));
            }
          },
          error: (error) => {
            this.isLoading = false;
            this.handleLoadError(error);
          }
        });
      } else {
        // If no department ID, just load all requests without filtering
        combineLatest([
          this.leaveService.getLeaveRequests('current'),
          this.leaveService.getLeaveRequests('all')
        ]).pipe(
          finalize(() => {
            this.isLoading = false;
          })
        ).subscribe({
          next: ([currentData, allData]) => {
            const currentLeaves = Array.isArray(currentData) ? currentData : [];
            const allLeaves = Array.isArray(allData) ? allData : [];
            
            this.leaveRequests = this.mapApiResponseToUI(currentLeaves);
            this.allLeaveRequests = this.mapApiResponseToUI(allLeaves);
          },
          error: (error) => {
            this.handleLoadError(error);
          }
        });
      }
    }
  }
  /**
   * Filter leave requests based on user role
   * @param leaveRequests - Array of leave requests to filter
   * @returns Filtered array based on user permissions
   */
  private filterLeavesByUserRole(leaveRequests: any[]): any[] {
    const currentUser = this.authService.getCurrentUser();
    
    if (!currentUser) {
      return [];
    }
  
    // If user is Admin, CTO or Manager, show all requests
    if (this.authService.isAdmin() || this.authService.isCTO() || this.authService.isManager()) {
      return leaveRequests;
    }
  
    // For employees, show only their own requests
    return leaveRequests.filter(leave => {
      return leave.empId === currentUser.empId || 
             leave.empCode === currentUser.empId ||
             leave.empId === currentUser.userId ||
             leave.empCode === currentUser.userId ||
             String(leave.empId) === String(currentUser.empId) ||
             String(leave.empCode) === String(currentUser.empId);
    });
  }
  toggleDatePicker(): void {
    this.showDatePicker = !this.showDatePicker;
  }
  
  clearSelectedDate(): void {
    this.selectedDate = null;
    this.applyFilters();
  }
  
  onDateChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedDate = input.value;
    this.showDatePicker = false;
    this.applyFilters();
  }

  onDepartmentChange(): void {
    this.applyFilters();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
  }

  setStatusFilter(status: string): void {
    this.selectedStatus = status;
  }

  private applyFilters(): void {
    this.leaveRequests = this.allLeaveRequests.filter(leave => {
      const matchesSearch = !this.searchTerm || 
        leave.name.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        leave.empCode.toLowerCase().includes(this.searchTerm.toLowerCase());
      
      const matchesDepartment = this.selectedDepartment === 'All Departments' || 
        (leave.department && leave.department === this.selectedDepartment);
      
      const matchesDate = !this.selectedDate || 
        (leave.rawDate && leave.rawDate === this.selectedDate);
      
      const matchesStatus = !this.selectedStatus ||
        leave.status === this.selectedStatus;
      
      return matchesSearch && matchesDepartment && matchesDate && matchesStatus;
    });
    this.filterCount = this.calculateFilterCount();
  }

  private calculateFilterCount(): number {
    let count = 0;
    if (this.searchTerm) count++;
    if (this.selectedDepartment !== 'All Departments') count++;
    if (this.selectedDate) count++;
    if (this.selectedStatus) count++;
    return count;
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedDepartment = 'All Departments';
    this.selectedDate = null;
    this.filterName = '';
    this.filterDate = '';
    this.filterDepartment = '';
    this.selectedStatus = '';
    this.applyFilters();
  }

  /**
   * Checks if any filters are currently applied
   * @returns boolean - true if any filters are active, false otherwise
   */
  hasAppliedFilters(): boolean {
    return (
      this.searchTerm.trim() !== '' ||
      this.selectedDepartment !== 'All Departments' ||
      this.selectedStatus !== '' ||
      this.selectedDate !== null ||
      this.filterStartDate !== '' ||
      this.filterEndDate !== ''
    );
  }

  formatDisplayDate(dateString: string | null): string {
    if (!dateString) return 'Select Date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
        return dateString || '';
    }
  }

  private mapApiResponseToUI(apiData: any[]): LeaveRequestUI[] {
    if (!apiData || !Array.isArray(apiData)) return [];

    return apiData.map(item => {
      try {
        const fromDate = new Date(item.fromDate);
        const toDate = new Date(item.toDate);
        
        const formattedDate = isNaN(fromDate.getTime()) 
          ? 'Invalid Date' 
          : fromDate.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            });
        
        const duration = item.totalDays || 1;
        const durationText = duration === 1 ? '1 day' : `${duration} days`;
        
        const normalizedStatus = item.status 
          ? item.status.charAt(0).toUpperCase() + item.status.slice(1).toLowerCase()
          : 'Pending';

        // Get department/division from the most likely properties
        const department = item.department || item.division || item.dept_name || item.division_name || 'N/A';
        
        return {
          id: item.id || `temp-${Math.random().toString(36).substr(2, 9)}`,
          empId: item.empId || '',
          empCode: item.empCode || '',
          name: item.name || 'Unknown Employee',
          department: department,
          division: item.division || department, // Keep original division if available
          fromDate: item.fromDate || '',
          toDate: item.toDate || '',
          totalDays: item.totalDays || 1,
          reason: item.reason || '',
          status: normalizedStatus,
          image: 'assets/images/default-avatar.png',
          date: formattedDate,
          rawDate: item.fromDate || '',
          duration: durationText,
          leaveBalances: item.leaveBalances || {},
          leaveHistory: item.leaveHistory || []
        };
      } catch (error) {
        return null;
      }
    }).filter((item): item is NonNullable<typeof item> => item !== null) as LeaveRequestUI[];
  }

  get filteredLeaves(): LeaveRequestUI[] {
    if (!this.allLeaveRequests || this.allLeaveRequests.length === 0) {
      return [];
    }
    
    const leavesToFilter = this.isCurrentUserEmployee() ? this.leaveRequests : this.allLeaveRequests;
    
    return leavesToFilter.filter(leave => {
      const searchTermLower = this.searchTerm ? this.searchTerm.toLowerCase() : '';
      const nameLower = leave.name ? leave.name.toLowerCase() : '';
      const empCodeLower = leave.empCode ? leave.empCode.toLowerCase() : '';
      
      const matchesSearch = !this.searchTerm || 
        nameLower.includes(searchTermLower) ||
        empCodeLower.includes(searchTermLower);
  
      const normalizeString = (str: string | null | undefined): string => 
        (str || '').toString().trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const selectedDeptNormalized = normalizeString(this.selectedDepartment);
      const leaveDeptNormalized = normalizeString(leave.department);
      const leaveDivisionNormalized = normalizeString(leave.division);
      
      const matchesDepartment = this.selectedDepartment === 'All Departments' || 
        (leave.department && leaveDeptNormalized === selectedDeptNormalized) ||
        (leave.division && leaveDivisionNormalized === selectedDeptNormalized);
  
      const matchesDate = !this.selectedDate || 
        (leave.rawDate && leave.rawDate.toString() === this.selectedDate.toString());
  
      return matchesSearch && matchesDepartment && matchesDate;
    });
  }
  get filteredTodaysLeaves(): LeaveRequestUI[] {
    if (!this.leaveRequests || this.leaveRequests.length === 0) return [];

    return this.leaveRequests.filter(leave => {
      const matchesSearch = !this.searchTerm || 
        (leave.name && leave.name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (leave.empCode && leave.empCode.toLowerCase().includes(this.searchTerm.toLowerCase()));

      const matchesDepartment = this.selectedDepartment === 'All Departments' || 
        (leave.department && leave.department === this.selectedDepartment);

      return matchesSearch && matchesDepartment;
    });
  }

  updateStatus(leave: LeaveRequestUI, status: 'Approved' | 'Rejected'): void {
    const isApproved = status === 'Approved';
    const actionText = isApproved ? 'approve' : 'reject';
    
    const showConfirmation = (): Promise<{isConfirmed: boolean, reason?: string}> => {
      if (isApproved) {
        return Swal.fire({
          title: 'Approve Leave',
          text: 'Are you sure you want to approve this leave request?',
          icon: 'question',
          showCancelButton: true,
          confirmButtonColor: '#3085d6',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes',
          cancelButtonText: 'Cancel'
        }).then((result) => ({
          isConfirmed: result.isConfirmed,
          reason: undefined
        }));
      } else {
        return Swal.fire({
          title: 'Reject Leave',
          html: `
            <p>Please provide a reason for rejection:</p>
            <textarea id="rejectionReason" class="swal2-textarea" placeholder="Enter reason for rejection..." required></textarea>
          `,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#d33',
          cancelButtonColor: '#6c757d',
          confirmButtonText: 'Yes',
          cancelButtonText: 'Cancel',
          focusConfirm: false,
          preConfirm: () => {
            const reasonInput = document.getElementById('rejectionReason') as HTMLTextAreaElement;
            const reason = reasonInput?.value.trim();
            if (!reason) {
              Swal.showValidationMessage('Please provide a reason for rejection');
              return false;
            }
            return reason;
          }
        }).then((result) => ({
          isConfirmed: result.isConfirmed,
          reason: result.value
        }));
      }
    };

    showConfirmation().then(({isConfirmed, reason}) => {
      if (isConfirmed) {
        Swal.fire({
          title: 'Updating...',
          text: 'Please wait while we update the leave status',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        
        this.leaveService.updateLeaveStatus({
          empCode: leave.empCode,
          id: leave.id,
          approved: isApproved,
          reason: reason
        }).subscribe({
          next: () => {
            const updateLeaveInArray = (arr: LeaveRequestUI[]) => {
              const index = arr.findIndex(l => l.id === leave.id);
              if (index !== -1) {
                arr[index].status = status;
                return [...arr];
              }
              return arr;
            };

            this.leaveRequests = updateLeaveInArray(this.leaveRequests);
            this.allLeaveRequests = updateLeaveInArray(this.allLeaveRequests);
            
            Swal.fire({
              icon: 'success',
              title: 'Success!',
              text: `Leave request has been ${status.toLowerCase()}.`,
              confirmButtonColor: '#3085d6',
            });
          },
          error: (error) => {
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: `Failed to ${actionText} leave request. Please try again.`,
              confirmButtonColor: '#d33',
            });
          }
        });
      }
    });
  }

  exportToPDF(): void {
    if (!this.exportDiv) return;
    
    const element = this.exportDiv.nativeElement;
    const options = {
      scale: 2,
      useCORS: true,
      logging: true,
      letterRendering: true,
      allowTaint: true
    };

    html2canvas(element, options).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('leave-requests.pdf');
      
      Swal.close();
      this.showSuccessToast('The PDF has been generated.');
    }).catch(error => {
      Swal.fire({
        icon: 'error',
        title: 'Error!',
        text: 'There was an error generating the PDF.',
        confirmButtonColor: '#d33'
      });
    });
  }

  navigateToEmployeeDetails(employeeId: string): void {
    this.router.navigate(['/employee', employeeId]);
  }

  openRequestModal(): void {
    this.showRequestModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.showRequestModal = false;
    document.body.style.overflow = 'auto';
  }

  openLeaveForm(): void {
    this.showRequestModal = false;
    this.router.navigate(['/leave-form']);
  }

  closeLeaveForm() {
    this.showLeaveForm = false;
    document.body.style.overflow = 'auto';
  }

  onLeaveSubmitted(success: boolean) {
    if (success) {
      Swal.fire({
        title: 'Success!',
        text: 'Leave request submitted successfully',
        icon: 'success',
        confirmButtonText: 'OK'
      });
      this.loadLeaveRequests();
    }
    this.closeLeaveForm();
  }

  generateQR(): void {
    this.showRequestModal = false;
    this.showQRCodeModal = true;
    document.body.style.overflow = 'hidden';
  }

  closeQRCodeModal(): void {
    this.showQRCodeModal = false;
    document.body.style.overflow = 'auto';
  }

  downloadQRCode(): void {
    const link = document.createElement('a');
    link.href = this.qrCodeImage;
    link.download = 'leave-request-qr-code.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showSuccessToast('QR code downloaded successfully!');
  }

  private showSuccessToast(message: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      title: message,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }
  private handleLoadError(error: any): void {
    this.errorMessage = 'Failed to load leave requests. Please try again later.';
    Swal.fire({
      title: 'Error!',
      text: this.errorMessage,
      icon: 'error',
      confirmButtonText: 'OK'
    });
  }
}