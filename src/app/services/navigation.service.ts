import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, catchError, of, tap, switchMap } from 'rxjs';
import { NavigationItem } from '../theme/layout/admin/navigation/navigation';
import { environment } from 'src/environments/environment';
import { AuthService } from '../core/services/auth.service';

@Injectable({
  providedIn: 'root'
})
export class NavigationService {
  private apiUrl = environment.apiUrl;
  private allMenuItems: any[] = [];

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  // Load all menu items from backend
  private loadAllMenuItems(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/api/v1/menu-items/hierarchy`).pipe(
      tap(items => this.allMenuItems = items)
    );
  }

  // Get only allowed menu IDs for current user
  private getUserPermissions(): Observable<Set<string>> {
    const user = this.authService.getCurrentUser();
    if (!user?.userId) return of(new Set<string>());

    return this.http.get<{ menuId: string }[]>(`${this.apiUrl}/api/v1/user-menu-permissions/user/${user.userId}`).pipe(
      map(perms => new Set(perms.map(p => p.menuId))),
      catchError(err => {
        console.error('Error fetching permissions:', err);
        return of(new Set<string>());
      })
    );
  }

  // Public method to get navigation items for current user
  getNavigationItems(): Observable<NavigationItem[]> {
    return this.loadAllMenuItems().pipe(
      switchMap(menuItems =>
        this.getUserPermissions().pipe(
          map(allowedIds => this.filterMenus(menuItems, allowedIds))
        )
      ),
      tap(finalItems => console.log('Final navigation items:', finalItems))
    );
  }

  // Recursive filtering of menus based on allowed IDs
  private filterMenus(menuItems: any[], allowedIds: Set<string>): NavigationItem[] {
    return menuItems
      .map(menu => {
        let filteredChildren: NavigationItem[] = [];

        if (menu.children) {
          filteredChildren = this.filterMenus(menu.children, allowedIds);
        }

        // Include menu if:
        // 1. Explicitly allowed OR
        // 2. Has allowed children
        if (allowedIds.has(menu.menuId) || filteredChildren.length > 0) {
          const navItem: NavigationItem = {
            id: menu.menuId,
            title: menu.menuName,
            type: filteredChildren.length ? 'collapse' : 'item',
            icon: this.getIconClass(menu.menuIndication),
            url: allowedIds.has(menu.menuId) ? menu.menuUrl : '', // Non-clickable if not allowed
            breadcrumbs: false,
            classes: 'nav-item',
            displayOrder: menu.displayOrder,
            children: filteredChildren.length ? filteredChildren : undefined
          };
          return navItem;
        }

        return null; // menu not allowed
      })
      .filter(item => item !== null)
      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0)) as NavigationItem[];
  }

  // Map raw menu indication to icon class
  private getIconClass(menuIndication: string): string {
    if (menuIndication?.startsWith('ti ti-')) return menuIndication;
    if (menuIndication?.startsWith('icon-')) return `ti ti-${menuIndication.substring(5)}`;
    return menuIndication || '';
  }
}
