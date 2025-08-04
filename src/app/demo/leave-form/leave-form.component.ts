import { Component, EventEmitter, Output } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-leave-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, HttpClientModule],
  templateUrl: './leave-form.component.html',
  styleUrls: ['./leave-form.component.scss']
})
export class LeaveFormComponent {
  @Output() close = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<boolean>();
  
  leaveForm: FormGroup;
  isLoading = false;
  errorMessage: string | null = null;
  today = new Date().toISOString().split('T')[0];
  
  leaveTypes: { value: string; label: string }[] = [];

  constructor(
    private fb: FormBuilder, 
    private http: HttpClient,
    private router: Router
  ) {
    this.fetchLeaveTypes();
    this.leaveForm = this.fb.group({
      cid: ['', [Validators.required]],
      leaveName: ['', [Validators.required]],
      fromDate: ['', [Validators.required]],
      toDate: ['', [Validators.required]],
      reason: ['', [Validators.required, Validators.minLength(10)]],
      medicalCertificateAttached: [false],
      handoverDetails: ['', [Validators.required]]
    });
  }

  onSubmit() {
    if (this.leaveForm.invalid) {
      this.leaveForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    const formData = {
      cid: this.leaveForm.value.cid,
      leaveName: this.leaveForm.value.leaveName,
      fromDate: this.formatDate(this.leaveForm.value.fromDate),
      toDate: this.formatDate(this.leaveForm.value.toDate),
      reason: this.leaveForm.value.reason,
      medicalCertificateAttached: this.leaveForm.value.medicalCertificateAttached,
      handoverDetails: this.leaveForm.value.handoverDetails
    };

    console.log('Submitting leave request with data:', formData);

    this.http.post(`${environment.leaveApiUrl}/requestLeave`, formData, { observe: 'response' })
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          console.log('Leave request successful:', response);
          this.submitted.emit(true);
          this.closeForm();
        },
        error: (error) => {
          console.error('Error submitting leave request:', {
            status: error.status,
            statusText: error.statusText,
            error: error.error,
            message: error.message,
            url: error.url
          });
          
          if (error.status === 0) {
            this.errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.';
          } else if (error.status === 400) {
            this.errorMessage = error.error?.message || 'Invalid request. Please check your input and try again.';
          } else if (error.status === 401 || error.status === 403) {
            this.errorMessage = 'Authentication failed. Please log in again.';
          } else if (error.status === 404) {
            this.errorMessage = 'The requested resource was not found. Please contact support.';
          } else if (error.status >= 500) {
            this.errorMessage = 'A server error occurred. Please try again later or contact support.';
          } else {
            this.errorMessage = error.error?.message || 'Failed to submit leave request. Please try again.';
          }
        }
      });
  }

  closeForm() {
    this.close.emit();
  }

  private fetchLeaveTypes() {
    this.isLoading = true;
    this.http.get<any[]>(`${environment.leaveApiUrl}/getAllLeaveType`)
      .pipe(finalize(() => this.isLoading = false))
      .subscribe({
        next: (response) => {
          // Assuming the API returns an array of objects with at least 'name' or similar property
          this.leaveTypes = response.map(type => ({
            value: type.name || type.leaveTypeName || type.id,
            label: type.displayName || type.name || type.leaveTypeName || type.id
          }));
        },
        error: (error) => {
          console.error('Error fetching leave types:', error);
          // Fallback to default leave types if API call fails
          this.leaveTypes = [
            { value: 'Annual Leave', label: 'Annual Leave' },
            { value: 'Sick Leave', label: 'Sick Leave' },
            { value: 'Casual Leave', label: 'Casual Leave' },
            { value: 'Maternity Leave', label: 'Maternity Leave' },
            { value: 'Paternity Leave', label: 'Paternity Leave' },
          ];
        }
      });
  }

  navigateBack() {
    this.router.navigate(['/elmr']);
  }

  private formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }
}
