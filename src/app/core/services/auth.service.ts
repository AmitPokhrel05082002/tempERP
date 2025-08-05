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
  empId: string;
  username: string;
  email: string;
  accountStatus: string;
  roleId: string;
  roleName: string; // Added roleName
  mustChangePassword: boolean;
  accessToken: string;
  refreshToken: string;
  permissions?: Permission[];
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
  get userId(): string | null {
    return this.currentUserValue?.userId ?? null;
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

   login(username: string, password: string): Observable<boolean> {
    const url = `${environment.apiUrl}/api/auth/login`;
    return this.http.post<any>(url, { username, password }).pipe(
      switchMap(loginResponse => {
        if (!loginResponse.success) {
          throw new Error('Login failed');
        }

        const userData = loginResponse.data.user;
        const baseUser: User = {
          userId: userData.userId,
          empId: userData.empId,
          username: userData.username,
          email: userData.email,
          accountStatus: userData.accountStatus,
          roleId: userData.roleId,
          roleName: userData.roleName, // Added roleName
          mustChangePassword: userData.mustChangePassword,
          accessToken: loginResponse.data.accessToken,
          refreshToken: loginResponse.data.refreshToken
        };

        return this.http.get<Permission[]>(
          `${environment.apiUrl}/api/v1/role-permissions/role/${userData.roleId}/permissions`
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

    return this.http.post<any>(`${environment.apiUrl}/api/auth/refresh-token`, {
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

  logout(): void {
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
    return user?.roleName === this.CTO_ROLE;
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
