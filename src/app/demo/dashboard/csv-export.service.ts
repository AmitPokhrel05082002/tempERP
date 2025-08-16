// csv-export.service.ts
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CsvExportService {

  constructor() { }

  /**
   * Export attendance data to CSV format with combined headers
   * @param employees - Array of employee attendance data
   * @param dynamicDateHeaders - Array of date headers (1, 2, 3, ...)
   * @param dynamicWeekHeaders - Array of week headers (Mon, Tue, Wed, ...)
   * @param selectedMonth - Selected month name
   * @param selectedYear - Selected year
   * @param selectedDepartment - Selected department
   */
  exportAttendanceToCSV(
    employees: any[], 
    dynamicDateHeaders: number[], 
    dynamicWeekHeaders: string[],
    selectedMonth: string,
    selectedYear: number,
    selectedDepartment: string = 'All'
  ): void {
    if (!employees || employees.length === 0) {
      alert('No data available to export');
      return;
    }

    // Create CSV header with combined day/date format
    const csvHeaders = this.createCombinedCSVHeaders(dynamicDateHeaders, dynamicWeekHeaders);
    
    // Create CSV rows for each employee
    const csvRows: string[] = [];
    
    employees.forEach((employee, employeeIndex) => {
      // Add employee info header
      csvRows.push(`"${employee.name || 'Unknown Employee'}","Department: ${employee.designation || 'Not specified'}"`);
      csvRows.push(''); // Empty row for spacing
      
      // Add data rows for this employee
      const employeeRows = this.createEmployeeRows(employee, dynamicDateHeaders);
      csvRows.push(...employeeRows);
      
      // Add spacing between employees (if not last employee)
      if (employeeIndex < employees.length - 1) {
        csvRows.push(''); // Empty row
        csvRows.push(''); // Another empty row for better spacing
      }
    });

    // Combine headers and rows
    const csvContent = [
      `"Attendance Report - ${selectedMonth} ${selectedYear}"`,
      `"Department: ${selectedDepartment}"`,
      `"Generated on: ${new Date().toLocaleDateString()}"`,
      '', // Empty row
      csvHeaders,
      ...csvRows
    ].join('\n');

    // Download the CSV file
    this.downloadCSV(csvContent, `Attendance_${selectedMonth}_${selectedYear}_${selectedDepartment.replace(/\s+/g, '_')}.csv`);
  }

  /**
   * Create CSV headers with combined dates and week days (Day/Date format)
   */
  private createCombinedCSVHeaders(dateHeaders: number[], weekHeaders: string[]): string {
    const headers = ['Row Type'];
    
    // Add combined date and day headers
    dateHeaders.forEach((date, index) => {
      const weekDay = weekHeaders[index] || '';
      headers.push(`"${weekDay}/${date}"`);
    });
    
    return headers.join(',');
  }

  /**
   * Create employee data rows
   */
  private createEmployeeRows(employee: any, dateHeaders: number[]): string[] {
    const rows: string[] = [];
    
    // Shift row
    const shiftRow = ['Shift'];
    dateHeaders.forEach((_, index) => {
      shiftRow.push(`"${employee.records[index]?.shift || '--'}"`);
    });
    rows.push(shiftRow.join(','));

    // Day Status row
    const statusRow = ['Day Status'];
    dateHeaders.forEach((_, index) => {
      statusRow.push(`"${employee.records[index]?.dayStatus || '--'}"`);
    });
    rows.push(statusRow.join(','));

    // Check In row
    const checkInRow = ['Check In'];
    dateHeaders.forEach((_, index) => {
      checkInRow.push(`"${employee.records[index]?.checkIn || '--'}"`);
    });
    rows.push(checkInRow.join(','));

    // Check Out row
    const checkOutRow = ['Check Out'];
    dateHeaders.forEach((_, index) => {
      checkOutRow.push(`"${employee.records[index]?.checkOut || '--'}"`);
    });
    rows.push(checkOutRow.join(','));

    // Break Time row
    const breakTimeRow = ['Break Time'];
    dateHeaders.forEach((_, index) => {
      breakTimeRow.push(`"${employee.records[index]?.breakTime || '--'}"`);
    });
    rows.push(breakTimeRow.join(','));

    // Working Hours row
    const workingHoursRow = ['Working Hours'];
    dateHeaders.forEach((_, index) => {
      workingHoursRow.push(`"${employee.records[index]?.workingHours || '--'}"`);
    });
    rows.push(workingHoursRow.join(','));

    // Extra Hours row
    const extraHoursRow = ['Extra Hours'];
    dateHeaders.forEach((_, index) => {
      extraHoursRow.push(`"${employee.records[index]?.extraHours || '--'}"`);
    });
    rows.push(extraHoursRow.join(','));

    // Late Time row
    const lateTimeRow = ['Late Time'];
    dateHeaders.forEach((_, index) => {
      lateTimeRow.push(`"${employee.records[index]?.lateTime || '--'}"`);
    });
    rows.push(lateTimeRow.join(','));

    // Early Time row
    const earlyTimeRow = ['Early Time'];
    dateHeaders.forEach((_, index) => {
      earlyTimeRow.push(`"${employee.records[index]?.earlyTime || '--'}"`);
    });
    rows.push(earlyTimeRow.join(','));

    return rows;
  }

  /**
   * Download CSV file
   */
  private downloadCSV(csvContent: string, fileName: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', fileName);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      // Fallback for older browsers
      const csvData = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvContent);
      window.open(csvData);
    }
  }

  /**
   * Export summary data to CSV (for attendance sheet summary)
   */
  exportSummaryToCSV(
    employees: any[],
    selectedMonth: string,
    selectedYear: number,
    selectedDepartment: string = 'All'
  ): void {
    if (!employees || employees.length === 0) {
      alert('No data available to export');
      return;
    }

    const csvRows: string[] = [];
    
    // Add headers
    csvRows.push(`"Employee Summary Report - ${selectedMonth} ${selectedYear}"`);
    csvRows.push(`"Department: ${selectedDepartment}"`);
    csvRows.push(`"Generated on: ${new Date().toLocaleDateString()}"`);
    csvRows.push(''); // Empty row
    
    // Add table headers
    csvRows.push([
      'Employee Name',
      'Full Day',
      'Half Day', 
      'Present Day',
      'Absent Day',
      'Leaves',
      'Late Days',
      'Holidays',
      'Early Days',
      'Late/Early Penalty',
      'Applied Penalty',
      'Over Time',
      'Total Work Hours'
    ].map(h => `"${h}"`).join(','));
    
    // Add employee data
    employees.forEach(employee => {
      const row = [
        employee.name || 'Unknown',
        employee.totals?.fullDay || 0,
        employee.totals?.halfDay || 0,
        employee.totals?.presentDay || 0,
        employee.totals?.absentDay || 0,
        employee.totals?.leaves || 0,
        employee.totals?.lateDays || 0,
        employee.totals?.holidays || 0,
        employee.totals?.earlyDays || 0,
        this.formatTimeForCSV(employee.totals?.latePenalty || 0),
        this.calculateAppliedPenalty(employee.totals?.latePenalty || 0),
        this.formatTimeForCSV(employee.totals?.extraHours || 0),
        this.formatTimeForCSV(employee.totals?.totalWorkHours || 0)
      ];
      csvRows.push(row.map(cell => `"${cell}"`).join(','));
    });

    const csvContent = csvRows.join('\n');
    this.downloadCSV(csvContent, `Summary_${selectedMonth}_${selectedYear}_${selectedDepartment.replace(/\s+/g, '_')}.csv`);
  }

  /**
   * Export detailed attendance with combined headers for better readability
   */
  exportDetailedAttendanceToCSV(
    employees: any[], 
    dynamicDateHeaders: number[], 
    dynamicWeekHeaders: string[],
    selectedMonth: string,
    selectedYear: number,
    selectedDepartment: string = 'All'
  ): void {
    if (!employees || employees.length === 0) {
      alert('No data available to export');
      return;
    }

    const csvRows: string[] = [];
    
    // Add report header
    csvRows.push(`"Detailed Attendance Report - ${selectedMonth} ${selectedYear}"`);
    csvRows.push(`"Department: ${selectedDepartment}"`);
    csvRows.push(`"Generated on: ${new Date().toLocaleDateString()}"`);
    csvRows.push(''); // Empty row

    // Create header row with Day/Date format
    const headerRow = ['Employee', 'Data Type'];
    dynamicDateHeaders.forEach((date, index) => {
      const weekDay = dynamicWeekHeaders[index] || '';
      headerRow.push(`"${weekDay} ${date}"`);
    });
    csvRows.push(headerRow.join(','));

    // Add employee data
    employees.forEach((employee, employeeIndex) => {
      const employeeName = employee.name || 'Unknown Employee';
      const department = employee.designation || 'Not specified';
      
      // Add employee header row
      csvRows.push(`"${employeeName} (${department})","","${new Array(dynamicDateHeaders.length).fill('').join('","')}"`);
      
      // Data types to export
      const dataTypes = [
        { label: 'Shift', field: 'shift' },
        { label: 'Status', field: 'dayStatus' },
        { label: 'Check In', field: 'checkIn' },
        { label: 'Check Out', field: 'checkOut' },
        { label: 'Break Time', field: 'breakTime' },
        { label: 'Working Hours', field: 'workingHours' },
        { label: 'Extra Hours', field: 'extraHours' },
        { label: 'Late Time', field: 'lateTime' },
        { label: 'Early Time', field: 'earlyTime' }
      ];

      // Add data rows for each type
      dataTypes.forEach(dataType => {
        const row = ['', `"${dataType.label}"`];
        dynamicDateHeaders.forEach((_, index) => {
          const value = employee.records[index]?.[dataType.field] || '--';
          row.push(`"${value}"`);
        });
        csvRows.push(row.join(','));
      });

      // Add spacing between employees
      if (employeeIndex < employees.length - 1) {
        csvRows.push(''); // Empty row
      }
    });

    const csvContent = csvRows.join('\n');
    this.downloadCSV(csvContent, `Detailed_Attendance_${selectedMonth}_${selectedYear}_${selectedDepartment.replace(/\s+/g, '_')}.csv`);
  }

  private formatTimeForCSV(hours: number): string {
    const totalMinutes = Math.round(hours * 60);
    if (totalMinutes < 60) {
      return `${totalMinutes} min`;
    } else {
      const hrs = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      if (mins === 0) {
        return `${hrs} hrs`;
      }
      return `${hrs}.${Math.round((mins / 60) * 10)} hrs`;
    }
  }

  private calculateAppliedPenalty(totalPenaltyMinutes: number): string {
    const penaltyHours = totalPenaltyMinutes / 60;
    const penaltyDays = Math.floor(penaltyHours / 8);
    return penaltyDays > 0 ? (penaltyDays === 1 ? '1 Day' : `${penaltyDays} Days`) : '--';
  }
}