// Tashi Tshering

import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormArray, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { catchError, throwError, tap, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from 'src/app/core/services/auth.service';



// =============================================
// INTERFACE DEFINITIONS
// =============================================

/**
 * Core employee data structures
 */
interface Department {
  dept_id: string;
  dept_name: string;
  dept_code: string;
  org_name: string;
  branch_name: string;
  budget_allocation: number;
  sub_departments_count: number;
}

interface Position {
  positionId: string;
  positionName: string;
  positionCode: string;
  deptName: string;
}

interface Grade {
  gradeId: string;
  gradeName: string;
  gradeCode: string;
  minSalary: number;
  maxSalary: number;
}

interface SalaryStructure {
  gradeId: string;
  gradeName: string;
  minSalary: number;
  maxSalary: number;
  salaryStructures: any[];
}

interface Branch {
  branchId: string;
  branchName: string;
  branchCode: string;
  dzongkhag: string;
  thromde: string;
  operationalStatus: boolean;
  organizationName: string;
}

/**
 * Employee sub-structures
 */
interface Address {
  addressId?: string;
  addressType: 'Permanent' | 'Temporary' | 'Correspondence';
  addressLine1: string;
  addressLine2: string;
  thromde: string;
  dzongkhag: string;
  country: string;
  isCurrent: boolean;
}

interface BankDetail {
  bankDetailId?: string;
  bankName: string;
  branchName: string;
  accountNumber: string;
  accountType: string;
}

interface Qualification {
  qualificationId?: string;
  institutionName: string;
  degreeName: string;
  specialization: string;
  yearOfCompletion: number;
}

interface Contact {
  contactId?: string;
  email: string;
  phonePrimary: string;
  isEmergencyContact: boolean;
}

/**
 * Main Employee interface
 */
interface Employee {
  profileImage?: string;
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
  hireDate: string;
  employmentStatus: string;
  employmentType: 'Regular' | 'Contract' | 'Temporary' | 'Probation' | 'Intern' | 'Consultant';
  email: string;
  department: string;
  location: string;
  positionId?: string;
  positionName?: string;
  gradeId?: string;
  basicSalary?: number;
  maxSalary?: number;
  qualifications: Qualification[];
  bankDetails: BankDetail[];
  addresses: Address[];
  contacts: Contact[];
  orgId?: string;
  branchId?: string;
  createdDate?: string;
  modifiedDate?: string;
}

interface ApiEmployeeResponse {
  employee: {
    empId: string;
    orgId: string;
    branchId: string;
    deptId: string;
    gradeId: string;
    positionId: string;
    empCode: string;
    firstName: string;
    middleName: string | null;
    lastName: string;
    dateOfBirth: string;
    gender: string;
    maritalStatus: string | null;
    bloodGroup: string;
    nationality: string;
    socialSecurityNumber: string;
    cidNumber: string;
    hireDate: string;
    employmentStatus: string;
    employmentType: 'Regular' | 'Contract' | 'Temporary' | 'Probation' | 'Intern' | 'Consultant';
    basicSalary: number;
    maxSalary: number;
    createdDate: string;
    modifiedDate: string;
  };
  contacts: any[];
  addresses: any[];
  qualifications: any[];
  bankDetails: any[];
  history: any[];
}

// =============================================
// COMPONENT DEFINITION
// =============================================

@Component({
  selector: 'app-emp-det',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DatePipe],
  templateUrl: './emp-det.component.html',
  styleUrls: ['./emp-det.component.scss']
})
export class EmployeeDetailComponent implements OnInit {
  // =============================================
  // COMPONENT STATE
  // =============================================

  // Form Management
  employeeForm: FormGroup;
  isEditMode = false;
  editedIndex = -1;
  selectedEmployee: Employee | null = null;
  selectedBranchId: string = '';
  // UI State
  showModal = false;
  showViewModal = false;
  modalActiveTab: string = 'basic';
  activeTab = 'All Employee';
  activeViewTab: string = '';
  searchQuery = '';
  isLoading = false;
  isSaving = false;
  errorMessage = '';

  // Data Collections
  employees: Employee[] = [];
  filteredEmployees: Employee[] = [];
  grades: Grade[] = [];
  selectedGrade: Grade | null = null;
  salaryStructure: SalaryStructure | null = null;
  tabDepartments: (Department | string)[] = ['All Employee'];
  filteredDepartments: Department[] = [];
  formDepartments: Department[] = [];
  positions: Position[] = [];
  filteredPositions: Position[] = [];
  branches: Branch[] = [];
  locations: string[] = [];
organizations: any[] = [];
selectedOrgId: string = '';

  // Pagination
  currentPage = 1;
  itemsPerPage = 10;
  totalItems = 0;
  pageSizeOptions = [5, 10, 25, 50];
  Math = Math;
  selectedFiles: File[] = [];
employeeDocuments: any[] = [];

  // API Configuration
  private readonly apiUrl = `${environment.apiUrl}/api/v1/employees`;
  private readonly deptApiUrl = `${environment.apiUrl}/api/v1/departments`;
  private readonly positionApiUrl = `${environment.apiUrl}/api/v1/job-positions`;
  private readonly branchApiUrl = `${environment.apiUrl}/api/v1/branches`;
  private readonly gradeApiUrl = `${environment.apiUrl}/api/v1/job-grades`;
  private readonly orgApiUrl = `${environment.apiUrl}/api/v1/organizations`;
   private readonly documentUploadUrl = `${environment.apiUrl}/api/archive/upload`;
  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    })
  };

  // Mapping dictionaries
  private departmentMap: { [key: string]: string } = {};
  private positionMap: { [key: string]: string } = {};
  private locationMap: { [key: string]: string } = {};

  // =============================================
  // COMPONENT INITIALIZATION
  // =============================================

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService 
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.route.snapshot.paramMap.get('empCode');
    this.loadInitialData();
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
      email: ['', [Validators.required, Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)]],
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
      country: ['Bhutan']
    });
      this.onNationalityChange();

  }
