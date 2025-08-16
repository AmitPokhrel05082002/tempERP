import { Component, OnInit, TemplateRef, ViewChild, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { HttpClient } from '@angular/common/http';
import { finalize, debounceTime, distinctUntilChanged, takeUntil, catchError } from 'rxjs/operators';
import { Subject, of } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';
import Swal from 'sweetalert2';

interface TrainingProgram {
  programId: string;
  orgId: string;
  categoryId: string;
  programName: string;
  programCode: string;
  programType: string;
  deliveryMethod: string;
  durationHours: number;
  costPerParticipant: number;
  batchName: string;
  startDate: string;
  endDate: string;
  venue: string;
  maxSeats: number;
  seatsBooked: number;
  isActive: boolean;
  createdDate: string;
  modifiedDate: string;
  heldBy: string;
  // For backward compatibility
  location?: string;
  trainerName?: string;
  status?: string;
  description?: string;
}

interface TrainingNomination {
  id: string;
  programId: string;
  employeeId?: string;  // Made optional with ?
  employeeName: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  createdDate: string;
  modifiedDate: string;
  programName?: string;
  programCode?: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  trainerName?: string;
}

interface EmployeeResponse {
  empId: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  empCode: string;
  contacts: any[];
  addresses: any[];
  qualifications: any[];
  bankDetails: any[];
  history: any[];
}

interface Employee {
  employeeId: string;
  firstName: string;
  lastName: string;
  empCode: string;
  fullName: string;
}

interface TrainingNominationWithProgram extends TrainingNomination {
  program?: TrainingProgram;
}

@Component({
  selector: 'app-emp-nominations',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbModule
  ],
  templateUrl: './emp-nominations.component.html',
  styleUrls: ['./emp-nominations.component.scss']
})
export class EmpNominationsComponent implements OnInit {
  // Data
  nominations: TrainingNominationWithProgram[] = [];
  programs: TrainingProgram[] = [];
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  loadingEmployees = false;
  
  // Pagination
  currentPage = 1;
  pageSize = 5;
  itemsPerPage = 10;
  totalPages = 1;
  
  // UI State
  filteredNominations: TrainingNominationWithProgram[] = [];
  currentNomination: TrainingNominationWithProgram | null = null;
  searchQuery = '';
  
  // Date range for filtering
  dateRange: [Date | null, Date | null] = [null, null];
  
  // Observables
  private employeeSearchInput$ = new Subject<string>();
  private destroy$ = new Subject<void>();
  
  
  // API Configuration
  private apiUrl = environment.apiUrl;
  
  // UI State
  isEditMode = false;
  isLoading = false;
  errorMessage = '';
  form: FormGroup;
  showEmployeeDropdown = false;
  employeeSearchControl = new FormControl('');
  
  // Template Refs
  @ViewChild('trainingModal') private trainingModalRef!: TemplateRef<any>;
  @ViewChild('viewTrainingModal') private viewTrainingModalRef!: TemplateRef<any>;
  private modalRef: any;

  constructor(
    private fb: FormBuilder,
    private modalService: NgbModal,
    private http: HttpClient,
    private authService: AuthService // Add this

  ) {
    this.initializeForm();
  }

