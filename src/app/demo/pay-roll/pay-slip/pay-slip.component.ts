// payslip.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-pay-slip',
  templateUrl: './pay-slip.component.html',
  styleUrls: ['./pay-slip.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule]
})
export class PaySlipComponent implements OnInit {
  // Employee information
  orgName: string = '';
  lastName: string = '';
  firstName: string = '';
  middleName: string = '';
  empId: string = '';
  empCode: string = '';
  designation: string = '';
  department: string = '';
  cid: string = '';
  nationality: string = '';
  gender: string = '';
  hireDate: string = '';
  
  // Salary information
  netSalary: number = 0;
  salaryMonth: string = '';
  grossSalary: number = 0;
  allowance: number = 0;
  benefits: number = 0;
  incentives: number = 0;
  overtime: number = 0;
  basicSalary: number = 0;
  
  // Deductions
  totalDeductions: number = 0;
  taxDeducted: number = 0;
  statutoryContributions: number = 0;
  otherDeduction: number = 0;
  gpf: number = 0;
  lwp: number = 0;
  gis: number = 0;
  tds: number = 0;
  
  // Payment information
  paymentStatus: string = '';
  paymentReference: string = '';
  paymentDate: string = new Date().toISOString();
  
  generatedDate: Date = new Date();
  isLoading: boolean = true;
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) { }

 ngOnInit(): void {
  this.route.paramMap.subscribe(params => {
    console.log('Route parameters:', params);
    
    const empId = params.get('empId');
    
    // Validate employee ID
    if (!empId || empId === 'undefined' || empId === 'null') {
      this.errorMessage = 'Invalid employee ID provided.';
      this.isLoading = false;
      console.error('Invalid employee ID:', empId);
      return;
    }
    
    const year = this.route.snapshot.queryParamMap.get('year');
    const month = this.route.snapshot.queryParamMap.get('month');
    
    console.log('Query parameters - year:', year, 'month:', month);
    
    this.empId = empId;
    this.fetchPayrollData(empId, year, month);
  });
}

// In pay-slip.component.ts
fetchPayrollData(empId: string, year: string, month: string): void {
  this.isLoading = true;
  this.errorMessage = '';
  
  // Use current year/month if not provided
  const currentDate = new Date();
  const queryYear = year || currentDate.getFullYear().toString();
  const queryMonth = month || (currentDate.getMonth() + 1).toString().padStart(2, '0');
  
  console.log('Fetching payroll for:', { empId, year: queryYear, month: queryMonth });

  // Correct URL construction - empId should be a query parameter, not path parameter
  const payrollApiUrl = `${environment.payrollApiUrl}/api/payRoll/viewEachEmployeePayroll`;
  console.log('Full API URL:', payrollApiUrl);
  
  // Add ALL parameters as query parameters
  const params = new HttpParams()
    .set('empId', empId)  // Add empId as query parameter
    .set('year', queryYear)
    .set('month', queryMonth);

  this.http.get<any>(payrollApiUrl, { params }).subscribe({
    next: (data) => {
      console.log('Payroll data received:', data);
      this.processPayrollData(data);
      this.isLoading = false;
    },
    error: (err: HttpErrorResponse) => {
      console.error('Error fetching payroll data:', err);
      console.error('Error details:', {
        url: err.url,
        status: err.status,
        statusText: err.statusText,
        error: err.error
      });
      
      if (err.status === 404) {
        this.errorMessage = `No payroll data found for employee ${empId} for ${this.formatMonthYear(queryYear + '-' + queryMonth)}.`;
      } else if (err.status === 500) {
        this.errorMessage = 'Server error occurred while fetching payroll data.';
      } else {
        this.errorMessage = 'Failed to load payslip data. Please try again.';
      }
      
      this.isLoading = false;
    }
  });
}

  processPayrollData(data: any): void {
  // Check if data is valid
  if (!data || (Array.isArray(data) && data.length === 0)) {
    this.errorMessage = 'No payroll data found for this employee and period.';
    this.isLoading = false;
    return;
  }

  // Handle case where data might be an array (take first element)
  const payrollData = Array.isArray(data) ? data[0] : data;

  // Check if the response contains actual data or just a message
  if (payrollData.message && !payrollData.empId) {
    this.errorMessage = payrollData.message || 'No payroll data available.';
    this.isLoading = false;
    return;
  }

  console.log('Processing payroll data:', payrollData);
    // Map the API response fields to component properties
    this.orgName = payrollData.orgName || payrollData.organizationName || '';
    this.lastName = payrollData.lastName || '';
    this.firstName = payrollData.firstName || '';
    this.middleName = payrollData.middleName || '';
    this.empCode = payrollData.empCode || payrollData.employeeCode || '';
    this.designation = payrollData.designation || payrollData.position || '';
    this.department = payrollData.department || payrollData.departmentName || '';
    this.cid = payrollData.cidNumber || payrollData.cid || '';
    this.nationality = payrollData.nationality || '';
    this.gender = payrollData.gender || '';
    this.hireDate = payrollData.hireDate || payrollData.dateOfJoining || '';
    
    // Salary information
    this.netSalary = payrollData.netSalary || 0;
    this.salaryMonth = payrollData.salaryMonth || '';
    this.grossSalary = payrollData.grossSalary || 0;
    this.allowance = payrollData.allowance || 0;
    this.benefits = payrollData.benefits || 0;
    this.basicSalary = payrollData.basic || payrollData.basicSalary || 0;
    
    // Deductions
    this.totalDeductions = payrollData.totalDeductions || 0;
    this.taxDeducted = payrollData.taxDeducted || 0;
    this.statutoryContributions = payrollData.statutoryContributions || 0;
    this.otherDeduction = payrollData.otherDeduction || 0;
    this.gpf = payrollData.gpf || 0;
    this.lwp = payrollData.lwp || 0;
    this.gis = payrollData.gis || 0;
    this.tds = payrollData.tds || 0;
    
    // Additional fields that might be in the response
    this.incentives = payrollData.incentives || 0;
    this.overtime = payrollData.overtime || 0;
    
    // Payment information
    this.paymentStatus = payrollData.paymentStatus || 'Pending';
    this.paymentReference = payrollData.paymentReference || '';
    
    // Set payment date to end of salary month if available
    if (this.salaryMonth) {
      try {
        const [year, month] = this.salaryMonth.split('-');
        this.paymentDate = new Date(parseInt(year), parseInt(month), 0).toISOString();
      } catch (error) {
        this.paymentDate = new Date().toISOString();
      }
    }

    console.log('Processed data:', {
      orgName: this.orgName,
      employee: `${this.firstName} ${this.lastName}`,
      netSalary: this.netSalary,
      salaryMonth: this.salaryMonth
    });
  }

  formatCurrency(amount: number): string {
    return amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatMonthYear(monthYear: string): string {
    if (!monthYear) return 'N/A';
    
    try {
      const [year, month] = monthYear.split('-');
      const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      return `${monthNames[parseInt(month) - 1]} ${year}`;
    } catch (error) {
      return monthYear;
    }
  }

  formatDate(dateString: string): string {
    if (!dateString) return 'N/A';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  goBack(): void {
    this.router.navigate(['/pay-roll']);
  }
  
  retry(): void {
    this.ngOnInit();
  }
  
  printPayslip(): void {
    window.print();
  }
}