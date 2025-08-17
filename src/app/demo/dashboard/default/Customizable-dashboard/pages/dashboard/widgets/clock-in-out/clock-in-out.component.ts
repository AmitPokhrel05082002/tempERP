// clock-in-out.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  clockInTime: string;
  clockOutTime: string;
  productionTime: string;
  isLate: boolean;
  lateMinutes?: number;
  clockInStatus: 'on-time' | 'late';
  isExpanded: boolean;
}

@Component({
  selector: 'app-clock-in-out',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './clock-in-out.component.html',
  styleUrls: ['./clock-in-out.component.scss']
})
export class ClockInOutComponent implements OnInit {
  selectedDepartment: string = 'All Departments';
  selectedDate: string = 'Today';

  employees: Employee[] = [
    {
      id: 1,
      name: 'Daniel Esbella',
      position: 'UI/UX Designer',
      avatar: 'assets/avatars/daniel.jpg',
      clockInTime: '09:15 AM',
      clockOutTime: '05:30 PM',
      productionTime: '08:15 Hrs',
      isLate: false,
      clockInStatus: 'on-time',
      isExpanded: false
    },
    {
      id: 2,
      name: 'Doglas Martini',
      position: 'Project Manager',
      avatar: 'assets/avatars/doglas.jpg',
      clockInTime: '09:36 AM',
      clockOutTime: '06:15 PM',
      productionTime: '08:39 Hrs',
      isLate: false,
      clockInStatus: 'on-time',
      isExpanded: false
    },
    {
      id: 3,
      name: 'Brian Villalobos',
      position: 'PHP Developer',
      avatar: 'assets/avatars/brian.jpg',
      clockInTime: '10:30 AM',
      clockOutTime: '09:45 AM',
      productionTime: '09:21 Hrs',
      isLate: false,
      clockInStatus: 'on-time',
      isExpanded: false
    },
    {
      id: 4,
      name: 'Anthony Lewis',
      position: 'Marketing Head',
      avatar: 'assets/avatars/anthony.jpg',
      clockInTime: '08:35 AM',
      clockOutTime: '04:45 PM',
      productionTime: '07:10 Hrs',
      isLate: true,
      lateMinutes: 30,
      clockInStatus: 'late',
      isExpanded: false
    }
  ];

  departments: string[] = [
    'All Departments',
    'Design',
    'Development',
    'Marketing',
    'Management'
  ];

  constructor() { }

  ngOnInit(): void {
  }

  toggleEmployeeDetails(employee: Employee): void {
    // Reset all other employees
    this.employees.forEach(emp => {
      if (emp.id !== employee.id) {
        emp.isExpanded = false;
      }
    });

    // Toggle the selected employee
    employee.isExpanded = !employee.isExpanded;
  }

  changeDepartment(department: string): void {
    this.selectedDepartment = department;
    // In a real app, this would filter employees by department
  }

  changeDate(date: string): void {
    this.selectedDate = date;
    // In a real app, this would fetch data for the selected date
  }
}
