import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MenuHierarchyService } from '../../../services/menu-hierarchy.service';
import { MenuPermissionService } from '../../../services/menu-permission.service';
import { AuthService } from '../../../core/services/auth.service';
import Swal from 'sweetalert2';

interface PermissionGroup {
  id: string;
  name: string;
  expanded: boolean;
  icon?: string;
  subGroups?: PermissionSubGroup[];
  permissions?: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    export: boolean;
    approve?: boolean;
  };
}

interface PermissionSubGroup {
  id: string;
  name: string;
  permissions: {
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    export: boolean;
    approve?: boolean;
  };
}

interface User {
  userId: string;
  username: string;
  email: string;
}

@Component({
  selector: 'app-rbac',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './RBAC.component.html',
  styleUrls: ['./RBAC.component.scss']
})
export class RBACComponent implements OnInit {
  private menuHierarchyService = inject(MenuHierarchyService);
  private menuPermissionService = inject(MenuPermissionService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  
  permissionGroups = signal<PermissionGroup[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  userId: string | null = null;
  selectedMenuId: string | null = null;
  
  isEditMode = false;
  originalPermissionGroups: PermissionGroup[] = [];
  permissionType: string = 'GRANT';
  expiryDate: string | null = null;
  expiryTime: string = '00:00';
  isActive: boolean = true;
  showExpiryDate = true; // Always show expiry date
  minDate = new Date().toISOString().split('T')[0];
  currentUser: User | null = null;

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    this.route.queryParams.subscribe(params => {
      this.userId = params['userId'];
      this.selectedMenuId = params['menuId'];
      if (this.userId) {
        this.loadUserPermissions();
      } else {
        this.loadMenuHierarchy();
      }
    });
  }

  toggleEditMode() {
    this.isEditMode = !this.isEditMode;
    
    if (this.isEditMode) {
      this.originalPermissionGroups = JSON.parse(JSON.stringify(this.permissionGroups()));
      this.loadFullMenuHierarchy();
    } else {
      this.permissionGroups.set(this.originalPermissionGroups);
      this.expiryDate = null;
      this.expiryTime = '00:00';
    }
  }

  onPermissionTypeChange() {
    // No special handling needed as expiry date is always shown
  }

  getExpiryDateTime(): string | null {
    if (!this.expiryDate) return null;
    
    // Parse the date and time
    const [year, month, day] = this.expiryDate.split('-');
    const [hours, minutes] = this.expiryTime.split(':');
    
    // Create a date object in local timezone
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1, // months are 0-indexed
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );
    
    // Convert to ISO string (UTC)
    return localDate.toISOString();
  }

