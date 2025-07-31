import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import { AuthenticationRoutingModule } from './authentication-routing.module';

// Note: Since LoginComponent is standalone, we don't need to declare it here
// It will be loaded directly by the router

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    AuthenticationRoutingModule
  ]
})
export class AuthenticationModule {}
