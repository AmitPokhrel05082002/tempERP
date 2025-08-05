// role.guard.ts
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    
    const requiredRoles = next.data['roles'] as Array<string>;
    const user = this.authService.currentUserValue;
    
    if (!user) {
      // Not logged in - redirect to login
      return this.router.createUrlTree(['/auth/login']);
    }

    if (!requiredRoles || requiredRoles.length === 0) {
      // No roles required - allow access
      return true;
    }

    if (requiredRoles.includes(user.roleName)) {
      // User has required role - allow access
      return true;
    }

    // User doesn't have required role - redirect to unauthorized or home
    return this.router.createUrlTree(['/unauthorized']);
  }
}