import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { CommonModule, NgIf } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { catchError, map, of, switchMap, throwError } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { NgbNavModule } from '@ng-bootstrap/ng-bootstrap';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuthService, User } from 'src/app/core/services/auth.service';

interface Employee {
  empId: string;
  empCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus: string;
  nationality: string;
  cidNumber: string;
  orgId?: string;
  orgName?: string;
  hireDate: string;
  employmentStatus: string;
  employmentType: string;
  email: string;
  department: string;
  location: string;
  positionName?: string;
  positionId?: string;
  deptId?: string;
  branchId?: string;
  shiftId?: string;
  shiftName?: string;
  shiftStartTime?: string;
  shiftEndTime?: string;
  gradeId?: string;
  gradeName?: string;
  gradeCode?: string;
  basicSalary?: number;
  maxSalary?: number;
  salaryStructures?: any[];
  address?: any;
  bankDetail?: any;
  qualification?: {
    qualificationId?: string;
    institutionName: string;
    degreeName: string;
    specialization: string;
    yearOfCompletion: number;
  };
  additionalEducations?: {
    qualificationId?: string;
    institutionName: string;
    degreeName: string;
    specialization: string;
    yearOfCompletion: number;
  }[];
  contact?: any;
  profileImage?: string;
}

interface Department {
  dept_id: string;
  dept_name: string;
}

interface Position {
  positionId: string;
  positionName: string;
  deptId?: string;
}

interface Branch {
  branchId: string;
  branchName: string;
}

interface Grade {
  gradeId: string;
  gradeName: string;
  gradeCode: string;
  minSalary: number;
  maxSalary: number;
}

interface Organization {
  orgId: string;
  orgName: string;
}

@Component({
  selector: 'app-emp-view-detail',
  templateUrl: './emp-view-detail.component.html',
  styleUrls: ['./emp-view-detail.component.scss'],
  providers: [DatePipe, CurrencyPipe],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, NgIf, NgbNavModule]
})
export class EmployeeViewComponent implements OnInit {
  tabs = [
    { id: 'grade', label: 'Grade', icon: 'bi bi-award' },
    { id: 'address', label: 'Address', icon: 'bi bi-house-door' },
    { id: 'bank', label: 'Bank', icon: 'bi bi-bank' },
    { id: 'education', label: 'Education', icon: 'bi bi-book' },
    { id: 'contact', label: 'Contact', icon: 'bi bi-telephone' }
  ];
  activeTab = 'personal';
  employee: Employee | null = null;
  isLoading = true;
  errorMessage = '';
  showEditModal = false;
  employeeForm: FormGroup;
  selectedFile: File | null = null;
  profileImageUrl: string | null = null;
  isUploading = false;
  organizations: Organization[] = [];
  selectedOrgId: string = '';
  departments: Department[] = [];
  positions: Position[] = [];
  branches: Branch[] = [];
  grades: Grade[] = [];
  modalActiveTab = 'basic';
  currentUser: User | null = null;
  canEditEmployee = false;
  canViewSensitiveInfo = false;
  currentUserEmpCode = '';

  // Add these properties to your component class
  formDepartments: Department[] = [];
  filteredPositions: Position[] = [];
  isSaving = false;
  shifts: any[] = [];

