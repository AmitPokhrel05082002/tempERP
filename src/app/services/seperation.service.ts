import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, throwError, of, BehaviorSubject, forkJoin } from 'rxjs';
import { map, catchError, switchMap, tap } from 'rxjs/operators';
import { environment } from 'src/environments/environment';
import { AuthService } from '../core/services/auth.service';

export interface SeparationType {
  separationTypeId: string;
  orgId: string;
  separationName: string;
  separationCode: string;
  category: string;
  noticePeriodDays: number;
  exitInterviewRequired: boolean;
  rehireEligible: boolean;
  createdDate: string | null;
  modifiedDate?: string | null;
}

export interface SeparationResponse {
  separationId: string;
  empId: string;
  separationType: SeparationType | null;
  separationTypeId?: string;
  initiatedBy: string | null;
  initiationDate: string;
  lastWorkingDate: string;
  noticePeriodServed: number;
  separationReason: string;
  resignationLetterPath: string;
  separationStatus: 'Pending' | 'Approved' | 'Cancelled' | 'Completed';
  approvedBy: string | null;
  approvalDate: string | null;
  exitInterviewCompleted: boolean;
  exitInterviewDate: string | null;
  exitInterviewNotes: string;
  handoverCompleted: boolean;
  finalSettlementAmount: number;
  settlementPaid: boolean;
  settlementPaidDate: string | null;
  rehireEligible: boolean;
  rehireNotes: string;
  createdDate: string | null;
  modifiedDate: string | null;
}

export interface Organization {
  orgId: string;
  orgName: string;
  orgCode: string;
  countryName: string;
  dzongkhag: string;
  thromde: string;
  parentOrgId: string | null;
  parentOrgName: string | null;
  orgLevel: number | null;
  childOrganizationsCount: number;
  createdDate: string;
}

export interface Branch {
  branchId: string;
  branchName: string;
  branchCode: string;
  dzongkhag: string | null;
  thromde: string | null;
  operationalStatus: boolean | null;
  organizationName: string | null;
}

export interface Department {
  dept_id: string;
  organization: Organization;
  branch: Branch;
  dept_name: string;
  dept_code: string;
  parent_department: Department | null;
  sub_departments: Department[];
  dept_head_id: string | null;
  budget_allocation: number;
  approval_hierarchy: string;
  reporting_structure: string | null;
  created_date: string;
  modified_date: string | null;
}

export interface Employee {
  empId: string;
  empCode: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  department?: string;
  departmentId?: string;
  position?: string;
  email?: string;
  phoneNumber?: string;
  orgId?: string;
  orgName?: string;
}

export interface EmployeeApiResponse {
  employee: Employee;
  contacts: any[];
  addresses: any[];
  qualifications: any[];
  bankDetails: any[];
  history: any[];
}

export interface SeparationRequest {
  empId: string;
  separationTypeId: string;
  initiatedBy: string;
  lastWorkingDate: string;
  noticePeriodServed: number;
  separationReason: string;
  resignationLetterPath?: string;
  rehireEligible: boolean;
  rehireNotes?: string;
  separationStatus: 'Pending' | 'Approved' | 'Cancelled' | 'Completed';
}

export interface SeparationUpdateRequest {
  empId: string;
  separationTypeId: string;
  initiatedBy: string;
  initiationDate: string;
  lastWorkingDate: string;
  noticePeriodServed: number;
  separationReason: string;
  resignationLetterPath?: string;
  rehireEligible: boolean;
  rehireNotes?: string;
  separationStatus?: 'Pending' | 'Approved' | 'Cancelled' | 'Completed';
}