  // Define status options as a constant for reusability
  readonly NOMINATION_STATUS = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected'
  } as const;

  initializeForm(): void {
    this.form = this.fb.group({
      id: [''],
      employeeId: ['', [
        Validators.required,
        Validators.pattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')
      ]],
      programId: ['', [
        Validators.required,
        Validators.pattern('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')
      ]],
      justification: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(1000)
      ]],
      status: [this.NOMINATION_STATUS.PENDING, [
        Validators.required,
        Validators.pattern(`^(${Object.values(this.NOMINATION_STATUS).join('|')})$`)
      ]],
      employeeSearch: ['']
    });
  }
 canEdit(): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    return ['Admin', 'HR', 'Manager'].includes(user.roleName);
  }

  canDelete(): boolean {
    const user = this.authService.currentUserValue;
    if (!user) return false;
    return ['Admin', 'HR'].includes(user.roleName); // Only Admin and HR can delete
  }

  canAdd(): boolean {
    return this.canEdit(); // Same permissions as edit
  }

  canExport(): boolean {
    return this.canEdit(); // Same permissions as edit
  }
  
  ngOnInit(): void {
    this.initializeForm();
    this.loadNominations();
    this.loadPrograms();
    this.setupEmployeeSearch();
    this.loadEmployees();
    
    // Set up the employee search
    this.employeeSearchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      if (searchTerm) {
        this.filterEmployees(searchTerm);
        this.showEmployeeDropdown = true;
      } else {
        this.filteredEmployees = [...this.employees];
        this.showEmployeeDropdown = true;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupEmployeeSearch(): void {
    // Initialize with all employees
    this.filteredEmployees = [...this.employees];
  }

  private filterEmployees(searchTerm: string): void {
    if (!searchTerm) {
      this.filteredEmployees = [...this.employees];
      return;
    }
    
    const term = searchTerm.toLowerCase().trim();
    this.filteredEmployees = this.employees.filter(emp => {
      return (emp.fullName && emp.fullName.toLowerCase().includes(term)) ||
             (emp.empCode && emp.empCode.toLowerCase().includes(term));
    });
  }

  selectEmployee(employee: Employee): void {
    if (!employee) return;
    
    this.form.patchValue({
      employeeId: employee.employeeId,
      employeeSearch: employee.fullName
    });
    this.employeeSearchControl.setValue(employee.fullName);
    this.showEmployeeDropdown = false;
  }

  onEmployeeBlur(): void {
    // Small delay to allow click events to fire before hiding the dropdown
    setTimeout(() => {
      this.showEmployeeDropdown = false;
    }, 200);
  }

  loadPrograms(): void {
    this.isLoading = true;
    const url = `${this.apiUrl}/api/v1/training/programs`;
    // Fetching programs from API
    
    this.http.get<TrainingProgram[]>(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: (programs) => {
        // Programs loaded successfully
        this.programs = programs;
        this.loadNominations();
      },
      error: (error) => {
        console.error('Error loading programs:', error);
        Swal.fire({
          title: 'Error',
          text: 'Failed to load training programs. Please check your connection and try again.',
          icon: 'error'
        });
      }
    });
  }

  loadNominations(): void {
    this.isLoading = true;
    
    // If there are no programs, load them first
    if (this.programs.length === 0) {
      this.loadPrograms();
      return;
    }

    // Get all program IDs
    const programIds = this.programs.map(p => p.programId);
    
    // If there are no programs, set empty nominations and return
    if (programIds.length === 0) {
      this.nominations = [];
      this.filteredNominations = [];
      this.isLoading = false;
      return;
    }

    // Create an array of promises to fetch nominations for each program
    const nominationPromises = programIds.map(programId => 
      this.http.get<TrainingNomination[]>(`${this.apiUrl}/api/v1/training/nominations/program/${programId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }).pipe(
        catchError(error => {
          console.error(`Error loading nominations for program ${programId}:`, error);
          return of([]); // Return empty array on error to continue with other requests
        })
      ).toPromise()
    );

    // Process all nomination requests
    Promise.all(nominationPromises)
      .then(nominationArrays => {
        // Reset nominations array
        this.nominations = [];
        
        // Process each program's nominations
        nominationArrays.forEach((nominations, index) => {
          const programId = programIds[index];
          const program = this.programs.find(p => p.programId === programId);
          
          if (!program || !Array.isArray(nominations)) return;
          
          // Map nominations with program details
          const nominationsWithProgram = nominations.map(nomination => {
            // If we already have the employee name, use it
            const employeeName = nomination.employeeName || '';
            
            return {
              ...nomination,
              employeeId: nomination.employeeId || nomination.empId, // Handle different ID field names
              employeeName: employeeName,
              programName: program.programName,
              programCode: program.programCode,
              startDate: program.startDate,
              endDate: program.endDate,
              location: program.venue || program.location,
              trainerName: program.heldBy || program.trainerName,
              program: program
            };
          });
          
          this.nominations = [...this.nominations, ...nominationsWithProgram];
        });
        
        // Update filtered nominations and pagination
        this.filteredNominations = [...this.nominations];
        this.updateTotalPages();
        this.isLoading = false;
        
        // Fetch employee names for all nominations
        this.fetchEmployeeNamesForNominations();
      })
      .catch(error => {
        console.error('Error processing nominations:', error);
        this.isLoading = false;
        Swal.fire('Error', 'Failed to process training nominations', 'error');
      })
      .finally(() => {
        this.isLoading = false;
      });
  }

  // Fetch employee names for all nominations that don't have a name
  private fetchEmployeeNamesForNominations(): void {
    this.nominations.forEach(nomination => {
      if (nomination.employeeId && !nomination.employeeName) {
        this.fetchAndUpdateEmployeeName(nomination);
      }
    });
  }


  // Fetch employee by ID and update the nomination with the employee's name
  private fetchAndUpdateEmployeeName(nomination: TrainingNominationWithProgram): void {
    if (!nomination.employeeId) return;
    
    this.http.get<any>(`${this.apiUrl}/api/v1/employees/${nomination.employeeId}`).pipe(
      catchError(error => {
        console.error(`Error fetching employee ${nomination.employeeId}:`, error);
        return of(null);
      })
    ).subscribe(employeeData => {
      if (employeeData) {
        const emp = employeeData.employee || employeeData;
        const firstName = emp.firstName || emp.first_name || emp.empFirstName || emp.name?.first || '';
        const lastName = emp.lastName || emp.last_name || emp.empLastName || emp.name?.last || '';
        const middleName = (emp.middleName || emp.middle_name || emp.empMiddleName || emp.name?.middle || '').trim();
        
        const nameParts = [firstName];
        if (middleName) nameParts.push(middleName);
        nameParts.push(lastName);
        const fullName = nameParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        
        // Update the nomination with the employee's name
        const updatedNomination = this.nominations.find(n => n.id === nomination.id);
        if (updatedNomination) {
          updatedNomination.employeeName = fullName;
        }
      }
    });
  }

  loadEmployees(): void {
    this.loadingEmployees = true;
    const url = `${this.apiUrl}/api/v1/employees`;
    
    this.http.get<any>(url, { observe: 'response' }).pipe(
      finalize(() => this.loadingEmployees = false)
    ).subscribe({
      next: (httpResponse) => {
        const response = httpResponse.body;
        
        if (response == null) {
          console.error('Empty response received from server');
          Swal.fire('Error', 'Received empty response from server', 'error');
          return;
        }
        
        let employeesData = [];
        
        if (Array.isArray(response)) {
          employeesData = response;
        } else if (Array.isArray(response.data)) {
          employeesData = response.data;
        } else if (Array.isArray(response.items)) {
          employeesData = response.items;
        } else if (typeof response === 'object' && response !== null) {
          employeesData = Object.values(response).find(Array.isArray) || [];
        }
        
        if (!Array.isArray(employeesData)) {
          console.error('Unexpected response format. Expected an array but got:', typeof response);
          console.error('Full response:', response);
          Swal.fire('Error', 'Unexpected employee data format received', 'error');
          return;
        }
        
        this.employees = employeesData.map(item => {
          const emp = item.employee || item;
          
          const firstName = emp.firstName || emp.first_name || emp.empFirstName || emp.name?.first || '';
          const lastName = emp.lastName || emp.last_name || emp.empLastName || emp.name?.last || '';
          const middleName = (emp.middleName || emp.middle_name || emp.empMiddleName || emp.name?.middle || '').trim();
          
          const nameParts = [firstName];
          if (middleName) nameParts.push(middleName);
          nameParts.push(lastName);
          const fullName = nameParts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
          
          const employeeData = {
            employeeId: emp.empId || emp.id || emp.employeeId || emp._id || '',
            firstName: firstName,
            lastName: lastName,
            empCode: emp.empCode || emp.employeeCode || emp.empNo || emp.employeeNo || emp.code || '',
            fullName: fullName
          };
          
          return employeeData;
        }).filter(emp => {
          // Only include employees with at least a first or last name and an ID
          const isValid = (emp.firstName || emp.lastName) && emp.employeeId;
          if (!isValid) {
            console.warn('Filtering out invalid employee data (missing name or ID):', emp);
          } else {
            // Valid employee data processed
          }
          return isValid;
        }) as Employee[];
        
        // Successfully processed employees
        
        if (this.employees.length === 0) {
          console.warn('No valid employees found in the response');
          // Removed the Swal.fire call that was showing on page load
        }
        
        // Initialize filtered employees with all employees
        this.filteredEmployees = [...this.employees];
      },
      error: (error) => {
        console.error('Error loading employees:', error);
        
        // Log detailed error information
        if (error.error instanceof ErrorEvent) {
          // Client-side or network error
          console.error('Client-side error:', error.error.message);
        } else {
          // Backend returned an unsuccessful response code
          console.error(`Backend returned code ${error.status}, body was:`, error.error);
        }
        
        // Try to extract a meaningful error message
        let errorMessage = 'Failed to load employees';
        if (error.error && typeof error.error === 'object') {
          errorMessage = error.error.message || JSON.stringify(error.error);
        } else if (error.message) {
          errorMessage = error.message;
        }
        
        console.error('Full error details:', error);
        Swal.fire('Error', errorMessage, 'error');
      }
    });
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredNominations = [...this.nominations];
      this.updateTotalPages();
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredNominations = this.nominations.filter(nomination => 
      (nomination.programName?.toLowerCase().includes(query) ||
      nomination.programCode?.toLowerCase().includes(query) ||
      nomination.employeeName?.toLowerCase().includes(query) ||
      nomination.status?.toLowerCase().includes(query) ||
      nomination.location?.toLowerCase().includes(query)) ?? false
    );
    this.currentPage = 1;
    this.updateTotalPages();
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentNomination = null;
    this.form.reset({
      status: 'Pending',
      programId: '',
      employeeId: '',
      employeeName: '',
      justification: ''
    });
    this.modalRef = this.modalService.open(this.trainingModalRef, { size: 'lg' });
  }

  openEditModal(nomination: TrainingNominationWithProgram): void {
    this.isEditMode = true;
    this.currentNomination = { ...nomination };
    this.form.patchValue({
      employeeId: nomination.employeeId || '',
      employeeName: nomination.employeeName || '',
      programId: nomination.programId || '',
      justification: (nomination as any).justification || '',
      status: nomination.status || 'Pending',
      startDate: nomination.startDate ? new Date(nomination.startDate).toISOString().substring(0, 10) : '',
      endDate: nomination.endDate ? new Date(nomination.endDate).toISOString().substring(0, 10) : '',
      location: nomination.location || '',
      trainerName: nomination.trainerName || ''
    });
    this.modalRef = this.modalService.open(this.trainingModalRef, { size: 'lg' });
  }

  openViewModal(nomination: TrainingNominationWithProgram): void {
    this.currentNomination = nomination;
    this.modalRef = this.modalService.open(this.viewTrainingModalRef, { size: 'lg' });
  }

  saveNomination(): void {
    if (this.form.invalid) {
      return;
    }

    const formData = this.form.value;
    const apiUrl = environment.apiUrl;
    
    // Prepare the request body according to the API specification
    const nominationData = {
      empId: formData.employeeId,
      programId: formData.programId,
      justification: formData.justification || '',
      status: formData.status || 'Pending'
    };

    const request = this.isEditMode && this.currentNomination?.id
      ? this.http.put(`${apiUrl}/api/v1/training/nominations/${this.currentNomination.id}`, nominationData)
      : this.http.post(`${apiUrl}/api/v1/training/nominations`, nominationData);

    this.isLoading = true;
    request.pipe(
      finalize(() => this.isLoading = false)
    ).subscribe({
      next: () => {
        Swal.fire({
          title: 'Success!',
          text: `Training nomination ${this.isEditMode ? 'updated' : 'created'} successfully.`,
          icon: 'success',
          confirmButtonText: 'OK'
        });
        this.loadNominations();
        this.modalRef.close();
      },
      error: (error) => {
        console.error('Error saving training nomination:', error);
        Swal.fire({
          title: 'Error!',
          text: 'An error occurred while saving the training nomination. Please try again.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    });
  }

  confirmDelete(id: string): void {
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this nomination record!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it',
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
    }).then((result) => {
      if (result.isConfirmed) {
        this.deleteNomination(id);
      }
    });
  }

  private deleteNomination(id: string): void {
    this.isLoading = true;
    this.http.delete(`${environment.apiUrl}/api/v1/training/nominations/${id}`)
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: () => {
          Swal.fire({
            title: 'Deleted!',
            text: 'The nomination record has been deleted.',
            icon: 'success',
            confirmButtonText: 'OK'
          });
          this.loadNominations();
        },
        error: (error) => {
          console.error('Error deleting nomination record:', error);
          Swal.fire({
            title: 'Error!',
            text: 'An error occurred while deleting the nomination record. Please try again.',
            icon: 'error',
            confirmButtonText: 'OK'
          });
        }
      });
  }

  private showSuccess(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      timer: 2000,
      showConfirmButton: false
    });
  }

  private formatDateForInput(dateString: string): string {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  updateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredNominations.length / this.itemsPerPage) || 1;
  }

  get paginatedNominations(): TrainingNominationWithProgram[] {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredNominations.slice(start, start + this.itemsPerPage);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Approved':
        return 'bg-success';
      case 'Rejected':
        return 'bg-danger';
      default: // Pending
        return 'bg-secondary';
    }
  }
}