get educations(): FormArray {
  return this.employeeForm.get('educations') as FormArray;
}
addEducation(): void {
  // First, save the main education if it has values
  if (this.hasMainEducationValues()) {
    this.saveMainEducationToArray();
  }
  
  // Add a new empty education form group
  this.educations.push(this.createEducationFormGroup());
  
  // Clear the main form
  this.clearMainEducationForm();
}

// Check if main education form has values
private hasMainEducationValues(): boolean {
  return !!this.employeeForm.get('institutionName')?.value ||
         !!this.employeeForm.get('degreeName')?.value ||
         !!this.employeeForm.get('specialization')?.value ||
         !!this.employeeForm.get('yearOfCompletion')?.value;
}

// Save main education to the educations array
private saveMainEducationToArray(): void {
  const mainEducation: Qualification = {
    institutionName: this.employeeForm.get('institutionName')?.value,
    degreeName: this.employeeForm.get('degreeName')?.value,
    specialization: this.employeeForm.get('specialization')?.value,
    yearOfCompletion: this.employeeForm.get('yearOfCompletion')?.value
  };
  
  this.educations.insert(0, this.createEducationFormGroup(mainEducation));
}

// Clear main education form
private clearMainEducationForm(): void {
  this.employeeForm.patchValue({
    institutionName: '',
    degreeName: '',
    specialization: '',
    yearOfCompletion: 0
  });
}

// Create education form group
private createEducationFormGroup(education?: Qualification): FormGroup {
  return this.fb.group({
    qualificationId: [education?.qualificationId || ''],
    institutionName: [education?.institutionName || ''],
    degreeName: [education?.degreeName || ''],
    specialization: [education?.specialization || ''],
    yearOfCompletion: [education?.yearOfCompletion || null]
  });
}

// Remove education entry
removeEducation(index: number): void {
  this.educations.removeAt(index);
}
  // =============================================
  // DATA LOADING METHODS
  // =============================================

  /**
   * Initial data loading sequence
   */
  private loadInitialData(): void {
    this.isLoading = true;
    
    Promise.all([
      this.loadOrganizations(),
      this.loadBranches(),
      this.loadGrades()
    ])
      .then(() => {
        if (this.branches.length > 0) {
          this.selectedBranchId = this.branches[0].branchId;
        }
        return this.loadDepartments(this.selectedBranchId);
      })
      .then(() => {
        this.loadEmployees();
        this.loadPositions();
      })
      .catch(() => {
        this.isLoading = false;
      });
  }
private loadOrganizations(): Promise<void> {
  return new Promise((resolve, reject) => {
    this.http.get<any[]>(this.orgApiUrl, this.httpOptions)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading organizations:', error);
          reject(error);
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (orgs) => {
          this.organizations = orgs;
          if (orgs.length > 0) {
            this.selectedOrgId = orgs[0].orgId; // Default to first organization
          }
          resolve();
        },
        error: (error) => {
          console.error('Error loading organizations:', error);
          reject(error);
        }
      });
  });
}
  /**
   * Load branches data
   */
  // private loadBranches(): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     // Immediately set "All Branches" as default
  //     this.branches = [{
  //       branchId: '',
  //       branchName: 'All Branches',
  //       branchCode: '',
  //       dzongkhag: '',
  //       thromde: '',
  //       operationalStatus: true,
  //       organizationName: ''
  //     }];
  //     this.selectedBranchId = '';
      
  //     this.http.get<Branch[]>(this.branchApiUrl, this.httpOptions)
  //       .pipe(
  //         catchError(() => {
  //           resolve(); // Still resolve to continue flow
  //           return of([]);
  //         })
  //       )
  //       .subscribe({
  //         next: (branches) => {
  //           // Add loaded branches after the initial "All Branches"
  //           this.branches = [...this.branches, ...branches];
            
  //           // Build location map
  //           this.locationMap = {};
  //           branches.forEach(branch => {
  //             this.locationMap[branch.branchId] = branch.branchName;
  //           });
            
  //           resolve();
  //         },
  //         error: (error) => {
  //           reject(error);
  //         }
  //       });
  //   });
  // }

private loadBranches(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Immediately set "All Branches" as default
    this.branches = [{
      branchId: '',
      branchName: 'All Branches',
      branchCode: '',
      dzongkhag: '',
      thromde: '',
      operationalStatus: true,
      organizationName: ''
    }];
    this.selectedBranchId = '';
    
    this.http.get<Branch[]>(this.branchApiUrl, this.httpOptions)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Error loading branches:', error);
          resolve(); // Still resolve to continue flow
          return of([]);
        })
      )
      .subscribe({
        next: (branches) => {
          // Add loaded branches after the initial "All Branches"
          this.branches = [...this.branches, ...branches];
          
          // Build location map and locations array
          this.locationMap = {};
          this.locations = []; // Clear existing locations
          
          branches.forEach(branch => {
            this.locationMap[branch.branchId] = branch.branchName;
            this.locations.push(branch.branchName); // Add branch name to locations array
          });
          
          resolve();
        },
        error: (error) => {
          console.error('Error loading branches:', error);
          reject(error);
        }
      });
  });
}
// Branch change handler for form add/edit model
onBranchChangeInForm(): void {
  const selectedBranchName = this.employeeForm.get('location')?.value;
  const selectedBranch = this.branches.find(b => b.branchName === selectedBranchName);
  
  if (selectedBranch) {
    this.loadDepartments(selectedBranch.branchId).then(() => {
      // Reset department selection when branch changes
      this.employeeForm.get('department')?.setValue('');
    });
  }
}