export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface Separation {
  id?: string;
  separationId?: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentName?: string;
  position: string;
  separationType: SeparationType | null;
  separationTypeId?: string;
  initiatedBy?: string | null;
  initiatedByName?: string;
  initiationDate: string;
  lastWorkingDate: string;
  noticePeriodServed: number;
  separationReason: string;
  resignationLetterPath?: string;
  separationStatus?: 'Pending' | 'Approved' | 'Cancelled' | 'Completed';
  status: 'Pending' | 'Approved' | 'Cancelled' | 'Completed';
  approvedBy?: string | null;
  approvedByName?: string;
  approvalDate?: string | null;
  exitInterviewCompleted: boolean;
  exitInterviewDate?: string | null;
  exitInterviewNotes?: string;
  handoverCompleted: boolean;
  finalSettlementAmount?: number;
  settlementPaid?: boolean;
  settlementPaidDate?: string | null;
  rehireEligible: boolean;
  rehireNotes?: string;
  createdDate?: string | null;
  modifiedDate?: string | null;
  reason?: string;
  notes?: string;
  clearanceStatus?: 'Pending' | 'In Progress' | 'Completed';
}

@Injectable({
  providedIn: 'root'
})
export class SeparationService {
  apiUrl = `${environment.apiUrl}/api/v1/separations`;
  empUrl = `${environment.apiUrl}/api/v1/employees`;
  sepTypeUrl = `${environment.apiUrl}/api/separation-types`;
  orgUrl = `${environment.apiUrl}/api/v1/organizations`;
  deptUrl = `${environment.apiUrl}/api/v1/departments`;
  
  // Cache separation types and departments
  private separationTypesSubject = new BehaviorSubject<SeparationType[]>([]);
  public separationTypes$ = this.separationTypesSubject.asObservable();
  private separationTypesMap: { [key: string]: SeparationType } = {};
  private departmentsMap: { [key: string]: Department } = {};

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { 
    // Load separation types and departments on service initialization
    this.loadSeparationTypes();
    this.loadDepartments();
  }

