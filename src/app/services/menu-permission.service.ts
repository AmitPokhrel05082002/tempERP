import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// models/permission.model.ts
export interface Permission {
  id: string;
  name: string;
  checked: boolean;
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

  constructor(private http: HttpClient) {}

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
   * Get permissions for a specific menu
   * @param menuId The ID of the menu
   * @param activeOnly Whether to return only active permissions
   */
  getMenuPermissionsByMenuId(
    menuId: string,
    activeOnly: boolean = true
  ): Observable<MenuPermission[]> {
    let params = new HttpParams();
    if (activeOnly) {
      params = params.append('isActive', 'true');
    }
    return this.http.get<MenuPermission[]>(`${this.apiUrl}/menu/${menuId}`, { params });
  }
}
