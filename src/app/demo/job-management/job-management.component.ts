import { Component } from '@angular/core';
import { RouterModule, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-job-management',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  templateUrl: './job-management.component.html',
  styleUrl: './job-management.component.scss'
})
export class JobManagementComponent {
}
