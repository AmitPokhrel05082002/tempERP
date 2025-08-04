import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, throwError } from 'rxjs';
import { tap, catchError, map, switchMap } from 'rxjs/operators';
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
    const currentUser = this.currentUserValue;
    if (!currentUser?.refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<any>(`${environment.apiUrl}/api/auth/refresh-token`, {
      refreshToken: currentUser.refreshToken
    }).pipe(
      tap(response => {
        if (response.success) {
          const updatedUser = {
            ...currentUser,
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken
          };
          localStorage.setItem('currentUser', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    this.permissionsSubject.next([]);
    this.router.navigate(['/guest/login']).then(() => {
      window.location.reload();
    });
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

  hasAllPermissions(permissionCodes: string[]): boolean {
    const user = this.currentUserValue;
    if (!user || !user.permissions) return false;
    return permissionCodes.every(code => 
      user.permissions?.some(p => p.permissionCode === code)
    );
  }
}