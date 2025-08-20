import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeaveService, Employee } from '../../../services/leave.service';
import { DepartmentService, Branch, Department } from '../../../services/department.service';

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
  filteredEmployees: Employee[] = [];
  loading = true;
  error: string | null = null;
  searchQuery = '';
  private _searchQuery = '';  // Private backing field for search query
  
  // Filter properties
  branches: Branch[] = [];
  departments: Department[] = [];
  selectedBranch: string = '';
  selectedDepartment: string = '';
  
  // Filter properties
  
  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  constructor(
    private leaveService: LeaveService,
    private departmentService: DepartmentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadBranches();
    this.loadDepartments();
    this.loadEmployees();
  }

  loadBranches(): void {
    this.departmentService.getBranches().subscribe({
      next: (branches) => {
        this.branches = branches;
      },
      error: (err) => {
        console.error('Error loading branches:', err);
      }
    });
  }

  loadDepartments(): void {
    this.departmentService.getDepartments().subscribe({
      next: (response) => {
        this.departments = response.data;
      },
      error: (err) => {
        console.error('Error loading departments:', err);
      }
    });
  }
  

  onFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredEmployees = this.employees.filter(employee => {
      const matchesBranch = !this.selectedBranch || 
        (employee.branchName === this.getBranchName(this.selectedBranch));
      
      const matchesDepartment = !this.selectedDepartment || 
        (employee.departmentName === this.getDepartmentName(this.selectedDepartment));
      
      const matchesSearch = !this.searchQuery || 
        (employee.empCode && employee.empCode.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        ((employee.firstName + ' ' + (employee.middleName ? employee.middleName + ' ' : '') + employee.lastName).toLowerCase()
          .includes(this.searchQuery.toLowerCase()));
      
      return matchesBranch && matchesDepartment && matchesSearch;
    });
  }
  
  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => b.branchId === branchId);
    return branch ? branch.branchName : '';
  }
  
  getDepartmentName(deptId: string): string {
    const dept = this.departments.find(d => d.dept_id === deptId);
    return dept ? dept.dept_name : '';
  }

  loadEmployees(): void {
    this.loading = true;
    this.error = null;

    this.leaveService.getAllEmployees().subscribe({
      next: (data) => {
        this.employees = data;
        this.applyFilters();
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

  // Filter employees based on search and selected filters
  updateFilteredEmployees(): void {
    let filtered = this.employees;
    
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(emp => {
        const fullName = this.getFullName(emp).toLowerCase();
        return (
          emp.empCode.toLowerCase().includes(query) ||
          fullName.includes(query) ||
          (emp.organizationName?.toLowerCase().includes(query) || '')
        );
      });
    }
    
    this.filteredEmployees = filtered;
    this.currentPage = 1; // Reset to first page when filters change
  }
  
  get totalPages(): number {
    return Math.ceil(this.filteredEmployees.length / this.itemsPerPage);
  }
  
  get paginatedEmployees(): Employee[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return this.filteredEmployees.slice(startIndex, endIndex);
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
