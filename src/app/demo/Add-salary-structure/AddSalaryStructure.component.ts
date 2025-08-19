import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, ValidationErrors, FormArray } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CommonModule } from '@angular/common';

interface SalaryStructure {
    id?: string;
    gradeId: string;
    componentId: string;
    componentValue: number;
    isVariable: boolean;
    performanceLinked: boolean;
    revisionCycle: string;
    effectiveFrom: string;
    effectiveTo: string;
}

interface Grade {
    gradeId: string;
    gradeName: string;
}

interface SalaryComponent {
    componentId: string;
    componentName: string;
}

@Component({
    standalone: true,
    selector: 'app-salary-structure',
    templateUrl: './AddSalaryStructure.component.html',
    styleUrls: ['./AddSalaryStructure.component.scss'],
    imports: [CommonModule, FormsModule, ReactiveFormsModule]
})
export class SalaryStructureComponent implements OnInit {
    salaryStructures: SalaryStructure[] = [];
    filteredSalaryStructures: SalaryStructure[] = [];
    paginatedSalaryStructures: SalaryStructure[] = [];
    grades: Grade[] = [];
    components: SalaryComponent[] = [];
    currentSalaryStructure: SalaryStructure | null = null;
    searchQuery: string = '';
    currentPage: number = 1;
    itemsPerPage: number = 10;
    totalPages: number = 1;
    pages: number[] = [];
    isLoading: boolean = false;
    errorMessage: string = '';
    isEditMode: boolean = false;
    showAddButton: boolean = true;

    form: FormGroup;

    constructor(
        private fb: FormBuilder,
        private modalService: NgbModal,
        private http: HttpClient
    ) {
        this.form = this.fb.group({
            structures: this.fb.array([])
        });
        this.addNewStructure(); // Add one empty structure by default
    }

    get structures(): FormArray {
        return this.form.get('structures') as FormArray;
    }

    createStructure(): FormGroup {
        return this.fb.group({
            id: [''],
            gradeId: ['', Validators.required],
            componentId: ['', Validators.required],
            componentValue: [0, [Validators.required, Validators.min(0)]],
            isVariable: [false],
            performanceLinked: [false],
            revisionCycle: ['Annual'],
            effectiveFrom: ['', Validators.required],
            effectiveTo: [null]
        }, { validators: this.dateValidator });
    }

    addNewStructure(): void {
        this.structures.push(this.createStructure());
    }

    removeStructure(index: number): void {
        this.structures.removeAt(index);
        if (this.structures.length === 0) {
            this.addNewStructure();
        }
    }

    dateValidator(group: FormGroup): ValidationErrors | null {
        const from = group.get('effectiveFrom')?.value;
        const to = group.get('effectiveTo')?.value;

        if (from && to && new Date(to) < new Date(from)) {
            return { dateRange: true };
        }
        return null;
    }

    async ngOnInit(): Promise<void> {
        await this.loadGrades();
        await this.loadComponents();
        this.loadSalaryStructures();
    }

    loadSalaryStructures(): void {
        this.isLoading = true;
        this.http.get<any>(`${environment.payrollApiUrl}/api/payRoll/getAllSalaryStructure`).subscribe({
            next: (response) => {
                console.log('API Response:', response);

                if (response?.salaryStructures) {
                    this.salaryStructures = response.salaryStructures;
                } else if (Array.isArray(response)) {
                    this.salaryStructures = response;
                } else {
                    this.salaryStructures = [];
                }

                this.filteredSalaryStructures = [...this.salaryStructures];
                this.paginateData();
                this.isLoading = false;
            },
            error: (err) => {
                this.errorMessage = 'Failed to load salary structures';
                this.isLoading = false;
                console.error('Error loading salary structures:', err);
            }
        });
    }

    async loadGrades(): Promise<void> {
        console.log('Fetching grades from:', `${environment.apiUrl}/api/v1/job-grades`);
        return new Promise((resolve) => {
            this.http.get<any[]>(`${environment.apiUrl}/api/v1/job-grades`).subscribe({
                next: (data) => {
                    console.log('Grades received:', data);
                    this.grades = data;
                    resolve();
                },
                error: (err) => {
                    console.error('Failed to load grades', err);
                    resolve();
                }
            });
        });
    }

    async loadComponents(): Promise<void> {
        console.log('Fetching components from:', `${environment.payrollApiUrl}/api/payRoll/getComponents`);
        return new Promise((resolve) => {
            this.http.get<any[]>(`${environment.payrollApiUrl}/api/payRoll/getComponents`).subscribe({
                next: (data) => {
                    console.log('Components received:', data);
                    this.components = data;
                    resolve();
                },
                error: (err) => {
                    console.error('Failed to load components', err);
                    resolve();
                }
            });
        });
    }

