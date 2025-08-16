// dashboard.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';

// Import standalone components
import { ViewEmployeeComponent } from './view-employee/view-employee.component';
import { AttendanceSheetComponent } from './attendance-sheet/attendance-sheet.component';
import { DashboardRoutingModule } from './dashboard-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    HttpClientModule,
    RouterModule,
    NgbDropdownModule,
    DashboardRoutingModule,
    ViewEmployeeComponent,
    AttendanceSheetComponent
  ],
  providers: [
  ]
})
export class DashboardModule { }