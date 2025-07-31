// Angular import
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

// Core services
import { AuthService } from '../../../../../core/services/auth.service';

// Third party imports
import { SharedModule } from 'src/app/theme/shared/shared.module';

@Component({
  selector: 'app-nav-right',
  standalone: true,
  imports: [CommonModule, RouterModule, SharedModule],
  templateUrl: './nav-right.component.html',
  styleUrls: ['./nav-right.component.scss'],
  providers: [AuthService]
})
export class NavRightComponent {
  constructor(
    public authService: AuthService,
    private router: Router
  ) {}
  onLogout() {
    console.log('Logout button clicked in NavRightComponent');
    this.authService.logout();
  }
  
}