// nationality change handler for the form add
onNationalityChange(): void {
  const isBhutanese = this.employeeForm.get('nationality')?.value === 'Bhutanese';
  
  // Get form controls
  const addressLine1 = this.employeeForm.get('addressLine1');
  const addressLine2 = this.employeeForm.get('addressLine2');
  const thromde = this.employeeForm.get('thromde');
  const dzongkhag = this.employeeForm.get('dzongkhag');

  // Clear and reset fields based on nationality
  if (isBhutanese) {
    // Clear Non-Bhutanese fields only if they exist
    if (addressLine2?.value) {
      this.employeeForm.patchValue({ addressLine2: '' });
    }
    
    // Set validators for Bhutanese fields
    addressLine1?.clearValidators();
    addressLine2?.clearValidators();
    thromde?.clearValidators();
    dzongkhag?.clearValidators();
  } else {
    // Clear Bhutanese fields only if they exist
    if (thromde?.value || dzongkhag?.value) {
      this.employeeForm.patchValue({
        thromde: '',
        dzongkhag: ''
      });
    }
    
    // Set validators for Non-Bhutanese fields
    addressLine1?.clearValidators();
    addressLine2?.clearValidators();
    thromde?.clearValidators();
    dzongkhag?.clearValidators();
  }

  // Update validity for all affected controls
  addressLine1?.updateValueAndValidity();
  addressLine2?.updateValueAndValidity();
  thromde?.updateValueAndValidity();
  dzongkhag?.updateValueAndValidity();
}
  /**
   * Load departments for a specific branch
   */
  private loadDepartments(branchId?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let url = this.deptApiUrl;
      if (branchId) {
        url = `${this.deptApiUrl}/branch/${branchId}`;
      }

      this.http.get<{ success: boolean, message: string, data: Department[] }>(url, this.httpOptions)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            this.errorMessage = 'Failed to load departments. Please try again later.';
            reject(error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.formDepartments = response.data;
              this.filteredDepartments = [...response.data];
              this.departmentMap = {};

              this.tabDepartments = [
                'All Employee',
                ...response.data.map(dept => dept.dept_name)
              ];

              response.data.forEach(dept => {
                this.departmentMap[dept.dept_id] = dept.dept_name;
              });
              resolve();
            } else {
              reject(new Error('Invalid department data'));
            }
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }
// Add these to your EmployeeDetailComponent class

hasActiveFilters(): boolean {
  return !!this.selectedBranchId || 
         this.activeTab !== 'All Employee' || 
         !!this.searchQuery;
}
/**
   * clear all filters
   */
clearAllFilters(): void {
  // Reset branch filter
  this.selectedBranchId = '';
  
  // Reset department filter
  this.activeTab = 'All Employee';
  
  // Reset search
  this.searchQuery = '';
  
  // Apply the cleared filters
  this.applyFilters();
}
  /**
   * Load job positions
   */
  private loadPositions(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Position[]>(this.positionApiUrl, this.httpOptions)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            this.errorMessage = 'Failed to load positions. Please try again later.';
            reject(error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (positions) => {
            this.positions = positions;
            this.filteredPositions = [...positions];
            this.positionMap = {};

            positions.forEach(pos => {
              this.positionMap[pos.positionId] = pos.positionName;
            });
            resolve();
          },
          error: (error) => {
            this.errorMessage = 'Failed to load positions. Please try again later.';
            reject(error);
          }
        });
    });
  }

  /**
   * Load job grades
   */
  private loadGrades(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.http.get<Grade[]>(this.gradeApiUrl, this.httpOptions)
        .pipe(
          catchError((error: HttpErrorResponse) => {
            this.errorMessage = 'Failed to load grades. Please try again later.';
            reject(error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: (grades) => {
            this.grades = grades;
            resolve();
          },
          error: (error) => {
            reject(error);
          }
        });
    });
  }

  /**
   * Load employee data
   */
  private loadEmployees(): void {
  this.isLoading = true;
  this.errorMessage = '';

  const currentUser = this.authService.currentUserValue;
  const isAdmin = currentUser?.roleCode === 'ROLE_ADMIN';
  const isEmployee = currentUser?.roleCode === 'ROLE_EMPLOYEE';
  const isCTO = currentUser?.roleCode === 'ROLE_CTO';

  let apiUrl = this.apiUrl;
  
  // If user is employee, only fetch their own data
  if (isEmployee && currentUser?.empId) {
    apiUrl = `${this.apiUrl}/${currentUser.empId}`;
  }
  // If user is CTO, maybe fetch employees in their department
  else if (isCTO && currentUser?.ctoId) {
    apiUrl = `${this.apiUrl}/cto/${currentUser.ctoId}`;
  }

  this.http.get<ApiEmployeeResponse[] | ApiEmployeeResponse>(apiUrl, this.httpOptions)
    .pipe(
      catchError((error: HttpErrorResponse) => {
        this.isLoading = false;
        this.handleError(error);
        return throwError(() => error);
      })
    )
    .subscribe({
      next: (response) => {
        if (isEmployee || isCTO) {
          // Handle single employee/limited response
          const singleResponse = response as ApiEmployeeResponse;
          this.employees = [this.mapApiEmployee(singleResponse)];
        } else {
          // Handle array response for admin
          const arrayResponse = response as ApiEmployeeResponse[];
          this.employees = arrayResponse.map(emp => this.mapApiEmployee(emp));
        }
        
        this.applyFilters();
        this.isLoading = false;
      },
      error: () => this.isLoading = false
    });
}
private handleError(error: HttpErrorResponse): void {
  if (error.status === 404) {
    this.errorMessage = 'API endpoint not found. Check if the server is running.';
  } else if (error.status === 0) {
    this.errorMessage = 'Failed to connect to server. Check your network.';
  } else if (error.status === 403) {
    this.errorMessage = 'You do not have permission to access this resource.';
  } else {
    this.errorMessage = 'An unexpected error occurred.';
  }
}
// user permission
canAddEmployee(): boolean {
  return this.authService.hasPermission('EMP_CREATE') || 
         this.authService.currentUserValue?.roleCode === 'ROLE_ADMIN';
}

