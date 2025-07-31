import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of, tap, catchError, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import jwt_decode, { jwtDecode } from 'jwt-decode';

export interface User {
  username: string;
  name: string;
  role: string;
  permissions: string[];
  accessToken: string;
  refreshToken: string;
  tokenExpiration?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser$: Observable<User | null>;
  private tokenRefreshTimeout: any;

  constructor(private router: Router, private http: HttpClient) {
    const storedUser = localStorage.getItem('currentUser');
    this.currentUserSubject = new BehaviorSubject<User | null>(
      storedUser ? JSON.parse(storedUser) : null
    );
    this.currentUser$ = this.currentUserSubject.asObservable();

    // Start token refresh timer if user exists
    if (storedUser) {
      const user = JSON.parse(storedUser);
      this.startTokenRefreshTimer(user);
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  public get isAuthenticated$(): Observable<boolean> {
    return this.currentUser$.pipe(map(user => !!user && !this.isTokenExpired(user)));
  }

  private isTokenExpired(user: User): boolean {
    if (!user.tokenExpiration) return true;
    return Date.now() > user.tokenExpiration * 1000;
  }

  private startTokenRefreshTimer(user: User): void {
    if (!user.tokenExpiration) return;

    // Set timeout to refresh token 1 minute before it expires
    const expiresIn = user.tokenExpiration * 1000 - Date.now() - 60000;
    
    this.tokenRefreshTimeout = setTimeout(() => {
      this.refreshToken().subscribe();
    }, expiresIn);
  }

  private stopTokenRefreshTimer(): void {
    clearTimeout(this.tokenRefreshTimeout);
  }

  login(username: string, password: string): Observable<boolean> {
    const url = `${environment.apiUrl}/api/auth/login`;
    return this.http.post<any>(url, { username, password }).pipe(
      tap(res => {
        // Decode token to get expiration
        const decodedToken: any = jwtDecode(res.accessToken);
        
        const user: User = {
          username: res.username || username,
          name: res.name,
          role: res.role,
          permissions: res.permissions || [],
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          tokenExpiration: decodedToken.exp
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        this.startTokenRefreshTimer(user);
      }),
      map(() => true),
      catchError((error: HttpErrorResponse) => {
        console.error('Login error', error);
        return throwError(() => error);
      })
    );
  }

  refreshToken(): Observable<User | null> {
    const currentUser = this.currentUserValue;
    if (!currentUser?.refreshToken) {
      return of(null);
    }

    const url = `${environment.apiUrl}/api/auth/refresh-token`;
    return this.http.post<any>(url, { refreshToken: currentUser.refreshToken }).pipe(
      tap(res => {
        const decodedToken: any = jwtDecode(res.accessToken);
        
        const user: User = {
          ...currentUser,
          accessToken: res.accessToken,
          refreshToken: res.refreshToken,
          tokenExpiration: decodedToken.exp
        };
        
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.currentUserSubject.next(user);
        this.startTokenRefreshTimer(user);
      }),
      catchError(error => {
        this.logout();
        return throwError(() => error);
      })
    );
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUserValue;
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === 'admin') return true;
    
    return user.permissions.includes(permission);
  }

  logout(): void {
    // Stop the refresh timer
    this.stopTokenRefreshTimer();
    
    // Clear user data
    localStorage.removeItem('currentUser');
    this.currentUserSubject.next(null);
    
    // Navigate to login
    this.router.navigate(['/auth/login']).then(() => {
      window.location.reload();
    });
  }
}