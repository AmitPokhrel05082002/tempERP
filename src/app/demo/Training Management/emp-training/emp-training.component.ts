import { Component, OnInit, TemplateRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { NgbModule, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { finalize } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { TrainingService, TrainingProgram, TrainingNomination } from '../../../services/training.service';
import { AuthService } from '../../../core/services/auth.service';

interface TrainingNominationExtended extends Partial<TrainingNomination> {
  employeeName?: string;
  employeeId?: string;
  nominationDate?: string;
  createdDate?: string;
  status: string;
}

interface TrainingProgramWithNominations extends Omit<TrainingProgram, 'status' | 'venue' | 'location' | 'trainerName' | 'seatsBooked' | 'maxSeats' | 'description'> {
  nominations?: TrainingNominationExtended[];
  status?: string;
  venue?: string;
  location?: string;
  trainerName?: string;
  seatsBooked?: number;
  maxSeats?: number;
  maxParticipants?: number;
  programDescription?: string;
  participants?: any[];
}

@Component({
  selector: 'app-emp-programs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    NgbModule
  ],
  templateUrl: './emp-training.component.html',
  styleUrls: ['./emp-training.component.scss']
})
export class EmpTrainingComponent implements OnInit {
  trainingPrograms: TrainingProgramWithNominations[] = [];
  filteredPrograms: TrainingProgramWithNominations[] = [];
  organizations: { orgId: string; orgName: string }[] = [];
  allCategories: { categoryId: string; categoryName: string; orgId: string | null; isActive?: boolean }[] = [];
  filteredCategories: { categoryId: string; categoryName: string }[] = [];
  currentProgram: TrainingProgramWithNominations | null = null;
  isLoading = false;
  currentTraining: TrainingProgramWithNominations | null = null;

  searchQuery = '';
  dateRange: [Date | null, Date | null] = [null, null];
  
  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;
  
  isEditMode = false;
  errorMessage = '';
  
  canEdit: boolean = false;
  canViewDetails: boolean = true; // Allow all users to view details

  form: FormGroup;

  @ViewChild('trainingModal') private trainingModalRef!: TemplateRef<any>;
  @ViewChild('viewTrainingModal') private viewTrainingModalRef!: TemplateRef<any>;
  private modalRef: any;

  constructor(
    private trainingService: TrainingService,
    private modalService: NgbModal,
    private fb: FormBuilder,
    private authService: AuthService
  ) {
    this.canEdit = this.authService.hasFullAccess() || 
                  this.authService.hasPermissionForModule('training', 'write');
    
    this.currentTraining = {
      programId: '',
      programName: '',
      programCode: '',
      startDate: new Date(),
      endDate: new Date(new Date().setDate(new Date().getDate() + 7)),
      venue: '',
      location: '',
      trainerName: '',
      status: 'Draft',
      seatsBooked: 0,
      maxSeats: 0,
      maxParticipants: 0,
      nominations: [],
      participants: [],
      orgId: '',
      categoryId: '',
      programType: 'In-House',
      deliveryMethod: 'In-Person',
      description: '',
      isActive: true
    } as unknown as TrainingProgramWithNominations;

    this.form = this.fb.group({
      orgId: ['', Validators.required],
      categoryId: ['', Validators.required],
      programName: ['', Validators.required],
      programCode: ['', [
        Validators.required, 
        Validators.pattern('^[A-Za-z0-9-]+$')
      ]],
      programType: ['', Validators.required],
      deliveryMethod: ['', Validators.required],
      startDate: ['', Validators.required],
      endDate: ['', Validators.required],
      durationHours: ['', [
        Validators.required, 
        Validators.min(1)
      ]],
      costPerParticipant: ['', [
        Validators.required, 
        Validators.min(0)
      ]],
      batchName: [''],
      heldBy: ['', Validators.required],
      venue: ['', Validators.required],
      maxSeats: ['', [
        Validators.required, 
        Validators.min(1)
      ]],
      isActive: [false],
      description: ['']
    }, { 
      validators: [
        this.dateRangeValidator,
      ] 
    });
  }

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadAllCategories();
    this.loadTrainingPrograms();
    
    this.form.get('orgId')?.valueChanges.subscribe(orgId => {
      this.filterCategoriesByOrganization(orgId);
    });
  }

  loadAllCategories(): void {
    this.isLoading = true;
    this.trainingService.getTrainingCategories()
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (categories) => {
          if (!Array.isArray(categories)) {
            console.error('Expected an array of categories but got:', typeof categories);
            this.allCategories = [];
            return;
          }
          
          this.allCategories = categories.map(cat => ({
            categoryId: cat.categoryId,
            categoryName: cat.categoryName,
            orgId: cat.orgId,
            isActive: cat.isActive
          }));
          
          const currentOrgId = this.form.get('orgId')?.value;
          this.filterCategoriesByOrganization(currentOrgId);
        },
        error: (error) => {
          console.error('Error loading categories:', error);
          this.allCategories = [];
          this.filteredCategories = [];
          this.form.get('categoryId')?.reset('');
          Swal.fire('Error', 'Failed to load categories', 'error');
        }
      });
  }

  filterCategoriesByOrganization(orgId: string | null): void {
    if (!orgId) {
      this.filteredCategories = this.allCategories
        .filter(cat => cat.orgId !== null && cat.isActive !== false)
        .map(({ categoryId, categoryName }) => ({ categoryId, categoryName }));
    } else {
      this.filteredCategories = this.allCategories
        .filter(cat => cat.orgId === orgId && cat.isActive !== false)
        .map(({ categoryId, categoryName }) => ({ categoryId, categoryName }));
    }
    
    if (this.filteredCategories.length === 1) {
      this.form.get('categoryId')?.setValue(this.filteredCategories[0].categoryId);
    } else {
      this.form.get('categoryId')?.reset('');
    }
  }

  loadOrganizations(): void {
    this.isLoading = true;
    this.trainingService.getOrganizations()
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (organizations) => {
          this.organizations = organizations || [];
        },
        error: (error) => {
          console.error('Error loading organizations:', error);
          Swal.fire('Error', 'Failed to load organizations', 'error');
        }
      });
  }

  loadTrainingPrograms(): void {
    this.isLoading = true;
    this.trainingService.getTrainingPrograms()
      .pipe(
        finalize(() => this.isLoading = false)
      )
      .subscribe({
        next: (programs) => {
          this.trainingPrograms = programs;
          this.filteredPrograms = [...this.trainingPrograms];
          this.loadNominationsForPrograms();
        },
        error: (error) => {
          console.error('Error loading training programs:', error);
          Swal.fire('Error', 'Failed to load training programs', 'error');
        }
      });
  }

  loadNominationsForPrograms(): void {
    this.trainingPrograms.forEach(program => {
      this.trainingService.getNominationsByProgram(program.programId)
        .subscribe({
          next: (nominations) => {
            program.nominations = nominations;
            if (nominations && nominations.length > 0) {
              program.status = nominations[0].status;
            } else {
              program.status = 'No Nominations';
            }
            program.seatsBooked = nominations?.length || 0;
          },
          error: (error) => {
            console.error(`Error loading nominations for program ${program.programId}:`, error);
            program.status = 'Error loading status';
            program.seatsBooked = 0;
          }
        });
    });
  }

  dateRangeValidator(group: FormGroup): { [key: string]: boolean } | null {
    const startDate = group.get('startDate')?.value;
    const endDate = group.get('endDate')?.value;

    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return { 'dateRangeInvalid': true };
    }
    return null;
  }

  applySearch(): void {
    if (!this.searchQuery.trim()) {
      this.filteredPrograms = [...this.trainingPrograms];
      return;
    }

    const query = this.searchQuery.toLowerCase().trim();
    this.filteredPrograms = this.trainingPrograms.filter(program => {
      const programName = program.programName?.toLowerCase() || '';
      const programCode = program.programCode?.toLowerCase() || '';
      const heldBy = program.heldBy?.toLowerCase() || '';
      const venue = program.venue?.toLowerCase() || '';
      
      return programName.includes(query) ||
             programCode.includes(query) ||
             heldBy.includes(query) ||
             venue.includes(query);
    });
  }

  updateTotalPages(): void {
    this.totalPages = Math.ceil(this.filteredPrograms.length / this.itemsPerPage) || 1;
  }

  get paginatedPrograms(): TrainingProgramWithNominations[] {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    return this.filteredPrograms.slice(startIndex, startIndex + this.itemsPerPage);
  }

  onPageChange(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openAddModal(): void {
    if (!this.canEdit) return;
    
    this.isEditMode = false;
    this.currentTraining = {
      programId: '',
      programName: '',
      programCode: '',
      startDate: new Date(),
      endDate: new Date(),
      venue: '',
      location: '',
      trainerName: '',
      status: 'Planned',
      seatsBooked: 0,
      maxSeats: 10,
      maxParticipants: 10,
      nominations: [],
      participants: [],
      orgId: '',
      categoryId: '',
      programType: 'In-House',
      deliveryMethod: 'In-Person',
      description: '',
      isActive: true
    } as unknown as TrainingProgramWithNominations;
    
    this.form.reset({
      programType: 'In-House',
      deliveryMethod: 'In-Person',
      isActive: true,
      maxSeats: 10
    });
    
    this.modalRef = this.modalService.open(this.trainingModalRef, { size: 'lg' });
  }

  openEditModal(program: TrainingProgramWithNominations): void {
    if (!this.canEdit) return;
    
    this.isEditMode = true;
    this.currentTraining = { ...program };
    
    this.form.patchValue({
      orgId: program.orgId,
      categoryId: program.categoryId,
      programName: program.programName,
      programCode: program.programCode,
      programType: program.programType,
      deliveryMethod: program.deliveryMethod,
      durationHours: program.durationHours,
      costPerParticipant: program.costPerParticipant,
      batchName: program.batchName || '',
      startDate: program.startDate,
      endDate: program.endDate,
      heldBy: program.heldBy,
      venue: program.venue,
      maxSeats: program.maxSeats,
      isActive: program.isActive
    });
    
    this.modalRef = this.modalService.open(this.trainingModalRef, { size: 'lg' });
  }

  openViewModal(program: TrainingProgramWithNominations): void {
    this.currentTraining = { ...program };
    this.modalService.open(this.viewTrainingModalRef, { size: 'lg' });
  }

  confirmDelete(programId: string): void {
    if (!this.canEdit) return;
    
    Swal.fire({
      title: 'Are you sure?',
      text: 'You will not be able to recover this training program!',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Yes, delete it!',
      cancelButtonText: 'No, keep it'
    }).then((result) => {
      if (result.isConfirmed) {
        this.trainingPrograms = this.trainingPrograms.filter(p => p.programId !== programId);
        this.filteredPrograms = this.filteredPrograms.filter(p => p.programId !== programId);
        
        Swal.fire(
          'Deleted!',
          'The training program has been deleted.',
          'success'
        );
        
        this.updateTotalPages();
      }
    });
  }

  getStatusBadgeClass(status: string = ''): string {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'no nominations') {
      return '';
    }
    
    if (statusLower === 'approved') {
      return 'bg-neon-green text-dark';
    }
    
    switch(statusLower) {
      case 'completed':
        return 'bg-success';
      case 'in progress':
      case 'inprogress':
        return 'bg-warning';
      case 'planned':
      case 'scheduled':
        return 'bg-info';
      case 'cancelled':
      case 'rejected':
        return 'bg-danger';
      case 'pending':
        return 'bg-secondary';
      default:
        return 'bg-light text-dark';
    }
  }
  
  getProgressPercentage(program: TrainingProgramWithNominations): number {
    if (!program.maxSeats) return 0;
    return Math.min(100, Math.round(((program.seatsBooked || 0) / program.maxSeats) * 100));
  }
  
  isAtCapacity(program: TrainingProgramWithNominations): boolean {
    if (!program.maxSeats) return false;
    return (program.seatsBooked || 0) >= program.maxSeats;
  }

  saveTraining(): void {
    if (!this.canEdit) return;
    
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const currentDate = new Date().toISOString();
    
    if (!this.isEditMode || !this.currentTraining?.programId) {
      const newProgram: Omit<TrainingProgram, 'programId' | 'seatsBooked' | 'createdDate' | 'modifiedDate'> = {
        orgId: this.form.value.orgId,
        categoryId: this.form.value.categoryId,
        programName: this.form.value.programName,
        programCode: this.form.value.programCode,
        programType: this.form.value.programType,
        deliveryMethod: this.form.value.deliveryMethod,
        durationHours: Number(this.form.value.durationHours),
        costPerParticipant: Number(this.form.value.costPerParticipant),
        batchName: this.form.value.batchName || '',
        startDate: this.form.value.startDate,
        endDate: this.form.value.endDate,
        heldBy: this.form.value.heldBy,
        venue: this.form.value.venue,
        maxSeats: Number(this.form.value.maxSeats),
        isActive: this.form.value.isActive
      };

      this.isLoading = true;
      this.trainingService.createProgram(newProgram)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: () => this.handleSaveSuccess('created'),
          error: (error) => this.handleSaveError(error)
        });
    } 
    else if (this.currentTraining?.programId) {
      const updatedProgram: TrainingProgram = {
        programId: this.currentTraining.programId,
        orgId: this.form.value.orgId,
        categoryId: this.form.value.categoryId,
        programName: this.form.value.programName,
        programCode: this.form.value.programCode,
        programType: this.form.value.programType,
        deliveryMethod: this.form.value.deliveryMethod,
        durationHours: Number(this.form.value.durationHours),
        costPerParticipant: Number(this.form.value.costPerParticipant),
        batchName: this.form.value.batchName || '',
        startDate: this.form.value.startDate,
        endDate: this.form.value.endDate,
        heldBy: this.form.value.heldBy,
        venue: this.form.value.venue,
        maxSeats: Number(this.form.value.maxSeats),
        isActive: this.form.value.isActive,
        seatsBooked: this.currentTraining.seatsBooked || 0,
        createdDate: this.currentTraining.createdDate || currentDate,
        modifiedDate: currentDate
      };

      this.isLoading = true;
      this.trainingService.updateProgram(updatedProgram)
        .pipe(finalize(() => this.isLoading = false))
        .subscribe({
          next: () => this.handleSaveSuccess('updated'),
          error: (error) => this.handleSaveError(error)
        });
    }
  }

  private handleSaveSuccess(action: 'created' | 'updated'): void {
    Swal.fire('Success', `Training program ${action} successfully`, 'success');
    this.loadTrainingPrograms();
    this.modalService.dismissAll();
  }

  private handleSaveError(error: any): void {
    console.error('Error saving training program:', error);
    const errorMessage = error.error?.message || 'Failed to save training program';
    Swal.fire('Error', errorMessage, 'error');
  }

  onSubmit(): void {
    this.saveTraining();
  }
}