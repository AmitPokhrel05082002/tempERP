// auth.service.ts - Complete Updated Version
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

  // Define role constants
  readonly ADMIN_ROLE = 'Admin';
  readonly CTO_ROLE = 'CTO';
  readonly EMPLOYEE_ROLE = 'Employee';
  readonly MANAGER_ROLE = 'Manager';
  readonly HR_ROLE = 'HR';

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

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated$(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => !!user));
  }

  public get isAdminOrCTO(): boolean {
    const user = this.currentUserValue;
    return user ? [this.ADMIN_ROLE, this.CTO_ROLE].includes(user.roleName) : false;
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
    return user.roleName === this.CTO_ROLE
      ? (user.ctoId || user.userId)
      : (user.empId || user.userId);
  }

  // ===============================
  // BASIC ROLE CHECKING METHODS
  // ===============================

  /**
   * Check if current user is an Admin
   */
  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.ADMIN_ROLE;
  }

  /**
   * Check if current user is a CTO
   */
  isCTO(): boolean {
    const user = this.currentUserValue;
    return user?.roleCode === 'CTO' || user?.roleName === this.CTO_ROLE;
  }

  /**
   * Check if current user is an Employee
   */
  isEmployee(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.EMPLOYEE_ROLE;
  }

  /**
   * Check if current user is HR
   */
  isHR(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.HR_ROLE;
  }

  /**
   * Check if current user is a Manager
   */
  isManager(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE;
  }

  /**
   * Check if current user is a Department Head Manager
   * LEGACY METHOD - kept for backward compatibility
   */
  isManagerDeptHead(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE && user?.isDeptHead === true;
  }

  /**
   * UPDATED: Check if current user is a Manager with department access
   * Now checks for deptId presence regardless of isDeptHead status
   */
  isManagerWithDepartment(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE && !!this.getManagerDepartmentId();
  }

  // ===============================
  // ENHANCED ACCESS CONTROL METHODS
  // ===============================

  /**
   * Check if user has full system access (Admin or CTO)
   */
  hasFullAccess(): boolean {
    return this.isAdmin() || this.isCTO();
  }

  /**
   * Check if user has admin-level access (Admin or CTO)
   */
  hasAdminAccess(): boolean {
    return this.hasFullAccess();
  }

  /**
   * Check if user has read-only access (typically employees)
   */
  hasReadOnlyAccess(): boolean {
    return this.isEmployee();
  }

  /**
   * UPDATED: Check if user can view all employee data
   */
  canViewAllEmployees(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Admin and CTO can see all
    if (this.hasAdminAccess()) return true;
    
    // HR can see all
    if (this.isHR()) return true;
    
    // UPDATED: Managers with department ID can see their department employees
    if (this.isManagerWithDepartment()) return true;
    
    return false;
  }

  /**
   * Check if user can export data
   */
  canExportData(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // All roles except regular employees without special permissions can export
    return !this.isEmployee() || this.hasAdminAccess();
  }

  /**
   * UPDATED: Check if user can search employee data
   */
  canSearchEmployees(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Admin, HR, and Managers with department can search
    return this.hasAdminAccess() || this.isHR() || this.isManagerWithDepartment();
  }

  /**
   * Check if user can filter by all branches
   */
  canViewAllBranches(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Only Admin and HR can see all branches
    return this.hasAdminAccess() || this.isHR();
  }

  /**
   * Check if user can filter by all departments
   */
  canViewAllDepartments(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Only Admin and HR can see all departments
    return this.hasAdminAccess() || this.isHR();
  }

  // ===============================
  // MANAGER-SPECIFIC METHODS
  // ===============================

  /**
   * UPDATED: Get manager's department ID
   * Returns deptId if user is a manager and has one, regardless of isDeptHead status
   */
  getManagerDepartmentId(): string | null {
    const user = this.currentUserValue;
    if (user?.roleName === this.MANAGER_ROLE) {
      // Return deptId if it exists (regardless of isDeptHead status)
      return user.getDepartmentId?.() || user.deptID || user.deptId || null;
    }
    return null;
  }

  /**
   * UPDATED: Check if manager has access to department data
   * Now based on having a deptId rather than being a department head
   */
  canManagerAccessDepartment(departmentId?: string): boolean {
    const user = this.currentUserValue;
    if (user?.roleName !== this.MANAGER_ROLE) {
      return false;
    }
    
    const managerDeptId = this.getManagerDepartmentId();
    if (!managerDeptId) {
      return false;
    }
    
    // If no specific department provided, check if manager has any department
    if (!departmentId) {
      return true;
    }
    
    // Check if the requested department matches manager's department
    return managerDeptId === departmentId;
  }

  /**
   * UPDATED: Get user's access level for debugging and role-based UI
   */
  getUserAccessLevel(): string {
    const user = this.currentUserValue;
    if (!user) return 'NONE';
    
    if (this.hasAdminAccess()) return 'FULL_ACCESS';
    if (this.isHR()) return 'HR_ACCESS';
    if (this.isManagerWithDepartment()) return 'DEPT_MANAGER_ACCESS';
    if (this.isManager() && !this.getManagerDepartmentId()) return 'LIMITED_MANAGER_ACCESS';
    if (this.isEmployee()) return 'EMPLOYEE_ACCESS';
    
    return 'UNKNOWN';
  }

  // ===============================
  // AUTHENTICATION METHODS
  // ===============================

  /**
   * UPDATED: Enhanced login method with better Manager handling
   */
  login(username: string, password: string): Observable<boolean> {
    const url = `${environment.apiUrl}/api/auth/login`;

    return this.http.post<any>(url, { username, password }).pipe(
      switchMap(loginResponse => {
        if (!loginResponse.success) {
          throw new Error('Login failed');
        }

        const userData = loginResponse.data.user;
        const roleId = userData.role.roleId;
        const roleName = userData.role.roleName;
        const roleCode = userData.role.roleCode;

        // Enhanced manager-specific handling
        let empId = userData.empId;
        let ctoId = userData.ctoId;
        let deptId = userData.deptID || userData.deptId;
        let isDeptHead = userData.isDeptHead || false;

        // UPDATED: Validate manager data - focus on deptId presence
        if (roleName === this.MANAGER_ROLE) {
          console.log('Manager login detected:', {
            isDeptHead: isDeptHead,
            deptId: deptId,
            empId: empId,
            hasDepartmentAccess: !!deptId  // UPDATED: Access based on deptId
          });

          // UPDATED: Manager access is now based on having deptId
          if (!deptId) {
            console.warn('Manager login: No department ID found - limited access');
          } else {
            console.log('Manager login: Department ID found - granting department access');
          }

        }

        // Create the base user object with enhanced role-based ID handling
        const baseUser: User = {
          userId: userData.userId,
          deptId: deptId,
          deptID: userData.deptID,
          isDeptHead: isDeptHead,
          empId: empId,
          ctoId: roleName === this.CTO_ROLE ? (ctoId || userData.userId) : undefined,
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
            if (this.roleName === 'CTO') {
              return this.ctoId || this.userId;
            } else if (this.roleName === 'Manager' || this.roleName === 'Employee') {
              return this.empId || this.userId;
            }
            return this.userId;
          },
          getDepartmentId: function() {
            return this.deptID || this.deptId;
          }
        };

        // Get permissions for this role
        return this.http.get<Permission[]>(
          `${environment.apiUrl}/api/v1/role-permissions/role/${roleId}/permissions`
        ).pipe(
          tap(permissions => {
            const completeUser = {
              ...baseUser,
              permissions: permissions
            };
            
            console.log('Complete user object created:', {
              roleName: completeUser.roleName,
              isDeptHead: completeUser.isDeptHead,
              deptId: completeUser.getDepartmentId?.(),
              empId: completeUser.empId,
              permissions: permissions.length,
              hasManagerDeptAccess: completeUser.roleName === 'Manager' ? !!completeUser.getDepartmentId?.() : 'N/A'
            });
            
            localStorage.setItem('currentUser', JSON.stringify(completeUser));
            this.currentUserSubject.next(completeUser);
            this.permissionsSubject.next(permissions);
          }),
          map(() => true),
          catchError(permError => {
            console.error('Error fetching permissions:', permError);
            // Still allow login but without permissions
            const completeUser = {
              ...baseUser,
              permissions: []
            };
            localStorage.setItem('currentUser', JSON.stringify(completeUser));
            this.currentUserSubject.next(completeUser);
            this.permissionsSubject.next([]);
            return of(true);
          })
        );
      }),
      catchError(error => {
        console.error('Login error', error);
        return of(false);
      })
    );
  }

  /**
   * Refresh the current user's access token
   */
  refreshToken(): Observable<any> {
    const user = this.currentUserValue;
    if (!user?.refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }

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

  // ===============================
  // USER DATA METHODS
  // ===============================

  /**
   * Get current user object
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Update current user data
   */
  updateCurrentUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
    if (user.permissions) {
      this.permissionsSubject.next(user.permissions);
    }
  }

  /**
   * Get user permissions
   */
  getUserPermissions(): Permission[] {
    return this.permissionsSubject.value;
  }

  /**
   * Get employee data by employee ID
   */
  getEmployeeByEmpId(empId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/v1/employees/${empId}`).pipe(
      catchError(error => {
        console.error('Error fetching employee:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Retrieve the current user's access token
   */
  getToken(): string | null {
    return this.currentUserValue?.accessToken ?? null;
  }

  // ===============================
  // PERMISSION CHECKING METHODS
  // ===============================

  /**
   * Check if user has a specific permission
   */
  hasPermission(permissionCode: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return user.permissions.some(p => p.permissionCode === permissionCode);
  }

  /**
   * Check if user has any of the specified permissions
   */
  hasAnyPermission(permissionCodes: string[]): boolean {
    return user?.roleCode === 'CTO';
  }


  isEmployee(): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.some(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }

  /**
   * Check if user has all specified permissions
   */
  hasAllPermissions(permissionCodes: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.every(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }

  /**
   * Check permission for specific module and action
   */
  public hasPermissionForModule(moduleName: string, actionType: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    
    return user.permissions.some(p => 
      p.moduleName.toLowerCase() === moduleName.toLowerCase() && 
      p.actionType.toLowerCase() === actionType.toLowerCase()
    );
  }

  // ===============================
  // MODULE-SPECIFIC PERMISSION CHECKS
  // ===============================

  /**
   * Check if user can view a specific module
   */
  canViewModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'read');
  }

  /**
   * Check if user can edit a specific module
   */
  canEditModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'write');
  }

  /**
   * Check if user can delete from a specific module
   */
  canDeleteModule(moduleName: string): boolean {
    if (this.hasFullAccess()) return true;
    return this.hasPermissionForModule(moduleName, 'delete');
  }

  // ===============================
  // ATTENDANCE-SPECIFIC PERMISSIONS
  // ===============================

  /**
   * UPDATED: Check if user can view attendance data
   */
  canViewAttendance(): boolean {
    return this.canViewModule('attendance') || 
           this.hasFullAccess() || 
           this.isHR() || 
           this.isManagerWithDepartment();  // UPDATED: Use new method
  }

  /**
   * Check if user can export attendance data
   */
  canExportAttendance(): boolean {
    return this.canExportData() && (this.canViewAttendance() || this.hasFullAccess());
  }

  /**
   * Check if user can filter attendance by date
   */
  canFilterAttendanceByDate(): boolean {
    return this.canViewAttendance();
  }

  /**
   * Check if user can filter attendance by status
   */
  canFilterAttendanceByStatus(): boolean {
    // Employees typically can't filter by status in most systems
    return !this.isEmployee() && this.canViewAttendance();
  }

  /**
   * UPDATED: Check if user can search attendance records
   */
  canSearchAttendance(): boolean {
    return this.canSearchEmployees() && this.canViewAttendance();
  }

  // ===============================
  // DEBUG AND UTILITY METHODS
  // ===============================

  /**
   * UPDATED: Get comprehensive user info for debugging
   */
  getDebugUserInfo(): any {
    const user = this.currentUserValue;
    if (!user) return { error: 'No user logged in' };

    return {
      userId: user.userId,
      username: user.username,
      email: user.email,
      roleName: user.roleName,
      roleCode: user.roleCode,
      isDeptHead: user.isDeptHead,
      departmentId: user.getDepartmentId?.(),
      empId: user.empId,
      ctoId: user.ctoId,
      accessLevel: this.getUserAccessLevel(),
      permissions: user.permissions?.map(p => p.permissionCode) || [],
      roleChecks: {
        isAdmin: this.isAdmin(),
        isCTO: this.isCTO(),
        isHR: this.isHR(),
        isManager: this.isManager(),
        isManagerDeptHead: this.isManagerDeptHead(),
        isManagerWithDepartment: this.isManagerWithDepartment(),  // UPDATED: New method
        isEmployee: this.isEmployee(),
        hasFullAccess: this.hasFullAccess(),
        canViewAllEmployees: this.canViewAllEmployees(),
        canExportData: this.canExportData(),
        canSearchEmployees: this.canSearchEmployees(),
        canViewAllBranches: this.canViewAllBranches(),
        canViewAllDepartments: this.canViewAllDepartments(),
        canManagerAccessDepartment: this.canManagerAccessDepartment()
      }
    };
  }

  /**
   * Log comprehensive user debug info to console
   */
  debugUserInfo(): void {
    console.log('=== AUTH SERVICE DEBUG INFO ===');
    console.log(this.getDebugUserInfo());
  }
}