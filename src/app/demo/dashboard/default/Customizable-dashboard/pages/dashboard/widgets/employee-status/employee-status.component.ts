// employee-status.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

interface EmployeeStatus {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

interface TopPerformer {
  name: string;
  position: string;
  performance: number;
  avatar: string;
}

@Component({
  selector: 'app-employee-status',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-status.component.html',
  styleUrls: ['./employee-status.component.scss']
})
export class EmployeeStatusComponent implements OnInit {
  totalEmployees: number = 154;

  // Employee status categories
  employeeStatuses: EmployeeStatus[] = [
    { category: 'Fulltime', count: 112, percentage: 48, color: '#ffcc00' },
    { category: 'Contract', count: 42, percentage: 20, color: '#3e7788' },
    { category: 'Probation', count: 12, percentage: 22, color: '#e63946' },
    { category: 'WFH', count: 4, percentage: 10, color: '#ee59a1' }
  ];

  // Top performer
  topPerformer: TopPerformer = {
    name: 'Daniel Esbella',
    position: 'iOS Developer',
    performance: 99,
    avatar: 'assets/avatar.jpg' // Placeholder path - replace with actual avatar path
  };

  constructor() { }

  ngOnInit(): void {
    // Calculate correct percentages based on counts
    this.recalculatePercentages();
  }

  recalculatePercentages(): void {
    const totalCount = this.employeeStatuses.reduce((sum, status) => sum + status.count, 0);
    this.employeeStatuses.forEach(status => {
      status.percentage = Math.round((status.count / totalCount) * 100);
    });
  }

  updateTimePeriod(period: string): void {
    console.log(`Switched to ${period}`);
    // This would fetch data for the selected time period in a real app
  }
}
