import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AdminComponent } from './theme/layout/admin/admin.component';
import { GuestComponent } from './theme/layout/guest/guest.component';
import { AuthGuard } from './core/guards/auth.guard';
import { SalaryViewDetailsComponent } from './demo/dashboard/pay-revision/salary-view-details/salary-view-details.component';
import { PayRollDetailComponent } from './demo/pay-roll/pay-roll-details/pay-roll-detail.component';
import { AssetManagementComponent } from './demo/asset-management/asset-management.component';
import { ReportComponent } from './demo/dashboard/report/report.component';
import { CommanDashboardComponent } from './comman-dashboard/comman-dashboard.component';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/guest/login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadChildren: () => import('./demo/pages/authentication/authentication-routing.module').then((m) => m.AuthenticationRoutingModule)
  },
  {
    path: '',
    component: AdminComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: '',
        redirectTo: '/default',
        pathMatch: 'full'
      },
      {
        path: 'default',
        loadComponent: () => import('./demo/dashboard/default/default.component').then((c) => c.DefaultComponent)
      },
      {
        path: 'report',
        component: ReportComponent
      },
      {
        path: 'attendence',
        loadComponent: () => import('./demo/dashboard/attendence/attendence.component').then((c) => c.AttendenceComponent),
        children: [
          { path: '', redirectTo: 'employee-attendance', pathMatch: 'full' },
          {
            path: 'employee-attendance',
            loadComponent: () =>
              import('./demo/dashboard/employee-attendance/employee-attendance.component').then((c) => c.EmployeeAttendanceComponent)
          },
          {
            path: 'attendance-sheet',
            loadComponent: () =>
              import('./demo/dashboard/attendance-sheet/attendance-sheet.component').then((c) => c.AttendanceSheetComponent)
          }
        ]
      },
      // Keep the old routes for backward compatibility
      {
        path: 'employee-attendance',
        redirectTo: 'job-management/employee-attendance',
        pathMatch: 'full'
      },
      {
        path: 'menu-permissions',
        loadComponent: () =>
          import('./demo/RoleBaseAccess/menu-permissions/menu-permissions.component').then((c) => c.MenuPermissionsComponent)
      },
      {
        path: 'rbac',
        loadComponent: () => import('./demo/RoleBaseAccess/RBAC/RBAC.component').then((c) => c.RBACComponent)
      },
      {
        path: 'attendance-sheet',
        redirectTo: 'job-management/attendance-sheet',
        pathMatch: 'full'
      },
      {
        path: 'employees/all',
        loadComponent: () => import('./demo/dashboard/view-employee/view-employee.component').then((c) => c.ViewEmployeeComponent),
        data: { title: 'All Employees Attendance Details' }
      },
      {
        path: 'employees/:id',
        loadComponent: () => import('./demo/dashboard/view-employee/view-employee.component').then((c) => c.ViewEmployeeComponent),
        data: { title: 'Employee Attendance Details' }
      },
      // Backward compatibility redirects
      {
        path: 'typography',
        loadComponent: () => import('./demo/elements/typography/typography.component')
      },
      {
        path: 'color',
        loadComponent: () => import('./demo/elements/element-color/element-color.component')
      },
      {
        path: 'sample-page',
        loadComponent: () => import('./demo/other/sample-page/sample-page.component')
      },
      {
        path: 'leave-list',
        loadComponent: () => import('./demo/Leave/ELMR/elmr.component').then((c) => c.ELMRComponent)
      },
      {
        path: 'balanceleave',
        loadComponent: () => import('./demo/Leave/balanceleave/balanceleave.component').then((c) => c.BalanceleaveComponent)
      },

      {
        path: 'balanceleave/:id',
        loadComponent: () => import('./demo/Leave/balanceleave/balanceleave.component').then((c) => c.BalanceleaveComponent)
      },
      {
        path: 'pay-roll',
        loadComponent: () => import('./demo/pay-roll/pay-roll.component').then((c) => c.PayRollComponent)
      },
      {
        path: 'pay-roll-detail/:id',
        loadComponent: () => import('./demo/pay-roll/pay-roll-details/pay-roll-detail.component').then((c) => c.PayRollDetailComponent)
      },
      {
        path: 'pay-roll-detail/view',
        loadComponent: () => import('./demo/pay-roll/pay-roll-details/pay-roll-detail.component').then((c) => c.PayRollDetailComponent)
      },
      {
        path: 'view/tds/:empId',
        loadComponent: () => import('./demo/pay-roll/View TDS/view-tds.component').then((c) => c.TDSComponent)
      },
      {
        path: 'view/pay-slip/:empId',
        loadComponent: () => import('./demo/pay-roll/Pay-slip/pay-slip.component').then((c) => c.PaySlipComponent)
      },
      {
        path: 'pay-revision',
        loadComponent: () =>
          import('./demo/dashboard/pay-revision/salary-details/pay-revision.component').then((c) => c.PayRevisionComponent)
      },
      {
        path: 'salary-view-details/:empId',
        component: SalaryViewDetailsComponent,
        runGuardsAndResolvers: 'always'
      },
      {
        path: 'organizations/salarystructure',
        loadComponent: () => import('./demo/Add-salary-structure/AddSalaryStructure.component').then((m) => m.SalaryStructureComponent)
      },
      {
        path: 'document-archival',
        loadComponent: () =>
          import('./demo/elements/document-archival/document-archival.component').then((m) => m.DocumentArchivalComponent)
      },
      {
        path: 'doc-view-file/:id',
        loadComponent: () => import('./demo/elements/doc-view-file/doc-view-file.component').then((m) => m.DocViewFileComponent)
      },
      // {
      //   path: 'empl',
      //   loadChildren: () => import('./demo/emp-detail/emp.module').then((m) => m.EmployeeModule)
      // },
      {
        path: 'leave-allocation',
        loadComponent: () => import('./demo/Leave/leave-allocation/leave-allocation.component').then((c) => c.LeaveAllocationComponent)
      },
      {
        path: 'leave-allocation-details/:empId',
        loadComponent: () =>
          import('./demo/Leave/leave-allocation-details/leave-allocation-details.component').then((c) => c.LeaveAllocationDetailsComponent)
      },
      {
        path: 'calendar',
        children: [
          // Default route - Calendar Overview
          {
            path: '',
            title: 'Calendar Overview',
            loadComponent: () =>
              import('./demo/Calendar/calendar-overview/calendar-overview.component').then((c) => c.CalendarOverviewComponent)
          },
          // View Calendar Details (with full parameters)
          {
            path: 'details/:id/:branchId/:year',
            title: 'Calendar Details',
            loadComponent: () =>
              import('./demo/Calendar/calendar-details/calendar-details.component').then((c) => c.CalendarDetailsComponent)
          },
          // Fallback route for direct ID access (redirects to overview)
          {
            path: ':id',
            redirectTo: '/calendar',
            pathMatch: 'full'
          }
        ]
      },

      {
        path: 'organization/branches',
        loadComponent: () => import('./demo/branches/branches.component').then((c) => c.BranchesComponent)
      },

      {
        path: 'job-management',
        children: [
          { path: '', redirectTo: 'job-grade', pathMatch: 'full' },
          {
            path: 'job-grade',
            loadComponent: () => import('./demo/job-grade/job-grade.component').then((c) => c.JobGradeComponent)
          },
          {
            path: 'job-position',
            loadComponent: () => import('./demo/job-position/job-position.component').then((c) => c.JobPositionComponent)
          },
          {
            path: 'department',
            loadComponent: () => import('./demo/department/department.component').then((c) => c.DepartmentComponent)
          }
        ]
      },
      // Keep the old routes for backward compatibility
      {
        path: 'job-position',
        redirectTo: 'job-management/job-position',
        pathMatch: 'full'
      },
      {
        path: 'job-grade',
        redirectTo: 'job-management/job-grade',
        pathMatch: 'full'
      },
      {
        path: 'emp-training',
        loadComponent: () => import('./demo/Training Management/emp-training/emp-training.component').then((c) => c.EmpTrainingComponent)
      },
      {
        path: 'emp-categories',
        loadComponent: () =>
          import('./demo/Training Management/emp-categories/emp-categories.component').then((c) => c.EmpCategoriesComponent)
      },
      {
        path: 'emp-nominations',
        loadComponent: () =>
          import('./demo/Training Management/emp-nominations/emp-nominations.component').then((c) => c.EmpNominationsComponent)
      },
      {
        path: 'emp-transfer',
        loadComponent: () => import('./demo/Transfer/emp-transfer/emp-transfer.component').then((c) => c.EmpTransferComponent)
      },
      {
        path: 'transfer/transfer-types',
        loadComponent: () => import('./demo/Transfer/emp-type/emp-type.component').then((c) => c.EmpTypeComponent)
      },
      // Redirect transfer-types to emp-type
      {
        path: 'transfer-types',
        redirectTo: 'emp-type',
        pathMatch: 'full'
      },
      {
        path: 'emp-separation',
        loadComponent: () => import('./demo/emp-separation/emp-separation/emp-separation.component').then((c) => c.EmpSeparationComponent)
      },
      {
        path: 'separation-type',
        loadComponent: () =>
          import('./demo/emp-separation/separation-type/separation-type.component').then((c) => c.SeparationTypeComponent)
      },
      {
        path: 'emp-det',
        loadComponent: () => import('./demo/emp-detail/emp-details/emp-det.component').then((c) => c.EmployeeDetailComponent)
      },
      {
        path: 'emp-det/view/:empId',
        loadComponent: () => import('./demo/emp-detail/emp-view/emp-view-detail.component').then((c) => c.EmployeeViewComponent)
      },
      {
        path: 'emp-det/view',
        loadComponent: () => import('./demo/emp-detail/emp-view/emp-view-detail.component').then((c) => c.EmployeeViewComponent)
      },
      {
        path: 'menu-permissions',
        loadComponent: () =>
          import('./demo/RoleBaseAccess/menu-permissions/menu-permissions.component').then((c) => c.MenuPermissionsComponent)
      },

      {
        path: 'rbac',
        loadComponent: () => import('./demo/RoleBaseAccess/RBAC/RBAC.component').then((c) => c.RBACComponent),
      },
    ]
  },
  {
    path: '',
    component: GuestComponent,
    children: [
      {
        path: 'guest',
        loadChildren: () => import('./demo/pages/authentication/authentication.module').then((m) => m.AuthenticationModule)
      }
    ]
  },
  {
    path: 'asset-mgt',
    component: AssetManagementComponent
  },
  {
    path: 'common-dashboard',
    component: CommanDashboardComponent
  },
  {
    path: '',
    component: AdminComponent,
    canActivate: [AuthGuard],
    children: [
      {
        path: 'balanceleave',
        loadComponent: () => import('./demo/Leave/balanceleave/balanceleave.component').then((c) => c.BalanceleaveComponent)
      },
      {
        path: 'leave-application',
        loadComponent: () => import('./demo/Leave/leave-form/leave-form.component').then((c) => c.LeaveFormComponent)
      },
      {
        path: 'leave-form',
        loadComponent: () => import('./demo/Leave/leave-form/leave-form.component').then((c) => c.LeaveFormComponent)
      },
      {
        path: 'balanceleave/:id',
        loadComponent: () => import('./demo/Leave/balanceleave/balanceleave.component').then((c) => c.BalanceleaveComponent)
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule {}
