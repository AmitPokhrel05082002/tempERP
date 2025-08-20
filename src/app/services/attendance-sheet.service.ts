import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

interface AttendanceRecord {
  id: string;
  firstName: string;
  lastName: string;
  department: string;
  attendanceGroup: string;
  attendanceDate: string;
  dayOfWeek: string;
  timePeriod: string;
  requiredCheckInDate: string;
  requiredCheckInTime: string;
  requiredCheckOutDate: string;
  requiredCheckOutTime: string;
  actualCheckInTime: string;
  actualCheckOutTime: string;
  totalDuration: string;
  empCode: string;
  employeeId: string;
  graceCheckInTime: string;
  lateCheckInTime: string;
  earlyTime: string;
  overTime: string;
}

interface EmployeeAttendance {
  employeeId: string;
  attendanceList: AttendanceRecord[];
}

interface ApiResponse {
  content: EmployeeAttendance[];
  pageable: {
    pageNumber: number;
    pageSize: number;
    sort: { empty: boolean; sorted: boolean; unsorted: boolean; };
    offset: number;
    paged: boolean;
    unpaged: boolean;
  };
  last: boolean;
  totalPages: number;
  totalElements: number;
  size: number;
  number: number;
  sort: { empty: boolean; sorted: boolean; unsorted: boolean; };
  first: boolean;
  numberOfElements: number;
  empty: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceSheetService {
  apiUrl = `${environment.apiUrl}/api/v1/employee-attendance/monthly-grouped`;

  constructor(public http: HttpClient) { }

  /**
   * Get attendance data for a specific employee - for Employee role or specific employee view
   */
  getEmployeeAttendanceData(employeeId: string, year: number, month: number): Observable<EmployeeAttendance | null> {
    return this.getAllAttendanceData(year, month).pipe(
      map(allData => {
        // Find the specific employee's data
        const employeeData = allData.find(emp => emp.employeeId === employeeId);
        return employeeData || null;
      }),
      catchError(error => {
        console.error(`Error fetching attendance data for employee ${employeeId}:`, error);
        return of(null);
      })
    );
  }

  /**
   * Get attendance for a single employee by making direct API call
   */
  getEmployeeAttendance(employeeId: string, year?: number, month?: number): Observable<AttendanceRecord[]> {
    let url = `${environment.apiUrl}/api/v1/employee-attendance/employee/${employeeId}`;
    let params = new HttpParams();
    
    if (year) params = params.set('year', year.toString());
    if (month) params = params.set('month', month.toString());
    
    return this.http.get<AttendanceRecord[]>(url, { params }).pipe(
      catchError(error => {
        console.error('Error fetching employee attendance:', error);
        return of([]);
      })
    );
  }

  /**
   * Get all attendance data - for HR, Manager, Admin roles
   */
  getAllAttendanceData(year: number, month: number, attendanceGroup?: string): Observable<EmployeeAttendance[]> {
    return new Observable(subscriber => {
      let allData: EmployeeAttendance[] = [];
      let currentPage = 0;
      let hasMore = true;

      const fetchPage = (page: number) => {
        if (!hasMore) {
          subscriber.next(allData);
          subscriber.complete();
          return;
        }

        this.getAttendanceDataWithPagination(year, month, attendanceGroup, page)
          .subscribe({
            next: (response) => {
              if (response.content && response.content.length > 0) {
                allData = [...allData, ...response.content];
              }
              
              hasMore = !response.last && response.content && response.content.length > 0;
              
              if (hasMore) {
                fetchPage(page + 1);
              } else {
                subscriber.next(allData);
                subscriber.complete();
              }
            },
            error: (error) => {
              console.error(`Error fetching page ${page}:`, error);
              subscriber.next(allData);
              subscriber.complete();
            }
          });
      };

      fetchPage(currentPage);
    });
  }

  private getAttendanceDataWithPagination(year: number, month: number, attendanceGroup?: string, page: number = 0): Observable<ApiResponse> {
    let params = new HttpParams()
      .set('year', year.toString())
      .set('month', month.toString())
      .set('page', page.toString());

    if (attendanceGroup && attendanceGroup !== 'All') {
      params = params.set('attendanceGroup', attendanceGroup);
    }

    return this.http.get<ApiResponse>(this.apiUrl, { params }).pipe(
      catchError(error => {
        // Only log 404 errors once to avoid console spam
        if (error.status === 404) {
          // Silently handle 404 - no data available for this month
          const emptyResponse: ApiResponse = {
            content: [],
            pageable: { pageNumber: 0, pageSize: 0, sort: { empty: true, sorted: false, unsorted: true }, offset: 0, paged: true, unpaged: false },
            last: true, totalPages: 0, totalElements: 0, size: 0, number: 0,
            sort: { empty: true, sorted: false, unsorted: true }, first: true, numberOfElements: 0, empty: true
          };
          return of(emptyResponse);
        }
        
        // For other errors, log once and return empty response
        if (!environment.production && error.status !== 404) {
          console.warn(`API Error (${error.status}):`, error.message);
        }
        
        const errorResponse: ApiResponse = {
          content: [],
          pageable: { pageNumber: 0, pageSize: 0, sort: { empty: true, sorted: false, unsorted: true }, offset: 0, paged: true, unpaged: false },
          last: true, totalPages: 0, totalElements: 0, size: 0, number: 0,
          sort: { empty: true, sorted: false, unsorted: true }, first: true, numberOfElements: 0, empty: true
        };
        return of(errorResponse);
      })
    );
  }

  /**
   * Get available dates (years and months) for filters
   */
  getAvailableDates(): Observable<{ years: number[], months: { value: number, name: string }[] }> {
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    const months = [
      { value: 1, name: 'January' }, { value: 2, name: 'February' }, { value: 3, name: 'March' },
      { value: 4, name: 'April' }, { value: 5, name: 'May' }, { value: 6, name: 'June' },
      { value: 7, name: 'July' }, { value: 8, name: 'August' }, { value: 9, name: 'September' },
      { value: 10, name: 'October' }, { value: 11, name: 'November' }, { value: 12, name: 'December' }
    ];
    return of({ years, months });
  }

  /**
   * Get attendance groups/departments for filter dropdown
   */
  getAttendanceGroups(year: number, month: number): Observable<string[]> {
    return this.getAllAttendanceData(year, month).pipe(
      map(data => {
        const groups = new Set<string>();
        data.forEach(employee => {
          if (employee.attendanceList && employee.attendanceList.length > 0) {
            const group = employee.attendanceList[0]?.attendanceGroup;
            if (group && group.trim() !== '') {
              groups.add(group.trim());
            }
          }
        });
        return ['All', ...Array.from(groups).sort()];
      }),
      catchError(() => of(['All']))
    );
  }

  /**
   * Get department details by ID - for manager department loading
   */
  getDepartmentById(departmentId: string): Observable<any> {
    const url = `${environment.apiUrl}/api/v1/departments/${departmentId}`;
    return this.http.get<any>(url).pipe(
      catchError(error => {
        console.error('Error fetching department details:', error);
        return of(null);
      })
    );
  }
}