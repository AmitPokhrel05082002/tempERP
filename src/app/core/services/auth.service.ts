// auth.service.ts - Complete Corrected Version
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

  // Role constants
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

  // Observable streams
  get user$(): Observable<User | null> {
    return this.currentUser$;
  }

  get userId$(): Observable<string> {
    return this.user$.pipe(
      filter((u): u is User => !!u),
      map(u => u.userId)
    );
  }

  // Synchronous accessors
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
  }

  public get roleBasedId(): string | null {
    const user = this.currentUserValue;
    if (!user) return null;
    
    if (typeof user.getRoleBasedId === 'function') {
      return user.getRoleBasedId();
    }
    
    return user.roleName === this.CTO_ROLE
      ? (user.ctoId || user.userId)
      : (user.empId || user.userId);
  }

  // Role checking methods
  isAdmin(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.ADMIN_ROLE;
  }

  isCTO(): boolean {
    const user = this.currentUserValue;
    return user?.roleCode === 'CTO' || user?.roleName === this.CTO_ROLE;
  }

  isEmployee(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.EMPLOYEE_ROLE;
  }

  isHR(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.HR_ROLE;
  }

  isManager(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE;
  }

  isManagerDeptHead(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE && user?.isDeptHead === true;
  }

  isManagerWithDepartment(): boolean {
    const user = this.currentUserValue;
    return user?.roleName === this.MANAGER_ROLE && !!this.getManagerDepartmentId();
  }

  // Access control methods
  hasFullAccess(): boolean {
    return this.isAdmin() || this.isCTO();
  }

  hasAdminAccess(): boolean {
    return this.hasFullAccess();
  }

  hasReadOnlyAccess(): boolean {
    return this.isEmployee() && !this.hasAnyPermission(['write_access', 'admin_access']);
  }

  canViewAllEmployees(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    if (this.hasAdminAccess()) return true;
    if (this.isHR()) return true;
    if (this.isManagerWithDepartment()) return true;
    
    return false;
  }

  canExportData(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    return !this.isEmployee() || this.hasAdminAccess();
  }

  canSearchEmployees(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    return this.hasAdminAccess() || this.isHR() || this.isManagerWithDepartment();
  }

  canViewAllBranches(): boolean {
    const user = this.currentUserValue;
    return user ? ['Admin', 'Manager'].includes(user.roleName) : false;
  }

  canViewAllDepartments(): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    return this.hasAdminAccess() || this.isHR();
  }

  // Manager-specific methods
  getManagerDepartmentId(): string | null {
    const user = this.currentUserValue;
    if (user?.roleName === this.MANAGER_ROLE) {
      return user.getDepartmentId?.() || user.deptID || user.deptId || null;
    }
    return null;
  }

  canManagerAccessDepartment(departmentId?: string): boolean {
    const user = this.currentUserValue;
    if (user?.roleName !== this.MANAGER_ROLE) {
      return false;
    }
    
    const managerDeptId = this.getManagerDepartmentId();
    if (!managerDeptId) {
      return false;
    }
    
    if (!departmentId) {
      return true;
    }
    
    return managerDeptId === departmentId;
  }

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

  // Authentication methods
  login(username: string, password: string): Observable<boolean> {
    const url = `${environment.apiUrl}/api/auth/login`;

    return this.http.post<any>(url, { username, password }).pipe(
      switchMap(loginResponse => {
        if (!loginResponse.success) {
          throw new Error('Login failed');
        }
        const userData = loginResponse.data.user;
        const isDeptHead = !!userData.deptID;

        const roleId = userData.role.roleId;
        const roleName = userData.role.roleName;
        const roleCode = userData.role.roleCode;

        const baseUser: User = {
          userId: userData.userId,
          empId: roleName === 'Employee' ? userData.empId : undefined,
          ctoId: roleName === 'Manager' ? (userData.ctoId || userData.userId) : undefined,
          username: userData.username,
          email: userData.email,
          accountStatus: userData.accountStatus,
          roleId: roleId,
          roleName: roleName,
          roleCode: roleCode,
          mustChangePassword: userData.mustChangePassword,
          accessToken: loginResponse.data.accessToken,
          refreshToken: loginResponse.data.refreshToken,
          isDeptHead: isDeptHead,
          deptID: userData.deptID || null,
          getRoleBasedId: function() {
            return this.roleName === 'Manager' 
              ? (this.ctoId || this.userId) 
              : (this.empId || this.userId);
          }
        };

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

  refreshUserData(): Observable<User> {
    return this.http.get<any>(`${environment.apiUrl}/api/auth/current-user`).pipe(
      map(response => {
        const userData = response.data;
        const isDeptHead = !!userData.deptID;
        
        const updatedUser = {
          ...this.currentUserValue,
          isDeptHead: isDeptHead,
          deptID: userData.deptID || null
        };
        
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
        return updatedUser;
      }),
      catchError(error => {
        console.error('Error refreshing user data:', error);
        return throwError(() => error);
      })
    );
  }

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
        return of(true);
      })
    );
  }

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

  forceLogoutUser(userId: string): Observable<boolean> {
    return this.http.post<any>(`${environment.apiUrl}/api/auth/admin/force-logout/${userId}`, {}).pipe(
      map(() => true),
      catchError(error => {
        console.error('Force logout error:', error);
        return of(false);
      })
    );
  }

  private clearLocalAuthData(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.permissionsSubject.next([]);
    this.router.navigate(['/guest/login']).then(() => window.location.reload());
  }

  // User data methods
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  updateCurrentUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUserSubject.next(user);
    if (user.permissions) {
      this.permissionsSubject.next(user.permissions);
    }
  }

  getUserPermissions(): Permission[] {
    return this.permissionsSubject.value;
  }

  getEmployeeByEmpId(empId: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}/api/v1/employees/${empId}`).pipe(
      catchError(error => {
        console.error('Error fetching employee:', error);
        return throwError(() => error);
      })
    );
  }

  getToken(): string | null {
    return this.currentUserValue?.accessToken ?? null;
  }

  // Permission checking methods
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

  hasAllPermissions(permissionCodes: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.every(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }

  // Module-specific permission checks
  public hasPermissionForModule(moduleName: string, actionType: string): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    
    return user.permissions.some(p => 
      p.moduleName.toLowerCase() === moduleName.toLowerCase() && 
      p.actionType.toLowerCase() === actionType.toLowerCase()
    );
  }

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

  // Attendance-specific permissions
  canViewAttendance(): boolean {
    return this.canViewModule('attendance') || 
           this.hasFullAccess() || 
           this.isHR() || 
           this.isManagerWithDepartment();
  }

  canExportAttendance(): boolean {
    return this.canExportData() && (this.canViewAttendance() || this.hasFullAccess());
  }

  canFilterAttendanceByDate(): boolean {
    return this.canViewAttendance();
  }

  canFilterAttendanceByStatus(): boolean {
    return !this.isEmployee() && this.canViewAttendance();
  }

  canSearchAttendance(): boolean {
    return this.canSearchEmployees() && this.canViewAttendance();
  }

  // Debug methods
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
        isManagerWithDepartment: this.isManagerWithDepartment(),
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

  debugUserInfo(): void {
    console.log('=== AUTH SERVICE DEBUG INFO ===');
    console.log(this.getDebugUserInfo());
  }
}