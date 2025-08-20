import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface Service {
  id: string;
  name: string;
  description: string;
  route: string;
  iconPath: string;
  colorClass: string;
  activeUsers: number;
  status: 'online' | 'offline' | 'maintenance';
}

interface SystemStats {
  totalServices: number;
  activeUsers: number;
  systemHealth: number;
  lastUpdated: Date;
}

@Component({
  selector: 'app-comman-dashboard',
  standalone: true,
  imports: [],
  templateUrl: './comman-dashboard.component.html',
  styleUrl: './comman-dashboard.component.scss'
})
export class CommanDashboardComponent {
  services: Service[] = [
    {
      id: 'hrperp',
      name: 'HR & Payroll ERP',
      description: 'Complete human resource management including payroll processing, attendance, and employee lifecycle.',
      route: '/hrperp',
      iconPath: 'assets/icons/users.svg',
      colorClass: 'service-hrperp',
      activeUsers: 42,
      status: 'online'
    },
    {
      id: 'asset-management',
      name: 'Asset Management',
      description: 'Track physical assets, depreciation, maintenance schedules and asset lifecycle management.',
      route: '/asset-management',
      iconPath: 'assets/icons/building.svg',
      colorClass: 'service-asset',
      activeUsers: 15,
      status: 'online'
    },
    {
      id: 'shift-management',
      name: 'Shift Management',
      description: 'Employee scheduling, shift planning, roster management, and time tracking optimization.',
      route: '/shift-management',
      iconPath: 'assets/icons/clock.svg',
      colorClass: 'service-shift',
      activeUsers: 35,
      status: 'online'
    },
    {
      id: 'accounts',
      name: 'Financial Accounts',
      description: 'General ledger, accounts payable/receivable, financial reporting and budgeting tools.',
      route: '/accounts',
      iconPath: 'assets/icons/dollar.svg',
      colorClass: 'service-accounts',
      activeUsers: 28,
      status: 'online'
    },
    {
      id: 'inventory',
      name: 'Inventory Control',
      description: 'Real-time stock tracking, warehouse management, and automated reorder points.',
      route: '/inventory',
      iconPath: 'assets/icons/package.svg',
      colorClass: 'service-inventory',
      activeUsers: 33,
      status: 'online'
    },
    {
      id: 'project-management',
      name: 'Project Management',
      description: 'Task management, resource allocation, Gantt charts, and project analytics.',
      route: '/project-management',
      iconPath: 'assets/icons/clipboard.svg',
      colorClass: 'service-project',
      activeUsers: 56,
      status: 'online'
    },
    {
      id: 'crm',
      name: 'Customer CRM',
      description: 'Customer database, sales pipeline, communication tracking and analytics.',
      route: '/crm',
      iconPath: 'assets/icons/user.svg',
      colorClass: 'service-crm',
      activeUsers: 38,
      status: 'online'
    },
    {
      id: 'dms',
      name: 'Document System',
      description: 'Centralized document storage, version control, and workflow automation.',
      route: '/dms',
      iconPath: 'assets/icons/folder.svg',
      colorClass: 'service-dms',
      activeUsers: 64,
      status: 'online'
    }
  ];

  stats: SystemStats = {
    totalServices: 8,  // Updated to 8 services
    activeUsers: 283,   // Updated total active users (added 35 from shift management)
    systemHealth: 100,
    lastUpdated: new Date()
  };

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    // Load real-time data from your services
    // this.dashboardService.getStats().subscribe(stats => this.stats = stats);
    // this.dashboardService.getServices().subscribe(services => this.services = services);
  }

  navigateToService(route: string): void {
    this.router.navigate([route]);
  }

  getLastUpdatedText(): string {
    const now = new Date();
    const diff = Math.floor((now.getTime() - this.stats.lastUpdated.getTime()) / 60000);
    return diff < 1 ? 'Just now' : `${diff} min ago`;
  }
}
