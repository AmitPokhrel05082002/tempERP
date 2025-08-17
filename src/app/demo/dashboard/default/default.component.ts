import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { DashboardComponent } from './Customizable-dashboard/pages/dashboard/dashboard.component';

interface Employee {
  id: number;
  name: string;
  position: string;
  avatar: string;
  status: string;
  department: string;
}

interface Project {
  id: string;
  name: string;
  team: string[];
  progress: number;
  status: 'Active' | 'Completed' | 'On Hold';
  deadline: string;
}

interface Attendance {
  id: number;
  name: string;
  avatar: string;
  department: string;
  checkIn: string;
  status: 'Present' | 'Late' | 'Absent';
}

Chart.register(...registerables);

@Component({
  selector: 'app-default',
  standalone: true,
  imports: [CommonModule, FormsModule, DashboardComponent],
  template: `
    <app-dashboard></app-dashboard>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      background-color: #f8fafc;
      min-height: 100vh;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .welcome-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .welcome-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .user-avatar {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      object-fit: cover;
    }

    .user-info h2 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #1e293b;
    }

    .user-info p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-size: 14px;
    }

    .welcome-actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-secondary {
      background: #ff6b35;
      color: white;
    }

    .btn-secondary:hover {
      background: #e55a2b;
    }

    .btn-outline {
      background: transparent;
      border: 1px solid #e2e8f0;
      color: #64748b;
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 12px;
    }

    .btn-link {
      background: none;
      border: none;
      color: #3b82f6;
      cursor: pointer;
      font-size: 14px;
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      transition: transform 0.2s;
    }

    .metric-card:hover {
      transform: translateY(-2px);
    }

    .metric-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      color: white;
    }

    .metric-icon.blue { background: #3b82f6; }
    .metric-icon.teal { background: #20b2aa; }
    .metric-icon.blue-light { background: #60a5fa; }
    .metric-icon.pink { background: #ec4899; }
    .metric-icon.purple { background: #8b5cf6; }
    .metric-icon.red { background: #ef4444; }
    .metric-icon.green { background: #10b981; }
    .metric-icon.dark { background: #374151; }

    .metric-icon::before {
      content: "📊";
    }

    .metric-content h3 {
      margin: 0;
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }

    .metric-content p {
      margin: 4px 0;
      color: #64748b;
      font-size: 14px;
    }

    .metric-change {
      font-size: 12px;
      font-weight: 500;
    }

    .metric-change.positive {
      color: #10b981;
    }

    .metric-change.negative {
      color: #ef4444;
    }

    .charts-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .employee-status-card {
      min-height: 500px;
    }

    .attendance-chart-card {
      min-height: 500px;
    }

    .employee-status-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .total-employee {
      text-align: center;
      padding: 20px 0;
    }

    .total-label {
      display: block;
      color: #64748b;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .total-number {
      font-size: 48px;
      font-weight: 700;
      color: #1e293b;
    }

    .status-bar {
      height: 12px;
      border-radius: 6px;
      display: flex;
      overflow: hidden;
      margin: 20px 0;
    }

    .status-segment.fulltime { background: #fbbf24; }
    .status-segment.contract { background: #1e40af; }
    .status-segment.probation { background: #ef4444; }
    .status-segment.wfh { background: #ec4899; }

    .status-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 20px 0;
    }

    .status-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .status-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .status-color {
      width: 12px;
      height: 12px;
      border-radius: 3px;
    }

    .status-color.fulltime-color { background: #fbbf24; }
    .status-color.contract-color { background: #1e40af; }
    .status-color.probation-color { background: #ef4444; }
    .status-color.wfh-color { background: #ec4899; }

    .status-text {
      font-size: 14px;
      color: #64748b;
    }

    .status-count {
      font-size: 24px;
      font-weight: 700;
      color: #1e293b;
    }

    .top-performer {
      margin-top: 24px;
    }

    .top-performer h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: #1e293b;
    }

    .performer-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      border: 2px solid #ff6b35;
      border-radius: 12px;
      background: #fff7ed;
    }

    .performer-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .performer-info {
      flex: 1;
    }

    .performer-info h5 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .performer-info p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .performance-score {
      text-align: right;
    }

    .performance-label {
      display: block;
      font-size: 12px;
      color: #64748b;
    }

    .performance-value {
      font-size: 20px;
      font-weight: 700;
      color: #ff6b35;
    }

    .view-all-btn {
      width: 100%;
      padding: 12px;
      background: transparent;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      color: #64748b;
      font-weight: 500;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.2s;
    }

    .view-all-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .attendance-chart-content {
      position: relative;
      height: 400px;
    }

    .attendance-chart-content canvas {
      max-height: 200px;
    }

    .attendance-stats {
      margin-top: 20px;
    }

    .attendance-total {
      text-align: center;
      margin-bottom: 20px;
    }

    .attendance-label {
      display: block;
      color: #64748b;
      font-size: 14px;
      margin-bottom: 8px;
    }

    .attendance-number {
      font-size: 48px;
      font-weight: 700;
      color: #1e293b;
    }

    .status-legend {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 20px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .legend-item > div {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
    }

    .legend-dot.present { background: #10b981; }
    .legend-dot.late { background: #1e40af; }
    .legend-dot.permission { background: #fbbf24; }
    .legend-dot.absent { background: #ef4444; }

    .legend-text {
      font-size: 14px;
      color: #64748b;
    }

    .legend-percent {
      font-weight: 600;
      color: #1e293b;
    }

    .total-absentees {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }

    .absentees-label {
      font-size: 14px;
      color: #64748b;
    }

    .absentees-avatars {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .absentee-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
    }

    .more-count {
      background: #e2e8f0;
      color: #64748b;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .view-details-btn {
      background: none;
      border: none;
      color: #ff6b35;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
    }

    .btn-filter {
      background: #f1f5f9;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #64748b;
      cursor: pointer;
    }

    .btn-filter.active {
      background: #3b82f6;
      color: white;
    }

    .time-filter {
      display: flex;
      gap: 8px;
    }

    .department-chart-section {
      margin-bottom: 24px;
    }

    .department-chart-section .chart-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      height: 300px;
    }

    .chart-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .chart-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .attendance-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }

    .section-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .attendance-grid {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .attendance-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .employee-avatar,
    .applicant-avatar,
    .birthday-avatar,
    .activity-avatar,
    .stat-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .attendance-info {
      flex: 1;
    }

    .attendance-info h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .attendance-info p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .attendance-time {
      color: #64748b;
      font-size: 14px;
    }

    .status-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .status-present { background: #dcfce7; color: #166534; }
    .status-late { background: #fef3c7; color: #92400e; }
    .status-absent { background: #fee2e2; color: #dc2626; }
    .status-active { background: #dcfce7; color: #166534; }
    .status-completed { background: #dcfce7; color: #166534; }
    .status-on-hold { background: #fef3c7; color: #92400e; }

    .bottom-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 24px;
      margin-bottom: 24px;
    }

    .section-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .applicants-list,
    .employees-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .applicant-item,
    .employee-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .applicant-info,
    .employee-info {
      flex: 1;
    }

    .applicant-info h4,
    .employee-info h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .applicant-info p,
    .employee-info p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .applicant-actions {
      display: flex;
      gap: 8px;
    }

    .department-badge {
      background: #e0f2fe;
      color: #0277bd;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .sales-chart {
      height: 200px;
    }

    .sales-bars {
      display: flex;
      align-items: end;
      gap: 8px;
      height: 150px;
      margin-bottom: 16px;
    }

    .sales-bar {
      flex: 1;
      border-radius: 4px 4px 0 0;
      min-height: 20px;
    }

    .sales-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #64748b;
    }

    .projects-section {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 24px;
      margin-bottom: 24px;
    }

    .projects-table {
      overflow-x: auto;
    }

    .projects-table table {
      width: 100%;
      border-collapse: collapse;
    }

    .projects-table th {
      text-align: left;
      padding: 12px 16px;
      color: #64748b;
      font-weight: 500;
      font-size: 14px;
      border-bottom: 2px solid #f1f5f9;
    }

    .projects-table td {
      padding: 16px;
      border-bottom: 1px solid #f1f5f9;
      font-size: 14px;
    }

    .team-avatars {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .team-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      object-fit: cover;
    }

    .team-count {
      background: #e2e8f0;
      color: #64748b;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
    }

    .priority-badge {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
    }

    .priority-high { background: #fee2e2; color: #dc2626; }
    .priority-medium { background: #fef3c7; color: #92400e; }
    .priority-low { background: #dcfce7; color: #166534; }

    .progress-bar {
      width: 100px;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
      display: inline-block;
      margin-right: 8px;
    }

    .progress-fill {
      height: 100%;
      background: #10b981;
      transition: width 0.3s;
    }

    .progress-text {
      font-size: 12px;
      color: #64748b;
    }

    .table-stats {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .stat-info {
      flex: 1;
    }

    .stat-info h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .stat-info p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .stat-value {
      font-weight: 600;
      color: #1e293b;
    }

    .schedule-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .schedule-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .schedule-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 0;
      border-bottom: 1px solid #f1f5f9;
    }

    .schedule-time {
      min-width: 80px;
    }

    .schedule-time .time {
      display: block;
      font-weight: 600;
      color: #1e293b;
    }

    .schedule-time .date {
      font-size: 12px;
      color: #64748b;
    }

    .schedule-content {
      flex: 1;
    }

    .schedule-content h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .schedule-content p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .activities-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }

    .activities-list,
    .birthdays-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .activity-item,
    .birthday-item {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .activity-content,
    .birthday-info {
      flex: 1;
    }

    .activity-content p {
      margin: 0;
      font-size: 14px;
      color: #1e293b;
    }

    .activity-time {
      font-size: 12px;
      color: #64748b;
    }

    .birthday-info h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: #1e293b;
    }

    .birthday-info p {
      margin: 2px 0 0 0;
      font-size: 12px;
      color: #64748b;
    }

    .birthday-date {
      font-size: 12px;
      color: #64748b;
      margin-right: 12px;
    }

    @media (max-width: 768px) {
      .charts-section,
      .activities-section,
      .projects-section {
        grid-template-columns: 1fr;
      }

      .welcome-content {
        flex-direction: column;
        gap: 16px;
        align-items: flex-start;
      }

      .metrics-grid {
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      }
    }
  `]
})
export class DefaultComponent implements OnInit, AfterViewInit {
  @ViewChild('attendanceChart', { static: false }) attendanceChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('departmentChart', { static: false }) departmentChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('salesChart', { static: false }) salesChartRef!: ElementRef<HTMLCanvasElement>;