canEditEmployee(): boolean {
  return this.authService.hasPermission('EMP_EDIT') || 
         this.authService.currentUserValue?.roleCode === 'ROLE_ADMIN';
}

canDeleteEmployee(): boolean {
  return this.authService.hasPermission('EMP_DELETE') || 
         this.authService.currentUserValue?.roleCode === 'ROLE_ADMIN';
}

canExport(): boolean {
  return this.authService.hasPermission('EMP_EXPORT') || 
         this.authService.currentUserValue?.roleCode === 'ROLE_ADMIN';
}
    /**
   * Map API response to local employee structure
   */
  private mapApiEmployee(apiEmployee: ApiEmployeeResponse): Employee {
    const primaryContact = apiEmployee.contacts?.slice(-1)[0] || {
      email: '', phonePrimary: '', isEmergencyContact: false
    };
    const primaryAddress = apiEmployee.addresses?.slice(-1)[0] || {
      addressType: 'Permanent', addressLine1: '', addressLine2: '',
      thromde: '', dzongkhag: '', country: 'Bhutan', isCurrent: true
    };
    const primaryQualification = apiEmployee.qualifications?.slice(-1)[0] || {
      institutionName: '', degreeName: '', specialization: '', yearOfCompletion: 0
    };
    const primaryBankDetail = apiEmployee.bankDetails?.slice(-1)[0] || {
      bankName: '', branchName: '', accountNumber: '', accountType: ''
    };

    return {
      empId: apiEmployee.employee.empId,
      empCode: apiEmployee.employee.empCode,
      firstName: apiEmployee.employee.firstName,
      middleName: apiEmployee.employee.middleName || undefined,
      lastName: apiEmployee.employee.lastName,
      dateOfBirth: apiEmployee.employee.dateOfBirth,
      gender: apiEmployee.employee.gender,
      maritalStatus: apiEmployee.employee.maritalStatus || 'Single',
      nationality: apiEmployee.employee.nationality,
      cidNumber: apiEmployee.employee.cidNumber,
      hireDate: apiEmployee.employee.hireDate,
      employmentStatus: apiEmployee.employee.employmentStatus,
      employmentType: apiEmployee.employee.employmentType,
      email: primaryContact.email,
      department: this.getDepartmentName(apiEmployee.employee.deptId),
      positionId: apiEmployee.employee.positionId,
      positionName: this.getPositionName(apiEmployee.employee.positionId),
      location: this.getLocationName(apiEmployee.employee.branchId),
      orgId: apiEmployee.employee.orgId,
      branchId: apiEmployee.employee.branchId,
      gradeId: apiEmployee.employee.gradeId,
      basicSalary: apiEmployee.employee.basicSalary,
      maxSalary: apiEmployee.employee.maxSalary,
      contacts: [primaryContact],
      addresses: [primaryAddress],
      qualifications: [primaryQualification],
      bankDetails: [primaryBankDetail]
    };
  }

  // =============================================
  // UI INTERACTION METHODS
  // =============================================

  /**
   * Modal tab management
   */
  selectModalTab(tab: string): void {
    this.modalActiveTab = tab;
  }

  isModalTabActive(tab: string): boolean {
    return this.modalActiveTab === tab;
  }

  /**
   * View tab management
   */
  setActiveTab(tabId: string): void {
    this.activeViewTab = tabId;
  }

  isTabActive(tabId: string): boolean {
    return this.activeViewTab === tabId;
  }

  /**
   * Open/close modal methods
   */
  openModal(): void {
    this.showModal = true;
    this.isEditMode = false;
    this.editedIndex = -1;
    this.selectModalTab('basic');

    this.loadPositions().then(() => {
      this.employeeForm.reset({
        department: '',
        position: '',
        location: '',
        gender: '',
        maritalStatus: '',
        employmentStatus: '',
        employmentType: '',
        accountType: '',
        addressType: '',
        grade: '',
        organization: this.selectedOrgId,
        nationality: 'Bhutanese'
      });
 this.onNationalityChange();
      if (this.employeeForm.get('department')?.value) {
        this.employeeForm.get('position')?.enable();
      }
    }).catch(error => {
      console.error('Failed to load positions:', error);
      this.employeeForm.reset({
        department: this.formDepartments.length > 0 ? this.formDepartments[0].dept_id : '',
        position: null,
        location: this.locations[0],
        maritalStatus: 'Single',
        employmentStatus: 'Active',
        employmentType: 'Regular',
        addressType: 'Permanent'
      });
    });
  }

  closeModal(): void {
    this.showModal = false;
    this.employeeForm.reset();
    this.errorMessage = '';
  }

  closeViewModal(): void {
    this.showViewModal = false;
    this.selectedEmployee = null;
  }

  // =============================================
  // FORM HANDLING METHODS
  // =============================================

  /**
   * Handle branch selection change
   */
