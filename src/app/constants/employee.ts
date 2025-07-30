export interface LeaveRequest {
  id: string;
  name: string;
  department: string;
  image: string;
  date: string;
  duration: string;
  status: 'Pending' | 'Approved' | 'Rejected' | string;
  requestedDate: Date;
  empCode?: string;
  reason?: string;
  leaveBalances?: {
    sickLeave: { used: number; total: number; remaining: number };
    vacation: { used: number; total: number; remaining: number };
    casualLeave: { used: number; total: number; remaining: number };
    maternityPaternity: { used: number; total: number; remaining: number };
  };
  leaveHistory?: LeaveHistoryItem[];
}

export interface LeaveHistoryItem {
  id: string;
  empId?: string;
  name: string;
  type: string;
  reason: string;
  submittedOn: string;
  appliedDate?: string;
  status: string;
  duration: string;
  startDate?: string;
  endDate?: string;
  empCode?: string;
  leaveId?: string;
  [key: string]: any;
}

export const LEAVE_REQUESTS: LeaveRequest[] = [
  {
    id: '00123',
    name: 'Jigme Gyeltshen',
    department: 'Finance',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'June 12 - June 13, 2025',
    duration: '5 days',
    status: 'Pending',
    requestedDate: new Date('2025-06-19')
  },
  {
    id: '00124',
    name: 'Sonam Dorji',
    department: 'IT Division',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'June 1 - June 5, 2024',
    duration: '5 days',
    status: 'Pending',
    requestedDate: new Date('2024-06-01')
  },
  {
    id: '00125',
    name: 'Pema Wangmo',
    department: 'Marketing',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'April 10 - April 14, 2024',
    duration: '5 days',
    status: 'Approved',
    requestedDate: new Date('2024-04-10')
  },
  {
    id: '00126',
    name: 'Karma Lhamo',
    department: 'Content Division',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'July 1 - July 3, 2024',
    duration: '3 days',
    status: 'Rejected',
    requestedDate: new Date('2024-07-01')
  },
  {
    id: '00127',
    name: 'Tashi Wangchuk',
    department: 'Finance',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'May 12 - May 13, 2024',
    duration: '2 days',
    status: 'Pending',
    requestedDate: new Date('2024-05-12')
  },
  {
    id: '00128',
    name: 'Gangku',
    department: 'Marketing',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'May 12 - May 13, 2024',
    duration: '2 days',
    status: 'Pending',
    requestedDate: new Date('2025-06-20')
  },
  {
    id: '00128',
    name: 'Yeshi Dorji',
    department: 'IT Division',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'May 12 - May 13, 2024',
    duration: '2 days',
    status: 'Pending',
    requestedDate: new Date('2025-06-20')
  },
  {
    id: '00128',
    name: 'Sonam Yoezer',
    department: 'Content Division',
    image: '../../../assets/images/user/avatar-1.jpg',
    date: 'May 12 - May 13, 2024',
    duration: '2 days',
    status: 'Pending',
    requestedDate: new Date('2025-06-20')
  }
];