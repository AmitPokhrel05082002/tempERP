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
  userAccounts: any[] = [];
  filteredUserAccounts: any[] = [];
  currentPermission: MenuPermission | null = null;
  userPermissions: {[key: string]: MenuPermission[]} = {}; // Cache for user permissions
  employeeNames: {[key: string]: string} = {}; // Cache for employee names
  
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
    // First load user accounts
    this.menuPermissionService.getAllUserAccounts().subscribe({
      next: (accounts) => {
        this.userAccounts = accounts;
        this.filteredUserAccounts = [...this.userAccounts];
        
        // Fetch employee names for all accounts
        this.userAccounts.forEach(account => {
          if (account.empId) {
            this.menuPermissionService.getEmployeeName(account.empId).subscribe(name => {
              this.employeeNames[account.empId] = name;
            });
          }
        });
        
        // Then load permissions
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
      },
      error: (error) => {
        console.error('Error loading user accounts:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to load user accounts', 'error');
      }
    });
  }

  groupPermissionsByUser(): void {
    this.userPermissions = this.userAccounts.reduce((acc, user) => {
      const userPerms = this.permissions.filter(p => p.userId === user.userId);
      if (userPerms.length > 0) {
        acc[user.userId] = userPerms;
      }
      return acc;
    }, {} as {[key: string]: MenuPermission[]});
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredUserAccounts = [...this.userAccounts];
      this.filteredPermissions = [...this.permissions];
      this.groupPermissionsByUser();
      this.currentPage = 1;
      this.updatePagination();
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredUserAccounts = this.userAccounts.filter(user => 
      user.username.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.accountStatus.toLowerCase().includes(query)
    );
    
    this.currentPage = 1;
    this.groupPermissionsByUser();
    this.updatePagination();
  }

  updatePagination(): void {
    const totalItems = this.filteredUserAccounts.length;
    this.totalPages = Math.ceil(totalItems / this.itemsPerPage);
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

  get paginatedUserAccounts(): any[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredUserAccounts.map(account => ({
      ...account,
      employeeName: this.employeeNames[account.empId] || 'N/A'
    })).slice(startIndex, startIndex + this.itemsPerPage);
  }

  getUserPermissions(userId: string): MenuPermission[] {
    return this.userPermissions[userId] || [];
  }

  getPermissionTypes(permissions: MenuPermission[]): string {
    return [...new Set(permissions.map(p => p.permissionType))].join(', ');
  }

  getActionNames(permissions: MenuPermission[]): string {
    return [...new Set(permissions.flatMap(p => p.actionNames))].join(', ');
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