onBranchChange(): void {
  this.currentPage = 1;
  this.loadDepartments(this.selectedBranchId).then(() => {
    this.applyFilters();
  });
}
onOrganizationChange(): void {
  const orgId = this.employeeForm.get('organization')?.value;
  if (orgId) {
    this.selectedOrgId = orgId;
    // You might want to reload branches when organization changes
    this.loadBranches();
  }
}
  /**
   * Handle department selection change
   */
  onDepartmentChange(): void {
    const positionControl = this.employeeForm.get('position');
    positionControl?.enable();

    if (this.positions.length > 0 && !positionControl?.value) {
      positionControl?.setValue(this.positions[0].positionId);
    }
  }

  /**
   * Handle position selection change
   */
  onPositionChange(): void {
    const selectedPositionId = this.employeeForm.get('position')?.value;
    console.log('Position changed to:', selectedPositionId);
  }

  /**
   * Handle grade selection change
   */
  onGradeChange(event: Event): void {
    const gradeId = (event.target as HTMLSelectElement).value;
    if (gradeId) {
      this.selectedGrade = this.grades.find(g => g.gradeId === gradeId) || null;
      if (this.selectedGrade) {
        this.fetchSalaryStructure(gradeId);
      }
    } else {
      this.selectedGrade = null;
      this.salaryStructure = null;
      this.employeeForm.patchValue({
        basicSalary: '',
        maxSalary: ''
      });
    }
  }

  /**
   * Fetch salary structure for selected grade
   */
  private fetchSalaryStructure(gradeId: string): void {
    this.http.get<SalaryStructure>(`${this.gradeApiUrl}/${gradeId}/with-salary-structure`, this.httpOptions)
      .pipe(
        catchError((error: HttpErrorResponse) => {
          console.error('Failed to load salary structure:', error);
          this.errorMessage = 'Failed to load salary details.';
          return throwError(() => error);
        })
      )
      .subscribe({
        next: (structure) => {
          this.salaryStructure = structure;
          this.employeeForm.patchValue({
            basicSalary: structure.minSalary,
            maxSalary: structure.maxSalary
          });
        },
        error: (error) => {
          console.error('Error loading salary structure:', error);
        }
      });
  }

  /**
   * Set form values for editing an employee
   */
  private setFormValues(emp: Employee, deptId: string): void {
    const primaryContact = emp.contacts?.[0] || {
      email: '',
      phonePrimary: '',
      isEmergencyContact: false
    };

    const primaryBank = emp.bankDetails?.[0] || {
      bankName: '',
      branchName: '',
      accountNumber: '',
      accountType: ''
    };

    const highestQualification = emp.qualifications?.[0] || {
      institutionName: '',
      degreeName: '',
      specialization: '',
      yearOfCompletion: 0
    };

   const currentAddress: Address = emp.addresses?.find(a => a.isCurrent) || emp.addresses?.[0] || {
        addressType: 'Permanent',
        addressLine1: '',
        addressLine2: '',
        thromde: '',
        dzongkhag: '',
        country: 'Bhutan',
        isCurrent: false
    };

    this.employeeForm.patchValue({
      empCode: emp.empCode,
      firstName: emp.firstName,
      middleName: emp.middleName,
      lastName: emp.lastName,
      dateOfBirth: this.formatDateForInput(emp.dateOfBirth),
      gender: emp.gender,
      maritalStatus: emp.maritalStatus,
      nationality: emp.nationality || 'Bhutanese',
      cidNumber: emp.cidNumber,
      organization: emp.orgId || this.selectedOrgId,
      hireDate: this.formatDateForInput(emp.hireDate),
      employmentStatus: emp.employmentStatus,
      employmentType: emp.employmentType || '',
      email: primaryContact.email,
      department: deptId || '',
      position: emp.positionId || null,
      location: emp.location,
      phonePrimary: primaryContact.phonePrimary,
      grade: emp.gradeId || '',
      basicSalary: emp.basicSalary || '',
      maxSalary: emp.maxSalary || '',
      bankName: primaryBank.bankName,
      branchName: primaryBank.branchName,
      accountNumber: primaryBank.accountNumber,
      accountType: primaryBank.accountType,
      institutionName: highestQualification.institutionName,
      degreeName: highestQualification.degreeName,
      specialization: highestQualification.specialization,
      yearOfCompletion: highestQualification.yearOfCompletion || 0,
      addressType: currentAddress.addressType,
        addressLine1: currentAddress.addressLine1,
        addressLine2: currentAddress.addressLine2,
        thromde: currentAddress.thromde,
        dzongkhag: currentAddress.dzongkhag
    });
this.onNationalityChange();
    if (emp.gradeId) {
      this.fetchSalaryStructure(emp.gradeId);
    }
    while (this.educations.length) {
    this.educations.removeAt(0);
  }
    if (emp.qualifications && emp.qualifications.length > 0) {
    // Set first qualification in main form
    const [firstQualification, ...additionalQualifications] = emp.qualifications;
    
    this.employeeForm.patchValue({
      institutionName: firstQualification.institutionName,
      degreeName: firstQualification.degreeName,
      specialization: firstQualification.specialization,
      yearOfCompletion: firstQualification.yearOfCompletion
    });
    
    // Add remaining qualifications to educations array
    additionalQualifications.forEach(qual => {
      this.educations.push(this.createEducationFormGroup(qual));
    });
  }
  }

  // =============================================
  // EMPLOYEE CRUD OPERATIONS
  // =============================================

  /**
   * Save employee (create or update)
   */
