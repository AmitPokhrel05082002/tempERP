import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay, map } from 'rxjs/operators';

interface Employee {
  employeeId: string;
  name: string;
  division: string;
  date: string;
  shift: string;
  status: string;
  clockIn: string;
  clockOut: string;
  overTime: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmployeeDataService {
  private readonly API_DELAY = 300;

  private mockDepartments = ['All', 'IT Division', 'Content Division', 'Marketing', 'Finance'];

  private mockEmployees: Employee[] = [
    {
      employeeId: '00123',
      name: 'Jigme Gyeltshen',
      division: 'Finance',
      date: '11 March 2023',
      shift: 'Office Hours',
      status: 'Work From Home',
      clockIn: '08:00',
      clockOut: '17:00',
      overTime: '00:00'
    },
    {
      employeeId: '00124',
      name: 'Pema Wangchuk',
      division: 'IT Division',
      date: '11 March 2023',
      shift: 'Office Hours',
      status: 'Work From Office',
      clockIn: '08:00',
      clockOut: '17:00',
      overTime: '00:00'
    },
    {
      employeeId: '00125',
      name: 'Sonam Choden',
      division: 'Content Division',
      date: '11 March 2023',
      shift: 'Office Hours',
      status: 'Work From Home',
      clockIn: '08:00',
      clockOut: '17:00',
      overTime: '00:00'
    },
    {
      employeeId: '00126',
      name: 'Tashi Dorji',
      division: 'Marketing',
      date: '11 March 2023',
      shift: 'Office Hours',
      status: 'Work From Office',
      clockIn: '08:00',
      clockOut: '17:00',
      overTime: '00:00'
    },
    {
      employeeId: '00127',
      name: 'Karma Lhamo',
      division: 'Finance',
      date: '11 March 2023',
      shift: 'Office Hours',
      status: 'Work From Office',
      clockIn: '08:00',
      clockOut: '17:00',
      overTime: '00:00'
    }
  ];

  getEmployees(): Observable<Employee[]> {
    return of(this.mockEmployees).pipe(
      delay(this.API_DELAY),
      map(employees => [...employees].sort((a, b) => a.name.localeCompare(b.name)))
    );
  }

  getDepartments(): Observable<string[]> {
    return of(this.mockDepartments).pipe(
      delay(this.API_DELAY)
    );
  }

  // addEmployee(employee: Omit<Employee, 'employeeId'>): Observable<Employee> {
  //   const newEmployee = {
  //     ...employee,
  //     employeeId: this.generateEmployeeId()
  //   };
  //   this.mockEmployees.push(newEmployee);
  //   return of(newEmployee).pipe(delay(this.API_DELAY));
  // }

  // private generateEmployeeId(): string {
  //   const lastId = Math.max(...this.mockEmployees.map(e => parseInt(e.employeeId)));
  //   return (lastId + 1).toString().padStart(5, '0');
  // }
}