import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { catchError, map, switchMap } from 'rxjs/operators';

// User Account Interface
export interface UserAccount {
  userId: string;
  empId: string;
  username: string;
  email: string;
  roleId: string;
  accountStatus: string;
  mustChangePassword: boolean;
  lastLoginDate: string;
  accountLocked: boolean;
}

// Employee Profile Interface
export interface EmployeeProfile {
  employee: {
    empId: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    // Add other employee fields as needed
  };
  contacts: any[];
  addresses: any[];
  qualifications: any[];
  bankDetails: any[];
  history: any[];
}

// models/permission.model.ts
export interface Permission {
  id: string;
  name: string;
  checked: boolean;
}
export interface MenuPermission {
  permissionId: string;
  userId: string;
  menuId: string;
  menuItem: string | null;
  menuName: string;
  actionNames: string[];
  permissionType: string;
  grantedBy: string | null;
  grantedByUsername: string | null;
  grantedDate: string;
  expiryDate: string | null;
  reason: string | null;
  isActive: boolean;
}

export interface SubModule {
  id: string;
  name: string;
  permissions: Permission[];
  expanded: boolean;
}

export interface Module {
  id: string;
  name: string;
  expanded: boolean;
  subModules: SubModule[];
}

export interface MenuPermission {
  permissionId: string;
  userId: string;
  menuId: string;
  menuItem: string | null;
  menuName: string;
  actionNames: string[];
  permissionType: string;
  grantedBy: string | null;
  grantedByUsername: string | null;
  grantedDate: string;
  expiryDate: string | null;
  reason: string | null;
  isActive: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class MenuPermissionService {
  private apiUrl = `${environment.apiUrl}/api/v1/user-menu-permissions`;
  private apiBaseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  /**
   * Get all user accounts
   */
  getAllUserAccounts(): Observable<UserAccount[]> {
    return this.http.get<UserAccount[]>(`${this.apiBaseUrl}/api/auth/user-accounts/all`);
  }

  /**
   * Get all menu permissions
   * @param userId Optional filter by user ID
   * @param menuId Optional filter by menu ID
   * @param isActive Optional filter by active status
   */
  getMenuPermissions(
    userId?: string,
    menuId?: string,
    isActive?: boolean
  ): Observable<MenuPermission[]> {
    let params = new HttpParams();
    
    if (userId) {
      params = params.append('userId', userId);
    }
    
    if (menuId) {
      params = params.append('menuId', menuId);
    }
    
    if (isActive !== undefined) {
      params = params.append('isActive', isActive.toString());
    }
    
    return this.http.get<MenuPermission[]>(this.apiUrl, { params });
  }

  /**
   * Get a single menu permission by ID
   * @param permissionId The ID of the permission to retrieve
   */
  getMenuPermissionById(permissionId: string): Observable<MenuPermission> {
    return this.http.get<MenuPermission>(`${this.apiUrl}/${permissionId}`);
  }

  /**
   * Create a new menu permission
   * @param permission The permission data to create
   */
  createMenuPermission(permission: Partial<MenuPermission>): Observable<MenuPermission> {
    return this.http.post<MenuPermission>(this.apiUrl, permission);
  }

  /**
   * Update an existing menu permission
   * @param permissionId The ID of the permission to update
   * @param permission The updated permission data
   */
  updateMenuPermission(
    permissionId: string,
    permission: Partial<MenuPermission>
  ): Observable<MenuPermission> {
    return this.http.put<MenuPermission>(`${this.apiUrl}/${permissionId}`, permission);
  }

  /**
   * Delete a menu permission
   * @param permissionId The ID of the permission to delete
   */
  deleteMenuPermission(permissionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${permissionId}`);
  }

  /**
   * Toggle the active status of a permission
   * @param permissionId The ID of the permission to toggle
   * @param isActive The new active status
   */
  togglePermissionStatus(
    permissionId: string,
    isActive: boolean
  ): Observable<MenuPermission> {
    return this.http.patch<MenuPermission>(
      `${this.apiUrl}/${permissionId}/status`,
      { isActive }
    );
  }

  /**
   * Get permissions for a specific user
   * @param userId The ID of the user
   * @param activeOnly Whether to return only active permissions
   */
  getUserPermissions(
    userId: string,
    activeOnly: boolean = true
  ): Observable<MenuPermission[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.append('isActive', 'true');
    }
    return this.http.get<MenuPermission[]>(`${this.apiUrl}/user/${userId}`, { params });
  }

  /**
   * Get user account details by user ID
   * @param userId The ID of the user
   */
  getUserAccount(userId: string): Observable<UserAccount> {
    return this.http.get<UserAccount>(`${this.apiBaseUrl}/api/auth/user-accounts/${userId}`);
  }

  /**
   * Get employee profile by employee ID
   * @param empId The ID of the employee
   */
  getEmployeeProfile(empId: string): Observable<EmployeeProfile> {
    return this.http.get<EmployeeProfile>(`${this.apiBaseUrl}/api/v1/employees/${empId}`);
  }

  /**
   * Get employee full name by employee ID
   * @param empId The ID of the employee
   */
  getEmployeeName(empId: string): Observable<string> {
    return this.getEmployeeProfile(empId).pipe(
      map(profile => {
        const employee = profile.employee;
        return employee.middleName 
          ? `${employee.firstName} ${employee.middleName} ${employee.lastName}`
          : `${employee.firstName} ${employee.lastName}`;
      }),
      catchError(() => of(empId)) // Return empId if there's an error
    );
  }

  /**
   * Update user permissions for a specific menu
   * @param userId The ID of the user
   * @param menuId The ID of the menu
   * @param data The permission data to update
   */
  updateUserPermissions(
    userId: string,
    menuId: string,
    data: {
      actionNames: string[];
      permissionType: string;
      expiryDate: string | null;
      reason: string;
      isActive: boolean;
      grantedBy: string;
      grantedByUsername: string;
    }
  ): Observable<MenuPermission> {
    // First, get the existing permission to update
    return this.getUserPermissions(userId, false).pipe(
      switchMap(permissions => {
        const existingPermission = permissions.find(p => p.menuId === menuId);
        
        if (existingPermission) {
          // Update existing permission
          return this.http.put<MenuPermission>(
            `${this.apiUrl}/${existingPermission.permissionId}`,
            {
              ...existingPermission,
              actionNames: data.actionNames,
              permissionType: data.permissionType,
              expiryDate: data.expiryDate,
              reason: data.reason,
              isActive: data.isActive,
              grantedBy: data.grantedBy,
              grantedByUsername: data.grantedByUsername,
              modifiedDate: new Date().toISOString()
            }
          );
        } else {
          // Create new permission if it doesn't exist
          return this.http.post<MenuPermission>(this.apiUrl, {
            userId,
            menuId,
            actionNames: data.actionNames,
            permissionType: data.permissionType,
            expiryDate: data.expiryDate,
            reason: data.reason,
            isActive: data.isActive,
            grantedBy: data.grantedBy,
            grantedByUsername: data.grantedByUsername,
            grantedDate: new Date().toISOString(),
            menuItem: null,
            menuName: '' // This should be set based on your menu structure
          });
        }
      })
    );
  }

  /**
   * Get combined user and employee information
   * @param userId The ID of the user
   */
  getUserWithEmployeeInfo(userId: string): Observable<{user: UserAccount, employee: EmployeeProfile}> {
    return this.getUserAccount(userId).pipe(
      switchMap(userAccount => {
        if (!userAccount.empId) {
          return throwError(() => new Error('No employee ID associated with this user account'));
        }
        return this.getEmployeeProfile(userAccount.empId).pipe(
          map(employeeProfile => ({
            user: userAccount,
            employee: employeeProfile
          }))
        );
      })
    );
  }
}

