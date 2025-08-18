import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { MenuPermissionService, MenuPermission } from '../../../services/menu-permission.service';

@Component({
  selector: 'app-menu-permissions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbModule
  ],
  templateUrl: './menu-permissions.component.html',
  styleUrls: ['./menu-permissions.component.scss']
})
export class MenuPermissionsComponent implements OnInit {
  permissions: MenuPermission[] = [];
  filteredPermissions: MenuPermission[] = [];
  groupedPermissions: {[key: string]: MenuPermission[]} = {};
  currentPermission: MenuPermission | null = null;
  userNames: {[key: string]: string} = {}; // Cache for usernames
  
  form: FormGroup;
  isEditMode = false;
  searchQuery = '';
  
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  isLoading = false;

  @ViewChild('permissionModal') private permissionModalRef!: TemplateRef<any>;
  private modalRef: any;

  constructor(
    private fb: FormBuilder,
    private modalService: NgbModal,
    private menuPermissionService: MenuPermissionService,
    private router: Router
  ) {
    this.form = this.fb.group({
      userId: ['', Validators.required],
      menuId: ['', Validators.required],
      menuName: ['', Validators.required],
      actionNames: ['', Validators.required],
      permissionType: ['', Validators.required],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.loadPermissions();
  }

  loadPermissions(): void {
    this.isLoading = true;
    this.menuPermissionService.getMenuPermissions().subscribe({
      next: (permissions) => {
        this.permissions = permissions;
        this.filteredPermissions = [...this.permissions];
        this.groupPermissionsByUser();
        this.updatePagination();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading permissions:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load permissions', 'error');
      }
    });
  }

  groupPermissionsByUser(): void {
    this.groupedPermissions = this.filteredPermissions.reduce((acc, permission) => {
      if (!acc[permission.userId]) {
        acc[permission.userId] = [];
        // Fetch username for this user if not already in cache
        if (!this.userNames[permission.userId] && permission.userId) {
          this.menuPermissionService.getUserAccount(permission.userId).subscribe({
            next: (user) => {
              this.userNames[permission.userId] = user.username || permission.userId;
            },
            error: () => {
              this.userNames[permission.userId] = permission.userId; // Fallback to user ID if API fails
            }
          });
        }
      }
      // Only add if we don't already have this permission type for the user
      if (!acc[permission.userId].some(p => p.permissionType === permission.permissionType)) {
        acc[permission.userId].push(permission);
      }
      return acc;
    }, {} as {[key: string]: MenuPermission[]});
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredPermissions = [...this.permissions];
      this.groupPermissionsByUser();
      this.currentPage = 1;
      this.updatePagination();
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredPermissions = this.permissions.filter(permission => 
      permission.userId.toLowerCase().includes(query) ||
      permission.menuName.toLowerCase().includes(query) ||
      permission.permissionType.toLowerCase().includes(query) ||
      permission.grantedByUsername?.toLowerCase().includes(query) ||
      permission.actionNames.some(action => action.toLowerCase().includes(query))
    );
    
    this.currentPage = 1;
    this.groupPermissionsByUser();
    this.updatePagination();
  }

  updatePagination(): void {
    const totalGroups = Object.keys(this.groupedPermissions).length;
    this.totalPages = Math.ceil(totalGroups / this.itemsPerPage);
    if (this.currentPage > this.totalPages && this.totalPages > 0) {
      this.currentPage = this.totalPages;
    }
  }

  hasAnyActivePermission(permissions: MenuPermission[]): boolean {
    return permissions.some(p => p.isActive);
  }

  getActiveStatusText(permissions: MenuPermission[]): string {
    return this.hasAnyActivePermission(permissions) ? 'Yes' : 'No';
  }

  getActiveStatusClass(permissions: MenuPermission[]): string {
    return this.hasAnyActivePermission(permissions) ? 'bg-success' : 'bg-danger';
  }

  get paginatedPermissions(): {userId: string, userName: string, permissions: MenuPermission[], permissionTypes: string}[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const userGroups = Object.entries(this.groupedPermissions).map(([userId, permissions]) => ({
      userId,
      userName: this.userNames[userId] || userId, // Use cached username or fallback to userId
      permissions,
      // Get unique permission types for display
      permissionTypes: [...new Set(permissions.map(p => p.permissionType))].join(', '),
      // Get all action names
      actionNames: [...new Set(permissions.flatMap(p => p.actionNames))].join(', ')
    }));
    return userGroups.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentPermission = null;
    this.form.reset({
      isActive: true
    });
    this.modalRef = this.modalService.open(this.permissionModalRef, { size: 'lg' });
  }

  openEditModal(permission: MenuPermission): void {
    this.isEditMode = true;
    this.currentPermission = permission;
    
    this.form.patchValue({
      userId: permission.userId,
      menuId: permission.menuId,
      menuName: permission.menuName,
      actionNames: permission.actionNames.join(', '),
      permissionType: permission.permissionType,
      isActive: permission.isActive
    });
    
    this.modalRef = this.modalService.open(this.permissionModalRef, { size: 'lg' });
  }

  savePermission(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formData = this.form.value;
    const permissionData: Partial<MenuPermission> = {
      ...formData,
      actionNames: formData.actionNames.split(',').map((action: string) => action.trim()),
      grantedBy: 'current-user-id', // Replace with actual user ID
      grantedByUsername: 'Current User', // Replace with actual username
      grantedDate: new Date().toISOString()
    };

    const operation = this.isEditMode 
      ? this.menuPermissionService.updateMenuPermission(this.currentPermission!.permissionId, permissionData)
      : this.menuPermissionService.createMenuPermission(permissionData);

    operation.subscribe({
      next: (permission) => {
        this.showSuccess(`Permission ${this.isEditMode ? 'updated' : 'created'} successfully`);
        this.loadPermissions();
        this.modalRef.close();
      },
      error: (error) => {
        console.error('Error saving permission:', error);
        Swal.fire('Error', `Failed to ${this.isEditMode ? 'update' : 'create'} permission`, 'error');
      }
    });
  }

  confirmDelete(permissionId: string): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this permission!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d'
    }).then((result) => {
      if (result.isConfirmed) {
        this.deletePermission(permissionId);
      }
    });
  }

  deletePermission(permissionId: string): void {
    this.menuPermissionService.deleteMenuPermission(permissionId).subscribe({
      next: () => {
        this.showSuccess('Permission deleted successfully');
        this.loadPermissions();
      },
      error: (error) => {
        console.error('Error deleting permission:', error);
        Swal.fire('Error', 'Failed to delete permission', 'error');
      }
    });
  }

  togglePermissionStatus(permissionId: string, isActive: boolean): void {
    this.menuPermissionService.togglePermissionStatus(permissionId, isActive).subscribe({
      next: (permission) => {
        this.showSuccess(`Permission ${isActive ? 'activated' : 'deactivated'} successfully`);
        this.loadPermissions();
      },
      error: (error) => {
        console.error('Error toggling permission status:', error);
        Swal.fire('Error', 'Failed to toggle permission status', 'error');
      }
    });
  }

  private showSuccess(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      timer: 2000,
      showConfirmButton: false
    });
  }
}