import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const accessToken = this.authService.currentUserValue?.accessToken;

    if (accessToken) {
      request = this.addTokenHeader(request, accessToken);
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401 && !request.url.includes('auth/refresh-token')) {
          return this.handle401Error(request, next);
        }

        return throwError(() => error);
      })
    );
  }

  private addTokenHeader(request: HttpRequest<any>, token: string): HttpRequest<any> {
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshToken().pipe(
        switchMap(() => {
          this.isRefreshing = false;
          const newToken = this.authService.currentUserValue?.accessToken;
          this.refreshTokenSubject.next(newToken);

          if (newToken) {
            return next.handle(this.addTokenHeader(request, newToken));
          }

          this.authService.logout();
          this.router.navigate(['/auth/login']);
          return throwError(() => new Error('No new token received'));
        }),
        catchError(error => {
          this.isRefreshing = false;
          this.authService.logout();
          this.router.navigate(['/auth/login']);
          return throwError(() => error);
        })
      );
    } else {
      // Queue other requests while refreshing
      return this.refreshTokenSubject.pipe(
        filter(token => token != null),
        take(1),
        switchMap(token => {
          return next.handle(this.addTokenHeader(request, token!));
        })
      );
    }
  }
}
