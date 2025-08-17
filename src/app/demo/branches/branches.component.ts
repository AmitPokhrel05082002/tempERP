// branch.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbModal, NgbModule } from '@ng-bootstrap/ng-bootstrap';
import { BranchesService,Branch} from '../../services/branches.service';
import { finalize } from 'rxjs/operators';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { OrganizationService, Organization } from '../../services/organization.service';


@Component({
  selector: 'app-branches',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NgbModule,
    HttpClientModule,
    FormsModule,
    RouterModule
  ],
  providers: [BranchesService],
  templateUrl: './branches.component.html',
  styleUrls: ['./branches.component.scss']
})
export class BranchesComponent implements OnInit {
  branches: Branch[] = [];
  filteredBranches: Branch[] = [];
  isLoading = false;
  isEditing = false;
  isFilterOpen = false;
  organizations: Organization[] = [];

  // Filter options
  filterOptions = {
    dzongkhags: new Set<string>(),
    thromdes: new Set<string>(),
    statuses: new Set<string>(),
    selectedDzongkhags: new Set<string>(),
    selectedThromdes: new Set<string>(),
    selectedStatuses: new Set<string>()
  };

  // Show all toggle states for filter dropdowns
  showAllDzongkhags = false;
  showAllThromdes = false;

  // Search term
  searchTerm = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;