  loadUserPermissions() {
    this.loading.set(true);
    this.error.set(null);
    
    this.menuPermissionService.getUserPermissions(this.userId!, false).subscribe({
      next: (permissions) => {
        const selectedPermission = permissions.find(p => p.menuId === this.selectedMenuId);
        if (selectedPermission && selectedPermission.expiryDate) {
          const expiryDate = new Date(selectedPermission.expiryDate);
          this.expiryDate = expiryDate.toISOString().split('T')[0];
          this.expiryTime = `${this.padZero(expiryDate.getHours())}:${this.padZero(expiryDate.getMinutes())}`;
        }
        
        this.menuHierarchyService.getMenuHierarchy().subscribe({
          next: (menuItems) => {
            const groups = this.transformMenuToPermissionGroups(menuItems, permissions);
            this.permissionGroups.set(groups);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load menu hierarchy:', err);
            this.error.set('Failed to load menu hierarchy. Please try again later.');
            this.loading.set(false);
          }
        });
      },
      error: (err) => {
        console.error('Failed to load user permissions:', err);
        this.error.set('Failed to load user permissions. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  private padZero(num: number): string {
    return num < 10 ? `0${num}` : num.toString();
  }

  private formatDateTime(dateStr: string | null, timeStr: string): string | null {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const [hours, minutes] = timeStr.split(':').map(Number);
    date.setHours(hours, minutes);
    return date.toISOString();
  }

  loadMenuHierarchy() {
    this.loading.set(true);
    this.error.set(null);
    
    this.menuHierarchyService.getMenuHierarchy().subscribe({
      next: (menuItems) => {
        const groups = this.transformMenuToPermissionGroups(menuItems, []);
        this.permissionGroups.set(groups);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load menu hierarchy:', err);
        this.error.set('Failed to load menu hierarchy. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  loadFullMenuHierarchy() {
    this.loading.set(true);
    this.error.set(null);
    
    this.menuHierarchyService.getMenuHierarchy().subscribe({
      next: (menuItems) => {
        const groups = this.transformFullMenuToPermissionGroups(menuItems);
        this.permissionGroups.set(groups);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load menu hierarchy:', err);
        this.error.set('Failed to load menu hierarchy. Please try again later.');
        this.loading.set(false);
      }
    });
  }

  private transformMenuToPermissionGroups(menuItems: any[], userPermissions: any[]): PermissionGroup[] {
    return menuItems
      .filter(menu => menu.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(menu => {
        const menuPermissions = userPermissions.filter(p => p.menuId === menu.menuId);
        const hasMenuLevelPermissions = menuPermissions.length > 0;
        const allActionNames = menuPermissions.flatMap(p => p.actionNames);
  
        const childPermissions = menu.children 
          ? menu.children.map(child => ({
              child,
              permissions: userPermissions.filter(p => p.menuId === child.menuId)
            }))
          : [];
  
        if (this.userId && !hasMenuLevelPermissions && 
            (!menu.children || childPermissions.every(cp => cp.permissions.length === 0))) {
          return null;
        }
  
        const group: PermissionGroup = {
          id: menu.menuId,
          name: menu.menuName,
          expanded: false,
          icon: menu.menuIndication,
          subGroups: menu.children 
            ? menu.children
                .filter(child => child.isActive)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map(child => {
                  const effectivePermissions = hasMenuLevelPermissions 
                    ? menuPermissions 
                    : userPermissions.filter(p => p.menuId === child.menuId);
                  
                  const actionNames = effectivePermissions.flatMap(p => p.actionNames);
  
                  return {
                    id: child.menuId,
                    name: child.menuName,
                    permissions: {
                      view: actionNames.includes('view'),
                      create: actionNames.includes('create'),
                      update: actionNames.includes('update'),
                      delete: actionNames.includes('delete'),
                      export: actionNames.includes('export'),
                      approve: actionNames.includes('approve')
                    }
                  };
                })
            : undefined,
          permissions: !menu.children ? {
            view: allActionNames.includes('view'),
            create: allActionNames.includes('create'),
            update: allActionNames.includes('update'),
            delete: allActionNames.includes('delete'),
            export: allActionNames.includes('export'),
            approve: allActionNames.includes('approve')
          } : undefined
        };
        
        return group;
      })
      .filter(group => group !== null) as PermissionGroup[];
  }

  private transformFullMenuToPermissionGroups(menuItems: any[]): PermissionGroup[] {
    return menuItems
      .filter(menu => menu.isActive)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map(menu => {
        const group: PermissionGroup = {
          id: menu.menuId,
          name: menu.menuName,
          expanded: true,
          icon: menu.menuIndication,
          subGroups: menu.children 
            ? menu.children
                .filter((child: any) => child.isActive)
                .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
                .map((child: any) => ({
                  id: child.menuId,
                  name: child.menuName,
                  permissions: {
                    view: false,
                    create: false,
                    update: false,
                    delete: false,
                    export: false,
                    approve: false
                  }
                }))
            : undefined,
          permissions: !menu.children ? {
            view: false,
            create: false,
            update: false,
            delete: false,
            export: false,
            approve: false
          } : undefined
        };
        
        const originalGroup = this.originalPermissionGroups.find(g => g.id === menu.menuId);
        if (originalGroup) {
          if (originalGroup.permissions) {
            group.permissions = {...originalGroup.permissions};
          }
          if (originalGroup.subGroups && group.subGroups) {
            group.subGroups = group.subGroups.map(subGroup => {
              const originalSubGroup = originalGroup.subGroups?.find(sg => sg.id === subGroup.id);
              return originalSubGroup ? {...originalSubGroup} : subGroup;
            });
          }
        }
        
        return group;
      });
  }

  toggleGroup(groupId: string) {
    const groups = this.permissionGroups();
    const group = groups.find(g => g.id === groupId);
    if (group) {
      group.expanded = !group.expanded;
      this.permissionGroups.set([...groups]);
    }
  }

  areAllPermissionsChecked(permissions: any): boolean {
    return permissions.view && 
           permissions.create && 
           permissions.update && 
           permissions.delete && 
           permissions.export && 
           (permissions.approve !== undefined ? permissions.approve : true);
  }

  toggleAllPermissions(groupId: string, subGroupId: string | undefined, checked: boolean) {
    const groups = this.permissionGroups();
    const group = groups.find(g => g.id === groupId);
    if (!group) return;

    if (subGroupId !== undefined) {
      const subGroup = group.subGroups?.find(sg => sg.id === subGroupId);
      if (subGroup) {
        Object.keys(subGroup.permissions).forEach(key => {
          subGroup.permissions[key as keyof typeof subGroup.permissions] = checked;
        });
      }
    } else if (group.permissions) {
      Object.keys(group.permissions).forEach(key => {
        group.permissions![key as keyof typeof group.permissions] = checked;
      });
    }
    
    this.permissionGroups.set([...groups]);
  }

  getMenuName(menuId: string): string {
    const group = this.permissionGroups().find(g => g.id === menuId);
    return group ? group.name : 'Unknown Menu';
  }

  savePermissions() {
    if (!this.selectedMenuId) {
      Swal.fire('Error', 'Please select a menu first', 'error');
      return;
    }

    if (!this.expiryDate) {
      alert('Please select an expiry date');
      return;
    }
    
    if (!this.expiryTime) {
      alert('Please select an expiry time');
      return;
    }

    Swal.fire({
      title: 'Enter Reason',
      input: 'text',
      inputLabel: 'Reason for granting permissions',
      inputPlaceholder: 'Enter the reason...',
      showCancelButton: true,
      confirmButtonText: 'Save',
      cancelButtonText: 'Cancel',
      showLoaderOnConfirm: true,
      preConfirm: (reason) => {
        if (!reason) {
          Swal.showValidationMessage('Reason is required');
          return false;
        }
        return reason;
      }
    }).then((result) => {
      if (result.isConfirmed) {
        this.createPermissions(result.value);
      }
    });
  }

  private createPermissions(reason: string) {
    if (!this.currentUser) {
      Swal.fire('Error', 'User not authenticated', 'error');
      return;
    }

    if (this.permissionType === 'TEMPORARY' && !this.expiryDate) {
      Swal.fire('Error', 'Please select an expiry date for temporary permissions', 'error');
      return;
    }

    const selectedGroup = this.permissionGroups().find(g => g.id === this.selectedMenuId);
    if (!selectedGroup) {
      Swal.fire('Error', 'Selected menu not found', 'error');
      return;
    }

    const actionNames: string[] = [];
    
    if (selectedGroup.permissions) {
      if (selectedGroup.permissions.view) actionNames.push('VIEW');
      if (selectedGroup.permissions.create) actionNames.push('CREATE');
      if (selectedGroup.permissions.update) actionNames.push('UPDATE');
      if (selectedGroup.permissions.delete) actionNames.push('DELETE');
      if (selectedGroup.permissions.export) actionNames.push('EXPORT');
      if (selectedGroup.permissions.approve) actionNames.push('APPROVE');
    } else if (selectedGroup.subGroups) {
      selectedGroup.subGroups.forEach(subGroup => {
        if (subGroup.permissions.view) actionNames.push('VIEW');
        if (subGroup.permissions.create) actionNames.push('CREATE');
        if (subGroup.permissions.update) actionNames.push('UPDATE');
        if (subGroup.permissions.delete) actionNames.push('DELETE');
        if (subGroup.permissions.export) actionNames.push('EXPORT');
        if (subGroup.permissions.approve) actionNames.push('APPROVE');
      });
    }

    if (actionNames.length === 0) {
      Swal.fire('Error', 'Please select at least one permission', 'error');
      return;
    }

    const permissionData = {
      userId: this.userId,
      menuId: this.selectedMenuId,
      menuName: selectedGroup.name,
      actionNames: actionNames,
      permissionType: this.permissionType,
      grantedBy: this.currentUser.userId,
      grantedByUsername: this.currentUser.username,
      expiryDate: this.permissionType === 'TEMPORARY' 
        ? this.formatDateTime(this.expiryDate, this.expiryTime) 
        : null,
      reason: reason,
      isActive: this.isActive
    };

    this.menuPermissionService.createMenuPermission(permissionData).subscribe({
      next: () => {
        Swal.fire({
          title: 'Success',
          text: 'Permissions saved successfully',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.isEditMode = false;
        this.loadUserPermissions();
      },
      error: (error) => {
        console.error('Error saving permissions:', error);
        Swal.fire('Error', 'Failed to save permissions', 'error');
      }
    });
  }
}