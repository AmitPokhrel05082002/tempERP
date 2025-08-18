// auth.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map, switchMap, filter } from 'rxjs/operators';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface Permission {
  permissionId: string;
  permissionCode: string;
  moduleName: string;
  actionType: string;
  permissionName: string;
  grantedDate: string;
}

export interface User {
  userId: string;
  deptId?: string;  // For backward compatibility
  deptID?: string;  // Matches the API response
  isDeptHead: boolean;
  empId: string;
  ctoId?: string;
  username: string;
  email: string;
  accountStatus: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  mustChangePassword: boolean;
  accessToken: string;
  refreshToken: string;
  permissions?: Permission[];
  getRoleBasedId: () => string;
  
  // Helper method to get department ID regardless of case
  getDepartmentId?(): string | undefined;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;
  private permissionsSubject = new BehaviorSubject<Permission[]>([]);
  public permissions$ = this.permissionsSubject.asObservable();

  // Observable stream of current user
  get user$(): Observable<User | null> {
    return this.currentUser$;
  }

  // Stream of just the userId, useful for composing API calls
  get userId$(): Observable<string> {
    return this.user$.pipe(
      filter((u): u is User => !!u),
      map(u => u.userId)
    );
  }

  // Synchronous access to userId
  public get userId(): string | null {
    return this.currentUserValue?.userId ?? null;
  }

  isManager(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === 'Manager';
  }

  /**
   * Gets the role-based ID for the current user
   * Returns the CTO ID for CTOs, Employee ID for Employees, or null if no user is logged in
   */
  public get roleBasedId(): string | null {
    const user = this.currentUserValue;
    if (!user) return null;
    
    // Use the user's getRoleBasedId method if it exists
    if (typeof user.getRoleBasedId === 'function') {
      return user.getRoleBasedId();
    }
    
    // Fallback implementation if getRoleBasedId is not available
    return user.roleName === 'CTO'
      ? (user.ctoId || user.userId)
      : (user.empId || user.userId);
  }

  // Define role constants
  readonly ADMIN_ROLE = 'Admin';
  readonly CTO_ROLE = 'CTO';
  readonly EMPLOYEE_ROLE = 'Employee';