  currentBranchId: string | null = null;
  modalRef: any;
  branchForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private modalService: NgbModal,
    private branchesService: BranchesService,
    private organizationService: OrganizationService
  ) {
    this.branchForm = this.fb.group({
      orgId: ['', Validators.required],
      branchName: ['', [Validators.required, Validators.minLength(3)]],
      branchCode: ['', [Validators.required, Validators.pattern('^[A-Za-z0-9-]+$')]],
      dzongkhag: ['', Validators.required],
      thromde: ['', Validators.required],
      operationalStatus: [true, Validators.required]
    });
  }

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadBranches();
  }
  
  loadOrganizations(): void {
    this.organizationService.getOrganizations().subscribe({
      next: (orgs) => {
        this.organizations = orgs;
      },
      error: (error) => {
        console.error('Failed to load organizations', error);
      }
    });
  }

  initializeFilterOptions(): void {
    this.filterOptions.dzongkhags = new Set();
    this.filterOptions.thromdes = new Set();
    this.filterOptions.statuses = new Set(['Active', 'Inactive']);

    this.branches.forEach(branch => {
      if (branch.dzongkhag) this.filterOptions.dzongkhags.add(branch.dzongkhag);
      if (branch.thromde) this.filterOptions.thromdes.add(branch.thromde);
    });
  }

  toggleFilter(): void {
    this.isFilterOpen = !this.isFilterOpen;
    if (this.isFilterOpen) {
      this.initializeFilterOptions();
    }
  }

  toggleFilterOption(type: 'dzongkhags' | 'thromdes' | 'statuses', value: string): void {
    const selectedSet = this.filterOptions[`selected${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof this.filterOptions] as Set<string>;

    if (selectedSet.has(value)) {
      selectedSet.delete(value);
    } else {
      selectedSet.add(value);
    }

    this.applyFilters();
  }

  toggleShowAll(type: 'dzongkhags' | 'thromdes'): void {
    if (type === 'dzongkhags') {
      this.showAllDzongkhags = !this.showAllDzongkhags;
    } else if (type === 'thromdes') {
      this.showAllThromdes = !this.showAllThromdes;
    }
  }

  isSelected(set: Set<string>, value: string): boolean {
    return set.has(value);
  }

  setToArray(set: Set<string>): string[] {
    return Array.from(set);
  }

  isFilterActive(): boolean {
    return this.filterOptions.selectedDzongkhags.size > 0 ||
           this.filterOptions.selectedThromdes.size > 0 ||
           this.filterOptions.selectedStatuses.size > 0;
  }

  clearFilters(): void {
    this.filterOptions.selectedDzongkhags.clear();
    this.filterOptions.selectedThromdes.clear();
    this.filterOptions.selectedStatuses.clear();
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredBranches = this.branches.filter(branch => {
      const matchesDzongkhag = this.filterOptions.selectedDzongkhags.size === 0 ||
                             (branch.dzongkhag && this.filterOptions.selectedDzongkhags.has(branch.dzongkhag));

      const matchesThromde = this.filterOptions.selectedThromdes.size === 0 ||
                           (branch.thromde && this.filterOptions.selectedThromdes.has(branch.thromde));

      const matchesStatus = this.filterOptions.selectedStatuses.size === 0 ||
                          (this.filterOptions.selectedStatuses.has(branch.operationalStatus ? 'Active' : 'Inactive'));

      const matchesSearch = !this.searchTerm ||
                          (branch.branchName && branch.branchName.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (branch.branchCode && branch.branchCode.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
                          (branch.organizationName && branch.organizationName.toLowerCase().includes(this.searchTerm.toLowerCase()));

      return matchesDzongkhag && matchesThromde && matchesStatus && matchesSearch;
    });

    this.currentPage = 1;
  }

  get totalPages(): number {
    return Math.ceil(this.filteredBranches.length / this.itemsPerPage);
  }

  get paginatedBranches(): Branch[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredBranches.slice(startIndex, startIndex + this.itemsPerPage);
  }

  changePage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private loadBranches(): void {
    this.isLoading = true;
    this.branchesService.getBranches()
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (branches) => {
          this.branches = branches;
          this.filteredBranches = [...branches];
        },
        error: (error) => {
          this.branches = [];
          this.filteredBranches = [];
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Failed to load branches. Please try again.',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  openAddModal(modal: any): void {
    this.isEditing = false;
    this.currentBranchId = null;
    this.branchForm.reset({ operationalStatus: true });
    this.modalRef = this.modalService.open(modal, { centered: true });
  }

  openEditModal(modal: any, branch: Branch): void {
    this.isEditing = true;
    this.currentBranchId = branch.branchId;
    this.branchForm.patchValue({
      orgId: branch.orgId,
      branchName: branch.branchName,
      branchCode: branch.branchCode,
      dzongkhag: branch.dzongkhag,
      thromde: branch.thromde,
      operationalStatus: branch.operationalStatus
    });
    this.modalRef = this.modalService.open(modal, { centered: true });
  }
  saveBranch(): void {
    if (this.branchForm.invalid) {
      Object.values(this.branchForm.controls).forEach(control => {
        control.markAsTouched();
      });
      return;
    }
  
    const formValue = this.branchForm.getRawValue();
    const branchData = {
      orgId: formValue.orgId,
      branchName: formValue.branchName,
      branchCode: formValue.branchCode,
      dzongkhag: formValue.dzongkhag,
      thromde: formValue.thromde,
      operationalStatus: formValue.operationalStatus
    };
  

    const isEdit = this.isEditing && this.currentBranchId;
    const operation = isEdit
      ? this.branchesService.updateBranch(this.currentBranchId, branchData)
      : this.branchesService.createBranch(branchData);

    Swal.fire({
      title: isEdit ? 'Updating Branch...' : 'Creating Branch...',
      text: 'Please wait',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });

    operation.subscribe({
      next: () => {
        Swal.fire({
          icon: 'success',
          title: isEdit ? 'Updated!' : 'Created!',
          text: `Branch has been ${isEdit ? 'updated' : 'created'} successfully.`,
          timer: 1500,
          showConfirmButton: false
        });
        this.loadBranches();
        this.closeModal();
      },
      error: (error) => {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Failed to ${isEdit ? 'update' : 'create'} branch. ${error?.error?.message || 'Please try again.'}`,
          confirmButtonText: 'OK'
        });
      }
    });
  }

  closeModal(): void {
    if (this.modalRef) {
      this.modalRef.close();
      this.modalRef = null;
    }
  }

  viewBranch(branch: Branch): void {
    Swal.fire({
      title: branch.branchName,
      html: `
        <div class="text-start">
          <p><strong>Organization:</strong> ${branch.organizationName || 'N/A'}</p>
          <p><strong>Branch Code:</strong> ${branch.branchCode || 'N/A'}</p>
          <p><strong>Dzongkhag:</strong> ${branch.dzongkhag || 'N/A'}</p>
          <p><strong>Thromde:</strong> ${branch.thromde || 'N/A'}</p>
          <p><strong>Status:</strong> ${branch.operationalStatus ? 'Active' : 'Inactive'}</p>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Close',
      width: '600px'
    });
  }

  deleteBranch(branch: Branch): void {
    Swal.fire({
      title: 'Delete Branch',
      text: `Are you sure you want to delete ${branch.branchName}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.branchesService.deleteBranch(branch.branchId).subscribe({
          next: () => {
            Swal.fire(
              'Deleted!',
              'The branch has been deleted successfully.',
              'success'
            );
            this.loadBranches();
          },
          error: (error) => {
            Swal.fire(
              'Error',
              'Failed to delete branch. Please try again.',
              'error'
            );
            console.error('Error deleting branch:', error);
          }
        });
      }
    });
  }
}