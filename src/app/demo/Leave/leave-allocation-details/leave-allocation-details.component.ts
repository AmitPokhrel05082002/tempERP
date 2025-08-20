import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LeaveService } from '../../../services/leave.service';

export interface LeaveAllocation {
  allocationId: string;
  allocationYear: number;
  allocationMonth: number;
  allocationMonthName: string;
  openingBalance: number;
  annualAccrual: number;
  adjustments: number;
  utilizedBalance: number;
  lateAttendence: number;
  closingBalance: number;
  noOfWorkingDays: number;
  excludedDays: number;
  leaveTypeName: string | null;
}

@Component({
  selector: 'app-leave-allocation-details',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leave-allocation-details.component.html',
  styleUrl: './leave-allocation-details.component.scss'
})
export class LeaveAllocationDetailsComponent implements OnInit {
  employeeId: string = '';
  employeeName: string = 'Employee';
  loading: boolean = true;
  error: string | null = null;
  allocations: LeaveAllocation[] = [];
  currentPage: number = 1;
  itemsPerPage: number = 10;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private leaveService: LeaveService
  ) {}

  ngOnInit(): void {
    this.employeeId = this.route.snapshot.paramMap.get('empId') || '';
    if (this.employeeId) {
      this.loadLeaveAllocations();
    } else {
      this.error = 'No employee ID provided';
      this.loading = false;
    }
  }

  loadLeaveAllocations(): void {
    this.loading = true;
    this.error = null;

    this.leaveService.getLeaveAllocations(this.employeeId).subscribe({
      next: (data: any) => {
        // Filter out duplicate allocations based on year, month, and leave type
        const uniqueAllocations = data.filter((allocation: any, index: number, self: any[]) => {
          // Create a unique key for each allocation
          const key = `${allocation.allocationYear}-${allocation.allocationMonth}-${allocation.leaveTypeName || 'default'}`;
          // Check if this is the first occurrence of this key
          return index === self.findIndex((a: any) => 
            `${a.allocationYear}-${a.allocationMonth}-${a.leaveTypeName || 'default'}` === key
          );
        });
        
        this.allocations = uniqueAllocations;
        this.loading = false;
        
        // Set employee name from the first allocation if available
        if (uniqueAllocations.length > 0 && uniqueAllocations[0].employeeName) {
          this.employeeName = uniqueAllocations[0].employeeName;
        }
      },
      error: (err) => {
        console.error('Error loading leave allocations:', err);
        this.error = 'Failed to load leave allocations. Please try again later.';
        this.loading = false;
      }
    });
  }

  get totalPages(): number {
    return Math.ceil(this.allocations.length / this.itemsPerPage);
  }

  get paginatedAllocations(): LeaveAllocation[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.allocations.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  getPages(): number[] {
    const pages: number[] = [];
    const maxPages = 5; // Show max 5 page numbers in the pagination
    
    if (this.totalPages <= maxPages) {
      // If total pages are less than max pages, show all
      for (let i = 1; i <= this.totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      // Calculate start and end pages to show around current page
      let start = Math.max(2, this.currentPage - 1);
      let end = Math.min(this.totalPages - 1, this.currentPage + 1);
      
      // Adjust if we're near the start or end
      if (this.currentPage <= 3) {
        end = 3;
      } else if (this.currentPage >= this.totalPages - 2) {
        start = this.totalPages - 2;
      }
      
      // Add ellipsis if needed after first page
      if (start > 2) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      // Add middle pages
      for (let i = start; i <= end; i++) {
        if (i > 1 && i < this.totalPages) {
          pages.push(i);
        }
      }
      
      // Add ellipsis before last page if needed
      if (end < this.totalPages - 1) {
        pages.push(-1);
      }
      
      // Always show last page if there is more than one page
      if (this.totalPages > 1) {
        pages.push(this.totalPages);
      }
    }
    
    return pages;
  }

  goBack(): void {
    this.router.navigate(['/leave-allocation']);
  }
}