  private attendanceChart!: Chart;
  private departmentChart!: Chart;
  private salesChart!: Chart;
  attendanceData: Attendance[] = [
    {
      id: 1,
      name: 'Sarah Adams',
      avatar: 'https://via.placeholder.com/40',
      department: 'Development',
      checkIn: '09:00 AM',
      status: 'Present'
    },
    {
      id: 2,
      name: 'John Miller',
      avatar: 'https://via.placeholder.com/40',
      department: 'Design',
      checkIn: '09:15 AM',
      status: 'Late'
    },
    {
      id: 3,
      name: 'Emily Chen',
      avatar: 'https://via.placeholder.com/40',
      department: 'Marketing',
      checkIn: 'Not checked in',
      status: 'Absent'
    },
    {
      id: 4,
      name: 'Michael Johnson',
      avatar: 'https://via.placeholder.com/40',
      department: 'Sales',
      checkIn: '08:45 AM',
      status: 'Present'
    }
  ];

  jobApplicants = [
    {
      name: 'John Anderson',
      position: 'Frontend Developer',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      name: 'Sarah Wilson',
      position: 'UI/UX Designer',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      name: 'David Brown',
      position: 'Backend Developer',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      name: 'Lisa Garcia',
      position: 'Product Manager',
      avatar: 'https://via.placeholder.com/40'
    }
  ];

