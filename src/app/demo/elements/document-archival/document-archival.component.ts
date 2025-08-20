import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

export interface DocumentItem {
  id: string;
  documentCode: string;
  userInputFileName: string;
  createdAt: string;
  createdBy: string;
  createdByEmpId: string;
  createdName: string;
  deptId: string;
  createdDeptName: string;
  updatedAt: string | null;
  updatedBy: string | null;
  updatedName: string;
  visibleOnlyToMe: boolean;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
}

export interface Department {
  dept_id: string;
  dept_name: string;
  dept_code: string;
  org_name: string;
  branch_name: string;
  budget_allocation: number;
  sub_departments_count: number;
  documentCount?: number;
  isActive?: boolean;
  manager_emp_id?: string;
}

export interface DepartmentResponse {
  success: boolean;
  message: string;
  data: Department[];
}

export interface UserProfile {
  empId: string;
  roleName: string;
  deptId: string;
  userName: string;
  email: string;
  deptName?: string;
  managedDepartmentId?: string;
}

@Component({
  selector: 'app-document-archival',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-archival.component.html',
  styleUrls: ['./document-archival.component.scss']
})
export class DocumentArchivalComponent implements OnInit {
  
  // Data properties
  documents: DocumentItem[] = [];
  filteredDocuments: DocumentItem[] = [];
  departments: Department[] = [];
  allDocuments: DocumentItem[] = [];
  
  // User and role properties
  userProfile: UserProfile | null = null;
  isAdmin = false;
  isHR = false;
  isManager = false;
  isEmployee = false;
  userDepartmentId = '';
  userDepartment: Department | null = null;
  managedDepartment: Department | null = null;
  
  // Department selection
  selectedDepartment: Department | null = null;
  showDepartmentFolders = true;
  
  // Filter properties
  searchQuery = '';
  selectedFileType = '';
  selectedYear = new Date().getFullYear();
  years: number[] = [];
  
  // Modal properties
  showUploadModal = false;
  showViewModal = false;
  selectedDocument: DocumentItem | null = null;
  
  // Upload properties
  fileName = '';
  selectedFile: File | null = null;
  visibleOnlyToMe = false;
  
  // View properties
  safeUrl: SafeResourceUrl | null = null;
  
  // Loading state
  isLoading = false;
  isDepartmentLoading = false;
  downloadingDocs: Set<string> = new Set();
  
  // Iframe state tracking
  iframeLoaded = false;
  iframeError = false;

  constructor(
    private router: Router,
    private http: HttpClient,
    private authService: AuthService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.generateYearOptions();
    this.loadUserProfile();
  }

  // Load user profile and set role-based permissions
  loadUserProfile(): void {
    this.isLoading = true;
    console.log('Loading user profile...');
    this.getUserInfoFromAuthService();
    this.initializeUserInterface();
  }

  // Get user info from auth service
  private getUserInfoFromAuthService(): void {
    const currentUser = this.authService.getCurrentUser();
    console.log('Current user from auth service:', currentUser);
    
    if (currentUser) {
      this.userProfile = {
        empId: currentUser.empId || currentUser.userId || '',
        roleName: currentUser.roleName || 'employee',
        deptId: currentUser.deptId || currentUser.deptId || '',
        userName: currentUser.username || '',
        email: currentUser.email || '',
      };
      this.setUserRolePermissions();
      console.log('User profile created:', this.userProfile);
    } else {
      console.error('No current user found in auth service');
      this.router.navigate(['/login']);
    }
  }

  // Fixed role permission setting
  private setUserRolePermissions(): void {
    if (!this.userProfile) return;
    
    // Get role information from auth service
    this.isAdmin = this.authService.isAdmin();
    this.isHR = this.authService.isHR();
    this.isManager = this.authService.isManager();
    this.isEmployee = this.authService.isEmployee();
    
    // Ensure at least one role is set
    if (!this.isAdmin && !this.isHR && !this.isManager && !this.isEmployee) {
      this.isEmployee = true; // Default to employee if no role detected
    }
    
    // Set department ID based on role
    if (this.isManager) {
      this.userProfile.managedDepartmentId = this.authService.getManagerDepartmentId() || this.userProfile.deptId;
      this.userDepartmentId = this.userProfile.managedDepartmentId;
    } else {
      this.userDepartmentId = this.userProfile.deptId || '';
    }
    
    console.log('Role permissions set:', {
      roleName: this.userProfile.roleName,
      isAdmin: this.isAdmin,
      isHR: this.isHR,
      isManager: this.isManager,
      isEmployee: this.isEmployee,
      userDepartmentId: this.userDepartmentId,
      managedDepartmentId: this.userProfile.managedDepartmentId
    });
  }

