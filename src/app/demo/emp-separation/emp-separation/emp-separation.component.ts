import { Component, OnInit, TemplateRef, ViewChild, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin, of, Subject, Subscription, throwError } from 'rxjs';
import { tap, catchError, debounceTime, distinctUntilChanged, switchMap, takeUntil, map } from 'rxjs/operators';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { SeparationService, Separation, SeparationRequest, SeparationUpdateRequest, Employee, SeparationType, DateRangeFilter } from '../../../services/seperation.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-emp-separation',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbModule
  ],
  templateUrl: './emp-separation.component.html',
  styleUrls: ['./emp-separation.component.scss']
})
export class EmpSeparationComponent implements OnInit, OnDestroy {
  separations: Separation[] = [];
  filteredSeparations: Separation[] = [];
  separationTypes: SeparationType[] = [];
  separationTypesMap: { [key: string]: SeparationType } = {};
  currentSeparation: Separation | null = null;
  currentUser: any = null;
  isLoading = false;
  employeeMap: { [key: string]: Employee } = {};
  departmentMap: { [key: string]: string } = {};

  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  isLoadingEmployees = false;
  selectedEmployee: Employee | null = null;
  showEmployeeDropdown = false;
  employeeSearchSubject = new Subject<string>();
  selectedEmployeeIndex = -1;

  currentUserEmployee: Employee | null = null;

  form: FormGroup;
  isEditMode = false;

  searchQuery = '';
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  errorMessage = '';
  statusForm: FormGroup;

  // NEW: Date range filter properties
  dateFilterForm: FormGroup;
  showDateFilter = false;
  isDateFiltering = false;
  dateFilterApplied = false;

  // Role-based access properties
  canDeleteSeparations = false;
  canEditAllSeparations = false;
  canViewAllSeparations = false;
  isCurrentUserEmployee = false;
  canCreateSeparationForOthers = false;

  statusOptions = [
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Rejected', label: 'Rejected' },
    { value: 'Completed', label: 'Completed' }
  ];

  @ViewChild('separationModal', { static: true }) separationModalTemplate!: TemplateRef<any>;
  @ViewChild('viewSeparationModal', { static: true }) viewSeparationModalTemplate!: TemplateRef<any>;
  @ViewChild('statusModal', { static: true }) statusModalTemplate!: TemplateRef<any>;
  @ViewChild('dateFilterModal', { static: true }) dateFilterModalTemplate!: TemplateRef<any>;