  constructor(private router: Router, private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser$ = this.currentUserSubject.asObservable();
    
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.permissionsSubject.next(user.permissions || []);
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated$(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => !!user));
  }

  public get isAdminOrCTO(): boolean {
    const user = this.currentUserValue;
    return user ? ['Admin', 'CTO'].includes(user.roleName) : false;
  }
  getEmployeeByEmpId(empId: string): Observable<any> {
  return this.http.get(`${environment.apiUrl}/api/v1/employees/${empId}`).pipe(
    catchError(error => {
      console.error('Error fetching employee:', error);
      return throwError(() => error);
    })
  );
}
// auth.service.ts
updateCurrentUser(user: User): void {
  localStorage.setItem('currentUser', JSON.stringify(user));
  this.currentUserSubject.next(user);
  if (user.permissions) {
    this.permissionsSubject.next(user.permissions);
  }
}
  login(username: string, password: string): Observable<boolean> {
  const url = `${environment.apiUrl}/api/auth/login`;

  return this.http.post<any>(url, { username, password }).pipe(
    switchMap(loginResponse => {
      if (!loginResponse.success) {
        throw new Error('Login failed');
      }

      const userData = loginResponse.data.user;
      const roleId = userData.role.roleId; // Get roleId from nested role object
      const roleName = userData.role.roleName; // Already available in response
      const roleCode = userData.role.roleCode; // Already available in response

      // Create the base user object with role-based ID handling
      const baseUser: User = {
        userId: userData.userId,
        deptId: userData.deptID || userData.deptId, // Map from deptID (API) to deptId (interface)
        deptID: userData.deptID, // Keep the original deptID as well
        isDeptHead: userData.isDeptHead || false,
        empId: roleName === 'Employee' ? userData.empId : undefined,
        ctoId: roleName === 'CTO' ? (userData.ctoId || userData.userId) : undefined,
        username: userData.username,
        email: userData.email,
        accountStatus: userData.accountStatus,
        roleId: roleId,
        roleName: roleName,
        roleCode: roleCode,
        mustChangePassword: userData.mustChangePassword,
        accessToken: loginResponse.data.accessToken,
        refreshToken: loginResponse.data.refreshToken,
        getRoleBasedId: function() {
          return this.roleName === 'CTO' 
            ? (this.ctoId || this.userId) 
            : (this.empId || this.userId);
        },
        getDepartmentId: function() {
          return this.deptID || this.deptId;
        }
      };

      // Since we already have role info, we can skip the first role fetch
      // Just get permissions for this role
      return this.http.get<Permission[]>(
        `${environment.apiUrl}/api/v1/role-permissions/role/${roleId}/permissions`
      ).pipe(
        tap(permissions => {
          const completeUser = {
            ...baseUser,
            permissions: permissions
          };
          localStorage.setItem('currentUser', JSON.stringify(completeUser));
          this.currentUserSubject.next(completeUser);
          this.permissionsSubject.next(permissions);
        }),
        map(() => true)
      );
    }),
    catchError(error => {
      console.error('Login error', error);
      return of(false);
    })
  );
}
  refreshToken(): Observable<any> {
    const user = this.currentUserValue;
    if (!user?.refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

    // Remove the leading /api from the endpoint since it's already in the base URL
    return this.http.post<any>(`${environment.apiUrl}/auth/refresh-token`, {
      refreshToken: user.refreshToken
    }).pipe(
      tap(response => {
        if (response.success) {
          const updatedUser = {
            ...user,
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken
          };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      }),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

/**
   * Logout the current user
   */
  logout(): Observable<boolean> {
    const token = this.getToken();
    if (!token) {
      this.clearLocalAuthData();
      return of(true);
    }

    return this.http.post<any>(`${environment.apiUrl}/api/auth/logout`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).pipe(
      map(() => {
        this.clearLocalAuthData();
        return true;
      }),
      catchError(error => {
        console.error('Logout error:', error);
        this.clearLocalAuthData();
        return of(true); // Still return true to proceed with local cleanup
      })
    );
  }

  /**
   * Logout from all sessions
   */
  logoutAllSessions(): Observable<boolean> {
    const token = this.getToken();
    if (!token) {
      this.clearLocalAuthData();
      return of(true);
    }

    return this.http.post<any>(`${environment.apiUrl}/api/auth/logout-all`, {}, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).pipe(
      map(() => {
        this.clearLocalAuthData();
        return true;
      }),
      catchError(error => {
        console.error('Logout all error:', error);
        this.clearLocalAuthData();
        return of(true);
      })
    );
  }

  /**
   * Admin force logout a specific user
   */
  forceLogoutUser(userId: string): Observable<boolean> {
    return this.http.post<any>(`${environment.apiUrl}/api/auth/admin/force-logout/${userId}`, {}).pipe(
      map(() => true),
      catchError(error => {
        console.error('Force logout error:', error);
        return of(false);
      })
    );
  }

  /**
   * Clear local auth data and redirect to login
   */
  private clearLocalAuthData(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.permissionsSubject.next([]);
    this.router.navigate(['/guest/login']).then(() => window.location.reload());
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  getUserPermissions(): Permission[] {
    return this.permissionsSubject.value;
  }

  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.ADMIN_ROLE;
  }

  isCTO(): boolean {
    const user = this.currentUserValue;
    return user?.roleCode === 'CTO';
  }


  isEmployee(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.EMPLOYEE_ROLE;
  }

  hasFullAccess(): boolean {
    return this.isAdmin() || this.isCTO();
  }

  hasReadOnlyAccess(): boolean {
    return this.isEmployee();
  }

  // Module-specific permission checks
  canViewModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'read');
  }

  canEditModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'write');
  }

  canDeleteModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'delete');
  }

  public hasPermissionForModule(moduleName: string, actionType: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    
    return user.permissions.some(p => 
      p.moduleName.toLowerCase() === moduleName.toLowerCase() && 
      p.actionType.toLowerCase() === actionType.toLowerCase()
    );
  }


 hasPermission(permissionCode: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return user.permissions.some(p => p.permissionCode === permissionCode);
  }

  hasAnyPermission(permissionCodes: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.some(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }

  // Retrieve the current user's access token (if available)
  getToken(): string | null {
    return this.currentUserValue?.accessToken ?? null;
  }

  hasAllPermissions(permissionCodes: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.every(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }
}