  // Initialize user interface based on role
  private initializeUserInterface(): void {
    console.log('Initializing user interface for role:', this.userProfile?.roleName);
    
    if (this.isEmployee && this.userDepartmentId) {
      console.log('Employee detected, initializing direct interface for dept:', this.userDepartmentId);
      this.initializeEmployeeInterface();
    } else if (this.isManager && this.userDepartmentId) {
      console.log('Manager detected, initializing interface for managed dept:', this.userDepartmentId);
      this.initializeManagerInterface();
    } else if (this.hasAdminAccess()) {
      console.log('Admin/HR detected, loading all departments');
      this.loadDepartments();
    } else {
      console.error('Unknown user role or missing department ID');
      this.isLoading = false;
      alert('Unable to determine user permissions. Please contact administrator.');
    }
  }

  // Initialize employee interface directly
  private initializeEmployeeInterface(): void {
    console.log('Initializing employee interface with deptId:', this.userDepartmentId);
    
    this.loadDepartmentDetails(this.userDepartmentId).then((dept) => {
      if (dept) {
        this.userDepartment = dept;
        this.selectedDepartment = dept;
        this.departments = [dept];
        this.showDepartmentFolders = false;
        
        if (this.userProfile) {
          this.userProfile.deptName = dept.dept_name;
        }
        
        console.log('Employee department loaded:', dept);
        this.loadDocumentsByDepartment(this.userDepartmentId);
      } else {
        this.createFallbackEmployeeDepartment();
      }
    }).catch((error) => {
      console.error('Failed to load employee department details:', error);
      this.createFallbackEmployeeDepartment();
    });
  }

  // Initialize manager interface
  private initializeManagerInterface(): void {
    console.log('Initializing manager interface with managed deptId:', this.userDepartmentId);
    
    this.loadDepartmentDetails(this.userDepartmentId).then((dept) => {
      if (dept) {
        this.managedDepartment = dept;
        this.userDepartment = dept;
        this.selectedDepartment = dept;
        this.departments = [dept];
        this.showDepartmentFolders = false;
        
        if (this.userProfile) {
          this.userProfile.deptName = dept.dept_name;
        }
        
        console.log('Manager department loaded:', dept);
        this.loadDocumentsByDepartment(this.userDepartmentId);
      } else {
        console.error('Manager department not found, loading all departments as fallback');
        this.loadDepartments();
      }
    }).catch((error) => {
      console.error('Failed to load manager department details:', error);
      this.loadDepartments();
    });
  }

  // Create fallback department for employee if API fails
  private createFallbackEmployeeDepartment(): void {
    this.userDepartment = {
      dept_id: this.userDepartmentId,
      dept_name: `Department ${this.userDepartmentId}`,
      dept_code: '',
      org_name: '',
      branch_name: '',
      budget_allocation: 0,
      sub_departments_count: 0,
      documentCount: 0,
      isActive: true
    };

    this.selectedDepartment = this.userDepartment;
    this.departments = [this.userDepartment];
    this.showDepartmentFolders = false;

    console.log('Fallback employee department created:', this.userDepartment);
    this.loadDocumentsByDepartment(this.userDepartmentId);
  }

  // Load specific department details
  private loadDepartmentDetails(deptId: string): Promise<Department | null> {
    return new Promise((resolve) => {
      const url = `${environment.apiUrl}/api/v1/departments`;
      const headers = this.getHeaders();

      this.http.get<DepartmentResponse>(url, { headers }).subscribe({
        next: (response) => {
          if (response && response.success && response.data && Array.isArray(response.data)) {
            const dept = response.data.find(d => d.dept_id === deptId);
            resolve(dept || null);
          } else {
            resolve(null);
          }
        },
        error: (error) => {
          console.error('Error loading department details:', error);
          resolve(null);
        }
      });
    });
  }

  // Check if user has admin-level access
  hasAdminAccess(): boolean {
    return this.isAdmin || this.isHR;
  }

  // Fixed department access check
  canAccessDepartment(deptId: string): boolean {
    if (this.hasAdminAccess()) {
      return true; // Admin/HR can access all departments
    }
    
    if (this.isManager) {
      return this.userDepartmentId === deptId; // Manager can access their managed department
    }
    
    if (this.isEmployee) {
      return this.userDepartmentId === deptId; // Employee can access their department
    }
    
    return false;
  }

  // Enhanced document view permission check
  canViewDocument(doc: DocumentItem): boolean {
    if (this.hasAdminAccess()) {
      return true; // Admin/HR can view all documents
    }
    
    // Check if document is in user's accessible department
    if (!this.canAccessDepartment(doc.deptId)) {
      return false;
    }
    
    if (this.isManager) {
      // Manager can view all documents in their department except private docs from other users
      if (doc.deptId !== this.userDepartmentId) return false;
      return !doc.visibleOnlyToMe || doc.createdByEmpId === this.userProfile?.empId;
    }
    
    if (this.isEmployee) {
      // Employee can view their own documents + public documents in their department
      if (doc.deptId !== this.userDepartmentId) return false;
      
      // Can view their own documents (both private and public)
      if (doc.createdByEmpId === this.userProfile?.empId) {
        return true;
      }
      
      // Can view public documents from others in same department
      return !doc.visibleOnlyToMe;
    }
    
    return false;
  }

