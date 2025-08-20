import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import Swal from 'sweetalert2';
import { finalize } from 'rxjs/operators';
import { AuthService } from '../../../core/services/auth.service';

interface TrainingCategory {
  id: string;
  categoryName: string;
  categoryCode: string;
  description?: string;
  isActive: boolean;
  organizationId?: string;
  organizationName?: string;
  createdDate: string;
  modifiedDate: string;
}

interface Organization {
  orgId: string;
  orgName: string;
  orgCode: string;
  countryName: string;
  dzongkhag: string;
  thromde: string;
  parentOrgId: string | null;
  parentOrgName: string | null;
  orgLevel: string | null;
  childOrganizationsCount: number;
  createdDate: string;
}

@Component({
  selector: 'app-emp-categories',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbModule
  ],
  templateUrl: './emp-categories.component.html',
  styleUrls: ['./emp-categories.component.scss']
})
export class EmpCategoriesComponent implements OnInit {
  categories: TrainingCategory[] = [];
  filteredCategories: TrainingCategory[] = [];
  organizations: Organization[] = [];
  currentCategory: TrainingCategory | null = null;
  private apiUrl = environment.apiUrl;
  isLoading = false;

  searchQuery = '';
  
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  isEditMode = false;
  successMessage = '';
  errorMessage = '';
  
  canEdit: boolean = false;
  canViewDetails: boolean = true;

  form: FormGroup;

  @ViewChild('trainingModal') trainingModal!: TemplateRef<any>;
  @ViewChild('viewModal') viewModal!: TemplateRef<any>;
  private modalRef: any;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private modalService: NgbModal,
    private authService: AuthService
  ) {
    this.canEdit = this.authService.hasFullAccess() || 
                  this.authService.hasPermissionForModule('training_categories', 'write');
    
    this.form = this.fb.group({
      categoryName: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(100)
      ]],
      description: ['', Validators.maxLength(500)],
      organizationId: ['', Validators.required],
      status: [false]
    });
  }

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadCategories();
  }

  loadOrganizations(): void {
    this.http.get<Organization[]>(`${this.apiUrl}/api/v1/organizations`)
      .subscribe({
        next: (organizations) => {
          this.organizations = organizations || [];
        },
        error: (error) => {
          console.error('Error loading organizations:', error);
          Swal.fire('Error', 'Failed to load organizations', 'error');
        }
      });
  }

  loadCategories(): void {
    this.isLoading = true;
    this.http.get<TrainingCategory[]>(`${this.apiUrl}/api/v1/training/categories`)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (categories) => {
          this.categories = categories.map(category => {
            const org = this.organizations.find(org => org.orgId === category.organizationId);
            return {
              ...category,
              organizationName: org ? org.orgName : 'N/A'
            };
          });
          this.applyFilter();
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          Swal.fire('Error', 'Failed to load training categories', 'error');
        }
      });
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredCategories = [...this.categories];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredCategories = this.categories.filter(category =>
        category.categoryName.toLowerCase().includes(query) ||
        category.categoryCode.toLowerCase().includes(query) ||
        (category.description?.toLowerCase().includes(query) ?? false) ||
        (category.organizationName?.toLowerCase().includes(query) ?? false)
      );
    }
    this.currentPage = 1;
    this.updateTotalPages();
  }

  applyFilter(): void {
    this.applySearch();
  }

  openAddModal(): void {
    if (!this.canEdit) return;
    
    this.isEditMode = false;
    this.form.reset({
      status: true
    });
    this.modalRef = this.modalService.open(this.trainingModal, { size: 'lg' });
  }

  openEditModal(category: TrainingCategory): void {
    if (!this.canEdit) return;
    
    this.isEditMode = true;
    this.currentCategory = { ...category };
    this.form.patchValue({
      categoryName: category.categoryName,
      categoryCode: category.categoryCode,
      description: category.description || '',
      organizationId: category.organizationId || '',
      status: category.isActive
    });
    this.modalRef = this.modalService.open(this.trainingModal, { size: 'lg' });
  }

  openViewModal(category: TrainingCategory): void {
    this.currentCategory = { ...category };
    this.modalRef = this.modalService.open(this.viewModal, { size: 'lg' });
  }

  saveCategory(): void {
    if (!this.canEdit) return;
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const categoryData = {
      orgId: this.form.get('organizationId')?.value,
      categoryName: this.form.get('categoryName')?.value,
      categoryCode: this.form.get('categoryCode')?.value,
      isActive: this.form.get('status')?.value === true || this.form.get('status')?.value === 'true'
    };
    
    this.isLoading = true;

    const request = this.isEditMode && this.currentCategory?.id
      ? this.http.put(`${this.apiUrl}/api/v1/training/categories/${this.currentCategory.id}`, categoryData)
      : this.http.post(`${this.apiUrl}/api/v1/training/categories`, categoryData);

    request.pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: () => {
          Swal.fire('Success', `Category ${this.isEditMode ? 'updated' : 'created'} successfully`, 'success');
          this.loadCategories();
          this.modalRef.close();
        },
        error: (error) => {
          console.error(`Error ${this.isEditMode ? 'updating' : 'creating'} category:`, error);
          Swal.fire('Error', `Failed to ${this.isEditMode ? 'update' : 'create'} category`, 'error');
        }
      });
  }

  confirmDelete(id: string): void {
    if (!this.canEdit) return;
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this category!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        this.isLoading = true;
        this.http.delete(`${this.apiUrl}/api/v1/training/categories/${id}`)
          .pipe(finalize(() => this.isLoading = false))
          .subscribe({
            next: () => {
              Swal.fire('Deleted!', 'The category has been deleted.', 'success');
              this.loadCategories();
            },
            error: (error) => {
              console.error('Error deleting category:', error);
              Swal.fire('Error', 'Failed to delete category', 'error');
            }
          });
      }
    });
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusBadgeClass(isActive: boolean): string {
    return isActive ? 'bg-success' : 'bg-secondary';
  }

  getStatusText(isActive: boolean): string {
    return isActive ? 'Active' : 'Inactive';
  }

  updateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredCategories.length / this.itemsPerPage) || 1;
  }

  get paginatedCategories(): TrainingCategory[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredCategories.slice(start, start + this.itemsPerPage);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}