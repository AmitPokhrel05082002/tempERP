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
  showExpiryDate = true;
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
    
    // Only auto-expand if explicitly requested via menuId and we're in edit mode
    if (this.selectedMenuId && this.isEditMode) {
      setTimeout(() => {
        const groups = this.permissionGroups();
        const group = groups.find(g => g.id === this.selectedMenuId || 
          (g.subGroups && g.subGroups.some(sg => sg.id === this.selectedMenuId)));
        if (group) {
          group.expanded = true;
          this.permissionGroups.set([...groups]);
        }
      }, 300);
    }
  });
}

private normalizeActionName(action: string): string {
  return action.toLowerCase();
}
private hasPermission(permissions: any[], action: string): boolean {
  // Convert both the stored action names and the check to lowercase for case-insensitive comparison
  return permissions.some(p => 
    p.actionNames.some((a: string) => 
      a.toLowerCase() === action.toLowerCase()
    )
  );
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
          // Clear and rebuild the permission groups with fresh data
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

private loadFullMenuHierarchy() {
  this.loading.set(true);
  this.error.set(null);
  
  this.menuHierarchyService.getMenuHierarchy().subscribe({
    next: (menuItems) => {
      // Get current permissions before transforming
      const currentGroups = this.permissionGroups();
      
      const groups = menuItems
        .filter(menu => menu.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(menu => {
          // Find existing group if it exists
          const existingGroup = currentGroups.find(g => g.id === menu.menuId);
          
          const group: PermissionGroup = {
            id: menu.menuId,
            name: menu.menuName,
            expanded: menu.menuId === this.selectedMenuId,
            icon: menu.menuIndication,
            subGroups: menu.children 
              ? menu.children
                  .filter(child => child.isActive)
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map(child => {
                    // Find existing subGroup if it exists
                    const existingSubGroup = existingGroup?.subGroups?.find(sg => sg.id === child.menuId);
                    
                    return {
                      id: child.menuId,
                      name: child.menuName,
                      permissions: {
                        view: existingSubGroup?.permissions.view || false,
                        create: existingSubGroup?.permissions.create || false,
                        update: existingSubGroup?.permissions.update || false,
                        delete: existingSubGroup?.permissions.delete || false,
                        export: existingSubGroup?.permissions.export || false,
                        approve: existingSubGroup?.permissions.approve || false
                      }
                    };
                  })
              : undefined,
            permissions: !menu.children 
              ? {
                  view: existingGroup?.permissions?.view || false,
                  create: existingGroup?.permissions?.create || false,
                  update: existingGroup?.permissions?.update || false,
                  delete: existingGroup?.permissions?.delete || false,
                  export: existingGroup?.permissions?.export || false,
                  approve: existingGroup?.permissions?.approve || false
                } 
              : undefined
          };
          
          return group;
        });
      
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
private collectAllMenuIds(groups: PermissionGroup[]): string[] {
    const ids: string[] = [];
    
    const processGroup = (group: PermissionGroup) => {
      ids.push(group.id);
      if (group.subGroups) {
        group.subGroups.forEach(processGroup as any);
      }
    };
    
    groups.forEach(processGroup);
    return ids;
  }

  private findMenuById(menuId: string): PermissionGroup | PermissionSubGroup | undefined {
  const findInGroups = (groups: PermissionGroup[]): PermissionGroup | PermissionSubGroup | undefined => {
    for (const group of groups) {
      if (group.id === menuId) return group;
      if (group.subGroups) {
        const subGroup = group.subGroups.find(sg => sg.id === menuId);
        if (subGroup) return subGroup;
        
        // Recursively search in nested sub-groups
        const nestedResult = findInGroups(group.subGroups as unknown as PermissionGroup[]);
        if (nestedResult) return nestedResult;
      }
    }
    return undefined;
  };
  
  return findInGroups(this.permissionGroups());
}

private transformMenuToPermissionGroups(menuItems: any[], userPermissions: any[]): PermissionGroup[] {
  return menuItems
    .filter(menu => menu.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map(menu => {
      const menuPermissions = userPermissions.filter(p => p.menuId === menu.menuId);
      
      const group: PermissionGroup = {
        id: menu.menuId,
        name: menu.menuName,
        expanded: menu.menuId === this.selectedMenuId,
        icon: menu.menuIndication,
        subGroups: menu.children 
          ? menu.children
              .filter(child => child.isActive)
              .sort((a, b) => a.displayOrder - b.displayOrder)
              .map(child => {
                const childPerms = userPermissions.filter(p => p.menuId === child.menuId);
                return {
                  id: child.menuId,
                  name: child.menuName,
                  permissions: {
                    view: this.hasPermission(childPerms, 'view'),
                    create: this.hasPermission(childPerms, 'create'),
                    update: this.hasPermission(childPerms, 'update'),
                    delete: this.hasPermission(childPerms, 'delete'),
                    export: this.hasPermission(childPerms, 'export'),
                    approve: this.hasPermission(childPerms, 'approve')
                  }
                };
              })
          : undefined,
        permissions: !menu.children ? {
          view: this.hasPermission(menuPermissions, 'view'),
          create: this.hasPermission(menuPermissions, 'create'),
          update: this.hasPermission(menuPermissions, 'update'),
          delete: this.hasPermission(menuPermissions, 'delete'),
          export: this.hasPermission(menuPermissions, 'export'),
          approve: this.hasPermission(menuPermissions, 'approve')
        } : undefined
      };
      
      return group;
    })
    .filter(group => {
      // Show all groups when not viewing a specific user
      if (!this.userId) return true;
      
      // Show the group if it has direct permissions
      if (group.permissions && Object.values(group.permissions).some(v => v)) return true;
      
      // Show the group if it has sub-groups with permissions
      if (group.subGroups && group.subGroups.some(sg => Object.values(sg.permissions).some(v => v))) return true;
      
      // Show the group if it's the currently selected menu (even if no permissions yet)
      if (this.selectedMenuId && group.id === this.selectedMenuId) return true;
      
      // Show the group if it has any permissions at all (parent or child)
      const allPermissions = userPermissions.filter(p => p.menuId === group.id);
      return allPermissions.length > 0;
    }) as PermissionGroup[];
}
  toggleEditMode() {
  this.isEditMode = !this.isEditMode;
  
  if (this.isEditMode) {
    // Store the current state before loading full hierarchy
    this.originalPermissionGroups = JSON.parse(JSON.stringify(this.permissionGroups()));
    this.loadFullMenuHierarchy();
  } else {
    // Revert to original permissions
    this.permissionGroups.set(this.originalPermissionGroups);
    this.expiryDate = null;
    this.expiryTime = '00:00';
  }
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
  // First check in groups
  for (const group of this.permissionGroups()) {
    if (group.id === menuId) {
      return group.name;
    }
    // Then check in subGroups
    if (group.subGroups) {
      for (const subGroup of group.subGroups) {
        if (subGroup.id === menuId) {
          return subGroup.name;
        }
      }
    }
  }
  return 'Unknown Menu';
}

savePermissions() {
  if (!this.selectedMenuId) {
    Swal.fire('Error', 'Please select a menu first', 'error');
    return;
  }

  if (this.permissionType === 'TEMPORARY' && !this.expiryDate) {
    Swal.fire('Error', 'Please select an expiry date for temporary permissions', 'error');
    return;
  }
  
  // Find the selected menu using the findMenuById method which handles nested structures
  const selectedMenu = this.findMenuById(this.selectedMenuId!);
  
  if (!selectedMenu) {
    console.error('Selected menu not found in the menu structure');
    Swal.fire('Error', 'Selected menu not found. Please try selecting the menu again.', 'error');
    return;
  }

  Swal.fire({
    title: 'Are you sure?',
    text: 'Do you want to save these permission changes?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, save changes',
    cancelButtonText: 'Cancel',
    showLoaderOnConfirm: true,
    preConfirm: () => {
      return new Promise((resolve) => {
        // The actual save logic will be handled in the .then() block
        resolve(true);
      });
    },
  }).then((result) => {
    if (result.isConfirmed) {
      // First check if user has any existing permissions for the selected menu
      this.menuPermissionService.getUserPermissions(this.userId!, false).subscribe({
        next: (userPermissions) => {
          // Check if user has any access to the selected module
          const hasModuleAccess = userPermissions.some((permission: any) => 
            permission.menuId === this.selectedMenuId
          );

          if (hasModuleAccess) {
            // If user has access to the module, use PUT to update
            this.updatePermissions('Save changes');
          } else {
            // If user doesn't have access to the module, use POST to create new permissions
            this.createPermissions('Save changes');
          }
        },
        error: (error) => {
          console.error('Error checking module access:', error);
          Swal.fire('Error', 'Failed to check module access', 'error');
        }
      });
    }
  });
}

private createPermissions(reason: string) {
  if (!this.currentUser) {
    console.error('User not authenticated');
    Swal.fire('Error', 'User not authenticated', 'error');
    return;
  }

  if (!this.selectedMenuId) {
    console.error('No menu selected');
    Swal.fire('Error', 'No menu selected', 'error');
    return;
  }

  const selectedMenu = this.findMenuById(this.selectedMenuId);
  
  if (!selectedMenu) {
    console.error('Selected menu not found in createPermissions');
    Swal.fire('Error', 'Selected menu not found', 'error');
    return;
  }

  const actionNames: string[] = [];
  
  if (selectedMenu.permissions) {
    if (selectedMenu.permissions.view) actionNames.push('VIEW');
    if (selectedMenu.permissions.create) actionNames.push('CREATE');
    if (selectedMenu.permissions.update) actionNames.push('UPDATE');
    if (selectedMenu.permissions.delete) actionNames.push('DELETE');
    if (selectedMenu.permissions.export) actionNames.push('EXPORT');
    if (selectedMenu.permissions.approve) actionNames.push('APPROVE');
  }
  
  if ('subGroups' in selectedMenu && selectedMenu.subGroups) {
    selectedMenu.subGroups.forEach(subGroup => {
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
    menuName: selectedMenu.name,
    actionNames: [...new Set(actionNames)],
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
    next: (newPermission) => {
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

// In RBAC.component.ts
private updatePermissions(reason: string) {
  if (!this.currentUser || !this.userId || !this.selectedMenuId) {
    console.error('Missing required information:', {
      hasUser: !!this.currentUser,
      userId: this.userId,
      selectedMenuId: this.selectedMenuId
    });
    Swal.fire('Error', 'Missing required information', 'error');
    return;
  }

  const selectedMenu = this.findMenuById(this.selectedMenuId);
  
  if (!selectedMenu) {
    console.error('Selected menu not found in updatePermissions');
    Swal.fire('Error', 'Selected menu not found', 'error');
    return;
  }

  const actionNames: string[] = [];
  
  if (selectedMenu.permissions) {
    if (selectedMenu.permissions.view) actionNames.push('VIEW');
    if (selectedMenu.permissions.create) actionNames.push('CREATE');
    if (selectedMenu.permissions.update) actionNames.push('UPDATE');
    if (selectedMenu.permissions.delete) actionNames.push('DELETE');
    if (selectedMenu.permissions.export) actionNames.push('EXPORT');
    if (selectedMenu.permissions.approve) actionNames.push('APPROVE');
  }

  if ('subGroups' in selectedMenu && selectedMenu.subGroups) {
    selectedMenu.subGroups.forEach(subGroup => {
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

  const updateData = {
    actionNames: [...new Set(actionNames)],
    permissionType: this.permissionType,
    expiryDate: this.permissionType === 'TEMPORARY' 
      ? this.formatDateTime(this.expiryDate, this.expiryTime) 
      : null,
    reason: reason,
    isActive: this.isActive,
    grantedBy: this.currentUser.userId,
    grantedByUsername: this.currentUser.username
  };

  // Use the correct service method
  this.menuPermissionService.updateUserPermissions(
    this.userId,
    this.selectedMenuId,
    updateData
  ).subscribe({
    next: () => {
      Swal.fire({
        title: 'Success',
        text: 'Permissions updated successfully',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });
      this.isEditMode = false;
      this.loadUserPermissions();
    },
    error: (error) => {
      console.error('Error updating permissions:', error);
      Swal.fire('Error', 'Failed to update permissions', 'error');
    }
  });
}
  
}