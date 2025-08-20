import { Component, signal, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MenuHierarchyService } from '../../../services/menu-hierarchy.service';
import { MenuPermissionService } from '../../../services/menu-permission.service';
import { AuthService } from '../../../core/services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
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

interface UserRole {
  roleId: string;
  orgId: string;
  roleName: string;
  roleCode: string;
  roleDescription: string;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
}

@Component({
  selector: 'app-RBAC',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './RBAC.component.html',
  styleUrls: ['./RBAC.component.scss']
})
export class RBACComponent implements OnInit {
  private menuHierarchyService = inject(MenuHierarchyService);
  private menuPermissionService = inject(MenuPermissionService);
  private authService = inject(AuthService);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  
  permissionGroups = signal<PermissionGroup[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  userId: string | null = null;
  selectedMenuId: string | null = null;
  selectedMenuIds: string[] = []; // Track multiple selected menus for new users
  isMultiModuleSelection = false; // Flag to indicate multi-module mode
  
  isEditMode = false;
  originalPermissionGroups: PermissionGroup[] = [];
  permissionType: string = 'GRANT';
  expiryDate: string | null = null;
  expiryTime: string = '00:00';
  isActive: boolean = true;
  showExpiryDate = true;
  minDate = new Date().toISOString().split('T')[0];
  currentUser: User | null = null;
  userRole: UserRole | null = null;
  isNewUser = false;

  ngOnInit() {
    this.currentUser = this.authService.currentUserValue;
    this.route.queryParams.subscribe(params => {
      this.userId = params['userId'];
      this.selectedMenuId = params['menuId'];
      
      if (this.userId) {
        // First load user permissions, then fetch role information
        this.loadUserPermissions().then(() => {
          if (this.isNewUser) {
            this.fetchUserRole();
          }
        });
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

  // Fetch user role information
  private fetchUserRole() {
    if (!this.userId) return;
    
    this.menuPermissionService.getUserAccount(this.userId).subscribe({
      next: (userAccount) => {
        if (userAccount.roleId) {
          this.http.get<UserRole>(`${environment.apiUrl}/api/v1/user-roles/${userAccount.roleId}`).subscribe({
            next: (role) => {
              this.userRole = role;
            },
            error: (err) => {
              console.error('Failed to fetch user role:', err);
            }
          });
        }
      },
      error: (err) => {
        console.error('Failed to fetch user account:', err);
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

  loadUserPermissions(): Promise<void> {
    return new Promise((resolve) => {
      this.loading.set(true);
      this.error.set(null);
      
      this.menuPermissionService.getUserPermissions(this.userId!, false).subscribe({
        next: (permissions) => {
          console.log('Loaded user permissions:', permissions);
          
          // Check if user has no permissions (new user)
          this.isNewUser = permissions.length === 0;
          
          // Set expiry date/time if available
          const selectedPermission = permissions.find(p => p.menuId === this.selectedMenuId);
          if (selectedPermission && selectedPermission.expiryDate) {
            const expiryDate = new Date(selectedPermission.expiryDate);
            this.expiryDate = expiryDate.toISOString().split('T')[0];
            this.expiryTime = `${this.padZero(expiryDate.getHours())}:${this.padZero(expiryDate.getMinutes())}`;
          }
          
          // Load the menu hierarchy and map the permissions
          this.menuHierarchyService.getMenuHierarchy().subscribe({
            next: (menuItems) => {
              // Transform the menu items to include the user's permissions
              const groups = this.transformMenuToPermissionGroups(menuItems, permissions);
              this.permissionGroups.set(groups);
              
              // If we have a selected menu ID, expand its parent group
              if (this.selectedMenuId) {
                const groups = this.permissionGroups();
                const group = groups.find(g => 
                  g.id === this.selectedMenuId || 
                  (g.subGroups && g.subGroups.some(sg => sg.id === this.selectedMenuId))
                );
                
                if (group) {
                  group.expanded = true;
                  this.permissionGroups.set([...groups]);
                }
              }
              
              this.loading.set(false);
              resolve();
            },
            error: (err) => {
              console.error('Failed to load menu hierarchy:', err);
              this.error.set('Failed to load menu hierarchy. Please try again later.');
              this.loading.set(false);
              resolve();
            }
          });
        },
        error: (err) => {
          console.error('Failed to load user permissions:', err);
          this.error.set('Failed to load user permissions. Please try again later.');
          this.loading.set(false);
          resolve();
        }
      });
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
        // Find all permissions for this menu item
        const menuPermissions = userPermissions.filter(p => p.menuId === menu.menuId);
        
        const group: PermissionGroup = {
          id: menu.menuId,
          name: menu.menuName,
          expanded: menu.menuId === this.selectedMenuId || this.isEditMode,
          icon: menu.menuIndication,
          subGroups: menu.children 
            ? menu.children
                .filter(child => child.isActive)
                .sort((a, b) => a.displayOrder - b.displayOrder)
                .map(child => {
                  // Find all permissions for this child menu item
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
      // Store the current state before making changes
      this.originalPermissionGroups = JSON.parse(JSON.stringify(this.permissionGroups()));
      
      // If new user, apply default permissions based on role
      if (this.isNewUser && this.userRole) {
        this.isMultiModuleSelection = true;
        this.applyDefaultPermissions(this.userRole.roleCode || this.userRole.roleName);
      } else {
        this.isMultiModuleSelection = false;
        this.loadFullMenuHierarchy();
      }
    } else {
      // Revert to original permissions
      this.permissionGroups.set(this.originalPermissionGroups);
      this.selectedMenuIds = [];
      this.isMultiModuleSelection = false;
      this.expiryDate = null;
      this.expiryTime = '00:00';
    }
  }

  // Apply default permissions based on role
  applyDefaultPermissions(role: string) {
    this.loadFullMenuHierarchy();
    this.selectedMenuIds = []; // Reset selected menus
    
    setTimeout(() => {
      const groups = this.permissionGroups();
      
      // Use roleCode if available, otherwise use roleName
      const roleUpper = role.toUpperCase();
      
      if (roleUpper.includes('HR') || roleUpper.includes('ADMIN')) {
        // Full access to everything
        groups.forEach(group => {
          this.selectedMenuIds.push(group.id); // Add to selected menus
          
          if (group.permissions) {
            group.permissions = {
              view: true,
              create: true,
              update: true,
              delete: true,
              export: true,
              approve: true
            };
          }
          
          if (group.subGroups) {
            group.subGroups.forEach(subGroup => {
              this.selectedMenuIds.push(subGroup.id); // Add subgroups to selected menus
              subGroup.permissions = {
                view: true,
                create: true,
                update: true,
                delete: true,
                export: true,
                approve: true
              };
            });
          }
        });
      } else if (roleUpper.includes('MANAGER')) {
        // Specific access patterns for managers
        groups.forEach(group => {
          const groupName = group.name.toLowerCase();
          let hasPermissions = false;
          
          // Dashboard - view, approve, export
          if (groupName.includes('dashboard')) {
            hasPermissions = true;
            if (group.permissions) {
              group.permissions = {
                view: true,
                create: false,
                update: false,
                delete: false,
                export: true,
                approve: true
              };
            }
          }
          
          // Organization and its sub-branches - view, export, approve
          if (groupName.includes('organization')) {
            hasPermissions = true;
            if (group.permissions) {
              group.permissions = {
                view: true,
                create: false,
                update: false,
                delete: false,
                export: true,
                approve: true
              };
            }
            
            if (group.subGroups) {
              group.subGroups.forEach(subGroup => {
                this.selectedMenuIds.push(subGroup.id);
                subGroup.permissions = {
                  view: true,
                  create: false,
                  update: false,
                  delete: false,
                  export: true,
                  approve: true
                };
              });
            }
          }
          
          // Similar patterns for other modules...
          const viewExportApproveModules = [
            'employee', 'leave', 'payroll', 'attendance', 
            'transfer', 'training', 'separation', 'document'
          ];
          
          viewExportApproveModules.forEach(module => {
            if (groupName.includes(module)) {
              hasPermissions = true;
              if (group.permissions) {
                group.permissions = {
                  view: true,
                  create: false,
                  update: false,
                  delete: false,
                  export: true,
                  approve: true
                };
              }
              
              if (group.subGroups) {
                group.subGroups.forEach(subGroup => {
                  this.selectedMenuIds.push(subGroup.id);
                  subGroup.permissions = {
                    view: true,
                    create: false,
                    update: false,
                    delete: false,
                    export: true,
                    approve: true
                  };
                });
              }
            }
          });
          
          if (hasPermissions) {
            this.selectedMenuIds.push(group.id);
          }
        });
      } else if (roleUpper.includes('EMPLOYEE')) {
        // Specific access for employees
        groups.forEach(group => {
          const groupName = group.name.toLowerCase();
          let hasPermissions = false;
          
          // For specific modules, employees get view, create, export
          const employeeModules = [
            'leave', 'payroll', 'attendance', 'transfer', 
            'training', 'document', 'employee'
          ];
          
          employeeModules.forEach(module => {
            if (groupName.includes(module)) {
              hasPermissions = true;
              if (group.permissions) {
                group.permissions = {
                  view: true,
                  create: true,
                  update: false,
                  delete: false,
                  export: true,
                  approve: false
                };
              }
              
              if (group.subGroups) {
                group.subGroups.forEach(subGroup => {
                  this.selectedMenuIds.push(subGroup.id);
                  subGroup.permissions = {
                    view: true,
                    create: true,
                    update: false,
                    delete: false,
                    export: true,
                    approve: false
                  };
                });
              }
            }
          });
          
          if (hasPermissions) {
            this.selectedMenuIds.push(group.id);
          }
        });
      }
      
      // Remove duplicates
      this.selectedMenuIds = [...new Set(this.selectedMenuIds)];
      this.permissionGroups.set([...groups]);
    }, 300);
  }

  // Add this new method to get display text for selected menus
  getMenuNames(menuIds: string[]): string {
    return menuIds.map(id => this.getMenuName(id)).join(', ');
  }

  getSelectedMenusDisplay(): string {
    if (this.isMultiModuleSelection && this.selectedMenuIds.length > 0) {
      const menuNames = this.getMenuNames(this.selectedMenuIds);
      const menuNameArray = menuNames.split(',');
      if (menuNameArray.length <= 3) {
        return menuNames;
      } else {
        return `${menuNameArray.slice(0, 3).join(',')} and ${menuNameArray.length - 3} more modules`;
      }
    } else if (this.selectedMenuId) {
      return this.getMenuName(this.selectedMenuId);
    }
    return 'No menu selected';
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
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex !== -1) {
      const group = {...groups[groupIndex]};
      
      if (subGroupId && group.subGroups) {
        // Update specific subgroup
        group.subGroups = group.subGroups.map(sg => 
          sg.id === subGroupId 
            ? {
                ...sg,
                permissions: {
                  view: checked,
                  create: checked,
                  update: checked,
                  delete: checked,
                  export: checked,
                  ...(sg.permissions.approve !== undefined && { approve: checked })
                }
              }
            : sg
        );
      } else if (!subGroupId && group.permissions) {
        // Update group's direct permissions
        group.permissions = {
          view: checked,
          create: checked,
          update: checked,
          delete: checked,
          export: checked,
          ...(group.permissions.approve !== undefined && { approve: checked })
        };
      }
      
      groups[groupIndex] = group;
      this.permissionGroups.set([...groups]);
    }
  }

  // Toggle a specific permission for all submodules in a group
  togglePermissionForAllSubmodules(groupId: string, permissionType: string, checked: boolean) {
    const groups = this.permissionGroups();
    const groupIndex = groups.findIndex(g => g.id === groupId);
    
    if (groupIndex === -1) return;
    
    const group = {...groups[groupIndex]};
    
    if (group.subGroups?.length) {
      // Update all sub-groups
      group.subGroups = group.subGroups.map(sg => ({
        ...sg,
        permissions: {
          ...sg.permissions,
          [permissionType]: checked
        }
      }));
    } else if (group.permissions) {
      // Update group's direct permissions
      group.permissions = {
        ...group.permissions,
        [permissionType]: checked
      };
    }
    
    groups[groupIndex] = group;
    this.permissionGroups.set([...groups]);
  }

  // Check if a specific permission is checked for all submodules in a group
  isPermissionCheckedForAllSubmodules(groupId: string, permissionType: string): boolean {
    const group = this.permissionGroups().find(g => g.id === groupId);
    if (!group) return false;
    
    // If there are sub-groups, check all of them
    if (group.subGroups?.length) {
      return group.subGroups.every(sg => 
        sg.permissions[permissionType as keyof typeof sg.permissions] === true
      );
    }
    
    // If no sub-groups, check the group's direct permissions
    return group.permissions?.[permissionType as keyof typeof group.permissions] === true;
  }
  
  // Check if a specific permission is partially checked for submodules in a group
  isPermissionIndeterminate(groupId: string, permissionType: string): boolean {
    const group = this.permissionGroups().find(g => g.id === groupId);
    if (!group) return false;
    
    // If there are no sub-groups, there's no partial state
    if (!group.subGroups?.length) return false;
    
    const hasSomeChecked = group.subGroups.some(sg => 
      sg.permissions[permissionType as keyof typeof sg.permissions] === true
    );
    const hasSomeUnchecked = group.subGroups.some(sg => 
      sg.permissions[permissionType as keyof typeof sg.permissions] !== true
    );
    
    return hasSomeChecked && hasSomeUnchecked;
  }

  // Check if any subgroup has approve permission
  hasSubgroupWithApprove(group: any): boolean {
    return group.subGroups && group.subGroups.some((sg: any) => sg.permissions.approve !== undefined);
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
    const menusToSave = this.isMultiModuleSelection && this.selectedMenuIds.length > 0 
      ? this.selectedMenuIds 
      : (this.selectedMenuId ? [this.selectedMenuId] : []);

    if (menusToSave.length === 0) {
      Swal.fire('Error', 'Please select at least one menu', 'error');
      return;
    }

    if (this.permissionType === 'TEMPORARY' && !this.expiryDate) {
      Swal.fire('Error', 'Please select an expiry date for temporary permissions', 'error');
      return;
    }

    Swal.fire({
      title: 'Are you sure?',
      text: `Do you want to save permission changes for ${menusToSave.length} module(s)?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, save changes',
      cancelButtonText: 'Cancel',
      showLoaderOnConfirm: true,
      preConfirm: () => {
        return new Promise((resolve) => {
          resolve(true);
        });
      },
    }).then((result) => {
      if (result.isConfirmed) {
        if (this.isMultiModuleSelection) {
          this.saveMultipleMenuPermissions(menusToSave);
        } else {
          // Handle single menu permission save as before
          this.handleSingleMenuPermission();
        }
      }
    });
  }

  private handleSingleMenuPermission() {
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

  // New method to save permissions for multiple menus
  private saveMultipleMenuPermissions(menuIds: string[]) {
    const savePromises = menuIds.map(menuId => {
      return this.savePermissionsForMenu(menuId);
    });

    Promise.all(savePromises).then(
      (results) => {
        const successCount = results.filter(r => r !== null).length;
        Swal.fire({
          title: 'Success',
          text: `Permissions saved successfully for ${successCount} module(s)`,
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        this.isEditMode = false;
        this.isMultiModuleSelection = false;
        this.selectedMenuIds = [];
        this.loadUserPermissions();
      },
      (error) => {
        console.error('Error saving permissions:', error);
        Swal.fire('Error', 'Failed to save some permissions', 'error');
      }
    );
  }

  // Helper method to save permissions for a single menu
  private savePermissionsForMenu(menuId: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const selectedMenu = this.findMenuById(menuId);
      
      if (!selectedMenu) {
        reject(new Error(`Menu ${menuId} not found`));
        return;
      }

      const actionNames: string[] = [];
      
      if (selectedMenu.permissions) {
        if (selectedMenu.permissions.view) actionNames.push('view');
        if (selectedMenu.permissions.create) actionNames.push('create');
        if (selectedMenu.permissions.update) actionNames.push('update');
        if (selectedMenu.permissions.delete) actionNames.push('delete');
        if (selectedMenu.permissions.export) actionNames.push('export');
        if (selectedMenu.permissions.approve) actionNames.push('approve');
      }
      
      if ('subGroups' in selectedMenu && selectedMenu.subGroups) {
        selectedMenu.subGroups.forEach(subGroup => {
          if (subGroup.permissions.view) actionNames.push('view');
          if (subGroup.permissions.create) actionNames.push('create');
          if (subGroup.permissions.update) actionNames.push('update');
          if (subGroup.permissions.delete) actionNames.push('delete');
          if (subGroup.permissions.export) actionNames.push('export');
          if (subGroup.permissions.approve) actionNames.push('approve');
        });
      }

      if (actionNames.length === 0) {
        resolve(null); // Skip menus with no permissions
        return;
      }

      const permissionData = {
        userId: this.userId,
        menuId: menuId,
        menuName: selectedMenu.name,
        actionNames: [...new Set(actionNames)],
        permissionType: this.permissionType,
        grantedBy: this.currentUser!.userId,
        grantedByUsername: this.currentUser!.username,
        expiryDate: this.permissionType === 'TEMPORARY' 
          ? this.formatDateTime(this.expiryDate, this.expiryTime) 
          : null,
        reason: 'Initial setup for new user',
        isActive: this.isActive
      };

      this.menuPermissionService.createMenuPermission(permissionData).subscribe({
        next: (result) => resolve(result),
        error: (error) => reject(error)
      });
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
      if (selectedMenu.permissions.view) actionNames.push('view');
      if (selectedMenu.permissions.create) actionNames.push('create');
      if (selectedMenu.permissions.update) actionNames.push('update');
      if (selectedMenu.permissions.delete) actionNames.push('delete');
      if (selectedMenu.permissions.export) actionNames.push('export');
      if (selectedMenu.permissions.approve) actionNames.push('approve');
    }
    
    if ('subGroups' in selectedMenu && selectedMenu.subGroups) {
      selectedMenu.subGroups.forEach(subGroup => {
        if (subGroup.permissions.view) actionNames.push('view');
        if (subGroup.permissions.create) actionNames.push('create');
        if (subGroup.permissions.update) actionNames.push('update');
        if (subGroup.permissions.delete) actionNames.push('delete');
        if (subGroup.permissions.export) actionNames.push('export');
        if (subGroup.permissions.approve) actionNames.push('approve');
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
      if (selectedMenu.permissions.view) actionNames.push('view');
      if (selectedMenu.permissions.create) actionNames.push('create');
      if (selectedMenu.permissions.update) actionNames.push('update');
      if (selectedMenu.permissions.delete) actionNames.push('delete');
      if (selectedMenu.permissions.export) actionNames.push('export');
      if (selectedMenu.permissions.approve) actionNames.push('approve');
    }

    if ('subGroups' in selectedMenu && selectedMenu.subGroups) {
      selectedMenu.subGroups.forEach(subGroup => {
        if (subGroup.permissions.view) actionNames.push('view');
        if (subGroup.permissions.create) actionNames.push('create');
        if (subGroup.permissions.update) actionNames.push('update');
        if (subGroup.permissions.delete) actionNames.push('delete');
        if (subGroup.permissions.export) actionNames.push('export');
        if (subGroup.permissions.approve) actionNames.push('approve');
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
  
  // Handle permission type change
  onPermissionTypeChange() {
    this.showExpiryDate = this.permissionType === 'TEMPORARY';
    if (this.permissionType !== 'TEMPORARY') {
      this.expiryDate = null;
      this.expiryTime = '00:00';
    }
  }
}