  employees: Employee[] = [
    {
      id: 1,
      name: 'Anthony Lewis',
      position: 'Frontend Developer',
      avatar: 'https://via.placeholder.com/40',
      status: 'Active',
      department: 'Development'
    },
    {
      id: 2,
      name: 'Brian Johnson',
      position: 'UI Designer',
      avatar: 'https://via.placeholder.com/40',
      status: 'Active',
      department: 'Design'
    },
    {
      id: 3,
      name: 'Catherine Miller',
      position: 'Product Manager',
      avatar: 'https://via.placeholder.com/40',
      status: 'Active',
      department: 'Management'
    },
    {
      id: 4,
      name: 'Daniel Wilson',
      position: 'Backend Developer',
      avatar: 'https://via.placeholder.com/40',
      status: 'Active',
      department: 'Development'
    }
  ];

  salesData = [
    { value: 40, color: '#ff6b35' },
    { value: 60, color: '#ff6b35' },
    { value: 30, color: '#ff6b35' },
    { value: 80, color: '#ff6b35' },
    { value: 50, color: '#ff6b35' },
    { value: 70, color: '#ff6b35' },
    { value: 90, color: '#ff6b35' },
    { value: 45, color: '#ff6b35' },
    { value: 65, color: '#ff6b35' },
    { value: 55, color: '#ff6b35' }
  ];

  salesLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