  private getAuthHeaders(): HttpHeaders {
    const user = this.authService.currentUserValue;
    if (!user || !user.accessToken) {
      console.error('No authentication token found');
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }
    
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${user.accessToken}`
    });
  }

  private createDefaultSeparationType(): SeparationType {
    return {
      separationTypeId: 'default',
      orgId: '',
      separationName: 'N/A',
      separationCode: 'DEFAULT',
      category: 'Unknown',
      noticePeriodDays: 0,
      exitInterviewRequired: false,
      rehireEligible: false,
      createdDate: new Date().toISOString(),
      modifiedDate: new Date().toISOString()
    };
  }

  private loadSeparationTypes(): void {
    this.getSeparationTypes().subscribe({
      next: (types) => {
        this.separationTypesSubject.next(types);
        this.separationTypesMap = {};
        types.forEach(type => {
          this.separationTypesMap[type.separationTypeId] = type;
        });
      },
      error: (error) => {
        console.error('Failed to load separation types:', error);
      }
    });
  }

  private loadDepartments(): void {
    this.getDepartments().subscribe({
      next: (departments) => {
        this.departmentsMap = {};
        departments.forEach(dept => {
          this.departmentsMap[dept.dept_id] = dept;
        });
      },
      error: (error) => {
        console.error('Failed to load departments:', error);
      }
    });
  }

  getDepartments(): Observable<Department[]> {
    const headers = this.getAuthHeaders();
    return this.http.get<{success: boolean, data: Department[]}>(this.deptUrl, { headers }).pipe(
      map(response => response.data || []),
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading departments:', error);
        return of([]);
      })
    );
  }

  getDepartmentById(deptId: string): Observable<Department | null> {
    // Check cache first
    if (this.departmentsMap[deptId]) {
      return of(this.departmentsMap[deptId]);
    }

    const headers = this.getAuthHeaders();
    return this.http.get<{success: boolean, data: Department}>(`${this.deptUrl}/${deptId}`, { headers }).pipe(
      map(response => {
        if (response.data) {
          this.departmentsMap[deptId] = response.data;
          return response.data;
        }
        return null;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`Error loading department ${deptId}:`, error);
        return of(null);
      })
    );
  }

  getSeparationTypes(): Observable<SeparationType[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<SeparationType[]>(this.sepTypeUrl, { 
      headers,
      observe: 'response'
    }).pipe(
      map(response => {
        if (!response.body) {
          console.warn('Received empty response body from separation types endpoint');
          return [];
        }
        const types = response.body;
        // Update the cached types
        this.separationTypesSubject.next(types);
        this.separationTypesMap = {};
        types.forEach(type => {
          this.separationTypesMap[type.separationTypeId] = type;
        });
        return types;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading separation types:', error);
        
        const mockTypes: SeparationType[] = [
          {
            separationTypeId: '7d7b5605-b6a9-4e63-95c2-2329a7f92c5f',
            orgId: '5fb2d078-532d-4352-84ba-4e185ae08dac',
            separationName: 'Resignation',
            separationCode: 'RES001',
            category: 'Voluntary',
            noticePeriodDays: 30,
            exitInterviewRequired: true,
            rehireEligible: true,
            createdDate: null
          },
          {
            separationTypeId: '8c7b5605-b6a9-4e63-95c2-2329a7f92c6g',
            orgId: '5fb2d078-532d-4352-84ba-4e185ae08dac',
            separationName: 'Termination',
            separationCode: 'TERM002',
            category: 'Involuntary',
            noticePeriodDays: 0,
            exitInterviewRequired: true,
            rehireEligible: false,
            createdDate: null
          }
        ];
        
        this.separationTypesSubject.next(mockTypes);
        this.separationTypesMap = {};
        mockTypes.forEach(type => {
          this.separationTypesMap[type.separationTypeId] = type;
        });
        return of(mockTypes);
      })
    );
  }

  getSeparationTypeById(id: string): Observable<SeparationType> {
    // First check cache
    if (this.separationTypesMap[id]) {
      return of(this.separationTypesMap[id]);
    }
    
    const url = `${this.sepTypeUrl}/${id}`;
    return this.http.get<SeparationType>(url, { headers: this.getAuthHeaders() })
      .pipe(
        tap(type => {
          // Cache the type
          this.separationTypesMap[id] = type;
        }),
        catchError(this.handleError)
      );
  }

  getAllEmployees(): Observable<Employee[]> {
    const headers = this.getAuthHeaders();
    
    return this.http.get<EmployeeApiResponse[]>(this.empUrl, { headers }).pipe(
      map(response => {
        if (Array.isArray(response)) {
          const employees = response.flatMap(item => {
            if (item && 'employee' in item && item.employee) {
              return [item.employee];
            }
            if (item && 'empId' in item) {
              return [item as unknown as Employee];
            }
            return [];
          }).filter((emp): emp is Employee => 
            !!emp && 'empId' in emp && 'empCode' in emp && 'firstName' in emp && 'lastName' in emp
          );
          return employees;
        } else {
          return [];
        }
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching employees:', error);
        return throwError(() => error);
      })
    );
  }

  getEmployeeById(empId: string): Observable<Employee> {
    return this.http.get<EmployeeApiResponse>(`${this.empUrl}/${empId}`, { 
      headers: this.getAuthHeaders() 
    }).pipe(
      map(response => {
        if (response && response.employee) {
          return response.employee;
        }
        return response as any;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error(`Error fetching employee ${empId}:`, error);
        return throwError(() => error);
      })
    );
  }

  // NEW: Get separations by date range
  getSeparationsByDateRange(startDate: string, endDate: string): Observable<SeparationResponse[]> {
    const headers = this.getAuthHeaders();
    const params = new URLSearchParams();
    params.append('startDate', startDate);
    params.append('endDate', endDate);
    
    const url = `${this.apiUrl}/date-range?${params.toString()}`;
    
    return this.http.get<SeparationResponse[]>(url, { headers }).pipe(
      catchError((error: HttpErrorResponse) => {
        console.error('Error fetching separations by date range:', error);
        return throwError(() => error);
      })
    );
  }

  // NEW: Export separations to CSV
  exportSeparationsToCSV(separations: Separation[]): void {
    if (!separations || separations.length === 0) {
      console.warn('No separations data to export');
      return;
    }

    // Define CSV headers
    const headers = [
      'Employee ID',
      'Employee Name',
      'Employee Code',
      'Department',
      'Position',
      'Separation Type',
      'Initiation Date',
      'Last Working Date',
      'Notice Period (Days)',
      'Separation Reason',
      'Status',
      'Initiated By',
      'Approved By',
      'Approval Date',
      'Exit Interview Completed',
      'Handover Completed',
      'Rehire Eligible',
      'Rehire Notes',
      'Created Date'
    ];

    // Convert separations to CSV format
    const csvData = separations.map(sep => [
      sep.employeeId || '',
      sep.employeeName || '',
      sep.employeeCode || '',
      sep.departmentName || sep.department || '',
      sep.position || '',
      sep.separationType?.separationName || 'N/A',
      this.formatDateForCSV(sep.initiationDate),
      this.formatDateForCSV(sep.lastWorkingDate),
      sep.noticePeriodServed?.toString() || '0',
      this.escapeCsvField(sep.separationReason || ''),
      sep.status || 'Pending',
      sep.initiatedByName || 'System',
      sep.approvedByName || 'N/A',
      this.formatDateForCSV(sep.approvalDate),
      sep.exitInterviewCompleted ? 'Yes' : 'No',
      sep.handoverCompleted ? 'Yes' : 'No',
      sep.rehireEligible ? 'Yes' : 'No',
      this.escapeCsvField(sep.rehireNotes || ''),
      this.formatDateForCSV(sep.createdDate)
    ]);

    // Combine headers and data
    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `employee_separations_${this.formatDateForFilename(new Date())}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // Helper method to format date for CSV
  private formatDateForCSV(dateString: string | null | undefined): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      return date.toLocaleDateString();
    } catch (e) {
      return dateString || '';
    }
  }

  // Helper method to escape CSV fields
  private escapeCsvField(field: string): string {
    if (!field) return '';
    // Replace double quotes with two double quotes and handle line breaks
    return field.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ');
  }

  // Helper method to format date for filename
  private formatDateForFilename(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}_${hours}${minutes}`;
  }

  private mapToSeparation(response: SeparationResponse, requestedTypeId?: string): Separation {
    if (!response) {
      const now = new Date().toISOString();
      const defaultSeparationType = this.createDefaultSeparationType();

      return {
        id: '',
        separationId: '',
        employeeId: '',
        employeeName: 'Unknown Employee',
        employeeCode: 'UNKNOWN',
        department: 'Not specified',
        departmentName: 'Not specified',
        position: 'Not specified',
        separationType: defaultSeparationType,
        separationTypeId: 'default',
        initiatedBy: 'System',
        initiationDate: now,
        lastWorkingDate: now,
        noticePeriodServed: 0,
        separationReason: 'Not specified',
        resignationLetterPath: '',
        separationStatus: 'Pending',
        status: 'Pending',
        clearanceStatus: 'Pending',
        approvedBy: null,
        approvalDate: null,
        exitInterviewCompleted: false,
        exitInterviewDate: null,
        exitInterviewNotes: '',
        handoverCompleted: false,
        finalSettlementAmount: 0,
        settlementPaid: false,
        settlementPaidDate: null,
        rehireEligible: false,
        rehireNotes: '',
        createdDate: now,
        modifiedDate: now
      };
    }

    // Try to extract separationTypeId from multiple sources
    let separationTypeId = response.separationTypeId || requestedTypeId;
    
    // If no separationTypeId but separationType exists with an ID, use that
    if (!separationTypeId && response.separationType && typeof response.separationType === 'object' && response.separationType.separationTypeId) {
      separationTypeId = response.separationType.separationTypeId;
    }
    
    // If separationType is a string (might be the ID itself), use it
    if (!separationTypeId && response.separationType && typeof response.separationType === 'string') {
      separationTypeId = response.separationType as any;
    }
    
    // Try to find the separation type from cache
    let separationType: SeparationType | null = null;
    
    if (separationTypeId && separationTypeId !== 'default') {
      separationType = this.separationTypesMap[separationTypeId] || null;
      if (separationType) {
        console.log(`Found separation type in cache for ID ${separationTypeId}:`, separationType.separationName);
      } else {
        console.warn(`Separation type not found in cache for ID: ${separationTypeId}`);
      }
    }
    
    // If still no separation type found, check if it came in the response as an object
    if (!separationType && response.separationType && typeof response.separationType === 'object') {
      separationType = response.separationType as SeparationType;
      // Cache it for future use
      if (separationType.separationTypeId) {
        this.separationTypesMap[separationType.separationTypeId] = separationType;
        if (!separationTypeId) {
          separationTypeId = separationType.separationTypeId;
        }
      }
    }
    
    // If still no separation type, create default
    if (!separationType) {
      console.warn(`Using default separation type. ID: ${separationTypeId}, Response:`, response);
      separationType = this.createDefaultSeparationType();
      if (!separationTypeId) {
        separationTypeId = 'default';
      }
    }

    return {
      id: response.separationId,
      separationId: response.separationId,
      employeeId: response.empId || '',
      employeeName: '',
      employeeCode: '',
      department: '',
      departmentName: '',
      position: 'Not specified',
      separationType: separationType,
      separationTypeId: separationTypeId,
      initiatedBy: response.initiatedBy || 'System',
      initiationDate: response.initiationDate,
      lastWorkingDate: response.lastWorkingDate,
      noticePeriodServed: response.noticePeriodServed || 0,
      separationReason: response.separationReason || 'Not specified',
      resignationLetterPath: response.resignationLetterPath || '',
      separationStatus: response.separationStatus,
      status: response.separationStatus,
      clearanceStatus: 'Pending',
      approvedBy: response.approvedBy || null,
      approvalDate: response.approvalDate || null,
      exitInterviewCompleted: response.exitInterviewCompleted || false,
      exitInterviewDate: response.exitInterviewDate || null,
      exitInterviewNotes: response.exitInterviewNotes || '',
      handoverCompleted: response.handoverCompleted || false,
      finalSettlementAmount: response.finalSettlementAmount || 0,
      settlementPaid: response.settlementPaid || false,
      settlementPaidDate: response.settlementPaidDate || null,
      rehireEligible: response.rehireEligible || false,
      rehireNotes: response.rehireNotes || '',
      createdDate: response.createdDate || null,
      modifiedDate: response.modifiedDate || null
    };
  }

  getSeparations(): Observable<Separation[]> {
    const headers = this.getAuthHeaders();
    
    // Ensure separation types are loaded first
    return this.getSeparationTypes().pipe(
      switchMap(types => {
        return this.http.get<SeparationResponse[]>(this.apiUrl, { 
          headers,
          observe: 'response'
        }).pipe(
          map(response => {
            if (!response.body || !Array.isArray(response.body)) {
              return [];
            }
            
            return response.body.map(item => {
              try {
                // Map the response and ensure proper separation type mapping
                const separation = this.mapToSeparation(item);
                
                // Additional check: if separationType is still null/default but we have an ID
                // Try to fetch it from our cache one more time
                if ((!separation.separationType || separation.separationType.separationTypeId === 'default') 
                    && item.separationTypeId) {
                  const cachedType = this.separationTypesMap[item.separationTypeId];
                  if (cachedType) {
                    separation.separationType = cachedType;
                    separation.separationTypeId = item.separationTypeId;
                  }
                }
                
                return separation;
              } catch (error) {
                console.error('Error mapping separation item:', item, error);
                return this.mapToSeparation(null as any);
              }
            }).filter(separation => separation.separationId);
          })
        );
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error loading separations:', error);
        return throwError(() => new Error('Failed to load separations'));
      })
    );
  }

  getCurrentUserEmployee(): Observable<Employee> {
    const currentUser = this.authService.currentUserValue;
    
    if (!currentUser) {
      return throwError(() => new Error('No user is currently logged in'));
    }
  
    // Try to get employee ID from different user properties
    let employeeId = currentUser.empId || currentUser.userId;
    
    // Use roleBasedId getter if available
    if (this.authService.roleBasedId) {
      employeeId = this.authService.roleBasedId;
    }
    
    if (!employeeId) {
      return throwError(() => new Error('No employee ID found'));
    }
  
    return this.getEmployeeById(employeeId).pipe(
      catchError((error: HttpErrorResponse) => {
        // Create a fallback employee object
        const emptyEmployee: Employee = {
          empId: employeeId,
          empCode: currentUser.username || '',
          firstName: currentUser.username || 'User',
          lastName: '',
          email: currentUser.email || ''
        };
        console.warn('Failed to fetch employee details, using fallback:', emptyEmployee);
        return of(emptyEmployee);
      })
    );
  }

  createSeparation(separation: SeparationRequest): Observable<Separation> {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser?.accessToken) {
      return throwError(() => new Error('No authentication token found. Please log in again.'));
    }

    if (!currentUser.userId) {
      return throwError(() => new Error('No user ID found for current user.'));
    }

    // Validation
    if (!separation.empId) {
      return throwError(() => new Error('Employee ID is required'));
    }
    if (!separation.separationTypeId) {
      return throwError(() => new Error('Separation type is required'));
    }
    if (!separation.lastWorkingDate) {
      return throwError(() => new Error('Last working date is required'));
    }
    if (!separation.separationReason) {
      return throwError(() => new Error('Separation reason is required'));
    }

    // Format date
    let formattedDate: string;
    try {
      const date = new Date(separation.lastWorkingDate);
      if (isNaN(date.getTime())) {
        formattedDate = separation.lastWorkingDate;
      } else {
        formattedDate = date.toISOString().split('T')[0];
      }
    } catch (e) {
      console.warn('Error formatting date, using as is:', e);
      formattedDate = separation.lastWorkingDate;
    }

    const requestPayload = {
      empId: separation.empId,
      separationTypeId: separation.separationTypeId,
      initiatedBy: currentUser.userId,
      lastWorkingDate: formattedDate,
      noticePeriodServed: Number(separation.noticePeriodServed) || 0,
      separationReason: separation.separationReason,
      resignationLetterPath: separation.resignationLetterPath || '',
      rehireEligible: Boolean(separation.rehireEligible),
      rehireNotes: separation.rehireNotes || ''
    };

    console.log('=== CREATE SEPARATION REQUEST ===');
    console.log('Sending payload to API:', requestPayload);
    console.log('SeparationTypeId being sent:', requestPayload.separationTypeId);

    return this.http.post<SeparationResponse>(
      this.apiUrl,
      requestPayload,
      { 
        headers: this.getAuthHeaders(),
        observe: 'response' 
      }
    ).pipe(
      map((response: HttpResponse<SeparationResponse>) => {
        if (!response.body) {
          throw new Error('Empty response body');
        }
        
        console.log('=== CREATE SEPARATION RESPONSE ===');
        console.log('Raw API response:', response.body);
        
        // Map the response, passing the requested type ID
        const mappedSeparation = this.mapToSeparation(response.body, separation.separationTypeId);
        
        // Ensure we have the correct separation type from our cache
        if (separation.separationTypeId && this.separationTypesMap[separation.separationTypeId]) {
          console.log('Setting separation type from cache for ID:', separation.separationTypeId);
          mappedSeparation.separationType = this.separationTypesMap[separation.separationTypeId];
          mappedSeparation.separationTypeId = separation.separationTypeId;
        }
        
        console.log('Final mapped separation:', mappedSeparation);
        
        return mappedSeparation;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error creating separation:', error);
        console.error('Error response body:', error.error);
        
        let errorMessage = 'Failed to create separation. Please try again.';
        
        if (error.status === 401) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to create a separation.';
        } else if (error.status === 400 && error.error?.errors) {
          const validationErrors = Object.values(error.error.errors).flat();
          errorMessage = validationErrors.join('\n');
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  // ENHANCED UPDATE METHOD with better validation and logging
  updateSeparation(separationId: string, separation: SeparationUpdateRequest): Observable<Separation> {
    const currentUser = this.authService.currentUserValue;
    if (!currentUser?.accessToken) {
      return throwError(() => new Error('No authentication token found. Please log in again.'));
    }

    // Enhanced validation with detailed error messages
    const validationErrors: string[] = [];
    
    if (!separationId || separationId.trim() === '') {
      validationErrors.push('Separation ID is required');
    }
    if (!separation.empId || separation.empId.trim() === '') {
      validationErrors.push('Employee ID is required');
    }
    if (!separation.separationTypeId || separation.separationTypeId.trim() === '') {
      validationErrors.push('Separation type is required');
    }
    if (!separation.lastWorkingDate || separation.lastWorkingDate.trim() === '') {
      validationErrors.push('Last working date is required');
    }
    if (!separation.separationReason || separation.separationReason.trim() === '') {
      validationErrors.push('Separation reason is required');
    }
    if (!separation.initiatedBy || separation.initiatedBy.trim() === '') {
      validationErrors.push('Initiator is required');
    }
    if (!separation.initiationDate || separation.initiationDate.trim() === '') {
      validationErrors.push('Initiation date is required');
    }

    if (validationErrors.length > 0) {
      return throwError(() => new Error(`Validation errors:\n${validationErrors.join('\n')}`));
    }

    // Enhanced date formatting with better error handling
    const formatDate = (dateString: string, fieldName: string): string => {
      try {
        if (!dateString) {
          throw new Error(`${fieldName} is empty`);
        }
        
        // If it's already in YYYY-MM-DD format, use it directly
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
          return dateString;
        }
        
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          console.warn(`Invalid ${fieldName}: ${dateString}, using as-is`);
          return dateString;
        }
        
        return date.toISOString().split('T')[0];
      } catch (e) {
        console.error(`Error formatting ${fieldName}:`, e);
        return dateString; // Return original if formatting fails
      }
    };

    const formattedLastWorkingDate = formatDate(separation.lastWorkingDate, 'last working date');
    const formattedInitiationDate = formatDate(separation.initiationDate, 'initiation date');

    // Create sanitized request payload
    const requestPayload: any = {
      empId: separation.empId.trim(),
      separationTypeId: separation.separationTypeId.trim(),
      initiatedBy: separation.initiatedBy.trim(),
      initiationDate: formattedInitiationDate,
      lastWorkingDate: formattedLastWorkingDate,
      noticePeriodServed: Math.max(0, Number(separation.noticePeriodServed) || 0),
      separationReason: separation.separationReason.trim(),
      resignationLetterPath: (separation.resignationLetterPath || '').trim(),
      rehireEligible: Boolean(separation.rehireEligible),
      rehireNotes: (separation.rehireNotes || '').trim()
    };

    // Add separationStatus if provided (for admin/HR users)
    if (separation.separationStatus) {
      requestPayload.separationStatus = separation.separationStatus;
    }

    console.log('=== UPDATE SEPARATION REQUEST ===');
    console.log('Separation ID:', separationId);
    console.log('Original separation data:', separation);
    console.log('Formatted payload:', requestPayload);
    console.log('Request URL:', `${this.apiUrl}/${separationId}`);

    // Verify separation type exists in cache
    if (!this.separationTypesMap[requestPayload.separationTypeId]) {
      console.warn(`Separation type ${requestPayload.separationTypeId} not found in cache. Available types:`, 
        Object.keys(this.separationTypesMap));
    }

    return this.http.put<SeparationResponse>(
      `${this.apiUrl}/${separationId}`,
      requestPayload,
      { 
        headers: this.getAuthHeaders(),
        observe: 'response' 
      }
    ).pipe(
      map((response: HttpResponse<SeparationResponse>) => {
        if (!response.body) {
          throw new Error('Empty response body');
        }
        
        console.log('=== UPDATE SEPARATION RESPONSE ===');
        console.log('Response status:', response.status);
        console.log('Raw API response:', response.body);
        
        // Map the response
        const mappedSeparation = this.mapToSeparation(response.body, separation.separationTypeId);
        
        // Ensure we have the correct separation type from our cache
        if (separation.separationTypeId && this.separationTypesMap[separation.separationTypeId]) {
          mappedSeparation.separationType = this.separationTypesMap[separation.separationTypeId];
          mappedSeparation.separationTypeId = separation.separationTypeId;
        }
        
        console.log('Final mapped updated separation:', mappedSeparation);
        
        return mappedSeparation;
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('=== UPDATE SEPARATION ERROR ===');
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error response body:', error.error);
        console.error('Request URL:', `${this.apiUrl}/${separationId}`);
        console.error('Request payload that was sent:', requestPayload);
        console.error('Request headers:', this.getAuthHeaders());
        
        let errorMessage = 'Failed to update separation. Please try again.';
        
        if (error.status === 401) {
          errorMessage = 'Your session has expired. Please log in again.';
        } else if (error.status === 403) {
          errorMessage = 'You do not have permission to update this separation.';
        } else if (error.status === 404) {
          errorMessage = 'Separation not found. It may have been deleted or the ID is incorrect.';
        } else if (error.status === 400) {
          if (error.error?.errors) {
            const validationErrors = Object.values(error.error.errors).flat();
            errorMessage = 'Validation errors:\n' + validationErrors.join('\n');
          } else if (error.error?.message) {
            errorMessage = `Bad Request: ${error.error.message}`;
          } else if (error.error?.error) {
            errorMessage = `Bad Request: ${error.error.error}`;
          } else {
            errorMessage = 'Invalid request data. Please check all fields and try again.';
          }
        } else if (error.status === 500) {
          errorMessage = 'Server error occurred. Please try again later or contact support.';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        return throwError(() => new Error(errorMessage));
      })
    );
  }

  deleteSeparation(separationId: string): Observable<any> {
    const headers = this.getAuthHeaders();
    return this.http.delete(`${this.apiUrl}/${separationId}`, { headers }).pipe(
      catchError(this.handleError)
    );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An error occurred';
    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.message}`;
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }
    return throwError(() => new Error(errorMessage));
  }

  createSeparationType(separationType: Omit<SeparationType, 'separationTypeId' | 'createdDate' | 'modifiedDate'>): Observable<SeparationType> {
    const headers = this.getAuthHeaders();
    return this.http.post<SeparationType>(this.sepTypeUrl, separationType, { headers }).pipe(
      tap(newType => {
        // Add to cache
        this.separationTypesMap[newType.separationTypeId] = newType;
        // Reload types
        this.loadSeparationTypes();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error creating separation type:', error);
        return throwError(() => new Error('Failed to create separation type. Please try again.'));
      })
    );
  }

  updateSeparationType(id: string, separationType: Partial<SeparationType>): Observable<SeparationType> {
    const headers = this.getAuthHeaders();
    return this.http.put<SeparationType>(`${this.sepTypeUrl}/${id}`, separationType, { headers }).pipe(
      tap(updatedType => {
        // Update cache
        this.separationTypesMap[id] = updatedType;
        // Reload types
        this.loadSeparationTypes();
      }),
      catchError((error: HttpErrorResponse) => {
        console.error('Error updating separation type:', error);
        return throwError(() => new Error('Failed to update separation type. Please try again.'));
      })
    );
  }

  getEmployeeNameById(empId: string): Observable<string> {
    return this.getEmployeeById(empId).pipe(
      map(employee => `${employee.firstName} ${employee.lastName}`),
      catchError(() => of('Unknown Employee'))
    );
  }

  // Helper method to get cached separation types
  getCachedSeparationTypes(): SeparationType[] {
    return this.separationTypesSubject.value;
  }

  // Helper method to get a specific cached separation type
  getCachedSeparationType(id: string): SeparationType | null {
    return this.separationTypesMap[id] || null;
  }

  // Helper method to get department name by ID
  getDepartmentNameById(deptId: string): Observable<string> {
    if (this.departmentsMap[deptId]) {
      return of(this.departmentsMap[deptId].dept_name);
    }

    return this.getDepartmentById(deptId).pipe(
      map(dept => dept ? dept.dept_name : 'Unknown Department'),
      catchError(() => of('Unknown Department'))
    );
  }
}