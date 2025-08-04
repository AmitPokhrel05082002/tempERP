import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthService } from '../services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class PermissionGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    const requiredPermissions = route.data['permissions'] as string[];
    
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const checkAll = route.data['checkAll'] as boolean || false;
    const hasPermission = checkAll 
      ? this.authService.hasAllPermissions(requiredPermissions)
      : this.authService.hasAnyPermission(requiredPermissions);
    
    if (!hasPermission) {
      return this.router.createUrlTree(['/unauthorized']);
    }
    
    return true;
  }
}