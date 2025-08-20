// pay-roll-detail.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/core/services/auth.service';

// Define the User interface if it doesn't exist
interface User {
  empId?: string;
  id?: string;
  username?: string;
  // Add other properties as needed
}

@Component({
    standalone: true,
    imports: [CommonModule],
    selector: 'app-pay-roll-detail',
    templateUrl: './pay-roll-detail.component.html',
    styleUrls: ['./pay-roll-detail.component.scss']
})
export class PayRollDetailComponent implements OnInit {
    employeeId: string | null = null;
    salaryDetails: any[] = [];
    employeeInfo: any = {
        name: '',
        empCode: '',
        department: ''
    };
    isLoading: boolean = true;
    errorMessage: string | null = null;
    isAdmin: boolean = false;

    earningCodes = ['BASIC', 'HRA', 'DA', 'TA'];
    deductionCodes = ['PF', 'TDS', 'GIS', 'GPF'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private http: HttpClient,
        private authService: AuthService
    ) { }

    ngOnInit(): void {
        this.isAdmin = this.authService.isAdmin();
        
        this.route.paramMap.subscribe(params => {
            this.employeeId = params.get('id');
            this.loadSalaryDetails();
        });
    }

    loadSalaryDetails(): void {
        this.isLoading = true;
        this.errorMessage = null;
        
        if (this.isAdmin) {
            if (!this.employeeId) {
                this.errorMessage = 'Employee ID is required for admin view';
                this.isLoading = false;
                return;
            }
            this.fetchSalaryDetails(this.employeeId);
        } else {
            this.getCurrentUserEmployeeId();
        }
    }

    private getCurrentUserEmployeeId(): void {
        const currentUser = this.authService.getCurrentUser() as User;
        
        if (currentUser && currentUser.empId) {
            this.fetchSalaryDetails(currentUser.empId);
        } else if (currentUser && currentUser.id) {
            this.fetchSalaryDetails(currentUser.id);
        } else if (currentUser && currentUser.username) {
            this.fetchSalaryDetails(currentUser.username);
        } else {
            this.getEmployeeIdFromToken();
        }
    }

    private getEmployeeIdFromToken(): void {
        try {
            const token = localStorage.getItem('access_token') || this.authService.getToken();
            
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1]));
                if (payload.employeeId) {
                    this.fetchSalaryDetails(payload.employeeId);
                } else if (payload.sub) {
                    this.fetchSalaryDetails(payload.sub);
                } else if (payload.preferred_username) {
                    this.fetchSalaryDetails(payload.preferred_username);
                } else {
                    this.handleNoEmployeeId();
                }
            } else {
                this.handleNoEmployeeId();
            }
        } catch (error) {
            console.error('Error decoding token:', error);
            this.handleNoEmployeeId();
        }
    }

    private handleNoEmployeeId(): void {
        this.errorMessage = 'Could not determine employee ID. Please contact administrator.';
        this.isLoading = false;
    }

    private fetchSalaryDetails(empId: string): void {
        const url = `${environment.payrollApiUrl}/api/payRoll/salary-details/${empId}`;
        
        console.log('Fetching salary details from:', url);
        
        this.http.get<any[]>(url).subscribe({
            next: (data) => {
                this.processSalaryData(data);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading salary details:', err);
                this.handleError(err);
                this.isLoading = false;
                
                if (err.status === 400) {
                    this.tryAlternativeIdFormat(empId);
                }
            }
        });
    }

    private tryAlternativeIdFormat(empId: string): void {
        const cleanId = empId.replace(/[^a-zA-Z0-9]/g, '');
        const alternativeUrl = `${environment.payrollApiUrl}/api/payRoll/salary-details/${cleanId}`;
        
        console.log('Trying alternative URL:', alternativeUrl);
        
        this.http.get<any[]>(alternativeUrl).subscribe({
            next: (data) => {
                this.processSalaryData(data);
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error with alternative ID format:', err);
            }
        });
    }

    private processSalaryData(data: any[]): void {
        this.salaryDetails = data;
        
        if (data && data.length > 0) {
            this.employeeInfo = {
                name: `${data[0].firstName || ''} ${data[0].lastName || ''}`.trim(),
                empCode: data[0].empCode || 'N/A',
                department: this.getDepartmentName(data[0])
            };
        } else {
            this.errorMessage = 'No salary details found';
        }
    }

    private getDepartmentName(data: any): string {
        const departmentFields = ['departmentName', 'department', 'deptName', 'dept'];
        for (const field of departmentFields) {
            if (data[field]) return data[field];
        }
        return 'N/A';
    }

    private handleError(err: any): void {
        console.log('Error details:', err);
        
        if (err.status === 400) {
            this.errorMessage = 'Invalid request. The employee ID might be incorrect or malformed.';
        } else if (err.status === 404) {
            this.errorMessage = 'Salary details not found for this employee.';
        } else if (err.status === 403) {
            this.errorMessage = 'Access denied. You may not have permission to view these details.';
        } else if (err.status === 0) {
            this.errorMessage = 'Network error. Please check your connection.';
        } else {
            this.errorMessage = 'Failed to load salary details. Please try again later.';
        }
    }

    isEarning(componentCode: string): boolean {
        return this.earningCodes.includes(componentCode);
    }

    isDeduction(componentCode: string): boolean {
        return this.deductionCodes.includes(componentCode);
    }

    getTotalEarnings(): number {
        return this.salaryDetails
            .filter(d => this.isEarning(d.componentCode))
            .reduce((sum, d) => sum + (d.componentValue || 0), 0);
    }

    getTotalDeductions(): number {
        return this.salaryDetails
            .filter(d => this.isDeduction(d.componentCode))
            .reduce((sum, d) => sum + (d.componentValue || 0), 0);
    }

    getNetSalary(): number {
        return this.getTotalEarnings() - this.getTotalDeductions();
    }
}