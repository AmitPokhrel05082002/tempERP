// employee-data.ts
export interface Employee {
  id: string;
  name: string;
  avatar: string;
  department: string;
  salary: string;
  payDay: string;
  status: 'paid' | 'unpaid';
  overtime: string;
  employeeType: string; // Fixed typo (changed from employeType)
}

export const EMPLOYEES: Employee[] = [
  {
    id: '00123',
    name: 'Jigme Gyeltshen',
    avatar: 'assets/images/user/images (2).png',
    department: 'finance',
    salary: 'Nu.2,500',
    payDay: '20 April 2020',
    status: 'paid',
    overtime: '5 hrs',
    employeeType: 'part-time' // Fixed spacing and made consistent
  },
  {
    id: '00124',
    name: 'Yeshi',
    avatar: 'assets/images/user/images (2).png',
    department: 'finance',
    salary: 'Nu.2,500',
    payDay: '15 June 2025',
    status: 'unpaid',
    overtime: '5 hrs',
    employeeType: 'contract'
  },
  {
    id: '00125',
    name: 'Jane Smith',
    avatar: 'assets/images/user/images (2).png',
    department: 'marketing',
    salary: 'Nu.3,000',
    payDay: '15 June 2025',
    status: 'paid',
    overtime: '2 hrs',
    employeeType: 'staff' // Fixed spacing
  },
  {
    id: '00125',
    name: 'Sharoj Adhikari',
    avatar: 'assets/images/user/images (2).png',
    department: 'marketing',
    salary: 'Nu.3,000',
    payDay: '15 June 2025',
    status: 'paid',
    overtime: '2 hrs',
    employeeType: 'staff' // Fixed spacing
  },
  {
    id: '00125',
    name: 'Kinley gyeltshen',
    avatar: 'assets/images/user/images (2).png',
    department: 'marketing',
    salary: 'Nu.3,000',
    payDay: '15 June 2025',
    status: 'unpaid',
    overtime: '2 hrs',
    employeeType: 'staff' // Fixed spacing
  },
  {
    id: '00125',
    name: 'Sonam Jigme',
    avatar: 'assets/images/user/images (2).png',
    department: 'marketing',
    salary: 'Nu.3,000',
    payDay: '15 June 2025',
    status: 'paid',
    overtime: '2 hrs',
    employeeType: 'contract' // Fixed spacing
  },
  {
    id: '00125',
    name: 'Choedra Gyamtsho',
    avatar: 'assets/images/user/images (2).png',
    department: 'marketing',
    salary: 'Nu.3,000',
    payDay: '15 June 2025',
    status: 'unpaid',
    overtime: '2 hrs',
    employeeType: 'others' // Fixed spacing
  },
];
