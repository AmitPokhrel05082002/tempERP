import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, tap, throwError, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface LeaveRequestPayload {
  cid: string;
  leaveName: string;
  fromDate: string;
  toDate: string;
  reason: string;
  medicalCertificateAttached: boolean;
  handoverDetails: string;
}

export interface LeaveAllocation {
  allocationId: string;
  allocationYear: number;
  allocationMonth: number;
  allocationMonthName: string;
  openingBalance: number;
  annualAccrual: number;
  adjustments: number;
  utilizedBalance: number;
  lateAttendence: number;
  closingBalance: number;
  noOfWorkingDays: number;
  excludedDays: number;
  leaveTypeName: string | null;
  employeeName?: string;
}

export interface Employee {
  empId: string;
  empCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  dateOfBirth: string | null;
  gender: string;
  maritalStatus: string | null;
  bloodGroup: string | null;
  nationality: string;
  socialSecurityNumber: string | null;
  cidNumber: string | null;
  hireDate: string | null;
  employmentStatus: string;
  organizationName: string;
  branchName: string;
  departmentName: string;
}

export interface LeaveRequest extends LeaveRequestPayload {
  id: string;
  empId: string;
  empCode: string;
  name: string;
  division: string;
  totalDays: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'Approved' | string;
  leaveType?: string;
}