  // Enhanced document download permission check
  canDownloadDocument(doc: DocumentItem): boolean {
    return this.canViewDocument(doc); // Same as view permissions
  }

  // Enhanced upload permission check - ALL authenticated users can upload to their departments
  canUploadToDepartment(deptId: string): boolean {
    // All authenticated users can upload to their accessible departments
    if (this.hasAdminAccess()) {
      return true; // Admin can upload to any department
    }
    
    if (this.isManager) {
      return this.userDepartmentId === deptId; // Manager can upload to their managed department
    }
    
    if (this.isEmployee) {
      return this.userDepartmentId === deptId; // Employee can upload to their department
    }
    
    return false;
  }

  // Helper method to determine if upload button should be shown
  canShowUploadButton(): boolean {
    // Admin/HR can always upload when a department is selected
    if (this.hasAdminAccess() && this.selectedDepartment) {
      return this.canUploadToDepartment(this.selectedDepartment.dept_id);
    }
    
    // Employee can upload to their department
    if (this.isEmployee && this.userDepartment) {
      return this.canUploadToDepartment(this.userDepartment.dept_id);
    }
    
    // Manager can upload to their managed department
    if (this.isManager && this.managedDepartment) {
      return this.canUploadToDepartment(this.managedDepartment.dept_id);
    }
    
    // If a department is selected, check upload permission
    if (this.selectedDepartment) {
      return this.canUploadToDepartment(this.selectedDepartment.dept_id);
    }
    
    return false;
  }

  // Enhanced method to get the target department for upload
  getUploadTargetDepartment(): Department | null {
    // If department is explicitly selected, use it
    if (this.selectedDepartment && this.canUploadToDepartment(this.selectedDepartment.dept_id)) {
      return this.selectedDepartment;
    }
    
    // For employees, use their department
    if (this.isEmployee && this.userDepartment && this.canUploadToDepartment(this.userDepartment.dept_id)) {
      return this.userDepartment;
    }
    
    // For managers, use their managed department
    if (this.isManager && this.managedDepartment && this.canUploadToDepartment(this.managedDepartment.dept_id)) {
      return this.managedDepartment;
    }
    
    return null;
  }