saveEmployee(): void {
  
  if (this.employeeForm.invalid) {
    this.errorMessage = 'Please fill all required fields correctly.';
    this.employeeForm.markAllAsTouched();
    
    // Log validation errors for debugging
    Object.keys(this.employeeForm.controls).forEach(key => {
      const control = this.employeeForm.get(key);
      if (control?.invalid) {
        console.error(`Validation error for ${key}:`, control.errors);
      }
    });
    
    return;
  }

  // Save main education to array if it has values
  if (this.hasMainEducationValues()) {
    this.saveMainEducationToArray();
  }

  this.isSaving = true;
  this.errorMessage = '';

  const formValue = this.employeeForm.getRawValue();
  const empId = this.isEditMode ? this.selectedEmployee?.empId : undefined;
  const isBhutanese = formValue.nationality === 'Bhutanese';

  try {
    const branchId = this.getBranchId(formValue.location);
    if (!branchId) {
      throw new Error('Invalid location selected');
    }

    // Get the most recent existing IDs
    const existingContact = this.selectedEmployee?.contacts?.slice(-1)[0];
    const existingAddress = this.selectedEmployee?.addresses?.slice(-1)[0];
    const existingQualification = this.selectedEmployee?.qualifications?.slice(-1)[0];
    const existingBankDetail = this.selectedEmployee?.bankDetails?.slice(-1)[0];

    // Prepare address payload based on nationality
    const addressPayload: any = {
      addressId: existingAddress?.addressId || undefined,
      addressType: formValue.addressType || 'Permanent',
      addressLine1: formValue.addressLine1,
      isCurrent: true
    };

    if (isBhutanese) {
      addressPayload.addressLine2 = ''; // Clear for Bhutanese
      addressPayload.thromde = formValue.thromde;
      addressPayload.dzongkhag = formValue.dzongkhag;
      addressPayload.country = 'Bhutan';
    } else {
      addressPayload.addressLine2 = formValue.addressLine2;
      addressPayload.thromde = ''; // Clear for non-Bhutanese
      addressPayload.dzongkhag = ''; // Clear for non-Bhutanese
      addressPayload.country = 'Non-Bhutanese';
    }

    const payload = {
      employee: {
        empId: empId,
        empCode: formValue.empCode,
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
        gradeId: formValue.grade,
        basicSalary: formValue.basicSalary,
        maxSalary: formValue.maxSalary
      },
      contacts: [{
        contactId: existingContact?.contactId || undefined,
        email: formValue.email,
        phonePrimary: formValue.phonePrimary,
        isEmergencyContact: false,
        relationship: 'Self',
        priorityLevel: 1
      }],
      addresses: [addressPayload],
      qualifications: this.educations.controls.map(control => ({
        qualificationId: control.value.qualificationId || undefined,
        institutionName: control.value.institutionName,
        degreeName: control.value.degreeName,
        specialization: control.value.specialization,
        yearOfCompletion: control.value.yearOfCompletion
      })),
      bankDetails: [{
        bankDetailId: existingBankDetail?.bankDetailId || undefined,
        bankName: formValue.bankName,
        branchName: formValue.branchName,
        accountNumber: formValue.accountNumber,
        accountType: formValue.accountType
      }],
      updateOperation: this.isEditMode
    };

    console.log('Sending payload:', payload);

    const request$ = this.isEditMode && empId
      ? this.http.put(`${this.apiUrl}/${empId}`, payload, this.httpOptions)
      : this.http.post(this.apiUrl, payload, this.httpOptions);

    request$.pipe(
      catchError(err => {
        console.error('Error saving employee:', {
          status: err.status,
          message: err.message,
          error: err.error
        });
        this.errorMessage = this.extractErrorMessage(err);
        this.isSaving = false;
        return throwError(() => err);
      })
    ).subscribe({
      next: (response: ApiEmployeeResponse | any) => {
        const generatedEmpId = (response as ApiEmployeeResponse)?.employee?.empId || 
                             response?.empId || 
                             empId;
        
        if (generatedEmpId && this.selectedFiles.length > 0) {
          // Upload documents if files were selected
          this.uploadDocuments(generatedEmpId).then(() => {
            this.isSaving = false;
            this.closeModal();
            this.handleUpdateResponse(response, empId);
            this.selectedFiles = []; // Clear selected files after upload
          }).catch((uploadError) => {
            console.error('Document upload failed:', uploadError);
            this.isSaving = false;
            this.closeModal();
            this.handleUpdateResponse(response, empId);
            // Optionally show a warning that employee was saved but documents failed
            this.errorMessage = 'Employee saved but document upload failed. You can upload documents later.';
          });
        } else {
          // No documents to upload
          this.isSaving = false;
          this.closeModal();
          this.handleUpdateResponse(response, empId);
        }
        
        const generatedCode = (response as ApiEmployeeResponse)?.employee?.empCode || 
                            response?.empCode || 
                            'N/A';
        console.log('Employee saved successfully with code:', generatedCode);
      },
      error: (err) => {
        console.error('Save failed:', err);
        this.isSaving = false;
      }
    });
  } catch (error) {
    this.errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
    this.isSaving = false;
    console.error('Exception in saveEmployee:', error);
  }
}


  /**
   * Handle response from save operation
   */
  private handleUpdateResponse(response: any, empId?: string): void {
    if (!empId) {
      this.loadEmployees();
      return;
    }

    const updatedEmployee = this.mapApiEmployee(response as ApiEmployeeResponse);

    const index = this.employees.findIndex(e => e.empId === empId);
    if (index !== -1) {
      this.employees[index] = updatedEmployee;
    }

    const filteredIndex = this.filteredEmployees.findIndex(e => e.empId === empId);
    if (filteredIndex !== -1) {
      this.filteredEmployees[filteredIndex] = updatedEmployee;
    }

    this.applyFilters();
  }

  /**
   * Edit an employee
   */
  editEmployee(identifier: number | string): void {
    let employeeToEdit: Employee | undefined;

    if (typeof identifier === 'number') {
      employeeToEdit = this.filteredEmployees[identifier];
    } else {
      employeeToEdit = this.employees.find(emp => emp.empCode === identifier);
    }

    if (!employeeToEdit) return;

    this.isEditMode = true;
    this.selectedEmployee = { ...employeeToEdit };

    const dept = this.formDepartments.find(d =>
      d.dept_name === this.selectedEmployee?.department
    );

    this.loadPositions().then(() => {
      console.log('Available positions:', this.positions);
      console.log('Employee position ID:', employeeToEdit?.positionId);

      this.setFormValues(this.selectedEmployee, dept?.dept_id || '');
      this.showModal = true;
    }).catch(error => {
      console.error('Failed to load positions:', error);
      this.setFormValues(this.selectedEmployee, dept?.dept_id || '');
      this.showModal = true;
    });
  }

  /**
   * Delete an employee
   */
  deleteEmployee(index: number): void {
    const emp = this.filteredEmployees[index];
    if (!emp || !emp.empId) return;

    if (confirm(`Are you sure you want to delete employee ${emp.empCode}?`)) {
      this.http.delete(`${this.apiUrl}/${emp.empId}`, this.httpOptions)
        .pipe(
          catchError(error => {
            this.errorMessage = this.extractErrorMessage(error);
            return throwError(() => error);
          })
        )
        .subscribe({
          next: () => {
            this.employees = this.employees.filter(e => e.empId !== emp.empId);
            this.applyFilters();
          },
          error: (error) => {
            console.error('Delete error:', error);
          }
        });
    }
  }

  /**
   * View employee details
   */
  viewEmployee(empCode: string) {
    this.router.navigate(['view', empCode], { relativeTo: this.route });
  }

  // =============================================
  // FILTERING & PAGINATION
  // =============================================

  /**
   * Apply filters to employee list
   */
  applyFilters(): void {
  const search = this.searchQuery.toLowerCase().trim();
  
  // Cache filter values to avoid repeated property access
  const activeTab = this.activeTab;
  const selectedBranchId = this.selectedBranchId;

  const filtered = this.employees.filter(emp => {
    // Department filter
    const matchesDept = activeTab === 'All Employee' || 
                       emp.department === activeTab;

    // Branch filter - empty string means "All Branches"
    const matchesBranch = selectedBranchId === '' ||
                         emp.branchId === selectedBranchId;

    // Early exit if either filter fails
    if (!matchesDept || !matchesBranch) return false;

    // Only perform search if needed
    if (!search) return true;

    return (
      (emp.empCode?.toLowerCase().includes(search)) ||
      (emp.firstName?.toLowerCase().includes(search)) ||
      (emp.lastName?.toLowerCase().includes(search)) ||
      (emp.email?.toLowerCase().includes(search)) ||
      (emp.positionName?.toLowerCase().includes(search))
    );
  });

  this.totalItems = filtered.length;
  this.currentPage = Math.min(this.currentPage, this.totalPages());
  
  const startIndex = (this.currentPage - 1) * this.itemsPerPage;
  this.filteredEmployees = filtered.slice(startIndex, startIndex + this.itemsPerPage);
}

  /**
   * Select department tab
   */
  selectTab(dept: string): void {
    this.activeTab = dept;
    this.currentPage = 1;
    this.applyFilters();
  }

  /**
   * Pagination methods
   */
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage = page;
    this.applyFilters();
  }

  totalPages(): number {
    return Math.ceil(this.totalItems / this.itemsPerPage);
  }

  getPages(): number[] {
    const pages = [];
    const total = this.totalPages();
    const maxVisiblePages = 5;

    if (total <= maxVisiblePages) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      const half = Math.floor(maxVisiblePages / 2);
      let start = Math.max(1, this.currentPage - half);
      let end = Math.min(total, start + maxVisiblePages - 1);

      if (end - start + 1 < maxVisiblePages) {
        start = Math.max(1, end - maxVisiblePages + 1);
      }

      if (start > 1) {
        pages.push(1);
        if (start > 2) {
          pages.push(-1);
        }
      }

      for (let i = start; i <= end; i++) {
        if (i > 0 && i <= total) {
          pages.push(i);
        }
      }

      if (end < total) {
        if (end < total - 1) {
          pages.push(-1);
        }
        pages.push(total);
      }
    }

    return pages;
  }

  onItemsPerPageChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  // =============================================
  // UTILITY METHODS
  // =============================================

  /**
   * Get department name from ID
   */
  private getDepartmentName(deptId: string): string {
    const dept = this.formDepartments.find(d => d.dept_id === deptId);
    return dept?.dept_name || 'Not specified';
  }

  /**
   * Get position name from ID
   */
  private getPositionName(positionId: string): string {
    const position = this.positions.find(p => p.positionId === positionId);
    return position?.positionName || 'Not specified';
  }

  /**
   * Get location name from branch ID
   */
  private getLocationName(branchId: string): string {
    const branch = this.branches.find(b => b.branchId === branchId);
    return branch?.branchName || 'Not specified';
  }

  /**
   * Get branch ID from location name
   */
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
      console.log('Available branches:', this.branches.map(b => b.branchName));
      throw new Error(`Branch not found for location: ${locationName}`);
    }

    return branch.branchId;
  }

  /**
   * Format date for display in input fields
   */
 private formatDateForInput(dateString: string): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  } catch (e) {
    console.error('Date formatting error:', e);
    return '';
  }
}

  /**
   * Format date for API requests
   */
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

  /**
   * Extract error message from HTTP response
   */
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

  // =============================================
  // EXPORT & UI HELPERS
  // =============================================

  /**
   * Export employee data to CSV
   */
  exportToCSV(): void {
    const headers = [
      'Employee Code', 'First Name', 'Middle Name', 'Last Name', 'Date of Birth', 'Gender',
      'Marital Status', 'Nationality', 'CID Number',
      'Hire Date', 'Employment Status', 'Employment Type', 'Email', 'Department', 'Position', 'Location',
      'Bank Name', 'Branch Name', 'Account Number', 'Account Type',
      'Institution Name', 'Degree Name', 'Specialization', 'Year of Completion',
      'Thromde', 'Dzongkhag', 'Country', 'Phone Number', 'Emergency Contact'
    ];

    const rows = this.filteredEmployees.map(emp => {
      const primaryContact: Contact = emp.contacts?.[0] || {
        email: '',
        phonePrimary: '',
        isEmergencyContact: false
      };

      const primaryBank: BankDetail = emp.bankDetails?.[0] || {
        bankName: '',
        branchName: '',
        accountNumber: '',
        accountType: ''
      };

      const highestQualification: Qualification = emp.qualifications?.[0] || {
        institutionName: '',
        degreeName: '',
        specialization: '',
        yearOfCompletion: 0
      };

      const currentAddress: Address = emp.addresses?.find(a => a.isCurrent) || emp.addresses?.[0] || {
        addressType: 'Permanent',
        addressLine1: '',
        addressLine2: '',
        thromde: '',
        dzongkhag: '',
        country: 'Bhutan',
        isCurrent: false
      };

      return [
        emp.empCode ?? '',
        emp.firstName ?? '',
        emp.middleName ?? '',
        emp.lastName ?? '',
        emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '',
        emp.gender ?? '',
        emp.maritalStatus ?? '',
        emp.nationality ?? '',
        emp.cidNumber ?? '',
        emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '',
        emp.employmentStatus ?? '',
        emp.employmentType ?? '',
        emp.email ?? '',
        emp.department ?? '',
        emp.positionName ?? '',
        emp.location ?? '',
        primaryBank.bankName ?? '',
        primaryBank.branchName ?? '',
        primaryBank.accountNumber ?? '',
        primaryBank.accountType ?? '',
        highestQualification.institutionName ?? '',
        highestQualification.degreeName ?? '',
        highestQualification.specialization ?? '',
        highestQualification.yearOfCompletion ?? '',
        currentAddress.thromde ?? '',
        currentAddress.dzongkhag ?? '',
        currentAddress.country ?? '',
        primaryContact.phonePrimary ?? '',
        primaryContact.isEmergencyContact ? 'Yes' : 'No'
      ];
    });

    let csvContent = headers.join(',') + '\n';
    rows.forEach(row => {
      csvContent += row.map(field => `"${field.toString().replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `employees_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Get CSS class for department badge
   */
  getDeptBadgeClass(department: string): string {
    const classes: Record<string, string> = {
      'E-Centric': 'emp-dept-e-centric',
      'Content Division': 'emp-dept-content-division',
      'CSO': 'emp-dept-cso',
      'HR': 'emp-dept-hr',
      'Marketing': 'emp-dept-marketing',
      'Finance': 'emp-dept-finance',
      'Management and Accounts': 'emp-dept-management-accounts',
      'SMD': 'emp-dept-smd',
      'IT': 'emp-dept-it',
      'Operations': 'emp-dept-operations',
      'TSSD': 'emp-dept-sales',
      'Customer Support': 'emp-dept-customer-support'
    };
    return classes[department] || 'emp-dept-default';
  }
  ///Document upload
  // File handling methods
triggerFileInput(): void {
  const fileInput = document.querySelector('.file-upload-area input[type="file"]') as HTMLElement;
  fileInput.click();
}

onFileSelected(event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      if (this.validateFile(file)) {
        this.selectedFiles.push(file);
      }
    }
  }
}

validateFile(file: File): boolean {
  const validTypes = ['application/pdf', 'application/msword', 
                     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                     'application/vnd.ms-excel', 
                     'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                     'image/jpeg', 'image/png'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!validTypes.includes(file.type)) {
    this.errorMessage = `Invalid file type: ${file.name}. Only PDF, Word, Excel, JPG, PNG are allowed.`;
    return false;
  }

  if (file.size > maxSize) {
    this.errorMessage = `File too large: ${file.name}. Max size is 5MB.`;
    return false;
  }

  return true;
}

removeFile(index: number): void {
  this.selectedFiles.splice(index, 1);
}

getFileIconClass(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const iconMap: { [key: string]: string } = {
    'pdf': 'bi bi-file-earmark-pdf text-danger',
    'doc': 'bi bi-file-earmark-word text-primary',
    'docx': 'bi bi-file-earmark-word text-primary',
    'xls': 'bi bi-file-earmark-excel text-success',
    'xlsx': 'bi bi-file-earmark-excel text-success',
    'jpg': 'bi bi-file-earmark-image text-info',
    'jpeg': 'bi bi-file-earmark-image text-info',
    'png': 'bi bi-file-earmark-image text-info'
  };
  return iconMap[extension || ''] || 'bi bi-file-earmark-text';
}

formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const sizeValue = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `${sizeValue} ${sizes[i]}`;
}

// Document API methods
uploadDocuments(empId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (this.selectedFiles.length === 0) {
      resolve();
      return;
    }

    const authToken = this.authService.getToken(); // Get your auth token
    if (!authToken) {
      this.errorMessage = 'Authentication required for document upload';
      reject('No auth token');
      return;
    }

    const uploadPromises = this.selectedFiles.map(file => {
      const formData = new FormData();
      formData.append('file', file, file.name);
      formData.append('fileName', file.name); // Using original filename
      formData.append('visibleOnlyToMe', 'false'); // Default visibility

      const headers = new HttpHeaders({
        'Authorization': `Bearer ${authToken}`
      });

      return this.http.post(this.documentUploadUrl, formData, { headers }).toPromise();
    });

    Promise.all(uploadPromises)
      .then(() => {
        this.selectedFiles = [];
        resolve();
      })
      .catch(error => {
        console.error('Document upload failed:', error);
        this.errorMessage = 'Document upload failed. You can try again later.';
        // Still resolve to allow employee save to continue
        resolve();
      });
  });
}

loadEmployeeDocuments(empId: string): void {
  if (!empId) return;
  
  this.http.get<any[]>(`${environment.apiUrl}/api/archive/upload/${empId}`, this.httpOptions)
    .pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading documents:', error);
        return of([]);
      })
    )
    .subscribe({
      next: (documents) => {
        this.employeeDocuments = documents;
      }
    });
}

deleteDocument(docId: string): void {
  if (confirm('Are you sure you want to delete this document?')) {
    this.http.delete(`${environment.apiUrl}/api/archive/${docId}`, this.httpOptions)
      .subscribe({
        next: () => {
          this.employeeDocuments = this.employeeDocuments.filter(doc => doc.id !== docId);
        },
        error: (error) => {
          console.error('Error deleting document:', error);
        }
      });
  }
}

getDocumentUrl(docId: string): string {
  return `${environment.apiUrl}/api/archive/download/${docId}`;
}
}