export type LeaveType = 'current' | 'all';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
    private apiUrl = `${environment.apiUrl}/leave`;

  constructor(private http: HttpClient) { }

  getLeaveAllocations(empId: string): Observable<LeaveAllocation[]> {
    if (!empId) {
      return of([]);
    }
    
    return this.http.get<LeaveAllocation[]>(`${this.apiUrl}/getAllocationByEmpId/${empId}`).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching leave allocations:', error);
        return throwError(() => new Error('Failed to fetch leave allocations'));
      })
    );
  }

  // Get leave requests
  getLeaveRequests(type: LeaveType = 'current'): Observable<LeaveRequest[]> {
    const endpoint = `${this.apiUrl}/applications/recent/${type}`;
    console.log(`Fetching ${type} leave requests from:`, endpoint);
    
    return this.http.get<LeaveRequest[]>(endpoint).pipe(
      tap(data => console.log(`Received ${data.length} ${type} leave requests`)),
      catchError(this.handleError)
    );
  }
  
  // Get all leave requests (convenience method)
  getAllLeaveRequests(type: LeaveType = 'all'): Observable<LeaveRequest[]> {
    const endpoint = `${this.apiUrl}/applications/recent/${type}`;
    console.log(`Fetching ${type} leave requests from:`, endpoint);
    
    return this.http.get<LeaveRequest[]>(endpoint).pipe(
      map((response: any) => {
        // Ensure we have a valid response
        if (!Array.isArray(response)) {
          console.warn('Unexpected response format, expected an array:', response);
          return [];
        }
        return response.map((item: any): LeaveRequest => ({
          id: item.id,
          empId: item.empId,
          empCode: item.empCode,
          name: item.name,
          division: item.division,
          fromDate: item.fromDate,
          toDate: item.toDate,
          status: item.status,
          totalDays: item.totalDays,
          reason: item.reason,
          cid: item.cid || '',
          leaveName: item.leaveName || '',
          medicalCertificateAttached: item.medicalCertificateAttached || false,
          handoverDetails: item.handoverDetails || '',
          ...(item.leaveType && { leaveType: item.leaveType })
        }));
      }),
      tap(data => console.log(`Received ${data.length} ${type} leave requests`)),
      catchError(this.handleError)
    );
  }

  // Get all employees
  getAllEmployees(): Observable<Employee[]> {
    const endpoint = `${this.apiUrl}/getAllEmployee`;
    console.log('Fetching all employees from:', endpoint);
    
    return this.http.get<Employee[]>(endpoint).pipe(
      tap(data => console.log(`Received ${data.length} employees`)),
      catchError(this.handleError)
    );
  }

  // Get all leave types
  getAllLeaveTypes(): Observable<{id: string, name: string}[]> {
    const endpoint = `${this.apiUrl}/getAllLeaveType`;
    console.log('Fetching all leave types from:', endpoint);
    
    return this.http.get<{id: string, name: string}[]>(endpoint).pipe(
      tap(data => console.log(`Received ${data.length} leave types`)),
      catchError(this.handleError)
    );
  }

  // Submit a new leave request
  requestLeave(leaveData: LeaveRequestPayload): Observable<LeaveRequest> {
    const endpoint = `${this.apiUrl}/requestLeave`;
    console.log('Submitting leave request to:', endpoint, 'with data:', leaveData);
    
    return this.http.post<LeaveRequest>(endpoint, leaveData).pipe(
      tap(response => console.log('Leave request submitted successfully:', response)),
      catchError(this.handleError)
    );
  }

  // Get employee leave details
  getEmployeeLeaveDetails(empid: string): Observable<any> {
    const endpoint = `${this.apiUrl}/employee/${empid}`;
    console.log(`Fetching leave details for employee ID: ${empid}`);
    
    return this.http.get<any>(endpoint).pipe(
      tap(data => console.log('Received employee leave details:', data)),
      catchError(this.handleError)
    );
  }

  /**
   * Updates the status of a leave request
   * @param updateData Either a string (legacy ID) or an object containing leave update details
   * @param approved Optional boolean for legacy parameter style
   * @param reason Optional reason for the status update
   * @returns Observable with the update result
   */
  updateLeaveStatus(updateData: { 
    empCode: string; 
    id: string; 
    approved: boolean;
    reason?: string;
  } | string, approved?: boolean, reason?: string): Observable<any> {

    console.log('Updating leave status with data:', updateData);
    let id: string;
    let isApproved: boolean; 
    
    try {
      // Handle both parameter styles for backward compatibility
      if (typeof updateData === 'string') {
        // Old style: updateLeaveStatus(id, approved, reason?)
        id = updateData;
        isApproved = approved as boolean;
      } else {
        // New style: updateLeaveStatus({ empCode, id, approved, reason? })
        id = updateData.id;
        isApproved = updateData.approved;
        reason = updateData.reason || reason;
      }
      
      if (!id) {
        throw new Error('Leave ID is required');
      }
      
      // Endpoint for approving/rejecting leave requests - using the leave ID in the URL
      const endpoint = `${this.apiUrl}/leave/${id}/approve`;
      
      // Prepare the request body with approval status and reason
      const body = {
        approved: isApproved,
        reason: reason || (isApproved ? 'Approved by manager' : 'Rejected by manager')
      };
      
      // Log the request details for debugging
      console.log('Preparing request to update leave status:', {
        endpoint,
        leaveId: id,
        isApproved,
        reason: body.reason,
        requestBody: JSON.stringify(body, null, 2)
      });
      
      // Make the API call
      return this.http.post<any>(endpoint, body, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }).pipe(
        tap((response) => {
          console.log('Leave status updated successfully:', response);
          return response;
        }),
        catchError(error => {
          console.error('Error updating leave status:', {
            error,
            status: error.status,
            statusText: error.statusText,
            message: error.message,
            url: error.url,
            errorDetails: error.error,
            headers: error.headers
          });
          return throwError(() => new Error('Failed to update leave status. Please try again.'));
        })
      );
    } catch (error) {
      console.error('Error in updateLeaveStatus:', error);
      return throwError(() => new Error('An unexpected error occurred while processing your request.'));
    }
  }

  // Submit a new leave request
  submitLeaveRequest(leaveData: any): Observable<any> {
    const endpoint = `${this.apiUrl}/requestLeave`;
    console.log('Submitting leave request:', leaveData);
    
    return this.http.post(endpoint, leaveData).pipe(
      tap(() => console.log('Leave request submitted successfully')),
      catchError(this.handleError)
    );
  }

  // Get leave balance for an employee
  getLeaveBalance(empCode: string): Observable<any> {
    const endpoint = `${this.apiUrl}/employee/${empCode}`;
    console.log('Fetching leave balance for employee:', empCode);
    
    return this.http.get<any>(endpoint).pipe(
      tap(data => console.log('Received employee data:', data)),
      map((response: any) => {
        // If the response has a leaveBalances array, return it
        if (response && Array.isArray(response.leaveBalances)) {
          return response.leaveBalances;
        }
        // If the response is the balance data directly, return it
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          return [{
            type: 'Annual Leave',
            used: response.usedDays || 0,
            total: response.totalDays || 0,
            remaining: (response.totalDays || 0) - (response.usedDays || 0)
          }];
        }
        // If no valid data found, return default values
        console.warn('No valid leave balance data found in response');
        return [];
      }),
      catchError(error => {
        console.error('Error in getLeaveBalance:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  // Get leave history for an employee
  getLeaveHistory(empCode: string): Observable<any[]> {
    console.log('Fetching leave history for employee:', empCode);
    const endpoint = `${this.apiUrl}/employee/${empCode}`;
    
    return this.http.get<any>(endpoint).pipe(
      tap(data => console.log('Received employee leave data:', data)),
      map((response: any) => {
        // If the response is an array, return it directly
        if (Array.isArray(response)) {
          return response;
        }
        // If response is an object with data array, return that
        if (response && Array.isArray(response.data)) {
          return response.data;
        }
        // If no valid data found, return empty array
        console.warn('No valid leave history data found in response');
        return [];
      }),
      catchError(error => {
        console.error('Error in getLeaveHistory:', error);
        return of([]); // Return empty array on error
      })
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.status === 0) {
        errorMessage = 'Unable to connect to the server. Please check your connection.';
      }
    }
    console.error('API Error:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }
}