  private apiUrl = `${environment.apiUrl}/api/v1/employees`;
  private deptApiUrl = `${environment.apiUrl}/api/v1/departments`;
  private positionApiUrl = `${environment.apiUrl}/api/v1/job-positions`;
  private branchApiUrl = `${environment.apiUrl}/api/v1/branches`;
  private gradeApiUrl = `${environment.apiUrl}/api/v1/job-grades`;
  private readonly orgApiUrl = `${environment.apiUrl}/api/v1/organizations`;
  private readonly shiftApiUrl = `${environment.apiUrl}/api/v1/shifts`;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient,
    private datePipe: DatePipe,
    private sanitizer: DomSanitizer,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.employeeForm = this.fb.group({
      firstName: ['', [Validators.required]],
      middleName: [''],
      lastName: ['', [Validators.required]],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      maritalStatus: ['Single'],
      nationality: ['', Validators.required],
      cidNumber: ['', [Validators.required]],
      organization: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phonePrimary: ['', [Validators.required]],
      department: ['', Validators.required],
      position: ['', Validators.required],
      employmentType: ['Regular', Validators.required],
      employmentStatus: ['Active', Validators.required],
      shift: ['', Validators.required],
      grade: ['', Validators.required],
      basicSalary: ['', Validators.required],
      maxSalary: ['', Validators.required],
      addressType: ['Permanent'],
      addressLine1: [''],
      addressLine2: [''],
      thromde: [''],
      dzongkhag: ['']
    });
  }

  ngOnInit(): void {
    this.checkPermissions();
    this.loadPositions();

    // Get empId from route or current user
    const empIdFromRoute = this.route.snapshot.paramMap.get('empId');
    const userData: any = localStorage.getItem('currentUser');
    const formattedData: any = JSON.parse(userData);

    // Use route parameter if available, otherwise fall back to current user's empId
    const empId = empIdFromRoute || formattedData?.empId;

    if (!empId) {
      this.handleMissingIdError();
      return;
    }

    this.initializeForm();

    this.loadReferenceData()
      .then(() => {
        if (this.authService.isAdmin()) {
          this.loadEmployeeDataForAdmin(empId);
        } else {
          this.loadEmployeeById(empId);
        }
      })
      .catch(error => {
        console.error('Error loading reference data:', error);
        this.isLoading = false;
        this.errorMessage = 'Failed to load required data';
        this.employee = null;
      });
  }

  private handleMissingIdError(): void {
    this.isLoading = false;
    this.errorMessage = 'Employee ID is missing from URL';
    setTimeout(() => this.router.navigate(['/employees']), 3000);
  }

  checkPermissions(): void {
    this.currentUser = this.authService.getCurrentUser();
    this.currentUserEmpCode = this.currentUser?.empId || '';

    // Check if user is viewing their own profile
    const isViewingOwnProfile = this.isViewingOwnProfile();

    // Admin permissions
    const isAdmin = this.authService.isAdmin();
    const isCTO = this.authService.isCTO();

    // Permission flags
    this.canEditEmployee = isAdmin || isCTO ||
      (this.authService.isEmployee() && isViewingOwnProfile &&
        this.authService.hasPermission('EMP_EDIT_OWN'));

    this.canViewSensitiveInfo = this.authService.hasPermission('EMP_VIEW_SENSITIVE') ||
      isAdmin ||
      isCTO;
  }

  private loadShifts(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<any[]>(`${environment.apiUrl}/api/v1/shifts`)
        .pipe(
          catchError(error => {
            console.error('Error loading shifts:', error);
            reject(error);
            return of([]);
          })
        )
        .subscribe({
          next: (shifts) => {
            this.shifts = shifts || [];
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  isViewingOwnProfile(): boolean {
    if (!this.employee) return false;
    return this.currentUserEmpCode === this.employee.empCode;
  }

  private initializeForm(): void {
    this.employeeForm = this.fb.group({
      // Personal Information
      firstName: ['', [Validators.required, Validators.maxLength(50)]],
      middleName: [''],
      lastName: ['', [Validators.required, Validators.maxLength(50)]],
      dateOfBirth: ['', Validators.required],
      gender: ['', Validators.required],
      maritalStatus: ['', Validators.required],
      nationality: ['Bhutanese', Validators.required],
      cidNumber: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],
      organization: ['', Validators.required],

      // Employment Information
      hireDate: ['', Validators.required],
      employmentStatus: ['', Validators.required],
      employmentType: ['', Validators.required],
      department: ['', Validators.required],
      position: [null, Validators.required],
      location: ['', Validators.required],
      grade: ['', Validators.required],
      basicSalary: ['', Validators.required],
      maxSalary: ['', Validators.required],

      // Contact Information
      email: ['', [Validators.required, Validators.email]],
      phonePrimary: ['', [Validators.required, Validators.pattern(/^[0-9]+$/)]],

      // Bank Details
      bankName: [''],
      branchName: [''],
      accountNumber: [''],
      accountType: [''],

      // Education
      institutionName: [''],
      degreeName: [''],
      specialization: [''],
      yearOfCompletion: [0],
      educations: this.fb.array([]),
      // Address
      addressType: ['Permanent'],
      addressLine1: [''],
      addressLine2: [''],
      thromde: [''],
      dzongkhag: [''],
      country: ['Bhutan'],

      //shift
      shift: ['', Validators.required],
    });
    this.onNationalityChange();

  }


  changeTab(tabId: string): void {
    this.activeTab = tabId;
  }

  private async loadPositions(): Promise<void> {
    try {
      const response = await this.http.get<Position[]>(this.positionApiUrl).toPromise();
      this.positions = response || [];
      this.filteredPositions = [...this.positions];
    } catch (error) {
      console.error('Error loading positions:', error);
      this.positions = [];
      this.filteredPositions = [];
    }
  }

  private async loadReferenceData(): Promise<void> {
    try {
      // Load all reference data in parallel for better performance
      const [
        deptsResponse,
        positionsResponse,
        branchesResponse,
        orgsResponse,
        gradesResponse,
        shiftsResponse
      ] = await Promise.all([
        this.http.get<{ data: Department[] }>(this.deptApiUrl).toPromise(),
        this.http.get<Position[]>(this.positionApiUrl).toPromise(),
        this.http.get<Branch[]>(this.branchApiUrl).toPromise(),
        this.http.get<Organization[]>(this.orgApiUrl).toPromise(),
        this.http.get<Grade[]>(this.gradeApiUrl).toPromise(),
        this.http.get<any[]>(this.shiftApiUrl).toPromise()
      ]);

      // Assign the responses to component properties
      this.departments = deptsResponse?.data || [];
      this.positions = positionsResponse || [];
      this.filteredPositions = [...this.positions];
      this.branches = branchesResponse || [];
      this.organizations = orgsResponse || [];
      this.grades = gradesResponse || [];
      this.shifts = shiftsResponse || [];

      // Set default organization if available
      if (this.organizations.length > 0) {
        this.selectedOrgId = this.organizations[0].orgId;
      }

      // Log successful loading (for debugging)
      console.log('Reference data loaded successfully:', {
        departments: this.departments.length,
        positions: this.positions.length,
        branches: this.branches.length,
        organizations: this.organizations.length,
        grades: this.grades.length
      });
    } catch (error) {
      console.error('Error loading reference data:', error);

      // Initialize empty arrays to prevent runtime errors
      this.departments = [];
      this.positions = [];
      this.filteredPositions = [];
      this.branches = [];
      this.organizations = [];
      this.grades = [];

      throw error;
    }
  }


  loadEmployeeById(empId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.http.get<any>(`${this.apiUrl}/${empId}`).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!response) {
          this.errorMessage = 'Employee not found';
          return;
        }
        this.employee = this.transformResponse(response);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading employee:', error);
        this.errorMessage = error.message || 'Failed to fetch employee details';
        this.employee = null;
      }
    });
  }

  private transformResponse(response: any): Employee {
    if (!response) {
      return null;
    }

    const emp = response.employee;
    const primaryContact = Array.isArray(response.contacts)
      ? response.contacts.find((c: any) => c.isPrimary) || response.contacts[0] || {}
      : {};
    const primaryAddress = Array.isArray(response.addresses)
      ? response.addresses.find((a: any) => a.isCurrent) || response.addresses[0] || {}
      : {};
    const primaryBank = Array.isArray(response.bankDetails)
      ? response.bankDetails[0] || {}
      : {};

    const primaryQualification = response.qualifications?.length > 0
      ? response.qualifications[0]
      : { institutionName: '', degreeName: '', specialization: '', yearOfCompletion: 0 };

    const additionalEducations = response.qualifications?.length > 1
      ? response.qualifications.slice(1)
      : [];

    let departmentName = '';
    if (emp.deptId && Array.isArray(this.departments)) {
      const dept = this.departments.find(d => d.dept_id === emp.deptId);
      departmentName = dept?.dept_name || emp.department || '';
    } else {
      departmentName = emp.department || '';
    }

    let positionName = '';
    if (emp.positionId && Array.isArray(this.positions)) {
      const position = this.positions.find(p => p.positionId === emp.positionId);
      positionName = position?.positionName || emp.positionName || '';
    } else {
      positionName = emp.positionName || '';
    }

    let locationName = '';
    if (emp.branchId && Array.isArray(this.branches)) {
      const branch = this.branches.find(b => b.branchId === emp.branchId);
      locationName = branch?.branchName || emp.location || '';
    } else {
      locationName = emp.location || '';
    }

    let orgName = '';
    if (emp.orgId && Array.isArray(this.organizations)) {
      const org = this.organizations.find(o => o.orgId === emp.orgId);
      orgName = org?.orgName || '';
    }

    // Get shift information
    let shiftName = '';
    let shiftStartTime = '';
    let shiftEndTime = '';
    if (response.shift) {
      shiftName = response.shift.shiftName || '';
      shiftStartTime = response.shift.startTime || '';
      shiftEndTime = response.shift.endTime || '';
    } else if (emp.shiftId && Array.isArray(this.shifts)) {
      const shift = this.shifts.find(s => s.shiftId === emp.shiftId);
      if (shift) {
        shiftName = shift.shiftName || '';
        shiftStartTime = shift.startTime || '';
        shiftEndTime = shift.endTime || '';
      }
    }

    const employee: Employee = {
      empId: emp.empId || '',
      empCode: emp.empCode || '',
      firstName: emp.firstName || '',
      middleName: emp.middleName,
      lastName: emp.lastName || '',
      dateOfBirth: emp.dateOfBirth || '',
      gender: emp.gender || '',
      maritalStatus: emp.maritalStatus || 'Unknown',
      nationality: emp.nationality || '',
      cidNumber: emp.cidNumber || '',
      orgId: emp.orgId,
      orgName: orgName,
      hireDate: emp.hireDate || '',
      employmentStatus: emp.employmentStatus || '',
      employmentType: emp.employmentType || '',
      email: primaryContact.email || emp.email || '',
      department: departmentName,
      location: locationName,
      positionName: positionName,
      positionId: emp.positionId,
      deptId: emp.deptId,
      branchId: emp.branchId,
      shiftId: emp.shiftId,
      shiftName: shiftName,
      shiftStartTime: shiftStartTime,
      shiftEndTime: shiftEndTime,
      gradeId: emp.gradeId,
      basicSalary: emp.basicSalary,
      maxSalary: emp.maxSalary,
      address: primaryAddress,
      bankDetail: primaryBank,
      qualification: primaryQualification,
      additionalEducations: additionalEducations,
      contact: primaryContact,
      profileImage: emp.profileImage
    };

    if (emp.gradeId && (!emp.gradeName || !emp.basicSalary)) {
      this.loadGradeDetails(emp.gradeId).then(grade => {
        if (grade) {
          employee.gradeName = grade.gradeName;
          employee.gradeCode = grade.gradeCode;
          employee.basicSalary = grade.minSalary;
          employee.maxSalary = grade.maxSalary;
        }
      });
    }

    return employee;
  }

  private loadEmployeeDataForAdmin(empId: string): void {
    this.isLoading = true;
    this.errorMessage = '';

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.get<any>(`${this.apiUrl}/${empId}`, { headers }).subscribe({
      next: (response) => {
        this.isLoading = false;
        if (!response) {
          this.errorMessage = 'Employee not found';
          return;
        }
        this.employee = this.transformResponse(response);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Full error:', error);
        if (error instanceof HttpErrorResponse) {
          console.error('Error status:', error.status);
          console.error('Error body:', error.error);
        }
        this.errorMessage = error.error?.message || error.message || 'Failed to fetch employee details';
        this.employee = null;
      }
    });
  }

  private async loadGradeDetails(gradeId: string): Promise<Grade | null> {
    if (!gradeId) return null;
    return this.grades.find(g => g.gradeId === gradeId) || null;
  }

  selectModalTab(tab: string): void {
    this.modalActiveTab = tab;
  }

  isModalTabActive(tab: string): boolean {
    return this.modalActiveTab === tab;
  }

  async openEditModal(): Promise<void> {
    if (!this.employee) return;

    try {
      // Initialize the form first
      this.initializeForm();

      // Load all necessary data in parallel
      await Promise.all([
        this.loadGrades(),
        this.loadBranches(),
        this.loadDepartments(this.employee.branchId || ''),
        this.loadShifts() // Make sure shifts are loaded
      ]);

      // Now that all data is loaded, set form values
      this.setFormValues(this.employee);

      // Show the modal
      this.showEditModal = true;
      this.modalActiveTab = 'basic';

    } catch (error) {
      console.error('Error opening edit modal:', error);
      this.errorMessage = 'Failed to initialize edit form';
    }
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.errorMessage = '';
  }

  private async loadGrades(): Promise<void> {
    try {
      const response = await this.http.get<Grade[]>(this.gradeApiUrl).toPromise();
      this.grades = response || [];
    } catch (error) {
      console.error('Error loading grades:', error);
      this.grades = [];
    }
  }

  private loadBranches(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Branch[]>(this.branchApiUrl)
        .pipe(
          catchError(error => {
            console.error('Error loading branches:', error);
            reject(error);
            return of([]);
          })
        )
        .subscribe({
          next: (branches) => {
            this.branches = branches || [];
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  private loadDepartments(branchId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let url = this.deptApiUrl;
      if (branchId) {
        url = `${this.deptApiUrl}/branch/${branchId}`;
      }

      this.http.get<{ data: Department[] }>(url)
        .pipe(
          catchError(error => {
            console.error('Error loading departments:', error);
            reject(error);
            return of({ data: [] });
          })
        )
        .subscribe({
          next: (response) => {
            this.formDepartments = response?.data || [];
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  onBranchChangeInForm(): void {
    const selectedBranchName = this.employeeForm.get('location')?.value;
    const selectedBranch = this.branches.find(b => b.branchName === selectedBranchName);

    if (selectedBranch) {
      this.loadDepartments(selectedBranch.branchId).then(() => {
        this.employeeForm.get('department')?.setValue('');
      });
    }
  }

  onDepartmentChange(): void {
    const departmentControl = this.employeeForm.get('department');
    const positionControl = this.employeeForm.get('position');

    if (!departmentControl || !positionControl) {
      return;
    }

    const selectedDepartmentId = departmentControl.value;

    if (!selectedDepartmentId) {
      // If no department selected, show all positions
      this.filteredPositions = [...this.positions];
      positionControl.setValue('');
      positionControl.disable();
      return;
    }

    // Filter positions based on selected department
    // Note: Adjust this logic if your positions have a different relationship structure
    this.filteredPositions = this.positions.filter(position =>
      position.deptId === selectedDepartmentId || // if positions have departmentId
      !position.deptId // include positions without department assignment
    );

    // Enable position selection and reset value
    positionControl.enable();
    positionControl.setValue('');

    // If there's only one position, select it automatically
    if (this.filteredPositions.length === 1) {
      positionControl.setValue(this.filteredPositions[0].positionId);
    }
  }

  // Nationality change handler
  onNationalityChange(): void {
    const isBhutanese = this.employeeForm.get('nationality')?.value === 'Bhutanese';

    const addressLine1 = this.employeeForm.get('addressLine1');
    const addressLine2 = this.employeeForm.get('addressLine2');
    const thromde = this.employeeForm.get('thromde');
    const dzongkhag = this.employeeForm.get('dzongkhag');

    if (isBhutanese) {
      if (addressLine2?.value) {
        this.employeeForm.patchValue({ addressLine2: '' });
      }

      addressLine1?.clearValidators();
      addressLine2?.clearValidators();
      thromde?.clearValidators();
      dzongkhag?.clearValidators();
    } else {
      if (thromde?.value || dzongkhag?.value) {
        this.employeeForm.patchValue({
          thromde: '',
          dzongkhag: ''
        });
      }

      addressLine1?.clearValidators();
      addressLine2?.clearValidators();
      thromde?.clearValidators();
      dzongkhag?.clearValidators();
    }

    addressLine1?.updateValueAndValidity();
    addressLine2?.updateValueAndValidity();
    thromde?.updateValueAndValidity();
    dzongkhag?.updateValueAndValidity();
  }

  onGradeChange(event: Event): void {
    const gradeId = (event.target as HTMLSelectElement).value;
    const selectedGrade = this.grades.find(g => g.gradeId === gradeId);

    if (selectedGrade) {
      this.employeeForm.patchValue({
        basicSalary: selectedGrade.minSalary,
        maxSalary: selectedGrade.maxSalary
      });
    }
  }

  private setFormValues(employee: Employee | null): void {
    if (!employee) return;

    const primaryContact = employee.contact || {
      email: '',
      phonePrimary: '',
      isEmergencyContact: false
    };

    const primaryBank = employee.bankDetail || {
      bankName: '',
      branchName: '',
      accountNumber: '',
      accountType: ''
    };

    const primaryQualification = employee.qualification || {
      institutionName: '',
      degreeName: '',
      specialization: '',
      yearOfCompletion: 0
    };

    const currentAddress = employee.address || {
      addressType: 'Permanent',
      addressLine1: '',
      addressLine2: '',
      thromde: '',
      dzongkhag: '',
      country: 'Bhutan',
      isCurrent: false
    };

    // Find the branch name from branchId
    const branchName = employee.branchId
      ? this.branches.find(b => b.branchId === employee.branchId)?.branchName
      : '';

    // Find the department from deptId
    const departmentId = employee.deptId || '';

    // Find the position from positionId
    const positionId = employee.positionId || '';

    // Find the grade from gradeId
    const gradeId = employee.gradeId || '';

    // Patch main form values
    this.employeeForm.patchValue({
      firstName: employee.firstName,
      middleName: employee.middleName || '',
      lastName: employee.lastName,
      dateOfBirth: this.formatDateForInput(employee.dateOfBirth),
      gender: employee.gender,
      maritalStatus: employee.maritalStatus || 'Single',
      nationality: employee.nationality || 'Bhutanese',
      cidNumber: employee.cidNumber,
      organization: employee.orgId || this.selectedOrgId,
      hireDate: this.formatDateForInput(employee.hireDate),
      employmentStatus: employee.employmentStatus,
      employmentType: employee.employmentType || '',
      email: primaryContact.email,
      department: departmentId,
      position: positionId,
      location: branchName,
      phonePrimary: primaryContact.phonePrimary,
      shift: employee.shiftId || '',
      grade: gradeId,
      basicSalary: employee.basicSalary || '',
      maxSalary: employee.maxSalary || '',
      bankName: primaryBank.bankName,
      branchName: primaryBank.branchName,
      accountNumber: primaryBank.accountNumber,
      accountType: primaryBank.accountType,
      institutionName: primaryQualification.institutionName,
      degreeName: primaryQualification.degreeName,
      specialization: primaryQualification.specialization,
      yearOfCompletion: primaryQualification.yearOfCompletion || 0,
      addressType: currentAddress.addressType,
      addressLine1: currentAddress.addressLine1,
      addressLine2: currentAddress.addressLine2,
      thromde: currentAddress.thromde,
      dzongkhag: currentAddress.dzongkhag
    });

    // Enable/disable fields based on selections
    if (branchName) {
      this.employeeForm.get('department')?.enable();
    }
    if (departmentId) {
      this.employeeForm.get('position')?.enable();
    }

    // Handle nationality specific fields
    this.onNationalityChange();
  }

  private formatDateForInput(dateString: string): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  }

  saveEmployee(): void {
    if (!this.canEditEmployee) {
      this.errorMessage = 'You do not have permission to edit this employee';
      return;
    }

    if (this.employeeForm.invalid || !this.employee) {
      this.errorMessage = 'Please fill all required fields correctly.';
      this.employeeForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    this.errorMessage = '';

    const formValue = this.employeeForm.getRawValue();
    const empId = this.employee.empId;

    try {
      // Validate branch/location
      const branchId = this.getBranchId(formValue.location);
      if (!branchId) {
        throw new Error('Invalid location selected');
      }

      // Validate shift
      const shiftId = formValue.shift;
      const selectedShift = this.shifts.find(s => s.shiftId === shiftId);
      if (!selectedShift) {
        this.errorMessage = 'Invalid shift selected';
        this.isSaving = false;
        return;
      }

      // Get existing IDs
      const existingContactId = this.employee.contact?.contactId;
      const existingAddressId = this.employee.address?.addressId;
      const existingBankDetailId = this.employee.bankDetail?.bankDetailId;

      // Prepare payload
      const payload = {
        employee: {
          empId: empId,
          empCode: this.employee.empCode, // Add empCode
          firstName: formValue.firstName,
          middleName: formValue.middleName || null,
          lastName: formValue.lastName,
          positionId: formValue.position,
          deptId: formValue.department,
          dateOfBirth: this.formatDateForAPI(formValue.dateOfBirth),
          gender: formValue.gender,
          maritalStatus: formValue.maritalStatus,
          nationality: formValue.nationality,
          cidNumber: formValue.cidNumber,
          hireDate: this.formatDateForAPI(formValue.hireDate),
          employmentStatus: formValue.employmentStatus,
          employmentType: formValue.employmentType,
          branchId: branchId,
          orgId: formValue.organization,
          shiftId: formValue.shift,
          gradeId: formValue.grade,
          basicSalary: formValue.basicSalary,
          maxSalary: formValue.maxSalary
        },
        contacts: [{
          contactId: existingContactId || undefined,
          contactType: 'Primary', // Add required field
          contactName: `${formValue.firstName} ${formValue.lastName}`, // Add required field
          email: formValue.email,
          phonePrimary: formValue.phonePrimary,
          isEmergencyContact: false,
          relationship: 'Self',
          priorityLevel: 1
        }],
        addresses: [{
          addressId: existingAddressId || undefined,
          addressType: formValue.addressType || 'Permanent',
          addressLine1: formValue.addressLine1,
          addressLine2: formValue.addressLine2,
          thromde: formValue.thromde,
          dzongkhag: formValue.dzongkhag,
          country: formValue.nationality === 'Bhutanese' ? 'Bhutan' : 'Non-Bhutanese',
          isCurrent: true
        }],
        bankDetails: [{
          bankDetailId: existingBankDetailId || undefined,
          bankName: formValue.bankName,
          branchName: formValue.branchName,
          accountNumber: formValue.accountNumber,
          accountType: formValue.accountType
        }],
        updateOperation: true
      };

      // Add headers with auth token
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authService.getToken()}`
      });

      this.http.put(`${this.apiUrl}/${empId}`, payload, { headers }).subscribe({
        next: (response) => {
          this.isSaving = false;
          this.closeEditModal();
          this.loadEmployeeById(empId);
        },
        error: (error: HttpErrorResponse) => {
          this.isSaving = false;
          console.error('Update error:', {
            status: error.status,
            error: error.error,
            url: error.url
          });

          if (error.error) {
            if (typeof error.error === 'string') {
              this.errorMessage = error.error;
            } else if (error.error.message) {
              this.errorMessage = error.error.message;
            } else if (error.error.errors) {
              this.errorMessage = Object.values(error.error.errors).join('\n');
            }
          } else {
            this.errorMessage = `Update failed: ${error.status} ${error.statusText}`;
          }
        }
      });
    } catch (error) {
      this.isSaving = false;
      this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      console.error('Error in saveEmployee:', error);
    }
  }

  // In your formatDateForAPI method
  private formatDateForAPI(date: Date | string): string {
    try {
      const d = date ? new Date(date) : new Date();
      if (isNaN(d.getTime())) throw new Error('Invalid date');
      return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    } catch (e) {
      console.error('Date formatting error:', e);
      return ''; // or handle differently
    }
  }

  private getBranchId(locationName: string): string {
    if (!locationName) {
      console.error('Location name is empty');
      return '';
    }

    const branch = this.branches.find(b =>
      b.branchName.trim().toLowerCase() === locationName.trim().toLowerCase()
    );

    if (!branch) {
      console.error('Branch not found for location:', locationName);
      throw new Error(`Branch not found for location: ${locationName}`);
    }

    return branch.branchId;
  }

  private extractErrorMessage(error: any): string {
    if (!error) return 'An unknown error occurred';

    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'Network error: Could not connect to server';
      }
      if (error.status === 404) {
        return 'The requested resource was not found';
      }

      try {
        const serverError = error.error;
        if (serverError?.message) {
          return serverError.message;
        }
        if (typeof serverError === 'string') {
          return serverError;
        }
      } catch (e) {
        console.error('Error parsing error response:', e);
      }

      return `Server error: ${error.status} ${error.statusText}`;
    }

    return error.message || 'An unknown error occurred';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (!file.type.match(/image\/*/)) {
        this.errorMessage = 'Only image files are allowed';
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        this.errorMessage = 'File size must be less than 2MB';
        return;
      }

      this.selectedFile = file;
      this.errorMessage = '';

      const reader = new FileReader();
      reader.onload = (e) => {
        this.profileImageUrl = this.sanitizer.bypassSecurityTrustUrl(e.target?.result as string) as string;
      };
      reader.readAsDataURL(file);
    }
  }

  uploadPhoto(): void {
    if (!this.selectedFile || !this.employee) return;

    this.isUploading = true;

    const reader = new FileReader();
    reader.onload = () => {
      this.isUploading = false;
      this.profileImageUrl = reader.result as string;
      if (this.employee) {
        this.employee.profileImage = this.profileImageUrl;
      }
    };
    reader.readAsDataURL(this.selectedFile);
  }

  formatDate(date: string | null | undefined): string {
    if (!date) return 'N/A';
    return this.datePipe.transform(date, 'mediumDate') || 'N/A';
  }

  getStatusBadgeClass(status: string | undefined): string {
    if (!status) return 'bg-secondary';
    switch (status.toLowerCase()) {
      case 'active': return 'bg-success';
      case 'inactive': return 'bg-danger';
      case 'on leave': return 'bg-warning';
      default: return 'bg-secondary';
    }
  }


  exportToPDF(): void {
    if (!this.employee) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 15;

    // Add title
    doc.setFontSize(18);
    doc.setTextColor(40);
    doc.text('Employee Details', pageWidth / 2, 20, { align: 'center' });

    // Add employee name and code
    doc.setFontSize(14);
    doc.text(`Name: ${this.employee.firstName} ${this.employee.lastName}`, margin, 35);
    doc.text(`Employee Code: ${this.employee.empCode}`, margin, 45);

    // Add department and position
    doc.text(`Department: ${this.employee.department || 'N/A'}`, margin, 55);
    doc.text(`Position: ${this.employee.positionName || 'N/A'}`, margin, 65);

    // Add employment status
    doc.text(`Employment Status: ${this.employee.employmentStatus || 'N/A'}`, margin, 75);

    // Add horizontal line
    doc.setDrawColor(200);
    doc.line(margin, 80, pageWidth - margin, 80);

    let yPosition = 90;

    // Personal Information Section
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text('Personal Information', margin, yPosition);
    yPosition += 10;

    const personalData = [
      ['Date of Birth', this.formatDate(this.employee.dateOfBirth)],
      ['Gender', this.employee.gender || 'N/A'],
      ['Marital Status', this.employee.maritalStatus || 'N/A'],
      ['Nationality', this.employee.nationality || 'N/A'],
      ['CID Number', this.employee.cidNumber || 'N/A']
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Field', 'Value']],
      body: personalData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Contact Information Section
    doc.setFontSize(14);
    doc.text('Contact Information', margin, yPosition);
    yPosition += 10;

    const contactData = [
      ['Email', this.employee.contact?.email || 'N/A'],
      ['Primary Phone', this.employee.contact?.phonePrimary || 'N/A'],
      ['Secondary Phone', this.employee.contact?.phoneSecondary || 'N/A']
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['Field', 'Value']],
      body: contactData,
      margin: { left: margin, right: margin },
      styles: { fontSize: 10 },
      headStyles: { fillColor: [41, 128, 185], textColor: 255 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    // Address Information Section
    if (this.employee.address) {
      doc.setFontSize(14);
      doc.text('Address Information', margin, yPosition);
      yPosition += 10;

      const addressData = [
        ['Address Type', this.employee.address.addressType || 'N/A'],
        ['Address Line 1', this.employee.address.addressLine1 || 'N/A'],
        ['Address Line 2', this.employee.address.addressLine2 || 'N/A'],
        ['Thromde/Dzongkhag', this.employee.address.thromde || this.employee.address.dzongkhag || 'N/A'],
        ['Country', this.employee.address.country || 'N/A']
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Field', 'Value']],
        body: addressData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // Bank Information Section
    if (this.employee.bankDetail) {
      doc.setFontSize(14);
      doc.text('Bank Information', margin, yPosition);
      yPosition += 10;

      const bankData = [
        ['Bank Name', this.employee.bankDetail.bankName || 'N/A'],
        ['Branch Name', this.employee.bankDetail.branchName || 'N/A'],
        ['Account Number', this.employee.bankDetail.accountNumber || 'N/A'],
        ['Account Type', this.employee.bankDetail.accountType || 'N/A']
      ];

      autoTable(doc, {
        startY: yPosition,
        head: [['Field', 'Value']],
        body: bankData,
        margin: { left: margin, right: margin },
        styles: { fontSize: 10 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });
    }

    // Add footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(10);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, doc.internal.pageSize.getHeight() - 10, { align: 'right' });
      doc.text('Generated by ERP System', margin, doc.internal.pageSize.getHeight() - 10);
    }

    // Save the PDF
    doc.save(`Employee_${this.employee.empCode}_Details.pdf`);
  }

}

