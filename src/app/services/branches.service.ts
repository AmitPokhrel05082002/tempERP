// branches.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Branch {
    branchId: string;
    orgId: string;
    branchName: string;
    branchCode: string;
    dzongkhag: string;
    thromde: string;
    organizationName?: string;
    operationalStatus: boolean;
    // Add other fields if needed
  }

@Injectable({
  providedIn: 'root'
})
export class BranchesService {
  private apiUrl = `${environment.apiUrl}/api/v1/branches`;

  constructor(private http: HttpClient) { }

  getBranches(): Observable<Branch[]> {
    return this.http.get<Branch[]>(this.apiUrl);
  }

  getBranch(id: string): Observable<Branch> {
    return this.http.get<Branch>(`${this.apiUrl}/${id}`);
  }

  createBranch(branch: Omit<Branch, 'branchId'>): Observable<Branch> {
    return this.http.post<Branch>(this.apiUrl, branch);
  }

  updateBranch(id: string, branch: Partial<Branch>): Observable<Branch> {
    return this.http.put<Branch>(`${this.apiUrl}/${id}`, branch);
  }

  deleteBranch(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}