  // Generate year options for filter
  generateYearOptions(): void {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      this.years.push(year);
    }
  }

  // Load departments based on user role
  loadDepartments(): void {
    this.isLoading = true;
    const url = `${environment.apiUrl}/api/v1/departments`;
    const headers = this.getHeaders();

    console.log('Loading departments from:', url);

    this.http.get<DepartmentResponse>(url, { headers }).subscribe({
      next: (response) => {
        console.log('Departments API Response:', response);
        
        if (response && response.success && response.data && Array.isArray(response.data)) {
          let departments = response.data.map(dept => ({
            ...dept,
            documentCount: 0,
            isActive: false
          }));
          
          if (this.isManager && this.userDepartmentId) {
            departments = departments.filter(dept => dept.dept_id === this.userDepartmentId);
          }
          
          this.departments = departments;
          this.updateUserProfileWithDepartmentName();
          this.loadDocumentCountsForDepartments();
        } else {
          console.warn('Unexpected departments response format:', response);
          this.departments = [];
          this.isLoading = false;
        }
      },
      error: (error) => {
        console.error('Error loading departments:', error);
        this.isLoading = false;
        alert('Failed to load departments: ' + (error.error?.message || 'Please try again'));
        this.departments = [];
      }
    });
  }

  // Load document counts for all accessible departments
  loadDocumentCountsForDepartments(): void {
    const promises = this.departments.map(dept => 
      this.loadDocumentCountForDepartment(dept.dept_id)
    );

    Promise.all(promises).then(() => {
      console.log('All department counts loaded:', this.departments);
      this.isLoading = false;
    }).catch((error) => {
      console.error('Error loading document counts:', error);
      this.isLoading = false;
    });
  }

  // Load document count for a specific department
  loadDocumentCountForDepartment(deptId: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.canAccessDepartment(deptId)) {
        resolve();
        return;
      }

      const url = `${environment.documentUploadUrl}/api/archive/admin/documents/by-department/${deptId}`;
      const headers = this.getHeaders();

      this.http.get<any>(url, { headers }).subscribe({
        next: (response) => {
          const documents = response?.data || response || [];
          const dept = this.departments.find(d => d.dept_id === deptId);
          if (dept) {
            const accessibleDocs = documents.filter((doc: DocumentItem) => this.canViewDocument(doc));
            dept.documentCount = Array.isArray(accessibleDocs) ? accessibleDocs.length : 0;
          }
          resolve();
        },
        error: (error) => {
          console.error(`Error loading count for department ${deptId}:`, error);
          const dept = this.departments.find(d => d.dept_id === deptId);
          if (dept) {
            dept.documentCount = 0;
          }
          resolve();
        }
      });
    });
  }

  // Enhanced load documents by department with strict role-based filtering
  loadDocumentsByDepartment(deptId: string): void {
    console.log('Loading documents for department:', deptId, 'User role:', this.userProfile?.roleName, 'User empId:', this.userProfile?.empId);
    
    if (!this.canAccessDepartment(deptId)) {
      console.error('Access denied to department:', deptId);
      alert('You do not have permission to access this department.');
      return;
    }

    this.isDepartmentLoading = true;
    const url = `${environment.documentUploadUrl}/api/archive/admin/documents/by-department/${deptId}`;
    const headers = this.getHeaders();

    console.log('Loading documents from URL:', url);

    this.http.get<any>(url, { headers }).subscribe({
      next: (response) => {
        console.log('Department Documents API Response:', response);
        
        let documents = [];
        if (response && response.data && Array.isArray(response.data)) {
          documents = response.data;
        } else if (Array.isArray(response)) {
          documents = response;
        }
        
        console.log('Raw documents found:', documents.length);
        
        this.documents = documents.filter((doc: DocumentItem) => {
          const canView = this.canViewDocument(doc);
          console.log(`Document ${doc.documentCode} - Created by: ${doc.createdByEmpId}, Department: ${doc.deptId}, Private: ${doc.visibleOnlyToMe}, Can view: ${canView}`);
          return canView;
        });
        
        console.log('Filtered documents for user:', this.documents.length);
        
        this.applyFilters();
        this.isDepartmentLoading = false;
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading department documents:', error);
        this.isDepartmentLoading = false;
        this.isLoading = false;
        
        if (error.status === 404) {
          console.log('No documents found for department, showing empty state');
          this.documents = [];
          this.filteredDocuments = [];
        } else if (error.status === 403) {
          alert('You do not have permission to access this department\'s documents.');
          this.documents = [];
          this.filteredDocuments = [];
        } else {
          alert('Failed to load department documents: ' + (error.error?.message || 'Please try again'));
          this.documents = [];
          this.filteredDocuments = [];
        }
      }
    });
  }

  // Select department and show its documents
  selectDepartment(department: Department): void {
    if (!this.canAccessDepartment(department.dept_id)) {
      alert('You do not have permission to access this department.');
      return;
    }

    console.log('Selecting department:', department);
    
    this.departments.forEach(dept => dept.isActive = dept.dept_id === department.dept_id);
    
    this.selectedDepartment = department;
    this.showDepartmentFolders = false;
    
    this.loadDocumentsByDepartment(department.dept_id);
  }

  // Select department and open upload modal
  selectDepartmentAndUpload(department: Department, event: Event): void {
    event.stopPropagation();
    
    if (!this.canUploadToDepartment(department.dept_id)) {
      alert('You do not have permission to upload to this department.');
      return;
    }
    
    console.log('Selecting department for upload:', department);
    this.selectedDepartment = department;
    this.openUploadModal();
  }

  // Go back to department view
  backToDepartments(): void {
    if (this.isEmployee || (this.isManager && this.managedDepartment)) {
      return;
    }

    this.showDepartmentFolders = true;
    this.selectedDepartment = null;
    this.documents = [];
    this.filteredDocuments = [];
    this.searchQuery = '';
    this.selectedFileType = '';
    this.selectedYear = new Date().getFullYear();
    
    this.departments.forEach(dept => dept.isActive = false);
    this.loadDocumentCountsForDepartments();
  }

  // Get HTTP headers for API calls
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authService.getToken()}`
    });
  }

  // Apply all filters
  applyFilters(): void {
    let filtered = [...this.documents];

    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(doc => {
        const fileName = (doc.userInputFileName || '').toLowerCase();
        const createdBy = (doc.createdName || '').toLowerCase();
        const department = (doc.createdDeptName || '').toLowerCase();
        const documentCode = (doc.documentCode || '').toLowerCase();
        
        return fileName.includes(query) || 
               createdBy.includes(query) || 
               department.includes(query) ||
               documentCode.includes(query);
      });
    }

    if (this.selectedFileType) {
      filtered = filtered.filter(doc => {
        const fileName = doc.userInputFileName || '';
        return fileName.toLowerCase().endsWith(this.selectedFileType.toLowerCase());
      });
    }

    if (this.selectedYear) {
      filtered = filtered.filter(doc => {
        if (!doc.createdAt) return false;
        const docYear = new Date(doc.createdAt).getFullYear();
        return docYear === this.selectedYear;
      });
    }

    this.filteredDocuments = filtered;
  }

  searchDocuments(): void {
    this.applyFilters();
  }

  filterByType(): void {
    this.applyFilters();
  }

  filterByYear(): void {
    this.applyFilters();
  }

  // Enhanced open upload modal
  openUploadModal(): void {
    // Auto-determine target department if not selected
    if (!this.selectedDepartment) {
      const targetDept = this.getUploadTargetDepartment();
      if (targetDept) {
        this.selectedDepartment = targetDept;
      } else {
        alert('Unable to determine target department for upload.');
        return;
      }
    }
    
    // Final check for upload permission
    if (!this.canUploadToDepartment(this.selectedDepartment.dept_id)) {
      alert('You do not have permission to upload to this department.');
      return;
    }
    
    this.showUploadModal = true;
    this.resetUploadForm();
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
    this.resetUploadForm();
  }

  private resetUploadForm(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.visibleOnlyToMe = false;
  }

  validateFile(file: File): { valid: boolean; message?: string } {
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      return {
        valid: false,
        message: 'File size must be less than 50MB'
      };
    }

    const allowedExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
      'zip', 'ppt', 'pptx', 'txt', 'jpg', 'jpeg', 'png'
    ];

    const fileExtension = this.getFileExtension(file.name);
    if (!allowedExtensions.includes(fileExtension)) {
      return {
        valid: false,
        message: `File type .${fileExtension} is not allowed. Supported types: ${allowedExtensions.join(', ')}`
      };
    }

    return { valid: true };
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const validation = this.validateFile(file);
      if (!validation.valid) {
        alert(validation.message);
        event.target.value = '';
        return;
      }
      
      this.selectedFile = file;
      if (!this.fileName) {
        this.fileName = file.name.split('.')[0];
      }
    }
  }

  // Enhanced upload file with correct role-based endpoint usage
  uploadFile(): void {
    if (!this.selectedFile || !this.fileName.trim()) {
      alert('Please select a file and enter a display name');
      return;
    }

    // Auto-select department for employees/managers if not selected
    if (!this.selectedDepartment) {
      const targetDept = this.getUploadTargetDepartment();
      if (targetDept) {
        this.selectedDepartment = targetDept;
      } else {
        alert('Unable to determine target department for upload.');
        return;
      }
    }

    // Validate file
    const validation = this.validateFile(this.selectedFile);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    this.isLoading = true;
    
    let url: string;
    let formData = new FormData();
    let headers: HttpHeaders;

    // Role-based endpoint selection
    if (this.hasAdminAccess()) {
      // Admin/HR: Use department-specific admin endpoint
      url = `${environment.documentUploadUrl}/api/archive/upload/admin/${this.selectedDepartment.dept_id}`;
      
      // For admin endpoint, userInputFileName goes as query parameter
      const params = new URLSearchParams();
      params.append('userInputFileName', this.fileName.trim());
      url += `?${params.toString()}`;
      
      formData.append('file', this.selectedFile);
      
      headers = new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      });
      
      console.log('Admin/HR upload to department:', this.selectedDepartment.dept_name, 'URL:', url);
      
    } else {
      // Employee/Manager: Use regular upload endpoint
      url = `${environment.documentUploadUrl}/api/archive/upload`;
      
      formData.append('file', this.selectedFile);
      formData.append('fileName', this.fileName.trim());
      formData.append('visibleOnlyToMe', this.visibleOnlyToMe.toString());
      
      // Include empId for backend validation and department mapping
      if (this.userProfile?.empId) {
        formData.append('empId', this.userProfile.empId);
      }
      
      headers = new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      });
      
      console.log('Employee/Manager upload:', {
        empId: this.userProfile?.empId,
        fileName: this.fileName,
        private: this.visibleOnlyToMe,
        endpoint: url
      });
    }

    this.http.post<any>(url, formData, { headers }).subscribe({
      next: (response) => {
        console.log('Upload successful:', response);
        this.isLoading = false;
        
        let successMessage = `File uploaded successfully!`;
        if (this.hasAdminAccess()) {
          successMessage = `File uploaded successfully to ${this.selectedDepartment?.dept_name} department!`;
        } else if (this.isEmployee) {
          successMessage = `File uploaded successfully! ${this.visibleOnlyToMe ? 'Private file visible only to you and managers.' : 'Public file visible to department members.'}`;
        } else if (this.isManager) {
          successMessage = `File uploaded successfully to your managed department!`;
        }
        
        alert(successMessage);
        this.closeUploadModal();
        
        // Refresh the current view
        if (this.showDepartmentFolders && this.selectedDepartment) {
          this.loadDocumentCountForDepartment(this.selectedDepartment.dept_id);
        } else if (this.selectedDepartment) {
          this.loadDocumentsByDepartment(this.selectedDepartment.dept_id);
        } else if (this.isEmployee && this.userDepartment) {
          this.loadDocumentsByDepartment(this.userDepartment.dept_id);
        } else if (this.isManager && this.managedDepartment) {
          this.loadDocumentsByDepartment(this.managedDepartment.dept_id);
        }
      },
      error: (error) => {
        console.error('Upload failed:', error);
        this.isLoading = false;
        
        let errorMessage = 'Upload failed: ';
        if (error.status === 400) {
          errorMessage += 'Invalid file or parameters. Please check your file and try again.';
        } else if (error.status === 403) {
          errorMessage += 'You do not have permission to upload files.';
        } else if (error.status === 413) {
          errorMessage += 'File is too large. Maximum size is 50MB.';
        } else if (error.status === 422) {
          errorMessage += 'Invalid employee ID or department mapping. Please contact administrator.';
        } else {
          errorMessage += (error.error?.message || 'Please try again');
        }
        
        alert(errorMessage);
      }
    });
  }

  shouldShowDepartmentFolders(): boolean {
    if (this.isEmployee || (this.isManager && this.managedDepartment)) {
      return false;
    }
    return this.showDepartmentFolders;
  }

  shouldShowBackButton(): boolean {
    if (this.isEmployee || (this.isManager && this.managedDepartment)) {
      return false;
    }
    return !this.showDepartmentFolders;
  }

  getEmployeeDepartmentHeaderText(): string {
    if (this.isManager && this.managedDepartment) {
      return `${this.getDepartmentDisplayName(this.managedDepartment)} - Manager View`;
    }
    if (this.userDepartment) {
      return `${this.getDepartmentDisplayName(this.userDepartment)}`;
    }
    return 'Your Department Documents';
  }

  viewDocument(docItem: DocumentItem): void {
    if (!docItem.documentCode) {
      alert('Document code not available');
      return;
    }

    if (!this.canViewDocument(docItem)) {
      alert('You do not have permission to view this document');
      return;
    }

    console.log('Viewing document:', docItem.documentCode, docItem.userInputFileName);
    
    this.selectedDocument = docItem;
    this.downloadAndViewDocument(docItem);
  }

  private downloadAndViewDocument(docItem: DocumentItem): void {
    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${docItem.documentCode}`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    console.log('Downloading document for viewing:', downloadUrl);

    this.http.get(downloadUrl, { 
      headers, 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        console.log('Document downloaded for viewing:', response);
        const blob = response.body;
        
        if (blob && blob.size > 0) {
          const objectUrl = window.URL.createObjectURL(blob);
          const extension = this.getFileExtension(docItem.userInputFileName || '');
          
          if (this.shouldOpenInNewTab(extension)) {
            const newWindow = window.open(objectUrl, '_blank');
            if (!newWindow) {
              this.openBlobInModal(objectUrl, docItem);
            } else {
              setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
            }
          } else {
            this.openBlobInModal(objectUrl, docItem);
          }
        } else {
          throw new Error('Empty document received');
        }
      },
      error: (error) => {
        console.error('Failed to download document for viewing:', error);
        this.handleViewError(error);
      }
    });
  }

  private openBlobInModal(objectUrl: string, docItem: DocumentItem): void {
    try {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      this.showViewModal = true;
      this.iframeLoaded = false;
      this.iframeError = false;
      
      const originalCloseModal = this.closeViewModal.bind(this);
      this.closeViewModal = () => {
        window.URL.revokeObjectURL(objectUrl);
        originalCloseModal();
      };
      
      console.log('Document opened in modal viewer');
    } catch (error) {
      console.error('Error creating safe URL:', error);
      window.URL.revokeObjectURL(objectUrl);
      alert('Unable to open document viewer. Please try downloading the document.');
    }
  }

  private shouldOpenInNewTab(extension: string): boolean {
    const newTabTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    return newTabTypes.includes(extension.toLowerCase());
  }

  closeViewModal(): void {
    this.showViewModal = false;
    
    if (this.safeUrl) {
      const url = (this.safeUrl as any).changingThisBreaksApplicationSecurity;
      if (url && url.startsWith('blob:')) {
        window.URL.revokeObjectURL(url);
      }
    }
    
    this.safeUrl = null;
    this.selectedDocument = null;
    this.iframeLoaded = false;
    this.iframeError = false;
  }

  onIframeLoad(): void {
    this.iframeLoaded = true;
    this.iframeError = false;
    console.log('Iframe loaded successfully');
  }

  onIframeError(): void {
    this.iframeError = true;
    this.iframeLoaded = false;
    console.error('Iframe failed to load');
  }

  retryIframe(): void {
    this.iframeError = false;
    this.iframeLoaded = false;
    
    if (this.selectedDocument) {
      this.downloadAndViewDocument(this.selectedDocument);
    }
  }

  shouldUseIframe(): boolean {
    if (!this.selectedDocument) return false;
    
    const extension = this.getFileExtension(this.selectedDocument.userInputFileName || '');
    const iframeTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    return iframeTypes.includes(extension.toLowerCase());
  }

  isDownloading(documentCode: string): boolean {
    return this.downloadingDocs.has(documentCode);
  }

  downloadDocument(documentCode: string, event?: Event): void {
    if (!documentCode) {
      alert('Document code not available');
      return;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    const doc = this.filteredDocuments.find(d => d.documentCode === documentCode) || 
               this.documents.find(d => d.documentCode === documentCode);
    
    if (doc && !this.canDownloadDocument(doc)) {
      alert('You do not have permission to download this document');
      return;
    }

    if (this.isDownloading(documentCode)) {
      return;
    }

    this.downloadingDocs.add(documentCode);

    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${documentCode}`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Accept': '*/*'
    });

    this.http.get(downloadUrl, { 
      headers, 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        
        if (blob && blob.size > 0) {
          const filename = this.getDownloadFilename(documentCode, response);
          const correctedBlob = this.createCorrectedBlob(blob, filename);
          
          const url = window.URL.createObjectURL(correctedBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);
        } else {
          throw new Error('Empty file received');
        }
        
        this.downloadingDocs.delete(documentCode);
      },
      error: (error) => {
        console.error('Download failed:', error);
        this.downloadingDocs.delete(documentCode);
        this.handleDownloadError(error, documentCode);
      }
    });
  }

  private createCorrectedBlob(originalBlob: Blob, filename: string): Blob {
    const extension = this.getFileExtension(filename);
    
    const mimeTypes: { [key: string]: string } = {
      'csv': 'text/csv',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    };

    const correctMimeType = mimeTypes[extension] || 'application/octet-stream';
    return new Blob([originalBlob], { type: correctMimeType });
  }

  private getDownloadFilename(documentCode: string, response: any): string {
    const doc = this.filteredDocuments.find(d => d.documentCode === documentCode) || 
               this.documents.find(d => d.documentCode === documentCode);
    
    let filename = `document_${documentCode}`;
    
    if (doc && doc.userInputFileName) {
      filename = doc.userInputFileName;
      
      const hasExtension = filename.includes('.');
      if (!hasExtension) {
        const contentType = response.headers.get('Content-Type');
        const extension = this.getExtensionFromContentType(contentType);
        if (extension) {
          filename += `.${extension}`;
        }
      }
      
      return filename;
    }
    
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '');
      }
    }
    
    return filename;
  }

  private getExtensionFromContentType(contentType: string | null): string {
    if (!contentType) return '';
    
    const typeMap: { [key: string]: string } = {
      'text/csv': 'csv',
      'text/plain': 'txt',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    };
    
    const cleanContentType = contentType.split(';')[0].trim().toLowerCase();
    return typeMap[cleanContentType] || '';
  }

  private handleDownloadError(error: any, documentCode: string): void {
    console.error('Download error details:', error);
    
    let errorMessage = 'Failed to download file.';
    
    if (error.status === 400) {
      errorMessage = 'Bad request. The document code might be invalid.';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed. Please login again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to download this document.';
    } else if (error.status === 404) {
      errorMessage = 'Document not found. It might have been deleted.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    alert(errorMessage);
  }

  private handleViewError(error: any): void {
    console.error('View error details:', error);
    
    let errorMessage = 'Failed to view document.';
    
    if (error.status === 400) {
      errorMessage = 'Document cannot be viewed. Try downloading instead.';
    } else if (error.status === 401) {
      errorMessage = 'Authentication failed. Please login again.';
    } else if (error.status === 403) {
      errorMessage = 'You do not have permission to view this document.';
    } else if (error.status === 404) {
      errorMessage = 'Document not found. It might have been deleted.';
    } else if (error.status === 500) {
      errorMessage = 'Server error. Please try again later.';
    }
    
    alert(errorMessage);
  }

  // Utility methods
  getFileIconClass(fileName: string): string {
    if (!fileName) return 'fas fa-file';
    
    const extension = this.getFileExtension(fileName);
    const iconMap: { [key: string]: string } = {
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'csv': 'fas fa-file-csv',
      'ppt': 'fas fa-file-powerpoint',
      'pptx': 'fas fa-file-powerpoint',
      'txt': 'fas fa-file-alt',
      'zip': 'fas fa-file-archive',
    };
    
    return iconMap[extension] || 'fas fa-file';
  }

  getFileIconColor(fileName: string): string {
    if (!fileName) return '#6b7280';
    
    const extension = this.getFileExtension(fileName);
    const colorMap: { [key: string]: string } = {
      'pdf': '#dc2626',
      'doc': '#2563eb',
      'docx': '#2563eb',
      'xls': '#059669',
      'xlsx': '#059669',
      'csv': '#10b981',
      'ppt': '#ea580c',
      'pptx': '#ea580c',
      'txt': '#6b7280',
      'zip': '#f59e0b',
    };
    
    return colorMap[extension] || '#6b7280';
  }

  getFileExtension(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      
      return `${year}-${month}-${day}`;
    } catch {
      return '';
    }
  }

  getDisplayName(doc: DocumentItem): string {
    return doc.userInputFileName || 'Unknown File';
  }

  getUploadedBy(doc: DocumentItem): string {
    return doc.createdName || 'Unknown';
  }

  getDepartmentName(doc: DocumentItem): string {
    return doc.createdDeptName || 'Unknown';
  }

  getCreatedDate(doc: DocumentItem): string {
    return this.formatDate(doc.createdAt);
  }

  highlightText(text: string): string {
    if (!this.searchQuery.trim() || !text) return text;
    
    const query = this.searchQuery.toLowerCase();
    const index = text.toLowerCase().indexOf(query);
    
    if (index === -1) return text;
    
    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);
    
    return `${before}<mark>${match}</mark>${after}`;
  }

  getFileTypeDisplayName(extension: string): string {
    const typeNames: { [key: string]: string } = {
      'pdf': 'PDF',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'xls': 'Excel Spreadsheet',
      'xlsx': 'Excel Spreadsheet', 
      'csv': 'CSV File',
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',
      'txt': 'Text File',
      'zip': 'ZIP Archive',
    };
    
    return typeNames[extension] || extension.toUpperCase();
  }

  getDepartmentIcon(departmentName: string): string {
    const deptName = departmentName.toLowerCase();
    const iconMap: { [key: string]: string } = {
      'cso': 'fas fa-shield-alt',
      'smd': 'fas fa-cogs',
      'dismd': 'fas fa-database',
      'e-centric': 'fas fa-laptop-code',
      'management': 'fas fa-chart-line',
      'account': 'fas fa-calculator',
      'supporting': 'fas fa-users',
      'staff': 'fas fa-users-cog'
    };
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (deptName.includes(key)) {
        return icon;
      }
    }
    
    return 'fas fa-building';
  }

  getSelectedDepartmentColorIndex(): number {
    if (!this.selectedDepartment) return 0;
    return this.departments.findIndex(d => d.dept_id === this.selectedDepartment?.dept_id);
  }

  getDepartmentDisplayName(department: Department): string {
    if (department.branch_name && department.branch_name !== 'Thimphu Main Branch') {
      return `${department.dept_name} - ${department.branch_name}`;
    }
    return department.dept_name;
  }

  getDepartmentSubtitle(department: Department): string {
    const parts = [];
    if (department.dept_code) {
      parts.push(department.dept_code);
    }
    if (department.branch_name) {
      parts.push(department.branch_name);
    }
    return parts.join(' • ');
  }

  getDepartmentColor(index: number): string {
    const colors = [
      '#3b82f6', '#059669', '#dc2626', '#ea580c', '#7c3aed',
      '#0891b2', '#be185d', '#4338ca', '#059669', '#b91c1c'
    ];
    return colors[index % colors.length];
  }

  getUserRoleDisplayName(): string {
    if (!this.userProfile) return 'User';
    
    const roleDisplayMap: { [key: string]: string } = {
      'Admin': 'Administrator',
      'HR': 'Human Resources',
      'Manager': 'Department Manager',
      'Employee': 'Employee',
      'CTO': 'Chief Technology Officer'
    };
    
    let roleName = roleDisplayMap[this.userProfile.roleName] || this.userProfile.roleName;
    
    if (this.isManager && this.managedDepartment) {
      roleName += ` - ${this.managedDepartment.dept_name}`;
    } else if (this.isEmployee && this.userProfile.deptName) {
      roleName += ` - ${this.userProfile.deptName}`;
    }
    
    return roleName;
  }

  getAccessibleDepartmentsCount(): number {
    if (this.hasAdminAccess()) {
      return this.departments.length;
    }
    return this.departments.filter(dept => this.canAccessDepartment(dept.dept_id)).length;
  }

  getTotalDocumentsCount(): number {
    if (this.hasAdminAccess()) {
      return this.departments.reduce((total, dept) => total + (dept.documentCount || 0), 0);
    }
    
    return this.departments.reduce((total, dept) => {
      if (this.canAccessDepartment(dept.dept_id)) {
        return total + (dept.documentCount || 0);
      }
      return total;
    }, 0);
  }

  private updateUserProfileWithDepartmentName(): void {
    if (this.userProfile && this.userProfile.deptId && this.departments.length > 0) {
      const userDept = this.departments.find(d => d.dept_id === this.userProfile!.deptId);
      if (userDept) {
        this.userProfile.deptName = userDept.dept_name;
        if (!this.userDepartment) {
          this.userDepartment = userDept;
        }
      }
    }
  }

  exportDocuments(): void {
    if (this.filteredDocuments.length === 0) {
      alert('No documents to export');
      return;
    }

    const headers = this.isEmployee 
      ? ['File Name', 'Upload Date', 'Document Code', 'Privacy']
      : ['File Name', 'Uploaded By', 'Upload Date', 'Document Code', 'Privacy'];
      
    const csvContent = [
      headers.join(','),
      ...this.filteredDocuments.map(doc => {
        const baseData = [
          `"${doc.userInputFileName || ''}"`,
          `"${this.formatDate(doc.createdAt)}"`,
          `"${doc.documentCode || ''}"`,
          `"${doc.visibleOnlyToMe ? 'Private' : 'Public'}"`
        ];
        
        if (!this.isEmployee) {
          baseData.splice(1, 0, `"${doc.createdName || ''}"`);
        }
        
        return baseData.join(',');
      })
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    const deptName = this.selectedDepartment?.dept_name || 'Department';
    const userRole = this.isManager ? 'Manager' : 'Employee';
    const filename = `${deptName}_Documents_${userRole}_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}