    getGradeName(gradeId: string): string {
        const grade = this.grades.find(g => g.gradeId === gradeId);
        return grade ? grade.gradeName : 'N/A';
    }

    getComponentName(componentId: string): string {
        const component = this.components.find(c => c.componentId === componentId);
        return component ? component.componentName : 'N/A';
    }

    applySearchSalaryStructure(): void {
        const query = this.searchQuery.toLowerCase();
        if (!query) {
            this.filteredSalaryStructures = [...this.salaryStructures];
        } else {
            this.filteredSalaryStructures = this.salaryStructures.filter(structure => {
                return (
                    this.getGradeName(structure.gradeId).toLowerCase().includes(query) ||
                    this.getComponentName(structure.componentId).toLowerCase().includes(query) ||
                    (structure.revisionCycle && structure.revisionCycle.toLowerCase().includes(query))
                );
            });
        }
        this.currentPage = 1;
        this.paginateData();
    }

    paginateData(): void {
        this.totalPages = Math.ceil(this.filteredSalaryStructures.length / this.itemsPerPage);
        this.pages = Array.from({ length: this.totalPages }, (_, i) => i + 1);

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        this.paginatedSalaryStructures = this.filteredSalaryStructures.slice(startIndex, endIndex);
    }

    onPageChangeSalaryStructure(page: number): void {
        if (page >= 1 && page <= this.totalPages) {
            this.currentPage = page;
            this.paginateData();
        }
    }

    openSalaryStructureModal(content: any, structure?: SalaryStructure): void {
  this.isEditMode = !!structure;
  
  // Clear existing structures
  while (this.structures.length !== 0) {
    this.structures.removeAt(0);
  }

  if (this.isEditMode && structure) {
    this.currentSalaryStructure = structure;
    // Add just the one structure being edited
    this.structures.push(this.fb.group({
      id: [structure.id],
      gradeId: [structure.gradeId, Validators.required],
      componentId: [structure.componentId, Validators.required],
      componentValue: [structure.componentValue, [Validators.required, Validators.min(0)]],
      isVariable: [structure.isVariable],
      performanceLinked: [structure.performanceLinked],
      revisionCycle: [structure.revisionCycle],
      effectiveFrom: [structure.effectiveFrom, Validators.required],
      effectiveTo: [structure.effectiveTo]
    }, { validators: this.dateValidator }));
    
    // Hide the "Add Another Structure" button in edit mode
    this.showAddButton = false;
  } else {
    this.currentSalaryStructure = null;
    this.addNewStructure(); // Add one empty structure for new entries
    this.showAddButton = true; // Show the "Add Another Structure" button
  }
  
  this.modalService.open(content, { ariaLabelledBy: 'modal-basic-title', size: 'lg' });
}

   saveSalaryStructure(): void {
  if (this.form.invalid) {
    this.form.markAllAsTouched();
    return;
  }

  const payload = this.structures.value.map((structure: any) => ({
    id: structure.id, // Include the ID for updates
    gradeId: structure.gradeId,
    componentId: structure.componentId,
    componentValue: Number(structure.componentValue),
    isVariable: structure.isVariable,
    performanceLinked: structure.performanceLinked,
    revisionCycle: structure.revisionCycle || 'Annual',
    effectiveFrom: structure.effectiveFrom,
    effectiveTo: structure.effectiveTo
  }));

  if (this.isEditMode && this.currentSalaryStructure?.id) {
    // For edit mode, we'll update the existing record
    this.http.put(`${environment.payrollApiUrl}/api/payRoll/UpdateSalaryStructure/${this.currentSalaryStructure.id}`, payload[0])
      .subscribe({
        next: () => {
          console.log('Updated successfully');
          this.loadSalaryStructures();
          this.modalService.dismissAll();
        },
        error: (err) => {
          console.error('Error:', err);
          this.errorMessage = 'Failed to update salary structure';
        }
      });
  } else {
    // For add mode, we'll create new records
    this.http.post(`${environment.payrollApiUrl}/api/payRoll/AddSalaryStructures`, payload)
      .subscribe({
        next: () => {
          console.log('Saved successfully');
          this.loadSalaryStructures();
          this.modalService.dismissAll();
        },
        error: (err) => {
          console.error('Error:', err);
          this.errorMessage = 'Failed to save salary structure';
        }
      });
  }
}


    editSalaryStructure(structure: SalaryStructure, content: any): void {
        this.openSalaryStructureModal(content, structure);
    }

    deleteSalaryStructure(id: string): void {
        if (confirm('Are you sure you want to delete this salary structure?')) {
            this.http.delete(`${environment.payrollApiUrl}/api/payRoll/DeleteSalaryStructure/${id}`).subscribe({
                next: () => {
                    this.loadSalaryStructures();
                },
                error: (err) => {
                    this.errorMessage = 'Failed to delete salary structure';
                    console.error(err);
                }
            });
        }
    }
}