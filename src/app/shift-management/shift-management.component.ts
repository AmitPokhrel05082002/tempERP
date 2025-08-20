import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
interface Employee {
  id: number;
  name: string;
  department: string;
}

interface Shift {
  id?: string;
  userId: number;
  date: string;
  shift: 'morning' | 'afternoon' | 'evening' | 'night';
  notes?: string;
  createdAt?: Date;
}

@Component({
  selector: 'app-shift-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './shift-management.component.html',
  styleUrl: './shift-management.component.scss'
})
export class ShiftManagementComponent implements OnInit {

  employees: Employee[] = [
    { id: 1, name: 'Karma Dorji', department: 'Operations' },
    { id: 2, name: 'Sangay Wangchuk', department: 'Security' },
    { id: 3, name: 'Tshering Pema', department: 'Customer Service' },
    { id: 4, name: 'Jigme Namgyal', department: 'IT Support' },
    { id: 5, name: 'Prem Bahadur', department: 'Maintenance' },
    { id: 6, name: 'Sita Kumari', department: 'Reception' },
    { id: 7, name: 'Ram Prasad', department: 'Logistics' },
    { id: 8, name: 'Dechen Wangmo', department: 'HR' },
    { id: 9, name: 'Bishnu Sharma', department: 'Finance' },
    { id: 10, name: 'Ugyen Tshomo', department: 'Admin' },
    { id: 11, name: 'Lakpa Sherpa', department: 'Operations' },
    { id: 12, name: 'Maya Gurung', department: 'Customer Service' },
    { id: 13, name: 'Kinley Dema', department: 'Sales' },
    { id: 14, name: 'Hari Thapa', department: 'Security' },
    { id: 15, name: 'Choden Lhamo', department: 'Quality Control' },
    { id: 16, name: 'Phurba Tamang', department: 'Warehouse' },
    { id: 17, name: 'Sonam Tobgay', department: 'Transport' },
    { id: 18, name: 'Ganga Rai', department: 'Accounting' },
    { id: 19, name: 'Norbu Zangpo', department: 'Marketing' },
    { id: 20, name: 'Anita Subba', department: 'Procurement' }
  ];

  shifts: Shift[] = [];

  currentShift: Shift = {
    userId: 0,
    date: '',
    shift: 'morning',
    notes: ''
  };

  editMode = false;
  editId: string | null = null;

  shiftTimes = {
    morning: '6:00 AM - 2:00 PM',
    afternoon: '2:00 PM - 10:00 PM',
    evening: '6:00 PM - 12:00 AM',
    night: '10:00 PM - 6:00 AM'
  };

  filterDate: string = '';
  filterShiftType: string = '';
  searchTerm: string = '';

  constructor() {}

  ngOnInit(): void {
    this.loadShifts();
    this.setTodayDate();
  }

  loadShifts(): void {
    const stored = localStorage.getItem('shiftData');
    if (stored) {
      try {
        this.shifts = JSON.parse(stored);
      } catch (e) {
        console.error('Error loading shifts:', e);
        this.shifts = [];
      }
    }
  }

  saveToLocalStorage(): void {
    localStorage.setItem('shiftData', JSON.stringify(this.shifts));
  }

  setTodayDate(): void {
    const today = new Date();
    this.currentShift.date = today.toISOString().split('T')[0];
  }

  selectShift(shiftType: 'morning' | 'afternoon' | 'evening' | 'night'): void {
    this.currentShift.shift = shiftType;
  }

  saveShift(): void {
    if (!this.validateShift()) {
      return;
    }

    if (this.editMode && this.editId) {
      // Update existing shift
      const index = this.shifts.findIndex(s => s.id === this.editId);
      if (index !== -1) {
        this.shifts[index] = {
          ...this.currentShift,
          userId: Number(this.currentShift.userId), // Ensure userId is a number
          id: this.editId,
          createdAt: this.shifts[index].createdAt
        };
      }
    } else {
      // Check for duplicate shift (same employee, same date, same shift type)
      const duplicate = this.shifts.find(s =>
        s.userId === Number(this.currentShift.userId) &&
        s.date === this.currentShift.date &&
        s.shift === this.currentShift.shift &&
        s.id !== this.editId
      );

      if (duplicate) {
        alert(`This employee already has a ${this.currentShift.shift} shift on this date. They can have different shift types on the same day.`);
        return;
      }

      // Add new shift
      const newShift: Shift = {
        ...this.currentShift,
        userId: Number(this.currentShift.userId), // Ensure userId is a number
        id: this.generateId(),
        createdAt: new Date()
      };
      this.shifts.push(newShift);
    }

    this.saveToLocalStorage();
    this.resetForm();
  }

