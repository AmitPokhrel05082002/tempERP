import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CommonModule } from '@angular/common';
import { AuthService } from 'src/app/core/services/auth.service';

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
            
            if (this.isAdmin && !this.employeeId) {
                console.error('No employee ID found in route parameters');
                this.errorMessage = 'Employee information could not be loaded';
                this.isLoading = false;
                setTimeout(() => this.router.navigate(['/pay-roll']), 3000);
                return;
            }

            if (this.isAdmin) {
                this.loadSalaryDetailsAdmin();
            } else {
                this.loadSalaryDetails();
            }
        });
    }

    // For employee view (gets own salary details)
    loadSalaryDetails(): void {
        this.isLoading = true;
        this.errorMessage = null;
        
        // Endpoint for employee's own salary details (no employeeId needed)
        const url = `${environment.payrollApiUrl}/api/payRoll/salary-details/${this.employeeId}`;
        
        this.http.get<any[]>(url).subscribe({
            next: (data) => {
                this.salaryDetails = data;
                
                if (data.length > 0) {
                    this.employeeInfo = {
                        name: `${data[0].firstName || ''} ${data[0].lastName || ''}`.trim(),
                        empCode: data[0].empCode || 'N/A',
                        department: data[0].departmentName || 
                                   data[0].department || 
                                   data[0].deptName || 
                                   data[0].dept || 
                                   'N/A'
                    };
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading salary details:', err);
                this.errorMessage = 'Failed to load salary details. Please try again later.';
                this.isLoading = false;
            }
        });
    }

    // For admin view (gets details for specific employee)
    loadSalaryDetailsAdmin(): void {
        this.isLoading = true;
        this.errorMessage = null;
        
        if (!this.employeeId) {
            this.errorMessage = 'Invalid employee ID';
            this.isLoading = false;
            return;
        }

        const url = `${environment.payrollApiUrl}/api/payRoll/salary-details/${this.employeeId}`;
        
        this.http.get<any[]>(url).subscribe({
            next: (data) => {
                this.salaryDetails = data;
                
                if (data.length > 0) {
                    this.employeeInfo = {
                        name: `${data[0].firstName || ''} ${data[0].lastName || ''}`.trim(),
                        empCode: data[0].empCode || 'N/A',
                        department: data[0].departmentName || 
                                   data[0].department || 
                                   data[0].deptName || 
                                   data[0].dept || 
                                   'N/A'
                    };
                }
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error loading salary details:', err);
                this.errorMessage = 'Failed to load salary details. Please try again later.';
                this.isLoading = false;
            }
        });
    }

    // ... rest of your helper methods remain the same
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