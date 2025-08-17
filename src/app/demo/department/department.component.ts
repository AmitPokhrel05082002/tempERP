import { Component, HostListener, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepartmentService, Department, DepartmentListResponse, DepartmentResponse, Organization, Branch } from '../../services/department.service';
import Swal from 'sweetalert2';

interface DepartmentTableItem extends Department {
  org_name: string;
  branch_name: string;
  sub_departments_count: number;
  status?: boolean;
}
import { HttpClientModule } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal, NgbModalRef, NgbModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-department',
  standalone: true,
  imports: [
    CommonModule,
    HttpClientModule,
    ReactiveFormsModule,
    FormsModule,
    NgbModule
  ],
  templateUrl: './department.component.html',
  styleUrls: ['./department.component.scss']
})
export class DepartmentComponent implements OnInit {
  departments: DepartmentTableItem[] = [];
  filteredDepartments: DepartmentTableItem[] = [];
  organizations: Partial<Organization>[] = [];
  branches: Partial<Branch>[] = [];
  showFilters = false;
  
  // Filter properties
  searchQuery = '';
  selectedOrganizations: string[] = [];
  selectedStatus: string | null = null;
  activeFilterCount = 0;
  currentPage = 1;
  itemsPerPage = 10;
  private _totalPages = 1;
  private _paginatedDepartments: DepartmentTableItem[] = [];
  departmentForm: FormGroup;
  isEditMode = false;
  currentDepartmentId: string | null = null;
  error: string | null = null;
  isLoading = false;
  isLoadingOrganizations = false;
  isLoadingBranches = false;
  isSubmitting = false;
  private modalRef!: NgbModalRef;

  @ViewChild('departmentModal') departmentModal!: TemplateRef<any>;

  constructor(
    private departmentService: DepartmentService,
    private fb: FormBuilder,
    private modalService: NgbModal
  ) {
    this.departmentForm = this.fb.group({
      dept_name: ['', [Validators.required, Validators.minLength(3)]],
      org_id: ['', [Validators.required]],
      branch_id: ['', [Validators.required]],
    });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.loadDepartments();
    this.loadOrganizations();
    this.loadBranches();
    this.updatePagination();
  }

  initializeForm() {
    this.departmentForm = this.fb.group({
      dept_name: ['', [Validators.required, Validators.minLength(3)]],
      org_id: ['', [Validators.required]],
      branch_id: ['', [Validators.required]],
    });
  }

  private updatePagination() {
    if (!this.filteredDepartments) {
      this._paginatedDepartments = [];
      this._totalPages = 0;
      return;
    }
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this._paginatedDepartments = this.filteredDepartments.slice(startIndex, endIndex);
    this._totalPages = Math.ceil(this.filteredDepartments.length / this.itemsPerPage) || 1;
  }

