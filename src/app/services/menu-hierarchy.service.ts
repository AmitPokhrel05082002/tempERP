import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable, map } from 'rxjs';

export interface MenuItem {
  menuId: string;
  menuName: string;
  menuUrl: string;
  parentId: string | null;
  displayOrder: number;
  menuIndication: string;
  menuDesc: string;
  moduleType: string;
  isActive: boolean;
  requiresPermission: boolean;
  children: MenuItem[] | null;
}

@Injectable({
  providedIn: 'root'
})
export class MenuHierarchyService {
  private apiUrl = `${environment.apiUrl}/api/v1/menu-items/hierarchy`;

  constructor(private http: HttpClient) {}

  getMenuHierarchy(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(this.apiUrl);
  }
}