  projects: Project[] = [
    {
      id: 'PRJ-001',
      name: 'Office Management App',
      team: ['https://via.placeholder.com/24', 'https://via.placeholder.com/24', 'https://via.placeholder.com/24'],
      progress: 75,
      status: 'Active',
      deadline: '2024-03-15'
    },
    {
      id: 'PRJ-002',
      name: 'Client Management',
      team: ['https://via.placeholder.com/24', 'https://via.placeholder.com/24'],
      progress: 90,
      status: 'Completed',
      deadline: '2024-02-28'
    },
    {
      id: 'PRJ-003',
      name: 'Task & Time Tracker',
      team: ['https://via.placeholder.com/24', 'https://via.placeholder.com/24', 'https://via.placeholder.com/24', 'https://via.placeholder.com/24'],
      progress: 45,
      status: 'On Hold',
      deadline: '2024-04-10'
    },
    {
      id: 'PRJ-004',
      name: 'Video Calling Website',
      team: ['https://via.placeholder.com/24', 'https://via.placeholder.com/24'],
      progress: 60,
      status: 'Active',
      deadline: '2024-03-30'
    }
  ];

  tableStats = [
    {
      name: 'Anthony Watson',
      role: 'CEO',
      avatar: 'https://via.placeholder.com/40',
      value: '$2,500'
    },
    {
      name: 'Maria Garcia',
      role: 'Manager',
      avatar: 'https://via.placeholder.com/40',
      value: '$1,800'
    },
    {
      name: 'David Kim',
      role: 'Developer',
      avatar: 'https://via.placeholder.com/40',
      value: '$1,200'
    },
    {
      name: 'Sarah Johnson',
      role: 'Designer',
      avatar: 'https://via.placeholder.com/40',
      value: '$1,100'
    }
  ];

  scheduleItems = [
    {
      time: '09:00',
      date: 'Today',
      title: 'Interview Candidates - UI/UX Designer',
      description: 'Review portfolios and conduct interviews',
      status: 'upcoming'
    },
    {
      time: '11:30',
      date: 'Today',
      title: 'Team Standup Meeting',
      description: 'Daily progress review with development team',
      status: 'in-progress'
    },
    {
      time: '14:00',
      date: 'Today',
      title: 'Performance Review',
      description: 'Quarterly performance evaluation session',
      status: 'upcoming'
    }
  ];

  recentActivities = [
    {
      user: 'John Doe',
      action: 'submitted leave application',
      time: '2 hours ago',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      user: 'Jane Smith',
      action: 'completed project milestone',
      time: '4 hours ago',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      user: 'Mike Johnson',
      action: 'updated profile information',
      time: '6 hours ago',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      user: 'Sarah Davis',
      action: 'joined Development team',
      time: '1 day ago',
      avatar: 'https://via.placeholder.com/40'
    }
  ];

  birthdays = [
    {
      name: 'Michael Brown',
      position: 'Software Engineer',
      date: 'Today',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      name: 'Emma Wilson',
      position: 'Product Designer',
      date: 'Tomorrow',
      avatar: 'https://via.placeholder.com/40'
    },
    {
      name: 'James Miller',
      position: 'Data Analyst',
      date: 'Aug 18',
      avatar: 'https://via.placeholder.com/40'
    }
  ];

  ngOnInit() {
    // Component initialization
  }

  ngAfterViewInit() {
    setTimeout(() => {
      this.createAttendanceChart();
      this.createDepartmentChart();
      // this.createSalesChart();
    }, 100);
  }

  createAttendanceChart() {
    const ctx = this.attendanceChartRef.nativeElement.getContext('2d');

    this.attendanceChart = new Chart(ctx!, {
      type: 'doughnut',
      data: {
        labels: ['Present', 'Late', 'Permission', 'Absent'],
        datasets: [{
          data: [59, 21, 2, 15],
          backgroundColor: [
            '#10b981', // Green for Present
            '#1e40af', // Dark blue for Late
            '#fbbf24', // Yellow for Permission
            '#ef4444'  // Red for Absent
          ],
          borderWidth: 0,
          // cutout: '70%'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.label + ': ' + context.parsed + '%';
              }
            }
          }
        }
      }
    });
  }

  createDepartmentChart() {
    const ctx = this.departmentChartRef.nativeElement.getContext('2d');

    this.departmentChart = new Chart(ctx!, {
      type: 'bar',
      data: {
        labels: ['Development', 'Design', 'Marketing', 'Sales', 'HR', 'Finance'],
        datasets: [{
          data: [45, 30, 25, 35, 28, 40],
          backgroundColor: '#ff6b35',
          borderRadius: 4,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              display: false
            },
            ticks: {
              display: false
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              color: '#64748b',
              font: {
                size: 12
              }
            }
          }
        }
      }
    });
  }

  getPriorityClass(progress: number): string {
    if (progress >= 80) return 'low';
    if (progress >= 50) return 'medium';
    return 'high';
  }

  getPriorityText(progress: number): string {
    if (progress >= 80) return 'Low';
    if (progress >= 50) return 'Medium';
    return 'High';
  }
}