  loadDepartments(): void {
    this.isLoading = true;
    this.error = null;

    this.departmentService.getDepartments().subscribe({
      next: (response: DepartmentListResponse) => {
        if (response && response.success) {
          this.departments = response.data.map(dept => ({
            ...dept,
            org_name: dept.organization?.orgName || 'N/A',
            branch_name: dept.branch?.branchName || 'N/A',
            sub_departments_count: dept.sub_departments?.length || 0
          }));
          this.applyFilters();
        } else {
          this.error = response?.message || 'Failed to load departments';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error loading departments. Please try again.';
        this.isLoading = false;
        console.error('Error loading departments:', err);
      }
    });
  }

  applyFilters(): void {
    if (!this.departments) return;
    
    this.filteredDepartments = this.departments.filter(dept => {
      // Search filter - check if search query matches dept_name or dept_code
      const searchMatch = !this.searchQuery || 
                         (dept.dept_name && dept.dept_name.toLowerCase().includes(this.searchQuery.trim().toLowerCase())) ||
                         (dept.dept_code && dept.dept_code.toLowerCase().includes(this.searchQuery.trim().toLowerCase()));
      
      // Organization filter - check if department's orgId is in selectedOrganizations
      const orgMatch = this.selectedOrganizations.length === 0 || 
                      (dept.organization && this.selectedOrganizations.includes(dept.organization.orgId));
      
      // Status filter - check if status matches the selected status
      const statusMatch = this.selectedStatus === null || 
                         (this.selectedStatus === 'active' && dept.status === true) || 
                         (this.selectedStatus === 'inactive' && dept.status === false);
      
      return searchMatch && orgMatch && statusMatch;
    });

    // Update filter count
    this.activeFilterCount = 
      (this.searchQuery.trim() ? 1 : 0) + 
      this.selectedOrganizations.length + 
      (this.selectedStatus !== null ? 1 : 0);

    // Reset to first page and update pagination
    this.currentPage = 1;
    this.updatePagination();
  }

  toggleOrganization(orgId: string): void {
    const index = this.selectedOrganizations.indexOf(orgId);
    if (index === -1) {
      this.selectedOrganizations.push(orgId);
    } else {
      this.selectedOrganizations.splice(index, 1);
    }
  }

  toggleStatus(status: string): void {
    this.selectedStatus = this.selectedStatus === status ? null : status;
  }

  clearFilters(): void {
    this.searchQuery = '';
    this.selectedOrganizations = [];
    this.selectedStatus = null;
    this.applyFilters();
  }

  get totalPages(): number {
    return this._totalPages;
  }

  get paginatedDepartments(): DepartmentTableItem[] {
    return this._paginatedDepartments;
  }

  get showPagination(): boolean {
    return this.filteredDepartments.length > this.itemsPerPage;
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const filterContainer = document.querySelector('.filter-container');

    if (filterContainer && !filterContainer.contains(target)) {
      this.showFilters = false;
    }
  }

  toggleFilters(event: Event): void {
    event.stopPropagation();
    this.showFilters = !this.showFilters;
    
    // Close filter dropdown when clicking outside
    if (this.showFilters) {
      setTimeout(() => {
        const clickHandler = (e: MouseEvent) => {
          const target = e.target as HTMLElement;
          if (!target.closest('.filter-dropdown') && !target.closest('.filter-icon')) {
            this.showFilters = false;
            document.removeEventListener('click', clickHandler);
          }
        };
        document.addEventListener('click', clickHandler);
      });
    }
  }

  closeFilters() {
    this.showFilters = false;
  }

  loadOrganizations() {
    this.isLoadingOrganizations = true;
    this.departmentService.getOrganizations().subscribe({
      next: (data: any[]) => {
        this.organizations = data.map(org => ({
          orgId: org.orgId,
          orgName: org.orgName,
          orgCode: org.orgCode
        } as Partial<Organization>));
        this.isLoadingOrganizations = false;
      },
      error: (err) => {
        console.error('Error loading organizations:', err);
        this.isLoadingOrganizations = false;
      }
    });
  }

  loadBranches() {
    this.isLoadingBranches = true;
    this.departmentService.getBranches().subscribe({
      next: (data: any[]) => {
        this.branches = data.map(branch => ({
          branchId: branch.branchId,
          branchName: branch.branchName,
          branchCode: branch.branchCode
        } as Partial<Branch>));
        this.isLoadingBranches = false;
      },
      error: (err) => {
        console.error('Error loading branches:', err);
        this.isLoadingBranches = false;
      }
    });
  }

  openAddModal() {
    this.isEditMode = false;
    this.currentDepartmentId = null;
    this.resetForm();
    this.error = null;
    this.modalRef = this.modalService.open(this.departmentModal, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
  }

  openEditModal(department: Department) {
    this.isEditMode = true;
    this.currentDepartmentId = department.dept_id;
    this.error = null;
    this.isLoading = true;

    // Fetch complete department details
    this.departmentService.getDepartmentById(department.dept_id).subscribe({
      next: (response: DepartmentResponse) => {
        if (response && response.success) {
          const dept = response.data;
          // Set form values with the detailed department data
          this.departmentForm.patchValue({
            org_id: dept.organization?.orgId || '',
            branch_id: dept.branch?.branchId || '',
            dept_name: dept.dept_name,
            dept_code: dept.dept_code,
            parent_dept_id: dept.parent_department?.dept_id || '',
            dept_head_id: dept.dept_head_id || '',
            budget_allocation: dept.budget_allocation || 0,
            approval_hierarchy: dept.approval_hierarchy || null,
            reporting_structure: dept.reporting_structure || null
          });

          this.modalRef = this.modalService.open(this.departmentModal, {
            size: 'lg',
            backdrop: 'static',
            keyboard: false
          });
        } else {
          this.error = response?.message || 'Failed to load department details';
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = 'Error loading department details. Please try again.';
        this.isLoading = false;
        console.error('Error loading department:', err);
      }
    });
  }

  private resetForm() {
    this.departmentForm.reset();
    this.isEditMode = false;
    this.currentDepartmentId = null;
  }

  onSubmit() {
    if (this.departmentForm.invalid) {
      return;
    }
    this.isSubmitting = true;
    this.error = null;

    // Prepare form data according to the expected API format
    const formData = {
      org_id: this.departmentForm.value.org_id,
      branch_id: this.departmentForm.value.branch_id,
      dept_name: this.departmentForm.value.dept_name,
      dept_code: this.departmentForm.value.dept_code,
      parent_dept_id: this.departmentForm.value.parent_dept_id || null,
      dept_head_id: this.departmentForm.value.dept_head_id || null,
      budget_allocation: Number(this.departmentForm.value.budget_allocation) || 0,
      approval_hierarchy: this.departmentForm.value.approval_hierarchy || null,
      reporting_structure: this.departmentForm.value.reporting_structure || null
    };

    // Remove null/empty values for optional fields
    if (!formData.parent_dept_id) delete formData.parent_dept_id;
    if (!formData.dept_head_id) delete formData.dept_head_id;

    const submitObservable = this.isEditMode && this.currentDepartmentId
      ? this.departmentService.updateDepartment(this.currentDepartmentId, formData)
      : this.departmentService.createDepartment(formData);

    submitObservable.subscribe({
      next: (response: any) => {
        if (response && response.success) {
          // Show success notification
          const successMessage = this.isEditMode
            ? 'Department updated successfully!'
            : 'Department created successfully!';

          Swal.fire({
            title: 'Success!',
            text: successMessage,
            icon: 'success',
            confirmButtonColor: '#23a9d2',
            confirmButtonText: 'OK',
            timer: 3000,
            timerProgressBar: true
          });

          this.loadDepartments();
          this.modalRef.close();
          this.resetForm();
        } else {
          this.error = response?.message ||
            (this.isEditMode ? 'Failed to update department' : 'Failed to create department');
        }
        this.isSubmitting = false;
      },
      error: (err: any) => {
        // Show error notification
        const errorMessage = this.isEditMode
          ? 'Error updating department. Please try again.'
          : 'Error creating department. Please try again.';

        Swal.fire({
          title: 'Error!',
          text: errorMessage,
          icon: 'error',
          confirmButtonColor: '#dc3545',
          confirmButtonText: 'OK'
        });

        this.error = errorMessage;
        this.isSubmitting = false;
        console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} department:`, err);
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }
}
