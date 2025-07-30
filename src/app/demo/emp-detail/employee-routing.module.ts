import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { EmployeeDetailComponent } from './emp-details/emp-det.component';
import { EmployeeViewComponent } from './emp-view/emp-view-detail.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'emp-det',
    pathMatch: 'full'
  },
  {
    path: 'emp-det',
    component: EmployeeDetailComponent
  },
  {
    path: 'emp-det/view/:empCode',
    component: EmployeeViewComponent
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class EmployeeRoutingModule { }
