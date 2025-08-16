// dashboard-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ViewEmployeeComponent } from './view-employee/view-employee.component';

const routes: Routes = [
  // Default dashboard route
  {
    path: '',
    redirectTo: 'attendance-sheet',
    pathMatch: 'full'
  },
  // Attendance Sheet (Summary view)
  {
    path: 'attendance-sheet',
    loadComponent: () => import('./attendance-sheet/attendance-sheet.component').then(c => c.AttendanceSheetComponent),
    data: { title: 'Attendance Sheet' }
  },
  // Employee Details Routes
  {
    path: 'employees/all',
    component: ViewEmployeeComponent,
    data: { title: 'All Employees Attendance Details' }
  },
  {
    path: 'employees/:id',
    component: ViewEmployeeComponent,
    data: { title: 'Employee Attendance Details' }
  },
  // Legacy redirects for backward compatibility
  {
    path: 'view-employee',
    redirectTo: 'employees/all',
    pathMatch: 'full'
  },
  {
    path: 'employee-attendance',
    loadComponent: () => import('./employee-attendance/employee-attendance.component').then(c => c.EmployeeAttendanceComponent),
    data: { title: 'Employee Attendance' }
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class DashboardRoutingModule { }