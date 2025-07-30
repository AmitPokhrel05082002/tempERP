import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeaveService } from '../../../services/leave.service';
import { Employee } from '../../../services/leave.service';

@Component({
  selector: 'app-leave-allocation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule
  ],
  templateUrl: './leave-allocation.component.html',
  styleUrls: ['./leave-allocation.component.scss']
})
export class LeaveAllocationComponent implements OnInit {
  employees: Employee[] = [];
  loading = true;
  error: string | null = null;
  searchQuery = '';
  private _searchQuery = '';  // Private backing field for search query
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  constructor(
    private leaveService: LeaveService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadEmployees();
  }

  loadEmployees(): void {
    this.loading = true;
    this.error = null;

    this.leaveService.getAllEmployees().subscribe({
      next: (data) => {
        this.employees = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading employees:', err);
        this.error = 'Failed to load employee data. Please try again later.';
        this.loading = false;
      }
    });
  }

  getFullName(employee: Employee): string {
    if (employee.middleName) {
      return `${employee.firstName} ${employee.middleName} ${employee.lastName}`.trim();
    }
    return `${employee.firstName} ${employee.lastName}`.trim();
  }

  onSearchChange(): void {
    // Only reset page if search query has actually changed
    if (this._searchQuery !== this.searchQuery) {
      this._searchQuery = this.searchQuery;
      this.currentPage = 1;  // Reset to first page on new search
    }
  }

  get filteredEmployees(): Employee[] {
    let filtered = this.employees;
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(emp => 
        emp.empCode.toLowerCase().includes(query) ||
        this.getFullName(emp).toLowerCase().includes(query) ||
        (emp.organizationName?.toLowerCase().includes(query) || '') ||
        (emp.branchName?.toLowerCase().includes(query) || '') ||
        (emp.departmentName?.toLowerCase().includes(query) || '')
      );
    }
    
    return filtered;
  }
  
  get totalPages(): number {
    return Math.ceil(this.filteredEmployees.length / this.itemsPerPage);
  }
  
  get paginatedEmployees(): Employee[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredEmployees.slice(startIndex, startIndex + this.itemsPerPage);
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
      // Always include first page
      pages.push(1);
      
      // Calculate start and end of the middle section
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
      
      // Add ellipsis if needed before last page
      if (end < this.totalPages - 1) {
        pages.push(-1); // -1 represents ellipsis
      }
      
      // Always include last page
      if (this.totalPages > 1) {
        pages.push(this.totalPages);
      }
    }
    
    return pages;
  }

  viewEmployeeDetails(employee: Employee): void {
    if (employee && employee.empId) {
      this.router.navigate(['/leave-allocation-details', employee.empId]);
    }
  }
}
