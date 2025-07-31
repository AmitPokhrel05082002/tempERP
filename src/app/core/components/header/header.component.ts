// import { Component } from '@angular/core';
// import { CommonModule } from '@angular/common';
// import { Router, RouterModule } from '@angular/router';
// import { AuthService } from '../../services/auth.service';

// @Component({
//   selector: 'app-header',
//   standalone: true,
//   imports: [CommonModule, RouterModule],
//   template: `
//     <header class="bg-primary text-white p-3">
//       <div class="container-fluid d-flex justify-content-between align-items-center">
//         <h1 class="h4 mb-0">NGN ERP</h1>
//         <nav>
//           <ul class="nav">
//             <li class="nav-item" *ngIf="authService.currentUserValue">
//               <button class="btn btn-outline-light btn-sm" (click)="onLogout()">
//                 Logout
//               </button>
//             </li>
//           </ul>
//         </nav>
//       </div>
//     </header>
//   `,
//   styles: [`
//     header {
//       box-shadow: 0 2px 4px rgba(0,0,0,0.1);
//     }
//   `]
// })
// export class HeaderComponent {
//   constructor(
//     public authService: AuthService,
//     private router: Router
//   ) {}

//   onLogout() {
//     this.authService.logout();
//   }
// }