  editShift(shift: Shift): void {
    this.currentShift = { ...shift };
    this.editMode = true;
    this.editId = shift.id || null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteShift(shift: Shift): void {
    if (confirm(`Are you sure you want to delete ${this.getEmployeeName(shift.userId)}'s shift on ${this.formatDate(shift.date)}?`)) {
      this.shifts = this.shifts.filter(s => s.id !== shift.id);
      this.saveToLocalStorage();
    }
  }

  cancelEdit(): void {
    this.resetForm();
  }

  resetForm(): void {
    this.currentShift = {
      userId: 0,
      date: '',
      shift: 'morning'
    };
    this.editMode = false;
    this.editId = null;
    this.setTodayDate();
  }

  validateShift(): boolean {
    if (!this.currentShift.userId || this.currentShift.userId === 0) {
      alert('Please select an employee');
      return false;
    }
    if (!this.currentShift.date) {
      alert('Please select a date');
      return false;
    }
    return true;
  }

  getEmployeeName(userId: number | string): string {
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const emp = this.employees.find(e => e.id === id);
    return emp ? emp.name : 'Unknown';
  }

  getEmployeeDept(userId: number | string): string {
    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    const emp = this.employees.find(e => e.id === id);
    return emp ? emp.department : '';
  }

  formatDate(dateString: string): string {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    };
    return date.toLocaleDateString('en-US', options);
  }

  getShiftCount(shiftType: string): number {
    return this.shifts.filter(s => s.shift === shiftType).length;
  }

  getTotalShifts(): number {
    return this.shifts.length;
  }

