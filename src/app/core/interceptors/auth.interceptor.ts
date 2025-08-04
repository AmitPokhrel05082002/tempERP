  import { Injectable } from '@angular/core';
  import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse
  } from '@angular/common/http';
  import { Observable, throwError, from } from 'rxjs';
  import { catchError, switchMap } from 'rxjs/operators';
  import { Router } from '@angular/router';
  import { AuthService } from '../services/auth.service';

  @Injectable()
  export class AuthInterceptor implements HttpInterceptor {
    private isRefreshing = false;

    constructor(
      private authService: AuthService,
      private router: Router
    ) {}

    intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
      const authToken = this.authService.currentUserValue?.accessToken;

      if (authToken) {
        request = request.clone({
          setHeaders: {
            Authorization: `Bearer ${authToken}`
          }
        });
      }

      return next.handle(request).pipe(
        catchError((error: HttpErrorResponse) => {
          if (error.status === 401 && !request.url.includes('auth/refresh-token')) {
            return this.handle401Error(request, next);
          }
          
          console.error('HTTP Error:', error);
          return throwError(() => error);
        })
      );
    }

    private handle401Error(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
      if (!this.isRefreshing) {
        this.isRefreshing = true;

        return from(this.authService.refreshToken()).pipe(
          switchMap(() => {
            this.isRefreshing = false;
            const newToken = this.authService.currentUserValue?.accessToken;
            if (newToken) {
              request = request.clone({
                setHeaders: {
                  Authorization: `Bearer ${newToken}`
                }
              });
            }
            return next.handle(request);
          }),
          catchError((error) => {
            this.isRefreshing = false;
            this.authService.logout();
            this.router.navigate(['/auth/login']);
            return throwError(() => error);
          })
        );
      }

      return next.handle(request);
    }
  }