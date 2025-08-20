import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
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
  
  // Additional fields from the JSON
  payrollId: string = '';
  
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
    // For demo purposes, we'll use the provided JSON directly
    // In a real application, you would use the API call
    this.processPayrollData({
      "firstName": "Sonam",
      "lastName": "Yoezer",
      "empId": "646bf427-4f97-4a4c-b30b-49a70604f3b7",
      "empCode": "80",
      "orgName": "NGN Technologies",
      "hireDate": "2025-05-11",
      "middleName": "Jigme",
      "nationality": "Bhutanese",
      "cidNumber": "11904001813",
      "netSalary": 41783.84,
      "allowance": 24000,
      "benefits": 0,
      "totalDeductions": 42216.16,
      "statutoryContributions": 7200,
      "paymentStatus": "PROCESSED",
      "paymentReference": "PAY-22D514A0",
      "grossSalary": 84000,
      "taxDeducted": 600,
      "otherDeduction": 0,
      "payrollId": "16548e70-e722-48d2-ba8e-8f522a7259b6",
      "salaryMonth": "2025-03",
      "gender": "Other",
      "tds": 600,
      "gpf": 1100,
      "lwp": 32516.16,
      "gis": 800,
      "basic": 65000
    });
    
    this.isLoading = false;
  }

  processPayrollData(data: any): void {
    // Check if data is valid
    if (!data || Object.keys(data).length === 0) {
      this.errorMessage = 'No payroll data found for this employee.';
      return;
    }
    
    // Map the API response fields to component properties
    this.orgName = data.orgName || '';
    this.lastName = data.lastName || '';
    this.firstName = data.firstName || '';
    this.middleName = data.middleName || '';
    this.empCode = data.empCode || '';
    this.cid = data.cidNumber || data.cid || '';
    this.nationality = data.nationality || '';
    this.gender = data.gender || '';
    this.hireDate = data.hireDate || '';
    
    // Salary information
    this.netSalary = data.netSalary || 0;
    this.salaryMonth = data.salaryMonth || '';
    this.grossSalary = data.grossSalary || 0;
    this.allowance = data.allowance || 0;
    this.benefits = data.benefits || 0;
    this.basicSalary = data.basic || data.basicSalary || 0;
    
    // Deductions
    this.totalDeductions = data.totalDeductions || 0;
    this.taxDeducted = data.taxDeducted || 0;
    this.statutoryContributions = data.statutoryContributions || 0;
    this.otherDeduction = data.otherDeduction || 0;
    this.gpf = data.gpf || 0;
    this.lwp = data.lwp || 0;
    this.gis = data.gis || 0;
    this.tds = data.tds || 0;
    
    // Payment information
    this.paymentStatus = data.paymentStatus || 'Pending';
    this.paymentReference = data.paymentReference || '';
    
    // Set default values for missing fields
    this.incentives = data.incentives || 0;
    this.overtime = data.overtime || 0;
    
    // Set payment date to end of salary month if available
    if (this.salaryMonth) {
      const [year, month] = this.salaryMonth.split('-');
      this.paymentDate = new Date(parseInt(year), parseInt(month), 0).toISOString();
    }
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
  
  // Add a retry method for better UX
  retry(): void {
    this.ngOnInit();
  }
  
  // Print the payslip
  printPayslip(): void {
    window.print();
  }
}