  private modalRef: any;
  private destroy$ = new Subject<void>();
  private subscriptions: Subscription[] = [];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private modalService: NgbModal,
    private separationService: SeparationService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) {
    this.form = this.fb.group({
      empId: ['', Validators.required],
      empName: ['', Validators.required],
      separationTypeId: ['', Validators.required],
      lastWorkingDate: ['', Validators.required],
      noticePeriodServed: [0, [Validators.required, Validators.min(0)]],
      separationReason: ['', Validators.required],
      resignationLetterPath: [''],
      rehireEligible: [false],
      rehireNotes: ['']
    });

    this.statusForm = this.fb.group({
      status: ['', Validators.required],
      notes: ['']
    });

    // NEW: Date filter form
    this.dateFilterForm = this.fb.group({
      startDate: ['', Validators.required],
      endDate: ['', Validators.required]
    });
  }

  get paginatedSeparations(): Separation[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredSeparations.slice(startIndex, startIndex + this.itemsPerPage);
  }

  get canAddSeparation(): boolean {
    return this.isCurrentUserEmployee || this.canCreateSeparationForOthers;
  }

  get employeeNamePlaceholder(): string {
    if (this.isCurrentUserEmployee) {
      return this.getCurrentUserDisplayName();
    }
    return 'Search and select an employee...';
  }

  // NEW: Employee search term getter/setter for template
  get employeeSearchTerm(): string {
    return this.form.get('empName')?.value || '';
  }

  set employeeSearchTerm(value: string) {
    this.form.get('empName')?.setValue(value, { emitEvent: false });
  }

  ngOnInit(): void {
    this.initializeForm();
    this.setupRoleBasedAccess();
    this.loadInitialData();
    this.setupEmployeeSearch();
    this.setupClickOutsideHandler();
    this.loadCurrentUserEmployee();

    // Get the current user value directly
    this.currentUser = this.authService.currentUserValue;

    // Subscribe to user changes using the user$ observable
    const userSub = this.authService.user$.subscribe(user => {
      this.currentUser = user;
      this.setupRoleBasedAccess();
    });

    this.subscriptions.push(userSub);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.subscriptions.forEach(sub => sub.unsubscribe());
    document.removeEventListener('click', this.handleDocumentClick);
  }

  /**
   * Setup role-based access control
   */
  private setupRoleBasedAccess(): void {
    if (!this.currentUser) {
      this.resetAccessFlags();
      return;
    }

    const userRole = this.currentUser.roleName;

    // Set access flags based on user role
    this.isCurrentUserEmployee = this.authService.isEmployee();
    this.canDeleteSeparations = this.authService.hasFullAccess(); // Admin/CTO only
    this.canEditAllSeparations = this.authService.hasFullAccess(); // Admin/CTO only
    this.canViewAllSeparations = this.authService.hasFullAccess(); // Admin/CTO can view all
    this.canCreateSeparationForOthers = this.authService.hasFullAccess(); // Admin/CTO can create for others

    console.log('Role-based access setup:', {
      userRole,
      isCurrentUserEmployee: this.isCurrentUserEmployee,
      canDeleteSeparations: this.canDeleteSeparations,
      canEditAllSeparations: this.canEditAllSeparations,
      canViewAllSeparations: this.canViewAllSeparations,
      canCreateSeparationForOthers: this.canCreateSeparationForOthers
    });
  }

  private resetAccessFlags(): void {
    this.isCurrentUserEmployee = false;
    this.canDeleteSeparations = false;
    this.canEditAllSeparations = false;
    this.canViewAllSeparations = false;
    this.canCreateSeparationForOthers = false;
  }

  /**
   * Check if current user can edit a specific separation
   */
  canEditSeparation(separation: Separation): boolean {
    if (this.canEditAllSeparations) return true;

    // Employees can only edit their own separations if status is pending
    if (this.isCurrentUserEmployee) {
      const currentUserEmpId = this.getCurrentUserEmpId();
      return separation.employeeId === currentUserEmpId &&
        (separation.status === 'Pending' || !separation.status);
    }

    return false;
  }

  /**
   * Check if current user can delete a specific separation
   */
  canDeleteSeparation(separation: Separation): boolean {
    // Only Admin/CTO can delete
    return this.canDeleteSeparations;
  }

  /**
   * Check if current user can update status of a separation
   */
  canUpdateStatus(separation: Separation): boolean {
    // Only Admin/CTO can update status
    if (!this.authService.hasFullAccess()) return false;

    // Can't update status of completed separations
    return separation.status !== 'Completed';
  }

  /**
   * Filter separations based on user role
   */
  private filterSeparationsByRole(separations: Separation[]): Separation[] {
    if (this.canViewAllSeparations) {
      return separations; // Admin/CTO can see all
    }

    if (this.isCurrentUserEmployee) {
      // Employees can only see their own separations
      const currentUserEmpId = this.getCurrentUserEmpId();
      return separations.filter(sep => sep.employeeId === currentUserEmpId);
    }

    return separations;
  }

  // Load initial data - separation types and separations
  private loadInitialData(): void {
    this.isLoading = true;

    // First load separation types, then separations
    const typesSub = this.separationService.getSeparationTypes().subscribe({
      next: (types) => {
        console.log('Loaded separation types:', types);
        this.separationTypes = types || [];
        this.separationTypesMap = {};
        types.forEach(type => {
          this.separationTypesMap[type.separationTypeId] = type;
        });

        // Now load separations
        this.loadSeparations();
      },
      error: (error) => {
        console.error('Error loading separation types:', error);
        this.showError('Failed to load separation types. Please try again.');
        this.isLoading = false;
      }
    });

    this.subscriptions.push(typesSub);
  }

  /**
   * Enhanced separation loading with better error handling
   */
  private loadSeparations(): void {
    const separationsSub = this.separationService.getSeparations().subscribe({
      next: (separations) => {
        console.log('Raw separations loaded:', separations);

        // Store separations with properly mapped types
        this.separations = separations.map(sep => {
          console.log('Processing separation:', sep);

          // Ensure we have proper separation type mapping
          if (sep.separationTypeId && this.separationTypesMap[sep.separationTypeId]) {
            sep.separationType = this.separationTypesMap[sep.separationTypeId];
          } else if (!sep.separationType || sep.separationType.separationTypeId === 'default') {
            if (sep.separationTypeId && this.separationTypesMap[sep.separationTypeId]) {
              sep.separationType = this.separationTypesMap[sep.separationTypeId];
            }
          }

          return sep;
        });

        console.log('Processed separations:', this.separations);

        // Filter separations based on user role
        this.separations = this.filterSeparationsByRole(this.separations);
        this.filteredSeparations = [...this.separations];
        this.totalPages = Math.ceil(this.separations.length / this.itemsPerPage);

        // Load employee names and departments for display
        this.loadEmployeeNames();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading separations:', error);
        this.showError('Failed to load separations. Please try again.');
        this.separations = [];
        this.filteredSeparations = [];
        this.isLoading = false;
      }
    });

    this.subscriptions.push(separationsSub);
  }

  // NEW: Open date filter modal
  openDateFilterModal(): void {
    // Set default date range (last 3 months)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    this.dateFilterForm.patchValue({
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    });

    this.modalRef = this.modalService.open(this.dateFilterModalTemplate, {
      size: 'md',
      backdrop: 'static',
      keyboard: false
    });
  }

  // NEW: Apply date filter
  applyDateFilter(): void {
    if (this.dateFilterForm.invalid) {
      this.markFormGroupTouched(this.dateFilterForm);
      return;
    }

    const formValue = this.dateFilterForm.value;
    this.isDateFiltering = true;
    this.modalRef?.close();

    console.log('Applying date filter:', formValue);

    const filterSub = this.separationService.getSeparationsByDateRange(
      formValue.startDate,
      formValue.endDate
    ).subscribe({
      next: (separations) => {
        console.log('Filtered separations by date:', separations);
        
        // Map the filtered separations
        this.separations = separations.map(sep => this.separationService['mapToSeparation'](sep));
        
        // Apply role-based filtering
        this.separations = this.filterSeparationsByRole(this.separations);
        this.filteredSeparations = [...this.separations];
        this.totalPages = Math.ceil(this.separations.length / this.itemsPerPage);
        this.currentPage = 1;
        
        this.dateFilterApplied = true;
        this.isDateFiltering = false;
        
        // Load employee names for the filtered results
        this.loadEmployeeNames();
        
        this.showSuccess(`Found ${this.separations.length} separations between ${formValue.startDate} and ${formValue.endDate}`);
      },
      error: (error) => {
        console.error('Error filtering separations by date:', error);
        this.isDateFiltering = false;
        this.showError('Failed to filter separations by date. Please try again.');
      }
    });

    this.subscriptions.push(filterSub);
  }

  // NEW: Clear date filter
  clearDateFilter(): void {
    this.dateFilterApplied = false;
    this.loadSeparations(); // Reload all separations
    this.showSuccess('Date filter cleared. Showing all separations.');
  }

  // NEW: Export to CSV
  exportToCSV(): void {
    if (!this.filteredSeparations || this.filteredSeparations.length === 0) {
      this.showError('No data to export. Please ensure there are separations to export.');
      return;
    }

    try {
      this.separationService.exportSeparationsToCSV(this.filteredSeparations);
      this.showSuccess(`Successfully exported ${this.filteredSeparations.length} separations to CSV file.`);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      this.showError('Failed to export data to CSV. Please try again.');
    }
  }

  // View reason in modal
  viewReason(reason: string): void {
    Swal.fire({
      title: 'Separation Reason',
      html: `<div class="text-start"><p>${reason || 'No reason provided'}</p></div>`,
      confirmButtonText: 'Close',
      width: '600px',
      customClass: {
        popup: 'text-start'
      }
    });
  }

  private handleDocumentClick = (event: Event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.employee-search-container')) {
      this.showEmployeeDropdown = false;
      this.selectedEmployeeIndex = -1;
    }
  };

  private setupClickOutsideHandler(): void {
    document.addEventListener('click', this.handleDocumentClick);
  }

  private setupEmployeeSearch(): void {
    const searchSub = this.employeeSearchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(searchTerm => {
        // Only search if user can create separations for others
        if (!this.canCreateSeparationForOthers) {
          return of([]);
        }

        if (!searchTerm || searchTerm.trim().length < 2) {
          this.isLoadingEmployees = false;
          this.filteredEmployees = [];
          return of([]);
        }

        this.isLoadingEmployees = true;
        return this.separationService.getAllEmployees().pipe(
          catchError(error => {
            console.error('Error searching employees:', error);
            this.isLoadingEmployees = false;
            return of([]);
          })
        );
      }),
      takeUntil(this.destroy$)
    ).subscribe(employees => {
      const searchTerm = this.employeeSearchTerm;
      if (searchTerm && searchTerm.trim().length >= 2) {
        const lowerSearchTerm = searchTerm.toLowerCase().trim();
        this.filteredEmployees = employees.filter(emp =>
          `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(lowerSearchTerm) ||
          emp.empCode.toLowerCase().includes(lowerSearchTerm) ||
          emp.empId.toLowerCase().includes(lowerSearchTerm)
        );
      } else {
        this.filteredEmployees = employees;
      }

      this.isLoadingEmployees = false;
      this.selectedEmployeeIndex = -1;
    });

    this.subscriptions.push(searchSub);
  }

  // FIXED: Employee search method without ngModel
  onEmployeeSearch(event: any): void {
    // Only allow search if user can create separations for others
    if (!this.canCreateSeparationForOthers) {
      return;
    }

    const searchTerm = event?.target?.value || '';
    this.showEmployeeDropdown = true;
    this.selectedEmployeeIndex = -1;

    // Update the form control value
    this.form.get('empName')?.setValue(searchTerm, { emitEvent: false });

    if (this.selectedEmployee) {
      const selectedName = `${this.selectedEmployee.firstName} ${this.selectedEmployee.lastName}`;
      if (searchTerm !== selectedName && searchTerm !== this.selectedEmployee.empCode) {
        this.clearEmployeeSelection();
      }
    }

    this.employeeSearchSubject.next(searchTerm);
  }

  onEmployeeKeydown(event: KeyboardEvent): void {
    if (!this.showEmployeeDropdown || this.filteredEmployees.length === 0 || !this.canCreateSeparationForOthers) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedEmployeeIndex = Math.min(this.selectedEmployeeIndex + 1, this.filteredEmployees.length - 1);
        this.scrollToSelectedEmployee();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.selectedEmployeeIndex = Math.max(this.selectedEmployeeIndex - 1, -1);
        this.scrollToSelectedEmployee();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.selectedEmployeeIndex >= 0 && this.selectedEmployeeIndex < this.filteredEmployees.length) {
          this.selectEmployee(this.filteredEmployees[this.selectedEmployeeIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.showEmployeeDropdown = false;
        this.selectedEmployeeIndex = -1;
        break;
    }
  }

  private scrollToSelectedEmployee(): void {
    setTimeout(() => {
      const selectedElement = document.getElementById(`employee-option-${this.selectedEmployeeIndex}`);
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  selectEmployee(employee: Employee): void {
    if (!employee || !this.canCreateSeparationForOthers) {
      console.error('No employee data found or insufficient permissions');
      return;
    }

    this.selectedEmployee = employee;
    const firstName = employee.firstName || '';
    const lastName = employee.lastName || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown Employee';
    const empId = employee.empId || '';

    // Update form controls
    this.form.patchValue({
      empId: empId,
      empName: fullName
    }, { emitEvent: false });

    this.form.get('empId')?.markAsTouched();
    this.form.get('empName')?.markAsTouched();
    this.form.get('empId')?.updateValueAndValidity();
    this.form.get('empName')?.updateValueAndValidity();

    this.showEmployeeDropdown = false;
    this.selectedEmployeeIndex = -1;

    setTimeout(() => {
      const nextField = document.getElementById('separationTypeId');
      if (nextField) {
        nextField.focus();
      }
    }, 100);
  }

  clearEmployeeSelection(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    // Only allow clearing if user can create separations for others
    if (!this.canCreateSeparationForOthers) {
      return;
    }

    this.selectedEmployee = null;
    this.filteredEmployees = [];
    this.selectedEmployeeIndex = -1;

    this.form.patchValue({
      empId: '',
      empName: ''
    }, { emitEvent: false });

    this.form.get('empId')?.markAsTouched();
    this.form.get('empName')?.markAsTouched();
    this.form.get('empId')?.updateValueAndValidity();
    this.form.get('empName')?.updateValueAndValidity();

    setTimeout(() => {
      const input = document.getElementById('empName') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  onEmployeeFocus(): void {
    // Only show dropdown if user can create separations for others
    if (!this.canCreateSeparationForOthers) {
      return;
    }

    this.showEmployeeDropdown = true;
    const searchTerm = this.employeeSearchTerm;
    if (searchTerm && searchTerm.length >= 2) {
      this.employeeSearchSubject.next(searchTerm);
    }
  }

  getCurrentUserDisplayName(): string {
    if (this.currentUserEmployee) {
      return `${this.currentUserEmployee.firstName} ${this.currentUserEmployee.lastName}`;
    }
    return this.authService.currentUserValue?.username || 'Current User';
  }

  getCurrentUserEmpId(): string {
    const currentUser = this.authService.currentUserValue;
    return currentUser?.empId || currentUser?.userId || 'system';
  }

  loadCurrentUserEmployee(): void {
    try {
      const currentUser = this.authService.currentUserValue;

      if (!currentUser) {
        console.warn('No user is currently logged in');
        this.router.navigate(['/auth/login']);
        return;
      }

      console.log('Loading employee data for user:', currentUser.username);

      const userSub = this.separationService.getCurrentUserEmployee().subscribe({
        next: (employee) => {
          if (employee) {
            console.log('Successfully loaded employee data:', employee);
            this.currentUserEmployee = employee;

            // If user is an employee, pre-populate their details in the form
            if (this.isCurrentUserEmployee) {
              this.prePopulateEmployeeForm(employee);
            }

            if (!this.employees.length) {
              this.loadEmployeeNames();
            }
          }
        },
        error: (error) => {
          console.warn('Could not load current user employee data:', error.message);
          if (currentUser.username) {
            console.log('Proceeding with basic user info');
          } else {
            this.router.navigate(['/auth/login']);
          }
        }
      });

      this.subscriptions.push(userSub);
    } catch (error) {
      console.error('Unexpected error in loadCurrentUserEmployee:', error);
      if (this.authService.currentUserValue?.username) {
        console.warn('Continuing despite error');
      } else {
        this.router.navigate(['/auth/login']);
      }
    }
  }

  /**
   * Pre-populate form with current employee's details (for employee role)
   */
  private prePopulateEmployeeForm(employee: Employee): void {
    if (!this.isCurrentUserEmployee || !employee) return;

    const fullName = `${employee.firstName} ${employee.lastName}`.trim();

    this.form.patchValue({
      empId: employee.empId,
      empName: fullName
    });

    // Mark fields as touched to show they're pre-filled
    this.form.get('empId')?.markAsTouched();
    this.form.get('empName')?.markAsTouched();

    // Disable these fields for employees
    this.form.get('empId')?.disable();
    this.form.get('empName')?.disable();

    this.selectedEmployee = employee;
  }

  private initializeForm(): void {
    this.form = this.fb.group({
      empId: ['', Validators.required],
      empName: ['', Validators.required],
      separationTypeId: ['', Validators.required],
      lastWorkingDate: ['', Validators.required],
      noticePeriodServed: [0, [Validators.required, Validators.min(0)]],
      separationReason: ['', Validators.required],
      resignationLetterPath: [''],
      rehireEligible: [false],
      rehireNotes: ['']
    });
  }

  private showError(message: string): void {
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: message,
      confirmButtonColor: '#3f51b5',
    });
  }

  private showSuccess(message: string): void {
    Swal.fire({
      icon: 'success',
      title: 'Success',
      text: message,
      confirmButtonColor: '#198754',
      timer: 3000,
      timerProgressBar: true
    });
  }

  /**
   * Enhanced employee validation
   */
  private isValidEmployeeId(id: string | null | undefined): boolean {
    if (!id) return false;
    const lowerId = id.toLowerCase();
    return !(lowerId.includes('system') || lowerId.includes('unknown') || id.length < 3);
  }

  /**
   * Enhanced unknown employee creation
   */
  private createUnknownEmployee(id: string): Employee {
    return {
      empId: id,
      empCode: 'UNKNOWN',
      firstName: 'Unknown',
      lastName: 'Employee',
      department: 'Unknown Department',
      position: 'Unknown Position'
    };
  }

  /**
   * Force reload separations with proper employee mapping
   */
  public reloadSeparationsData(): void {
    console.log('Force reloading separations data...');
    this.isLoading = true;

    // Clear existing maps
    this.employeeMap = {};
    this.departmentMap = {};

    // Reload separations
    this.loadSeparations();
  }

  /**
   * Debug method to check employee structure
   */
  private debugEmployeeStructure(employee: Employee, empId: string): void {
    console.log(`=== DEBUGGING EMPLOYEE ${empId} ===`);
    console.log('Full employee object:', employee);
    console.log('Available fields:', Object.keys(employee));
    console.log('departmentId:', employee.departmentId);
    console.log('department:', employee.department);
    console.log('dept_id:', (employee as any).dept_id);
    console.log('deptId:', (employee as any).deptId);
    console.log('Department object:', (employee as any).Department);
    console.log('department object:', (employee as any).department);
    console.log('=== END DEBUG ===');
  }

  /**
   * FIXED - Enhanced method to load employee names with better department field detection
   */
  private loadEmployeeNames(): void {
    try {
      if (!this.separations || this.separations.length === 0) {
        return;
      }

      const allIds = [
        ...this.separations.map(s => s.employeeId).filter(Boolean),
        ...this.separations.map(s => s.initiatedBy).filter(Boolean),
        ...this.separations.map(s => s.approvedBy).filter(Boolean)
      ] as string[];

      const validUniqueIds = [...new Set(allIds.filter(id => this.isValidEmployeeId(id)))];

      // Handle invalid IDs
      allIds.filter(id => !validUniqueIds.includes(id) && id).forEach(invalidId => {
        this.employeeMap[invalidId] = this.createUnknownEmployee(invalidId);
      });

      if (validUniqueIds.length === 0) {
        this.updateSeparationData();
        return;
      }

      console.log('Loading employees for IDs:', validUniqueIds);

      const employeeRequests = validUniqueIds.map(empId =>
        this.separationService.getEmployeeById(empId).pipe(
          tap(employee => {
            console.log(`Loaded employee ${empId}:`, employee);
            
            // Debug the employee structure
            this.debugEmployeeStructure(employee, empId);
          }),
          catchError(error => {
            console.warn(`Failed to load employee ${empId}:`, error);
            return of(this.createUnknownEmployee(empId));
          })
        )
      );

      const employeeNamesSub = forkJoin(employeeRequests).subscribe({
        next: (employees) => {
          console.log('All employees loaded:', employees);

          // Store employees in map and extract department info
          employees.forEach((employee, index) => {
            const empId = validUniqueIds[index];
            if (employee && empId) {
              this.employeeMap[empId] = employee;
              console.log(`Mapped employee ${empId}:`, employee);

              // Try to extract department information from various possible fields
              this.extractDepartmentInfo(employee, empId);
            }
          });

          // Now load departments for employees that have department IDs
          this.loadDepartmentsForEmployees();
        },
        error: (error) => {
          console.error('Error loading employee data:', error);
          this.updateSeparationData();
        }
      });

      this.subscriptions.push(employeeNamesSub);
    } catch (error) {
      console.error('Unexpected error in loadEmployeeNames:', error);
      this.updateSeparationData();
    }
  }

  /**
   * FIXED - Extract department information from employee object with multiple field possibilities
   */
  private extractDepartmentInfo(employee: Employee, empId: string): void {
    console.log(`Extracting department info for employee ${empId}`);
    
    // Try different possible field names for department ID
    let departmentId: string | null = null;
    let departmentName: string | null = null;

    // Check various possible field names for department ID
    if (employee.departmentId) {
      departmentId = employee.departmentId;
      console.log(`Found departmentId: ${departmentId}`);
    } else if ((employee as any).dept_id) {
      departmentId = (employee as any).dept_id;
      console.log(`Found dept_id: ${departmentId}`);
    } else if ((employee as any).deptId) {
      departmentId = (employee as any).deptId;
      console.log(`Found deptId: ${departmentId}`);
    }

    // Check for existing department name
    if (employee.department && typeof employee.department === 'string') {
      departmentName = employee.department;
      console.log(`Found department name: ${departmentName}`);
    } else if ((employee as any).departmentName) {
      departmentName = (employee as any).departmentName;
      console.log(`Found departmentName: ${departmentName}`);
    } else if ((employee as any).dept_name) {
      departmentName = (employee as any).dept_name;
      console.log(`Found dept_name: ${departmentName}`);
    }

    // Check if department is an object with name property
    if ((employee as any).Department && typeof (employee as any).Department === 'object') {
      const deptObj = (employee as any).Department;
      if (deptObj.dept_name) {
        departmentName = deptObj.dept_name;
        console.log(`Found Department.dept_name: ${departmentName}`);
      }
      if (deptObj.dept_id) {
        departmentId = deptObj.dept_id;
        console.log(`Found Department.dept_id: ${departmentId}`);
      }
    }

    // Store the department information
    if (departmentName) {
      this.departmentMap[empId] = departmentName;
      console.log(`Set department name for ${empId}: ${departmentName}`);
    }

    // Store the department ID for later lookup if we have it but no name yet
    if (departmentId && !this.departmentMap[empId]) {
      // We'll use this in loadDepartmentsForEmployees
      (employee as any)._extractedDeptId = departmentId;
      console.log(`Stored department ID for later lookup: ${departmentId}`);
    }

    // If we have neither, set a fallback
    if (!departmentName && !departmentId) {
      this.departmentMap[empId] = 'N/A';
      console.log(`No department info found for ${empId}, set to N/A`);
    }
  }

  /**
   * FIXED - Load departments with better field detection
   */
  private loadDepartmentsForEmployees(): void {
    // Collect all unique department IDs from employees using extracted info
    const departmentIds = new Set<string>();

    Object.values(this.employeeMap).forEach(employee => {
      // Check the extracted department ID
      const extractedDeptId = (employee as any)._extractedDeptId;
      if (extractedDeptId && extractedDeptId.trim()) {
        departmentIds.add(extractedDeptId);
      }
      
      // Also check standard fields
      if (employee.departmentId && employee.departmentId.trim()) {
        departmentIds.add(employee.departmentId);
      }
      
      // Check other possible field names
      if ((employee as any).dept_id && (employee as any).dept_id.trim()) {
        departmentIds.add((employee as any).dept_id);
      }
      
      if ((employee as any).deptId && (employee as any).deptId.trim()) {
        departmentIds.add((employee as any).deptId);
      }
    });

    const uniqueDeptIds = Array.from(departmentIds);
    console.log('Loading departments for IDs:', uniqueDeptIds);

    if (uniqueDeptIds.length === 0) {
      // No department IDs to load, just update with existing data
      console.log('No department IDs found, updating with existing data');
      this.updateSeparationData();
      return;
    }

    // Load all departments in parallel
    const departmentRequests = uniqueDeptIds.map(deptId =>
      this.separationService.getDepartmentById(deptId).pipe(
        map(dept => ({ deptId, department: dept })),
        catchError(error => {
          console.warn(`Failed to load department ${deptId}:`, error);
          return of({ deptId, department: null });
        })
      )
    );

    const departmentsSub = forkJoin(departmentRequests).subscribe({
      next: (departments) => {
        console.log('All departments loaded:', departments);

        // Map departments to employees
        departments.forEach(({ deptId, department }) => {
          // Find all employees with this department ID
          Object.keys(this.employeeMap).forEach(empId => {
            const employee = this.employeeMap[empId];
            const extractedDeptId = (employee as any)._extractedDeptId;
            
            // Check if this employee has this department ID (in any field)
            const hasThisDept = 
              employee.departmentId === deptId ||
              (employee as any).dept_id === deptId ||
              (employee as any).deptId === deptId ||
              extractedDeptId === deptId;

            if (hasThisDept) {
              if (department && department.dept_name) {
                this.departmentMap[empId] = department.dept_name;
                console.log(`Mapped department ${department.dept_name} to employee ${empId}`);
              } else if (!this.departmentMap[empId]) {
                // Fallback to employee's department field if available
                this.departmentMap[empId] = employee.department || 'Unknown Department';
                console.log(`Used fallback department for employee ${empId}: ${this.departmentMap[empId]}`);
              }
            }
          });
        });

        // Set fallback for employees without department mapping
        this.setFallbackDepartmentNames();

        // Update separation data
        this.updateSeparationData();
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.setFallbackDepartmentNames();
        this.updateSeparationData();
      }
    });

    this.subscriptions.push(departmentsSub);
  }

  /**
   * Set fallback department names for employees without proper department mapping
   */
  private setFallbackDepartmentNames(): void {
    Object.keys(this.employeeMap).forEach(empId => {
      if (!this.departmentMap[empId]) {
        const employee = this.employeeMap[empId];
        this.departmentMap[empId] = employee.department || 'N/A';
        console.log(`Set fallback department for employee ${empId}: ${this.departmentMap[empId]}`);
      }
    });
  }

  /**
   * FIXED - Enhanced department name getter with better field checking
   */
  getDepartmentName(separation: Separation): string {
    // First try department map (loaded from department API)
    if (this.departmentMap[separation.employeeId]) {
      return this.departmentMap[separation.employeeId];
    }

    // Then try separation's department fields
    if (separation.departmentName && separation.departmentName !== 'N/A') {
      return separation.departmentName;
    }

    if (separation.department && separation.department !== 'N/A') {
      return separation.department;
    }

    // Try employee's various department fields
    const employee = this.employeeMap[separation.employeeId];
    if (employee) {
      // Check standard department field
      if (employee.department && employee.department !== 'N/A') {
        return employee.department;
      }
      
      // Check other possible department name fields
      if ((employee as any).departmentName) {
        return (employee as any).departmentName;
      }
      
      if ((employee as any).dept_name) {
        return (employee as any).dept_name;
      }
      
      // Check if department is an object
      if ((employee as any).Department && (employee as any).Department.dept_name) {
        return (employee as any).Department.dept_name;
      }
    }

    return 'N/A';
  }

  /**
   * OPTIMIZED - Enhanced separation data update with simplified department handling
   */
  private updateSeparationData(): void {
    if (!this.separations || this.separations.length === 0) {
      console.log('No separations to update');
      return;
    }

    console.log('Updating separation data with employee map:', this.employeeMap);
    console.log('Department map:', this.departmentMap);

    this.separations = this.separations.map(separation => {
      const updatedSeparation = { ...separation };

      // Map employee information
      if (updatedSeparation.employeeId) {
        const employee = this.employeeMap[updatedSeparation.employeeId];
        if (employee) {
          updatedSeparation.employeeName = `${employee.firstName} ${employee.lastName}`.trim();
          updatedSeparation.employeeCode = employee.empCode || 'UNKNOWN';
          updatedSeparation.position = employee.position || 'N/A';

          // Department mapping - use the optimized single method
          const departmentName = this.getDepartmentName(updatedSeparation);
          updatedSeparation.departmentName = departmentName;
          updatedSeparation.department = departmentName;

          console.log(`Updated employee ${updatedSeparation.employeeId}:`, {
            name: updatedSeparation.employeeName,
            department: departmentName,
            position: updatedSeparation.position
          });
        } else {
          console.warn(`No employee found for ID: ${updatedSeparation.employeeId}`);
          const unknownEmployee = this.createUnknownEmployee(updatedSeparation.employeeId);
          updatedSeparation.employeeName = `${unknownEmployee.firstName} ${unknownEmployee.lastName}`.trim();
          updatedSeparation.employeeCode = unknownEmployee.empCode;
          updatedSeparation.departmentName = 'N/A';
          updatedSeparation.department = 'N/A';
          updatedSeparation.position = 'N/A';
        }
      }

      // Map initiator information
      if (updatedSeparation.initiatedBy) {
        const initiator = this.employeeMap[updatedSeparation.initiatedBy];
        if (initiator) {
          updatedSeparation.initiatedByName = `${initiator.firstName} ${initiator.lastName}`.trim();
          console.log(`Updated initiator ${updatedSeparation.initiatedBy}: ${updatedSeparation.initiatedByName}`);
        } else {
          console.warn(`No initiator found for ID: ${updatedSeparation.initiatedBy}`);
          // Try to load this employee if not already loaded
          if (this.isValidEmployeeId(updatedSeparation.initiatedBy)) {
            this.loadSingleEmployee(updatedSeparation.initiatedBy, 'initiator');
          }
          updatedSeparation.initiatedByName = 'Loading...';
        }
      } else {
        updatedSeparation.initiatedByName = 'System';
      }

      // Map approver information
      if (updatedSeparation.approvedBy) {
        const approver = this.employeeMap[updatedSeparation.approvedBy];
        if (approver) {
          updatedSeparation.approvedByName = `${approver.firstName} ${approver.lastName}`.trim();
          console.log(`Updated approver ${updatedSeparation.approvedBy}: ${updatedSeparation.approvedByName}`);
        } else {
          console.warn(`No approver found for ID: ${updatedSeparation.approvedBy}`);
          // Try to load this employee if not already loaded
          if (this.isValidEmployeeId(updatedSeparation.approvedBy)) {
            this.loadSingleEmployee(updatedSeparation.approvedBy, 'approver');
          }
          updatedSeparation.approvedByName = 'Loading...';
        }
      }

      return updatedSeparation;
    });

    this.filteredSeparations = [...this.separations];
    this.cdr.detectChanges();

    console.log('Final updated separations:', this.separations);
  }

  /**
   * Load a single employee that might have been missed
   */
  private loadSingleEmployee(empId: string, role: string): void {
    console.log(`Loading single employee ${empId} for role: ${role}`);

    const employeeSub = this.separationService.getEmployeeById(empId).pipe(
      catchError(error => {
        console.warn(`Failed to load single employee ${empId}:`, error);
        return of(this.createUnknownEmployee(empId));
      })
    ).subscribe({
      next: (employee) => {
        console.log(`Single employee ${empId} loaded:`, employee);
        this.employeeMap[empId] = employee;

        // Extract department info for this employee
        this.extractDepartmentInfo(employee, empId);

        // Load department if needed
        const extractedDeptId = (employee as any)._extractedDeptId;
        if (extractedDeptId && !this.departmentMap[empId]) {
          this.loadSingleDepartment(extractedDeptId, empId);
        } else if (employee.department) {
          this.departmentMap[empId] = employee.department;
        }

        // Update the separation data again
        this.updateSeparationData();
      }
    });

    this.subscriptions.push(employeeSub);
  }

  /**
   * Load a single department for a specific employee
   */
  private loadSingleDepartment(deptId: string, empId: string): void {
    const deptSub = this.separationService.getDepartmentById(deptId).subscribe({
      next: (department) => {
        if (department && department.dept_name) {
          this.departmentMap[empId] = department.dept_name;
        } else {
          const employee = this.employeeMap[empId];
          this.departmentMap[empId] = employee?.department || 'Unknown Department';
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.warn(`Failed to load department ${deptId}:`, error);
        const employee = this.employeeMap[empId];
        this.departmentMap[empId] = employee?.department || 'Unknown Department';
        this.cdr.detectChanges();
      }
    });

    this.subscriptions.push(deptSub);
  }

  getSeparationTypeOptions(): SeparationType[] {
    return this.separationTypes;
  }

  getSeparationTypeId(separationType: SeparationType): string {
    return separationType?.separationTypeId || '';
  }

  getSeparationTypeName(separation: Separation): string {
    if (separation.separationType && separation.separationType.separationName) {
      return separation.separationType.separationName;
    }
    if (separation.separationTypeId && this.separationTypesMap[separation.separationTypeId]) {
      return this.separationTypesMap[separation.separationTypeId].separationName;
    }
    return 'N/A';
  }

  getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'Approved':
        return 'bg-success';
      case 'Rejected':
        return 'bg-danger';
      case 'Completed':
        return 'bg-info';
      case 'Pending':
      default:
        return 'bg-warning text-dark';
    }
  }

  /**
   * Get initiator name with better fallback
   */
  getInitiatorName(separation: Separation): string {
    if (separation.initiatedByName && separation.initiatedByName !== 'Loading...') {
      return separation.initiatedByName;
    }

    if (separation.initiatedBy && this.employeeMap[separation.initiatedBy]) {
      const employee = this.employeeMap[separation.initiatedBy];
      return `${employee.firstName} ${employee.lastName}`.trim();
    }

    return separation.initiatedBy ? 'Loading...' : 'System';
  }

  /**
   * Get approver name with better fallback
   */
  getApproverName(separation: Separation): string {
    if (separation.approvedByName && separation.approvedByName !== 'Loading...') {
      return separation.approvedByName;
    }

    if (separation.approvedBy && this.employeeMap[separation.approvedBy]) {
      const employee = this.employeeMap[separation.approvedBy];
      return `${employee.firstName} ${employee.lastName}`.trim();
    }

    return separation.approvedBy ? 'Loading...' : 'N/A';
  }

  trackByEmployeeId(index: number, separation: Separation): string {
    return separation.separationId || separation.id || `${separation.employeeId}-${index}`;
  }

  openAddModal(): void {
    this.isEditMode = false;
    this.currentSeparation = null;
    this.selectedEmployee = null;
    this.showEmployeeDropdown = false;
    this.filteredEmployees = [];
    this.selectedEmployeeIndex = -1;
    this.initializeForm();

    this.form.enable();

    // If user is an employee, pre-populate their details
    if (this.isCurrentUserEmployee && this.currentUserEmployee) {
      this.prePopulateEmployeeForm(this.currentUserEmployee);
    }

    // Reload separation types to ensure we have the latest
    this.separationService.getSeparationTypes().subscribe({
      next: (types) => {
        this.separationTypes = types;
        this.separationTypesMap = {};
        types.forEach(type => {
          this.separationTypesMap[type.separationTypeId] = type;
        });
      }
    });

    this.modalRef = this.modalService.open(this.separationModalTemplate, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    setTimeout(() => {
      // Focus appropriate field based on user role
      const focusField = this.isCurrentUserEmployee ? 'separationTypeId' : 'empName';
      const input = document.getElementById(focusField) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 300);
  }

  // ENHANCED: Better edit modal with improved data handling
  openEditModal(separation: Separation): void {
    if (!this.canEditSeparation(separation)) {
      this.showError('You do not have permission to edit this separation.');
      return;
    }

    console.log('=== OPENING EDIT MODAL ===');
    console.log('Separation to edit:', separation);

    this.isEditMode = true;
    this.currentSeparation = separation;
    this.selectedEmployee = null;
    this.showEmployeeDropdown = false;
    this.filteredEmployees = [];
    this.selectedEmployeeIndex = -1;

    // Find employee in the map
    const employee = this.employeeMap[separation.employeeId];
    if (employee) {
      this.selectedEmployee = employee;
      console.log('Found employee for editing:', employee);
    } else {
      console.warn('Employee not found in map for ID:', separation.employeeId);
      // Try to create a temporary employee object
      this.selectedEmployee = {
        empId: separation.employeeId,
        empCode: separation.employeeCode || 'UNKNOWN',
        firstName: separation.employeeName ? separation.employeeName.split(' ')[0] : 'Unknown',
        lastName: separation.employeeName ? separation.employeeName.split(' ').slice(1).join(' ') : 'Employee',
        department: separation.departmentName || separation.department
      };
    }

    // Format the date properly for the input field
    const formatDateForInput = (dateString: string): string => {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toISOString().split('T')[0];
      } catch (e) {
        console.warn('Error formatting date:', e);
        return dateString;
      }
    };

    // Populate form with current separation data
    const formData = {
      empId: separation.employeeId || '',
      empName: separation.employeeName || '',
      separationTypeId: separation.separationTypeId || '',
      lastWorkingDate: formatDateForInput(separation.lastWorkingDate),
      noticePeriodServed: separation.noticePeriodServed || 0,
      separationReason: separation.separationReason || '',
      resignationLetterPath: separation.resignationLetterPath || '',
      rehireEligible: Boolean(separation.rehireEligible),
      rehireNotes: separation.rehireNotes || ''
    };

    console.log('Form data for editing:', formData);

    this.form.patchValue(formData);

    this.form.enable();

    // If current user is employee editing their own separation, disable employee fields
    if (this.isCurrentUserEmployee && separation.employeeId === this.getCurrentUserEmpId()) {
      this.form.get('empId')?.disable();
      this.form.get('empName')?.disable();
    }

    // Verify separation type is available
    if (formData.separationTypeId && !this.separationTypesMap[formData.separationTypeId]) {
      console.warn('Separation type not found in cache:', formData.separationTypeId);
      // Try to reload separation types
      this.separationService.getSeparationTypes().subscribe({
        next: (types) => {
          this.separationTypes = types;
          this.separationTypesMap = {};
          types.forEach(type => {
            this.separationTypesMap[type.separationTypeId] = type;
          });
          console.log('Reloaded separation types for edit modal');
        }
      });
    }

    this.modalRef = this.modalService.open(this.separationModalTemplate, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });

    setTimeout(() => {
      const focusField = this.isCurrentUserEmployee ? 'separationTypeId' : 'empName';
      const input = document.getElementById(focusField) as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }, 300);
  }

  openViewModal(separation: Separation): void {
    this.currentSeparation = separation;
    this.modalRef = this.modalService.open(this.viewSeparationModalTemplate, {
      size: 'lg',
      backdrop: 'static',
      keyboard: false
    });
  }

  openStatusModal(separation: Separation): void {
    if (!this.canUpdateStatus(separation)) {
      this.showError('You do not have permission to update the status of this separation.');
      return;
    }

    this.currentSeparation = separation;
    this.statusForm.patchValue({
      status: separation.status || 'Pending',
      notes: ''
    });

    this.modalRef = this.modalService.open(this.statusModalTemplate, {
      size: 'md',
      backdrop: 'static',
      keyboard: false
    });

    setTimeout(() => {
      const input = document.getElementById('status') as HTMLSelectElement;
      if (input) {
        input.focus();
      }
    }, 300);
  }

  // ENHANCED: Better save method with improved validation and error handling
  saveSeparation(): void {
    if (this.form.invalid) {
      this.markFormGroupTouched(this.form);
      console.log('Form is invalid:', this.form.errors);
      
      // Log specific field errors
      Object.keys(this.form.controls).forEach(key => {
        const control = this.form.get(key);
        if (control?.errors) {
          console.log(`Field ${key} has errors:`, control.errors);
        }
      });
      
      this.showError('Please fill in all required fields correctly.');
      return;
    }

    this.isLoading = true;
    const formValue = this.form.getRawValue(); // getRawValue() to include disabled fields

    console.log('=== SAVING SEPARATION ===');
    console.log('Is Edit Mode:', this.isEditMode);
    console.log('Form Value:', formValue);
    console.log('Current Separation:', this.currentSeparation);

    if (this.isEditMode && this.currentSeparation) {
      // ENHANCED UPDATE: Better data preparation
      const updateRequest: SeparationUpdateRequest = {
        empId: formValue.empId,
        separationTypeId: formValue.separationTypeId,
        initiatedBy: this.currentSeparation.initiatedBy || this.getCurrentUserEmpId(),
        initiationDate: this.currentSeparation.initiationDate,
        lastWorkingDate: formValue.lastWorkingDate,
        noticePeriodServed: Number(formValue.noticePeriodServed),
        separationReason: formValue.separationReason.trim(),
        resignationLetterPath: (formValue.resignationLetterPath || '').trim(),
        rehireEligible: Boolean(formValue.rehireEligible),
        rehireNotes: (formValue.rehireNotes || '').trim()
      };

      console.log('Update request payload:', updateRequest);
      console.log('Separation ID for update:', this.currentSeparation.separationId);

      if (!this.currentSeparation.separationId) {
        this.isLoading = false;
        this.showError('Invalid separation ID. Cannot update separation.');
        return;
      }

      const updateSub = this.separationService.updateSeparation(
        this.currentSeparation.separationId!,
        updateRequest
      ).subscribe({
        next: (updatedSeparation) => {
          console.log('Separation updated successfully:', updatedSeparation);
          this.isLoading = false;
          this.modalRef?.close();
          this.showSuccess('Separation updated successfully!');
          this.loadSeparations(); // Reload the list
        },
        error: (error) => {
          console.error('Error updating separation:', error);
          this.isLoading = false;
          this.showError(error.message || 'Failed to update separation. Please try again.');
        }
      });

      this.subscriptions.push(updateSub);
    } else {
      // Create new separation
      const createRequest: SeparationRequest = {
        empId: formValue.empId,
        separationTypeId: formValue.separationTypeId,
        initiatedBy: this.getCurrentUserEmpId(),
        lastWorkingDate: formValue.lastWorkingDate,
        noticePeriodServed: Number(formValue.noticePeriodServed),
        separationReason: formValue.separationReason.trim(),
        resignationLetterPath: (formValue.resignationLetterPath || '').trim(),
        rehireEligible: Boolean(formValue.rehireEligible),
        rehireNotes: (formValue.rehireNotes || '').trim()
      };

      console.log('Create request payload:', createRequest);

      const createSub = this.separationService.createSeparation(createRequest).subscribe({
        next: (newSeparation) => {
          console.log('Separation created successfully:', newSeparation);
          this.isLoading = false;
          this.modalRef?.close();
          this.showSuccess(this.isCurrentUserEmployee ? 'Separation request submitted successfully!' : 'Separation created successfully!');
          this.loadSeparations(); // Reload the list
        },
        error: (error) => {
          console.error('Error creating separation:', error);
          this.isLoading = false;
          this.showError(error.message || 'Failed to create separation. Please try again.');
        }
      });

      this.subscriptions.push(createSub);
    }
  }

  updateStatus(): void {
    if (this.statusForm.invalid || !this.currentSeparation) {
      this.markFormGroupTouched(this.statusForm);
      return;
    }

    this.isLoading = true;
    const formValue = this.statusForm.value;

    const statusSub = this.separationService.updateSeparationStatus(
      this.currentSeparation.separationId!,
      formValue.status,
      formValue.notes || ''
    ).subscribe({
      next: () => {
        this.isLoading = false;
        this.modalRef?.close();
        this.showSuccess('Separation status updated successfully!');
        this.loadSeparations(); // Reload the list
      },
      error: (error) => {
        console.error('Error updating separation status:', error);
        this.isLoading = false;
        this.showError(error.message || 'Failed to update separation status. Please try again.');
      }
    });

    this.subscriptions.push(statusSub);
  }

  deleteSeparation(separation: Separation): void {
    if (!this.canDeleteSeparation(separation)) {
      this.showError('You do not have permission to delete this separation.');
      return;
    }

    Swal.fire({
      title: 'Delete Separation',
      text: `Are you sure you want to delete the separation for ${separation.employeeName}? This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc3545',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'Cancel'
    }).then((result) => {
      if (result.isConfirmed) {
        this.performDelete(separation);
      }
    });
  }

  private performDelete(separation: Separation): void {
    this.isLoading = true;

    const deleteSub = this.separationService.deleteSeparation(separation.separationId!).subscribe({
      next: () => {
        this.isLoading = false;
        this.showSuccess('Separation deleted successfully!');
        this.loadSeparations(); // Reload the list
      },
      error: (error) => {
        console.error('Error deleting separation:', error);
        this.isLoading = false;
        this.showError(error.message || 'Failed to delete separation. Please try again.');
      }
    });

    this.subscriptions.push(deleteSub);
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredSeparations = [...this.separations];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredSeparations = this.separations.filter(separation => {
        return (
          separation.employeeName?.toLowerCase().includes(query) ||
          separation.employeeCode?.toLowerCase().includes(query) ||
          separation.employeeId?.toLowerCase().includes(query) ||
          separation.separationReason?.toLowerCase().includes(query) ||
          this.getSeparationTypeName(separation).toLowerCase().includes(query) ||
          this.getDepartmentName(separation).toLowerCase().includes(query)
        );
      });
    }

    this.totalPages = Math.ceil(this.filteredSeparations.length / this.itemsPerPage);
    this.currentPage = 1; // Reset to first page when searching
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  private markFormGroupTouched(formGroup: FormGroup): void {
    Object.keys(formGroup.controls).forEach(key => {
      const control = formGroup.get(key);
      control?.markAsTouched();
      if (control instanceof FormGroup) {
        this.markFormGroupTouched(control);
      }
    });
  }
}