  getFilteredShifts(): Shift[] {
    let filtered = [...this.shifts];

    if (this.filterDate) {
      filtered = filtered.filter(s => s.date === this.filterDate);
    }

    if (this.filterShiftType) {
      filtered = filtered.filter(s => s.shift === this.filterShiftType);
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(s => {
        const empName = this.getEmployeeName(s.userId).toLowerCase();
        const empDept = this.getEmployeeDept(s.userId).toLowerCase();
        return empName.includes(term) || empDept.includes(term);
      });
    }

    // Sort by date descending, then by employee name
    return filtered.sort((a, b) => {
      const dateCompare = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateCompare !== 0) return dateCompare;

      // If same date, sort by employee name
      const nameA = this.getEmployeeName(a.userId);
      const nameB = this.getEmployeeName(b.userId);
      return nameA.localeCompare(nameB);
    });
  }

  getEmployeeShiftsOnDate(userId: number, date: string): Shift[] {
    return this.shifts.filter(s =>
      s.userId === Number(userId) && s.date === date
    );
  }

  hasMultipleShifts(userId: number, date: string): boolean {
    return this.getEmployeeShiftsOnDate(userId, date).length > 1;
  }

  clearFilters(): void {
    this.filterDate = '';
    this.filterShiftType = '';
    this.searchTerm = '';
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  exportData(): void {
    // Create CSV content for Excel
    const headers = ['Employee Name', 'Department', 'Date', 'Day', 'Shift Type', 'Shift Time', 'Notes'];
    const csvContent = [
      headers.join(','),
      ...this.shifts.map(shift => {
        const emp = this.employees.find(e => e.id === shift.userId);
        const date = new Date(shift.date + 'T00:00:00');
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

        return [
          emp ? `"${emp.name}"` : 'Unknown',
          emp ? `"${emp.department}"` : '',
          formattedDate,
          dayName,
          shift.shift.charAt(0).toUpperCase() + shift.shift.slice(1),
          `"${this.shiftTimes[shift.shift]}"`,
          shift.notes ? `"${shift.notes.replace(/"/g, '""')}"` : ''
        ].join(',');
      })
    ].join('\n');

    // Add BOM for Excel to recognize UTF-8
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    const fileName = `shift_schedule_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  exportToExcel(): void {
    // Create HTML table for better Excel formatting
    let excelContent = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; }
          th { background-color: #4CAF50; color: white; font-weight: bold; padding: 12px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px; text-align: left; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f2f2f2; }
          .morning { background-color: #fff3cd; color: #856404; }
          .afternoon { background-color: #cce5ff; color: #004085; }
          .evening { background-color: #e2d5f1; color: #6f42c1; }
          .night { background-color: #d1ecf1; color: #0c5460; }
          .weekend { background-color: #fffacd; }
          .multiple-shifts { font-weight: bold; color: #d9534f; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Employee ID</th>
              <th>Employee Name</th>
              <th>Department</th>
              <th>Date</th>
              <th>Day</th>
              <th>Shift Type</th>
              <th>Shift Time</th>
              <th>Weekend</th>
              <th>Multiple Shifts</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>`;

    // Sort shifts by date and employee
    const sortedShifts = [...this.shifts].sort((a, b) => {
      const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
      if (dateCompare !== 0) return dateCompare;
      return Number(a.userId) - Number(b.userId);
    });

    sortedShifts.forEach(shift => {
      const emp = this.employees.find(e => e.id === Number(shift.userId));
      const date = new Date(shift.date + 'T00:00:00');
      const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
      const formattedDate = date.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const isWeekendDay = this.isWeekend(shift.date);
      const hasMultiple = this.hasMultipleShifts(shift.userId, shift.date);

      excelContent += `
        <tr class="${isWeekendDay ? 'weekend' : ''}">
          <td>${shift.userId}</td>
          <td>${emp ? emp.name : 'Unknown'}</td>
          <td>${emp ? emp.department : ''}</td>
          <td>${formattedDate}</td>
          <td>${dayName}</td>
          <td class="${shift.shift}">${shift.shift.charAt(0).toUpperCase() + shift.shift.slice(1)}</td>
          <td>${this.shiftTimes[shift.shift]}</td>
          <td>${isWeekendDay ? 'Yes' : 'No'}</td>
          <td class="${hasMultiple ? 'multiple-shifts' : ''}">${hasMultiple ? 'Yes' : 'No'}</td>
          <td>${shift.notes || ''}</td>
        </tr>`;
    });

    excelContent += `
          </tbody>
        </table>
        <br>
        <table>
          <tr>
            <th colspan="2">Summary Statistics</th>
          </tr>
          <tr>
            <td>Total Shifts</td>
            <td>${this.shifts.length}</td>
          </tr>
          <tr>
            <td>Morning Shifts</td>
            <td>${this.getShiftCount('morning')}</td>
          </tr>
          <tr>
            <td>Afternoon Shifts</td>
            <td>${this.getShiftCount('afternoon')}</td>
          </tr>
          <tr>
            <td>Evening Shifts</td>
            <td>${this.getShiftCount('evening')}</td>
          </tr>
          <tr>
            <td>Night Shifts</td>
            <td>${this.getShiftCount('night')}</td>
          </tr>
          <tr>
            <td>Weekend Shifts</td>
            <td>${this.shifts.filter(s => this.isWeekend(s.date)).length}</td>
          </tr>
          <tr>
            <td>Unique Employees</td>
            <td>${new Set(this.shifts.map(s => s.userId)).size}</td>
          </tr>
        </table>
      </body>
      </html>`;

    const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `shift_schedule_${new Date().toISOString().split('T')[0]}.xls`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  getUpcomingShifts(): Shift[] {
    const today = new Date().toISOString().split('T')[0];
    return this.shifts
      .filter(s => s.date >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 5);
  }

  isWeekend(dateString: string): boolean {
    const date = new Date(dateString + 'T00:00:00');
    const day = date.getDay();
    return day === 0 || day === 6;
  }
}
