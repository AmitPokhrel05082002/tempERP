import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

interface EmployeeAttendance {
  employeeId: string;
  attendanceList: Array<{
    id: string;
    firstName: string;
    lastName: string;
    department: string;
    attendanceGroup: string;
    attendanceDate: string;
    dayOfWeek: string;
    timePeriod: string;
    requiredCheckInTime: string;
    requiredCheckOutTime: string;
    actualCheckInTime: string;
    actualCheckOutTime: string;
    totalDuration: string;
    lateCheckInTime: string;
    empCode: string;
    earlyTime: string;
    overTime: string;

  }>;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceSheetService {
  private apiUrl = 'http://192.168.123.223:8080/api/v1/employee-attendance/monthly-grouped';

  constructor(private http: HttpClient) { }

  getAttendanceData(year: number, month: number, group?: string): Observable<EmployeeAttendance[]> {
    // Build query parameters object
    const params: any = {
      year: year.toString(),
      month: month.toString(),
      page: '0',
      size: '100'
    };

    // Only add attendanceGroup to params if it has a value
    if (group && group !== 'All') {
      params.attendanceGroup = group;
    }

    return this.http.get<{ content: EmployeeAttendance[] }>(this.apiUrl, { params })
      .pipe(
        map(response => response.content)
      );
  }

  // Get available years and months from the API
  getAvailableDates(): Observable<{ years: number[], months: { value: number, name: string }[] }> {
    // In a real app, this would be an API call like:
    // return this.http.get<{years: number[], months: {value: number, name: string}[]}>(`${this.apiUrl}/available-dates`);

    // For now, we'll return the current year and all months
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 1, currentYear, currentYear + 1];

    const months = [
      { value: 1, name: 'January' },
      { value: 2, name: 'February' },
      { value: 3, name: 'March' },
      { value: 4, name: 'April' },
      { value: 5, name: 'May' },
      { value: 6, name: 'June' },
      { value: 7, name: 'July' },
      { value: 8, name: 'August' },
      { value: 9, name: 'September' },
      { value: 10, name: 'October' },
      { value: 11, name: 'November' },
      { value: 12, name: 'December' }
    ];

    return new Observable(subscriber => {
      subscriber.next({ years, months });
      subscriber.complete();
    });
  }
}
