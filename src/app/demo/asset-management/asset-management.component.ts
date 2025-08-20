import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatDialog } from '@angular/material/dialog';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
// Angular Material Modules
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule } from '@angular/material/snack-bar';

interface Asset {
  id: string;
  assetCode: string;
  name: string;
  category: string;
  location: string;
  department: string;
  purchaseDate: Date;
  purchaseValue: number;
  currentValue: number;
  depreciationRate: number;
  status: 'Active' | 'Under Maintenance' | 'Retired' | 'Disposed';
  manufacturer: string;
  model: string;
  serialNumber: string;
  warrantyExpiry: Date;
  lastMaintenance: Date;
  nextMaintenance: Date;
  assignedTo: string;
  notes: string;
  maintenanceHistory: MaintenanceRecord[];
}

interface MaintenanceRecord {
  id: string;
  date: Date;
  type: 'Preventive' | 'Corrective' | 'Emergency';
  description: string;
  cost: number;
  technician: string;
  downtime: number;
}

interface AssetCategory {
  name: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-asset-management',
  templateUrl: './asset-management.component.html',
  styleUrls: ['./asset-management.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    // Material Modules
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDividerModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ]
})
export class AssetManagementComponent implements OnInit, AfterViewInit {
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  assets: Asset[] = [];
  dataSource!: MatTableDataSource<Asset>;
  displayedColumns: string[] = [
    'assetCode', 'name', 'category', 'location', 'status',
    'currentValue', 'assignedTo', 'nextMaintenance', 'actions'
  ];

  assetForm!: FormGroup;
  maintenanceForm!: FormGroup;
  selectedAsset: Asset | null = null;
  showAssetForm = false;
  showMaintenanceForm = false;
  editMode = false;

  categories: AssetCategory[] = [
    { name: 'Heavy Machinery', icon: 'construction', color: '#FF6B6B' },
    { name: 'Vehicles', icon: 'local_shipping', color: '#4ECDC4' },
    { name: 'IT Equipment', icon: 'computer', color: '#45B7D1' },
    { name: 'Tools', icon: 'build', color: '#F7DC6F' },
    { name: 'Safety Equipment', icon: 'security', color: '#BB8FCE' },
    { name: 'Office Equipment', icon: 'business_center', color: '#85C1E2' }
  ];

  statusOptions = ['Active', 'Under Maintenance', 'Retired', 'Disposed'];
  maintenanceTypes = ['Preventive', 'Corrective', 'Emergency'];

  // Dashboard metrics
  totalAssets = 0;
  totalValue = 0;
  assetsUnderMaintenance = 0;
  upcomingMaintenance = 0;

  // Charts
  categoryChart: any;
  statusChart: any;
  depreciationChart: any;

  // Today's date for comparisons
  today = new Date();

  constructor(
    private fb: FormBuilder,
    public dialog: MatDialog
  ) {
    this.initializeForms();
  }

  ngOnInit(): void {
    this.loadAssets();
    this.calculateMetrics();
  }

  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    setTimeout(() => this.initializeCharts(), 100);
  }

  initializeForms(): void {
    this.assetForm = this.fb.group({
      assetCode: ['', [Validators.required, Validators.pattern(/^[A-Z]{3}-\d{4}$/)]],
      name: ['', Validators.required],
      category: ['', Validators.required],
      location: ['', Validators.required],
      department: ['', Validators.required],
      purchaseDate: ['', Validators.required],
      purchaseValue: ['', [Validators.required, Validators.min(0)]],
      depreciationRate: ['', [Validators.required, Validators.min(0), Validators.max(100)]],
      status: ['Active', Validators.required],
      manufacturer: ['', Validators.required],
      model: ['', Validators.required],
      serialNumber: ['', Validators.required],
      warrantyExpiry: ['', Validators.required],
      assignedTo: [''],
      notes: ['']
    });

    this.maintenanceForm = this.fb.group({
      type: ['', Validators.required],
      description: ['', Validators.required],
      cost: ['', [Validators.required, Validators.min(0)]],
      technician: ['', Validators.required],
      downtime: ['', [Validators.required, Validators.min(0)]],
      date: [new Date(), Validators.required]
    });
  }

  loadAssets(): void {
    const savedAssets = localStorage.getItem('erpAssets');
    if (savedAssets) {
      this.assets = JSON.parse(savedAssets, this.dateReviver);
    } else {
      this.assets = this.generateSampleAssets();
      this.saveAssets();
    }
    this.dataSource = new MatTableDataSource(this.assets);
  }

  dateReviver(key: string, value: any): any {
    if (typeof value === 'string' && /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  generateSampleAssets(): Asset[] {
    const sampleAssets: Asset[] = [
      {
        id: this.generateId(),
        assetCode: 'HMC-0001',
        name: 'Excavator CAT 320D',
        category: 'Heavy Machinery',
        location: 'Site A - Mining Area',
        department: 'Mining Operations',
        purchaseDate: new Date('2022-01-15'),
        purchaseValue: 250000,
        currentValue: 187500,
        depreciationRate: 10,
        status: 'Active',
        manufacturer: 'Caterpillar',
        model: '320D',
        serialNumber: 'CAT320D2022001',
        warrantyExpiry: new Date('2025-01-15'),
        lastMaintenance: new Date('2024-01-10'),
        nextMaintenance: new Date('2024-04-10'),
        assignedTo: 'John Smith',
        notes: 'Primary excavator for mining operations',
        maintenanceHistory: [
          {
            id: this.generateId(),
            date: new Date('2024-01-10'),
            type: 'Preventive',
            description: 'Regular 500-hour service',
            cost: 2500,
            technician: 'Mike Johnson',
            downtime: 4
          }
        ]
      },
      {
        id: this.generateId(),
        assetCode: 'VEH-0023',
        name: 'Dump Truck Volvo A40G',
        category: 'Vehicles',
        location: 'Site B - Transport',
        department: 'Transport',
        purchaseDate: new Date('2021-06-20'),
        purchaseValue: 350000,
        currentValue: 245000,
        depreciationRate: 12,
        status: 'Active',
        manufacturer: 'Volvo',
        model: 'A40G',
        serialNumber: 'VLVA40G2021023',
        warrantyExpiry: new Date('2024-06-20'),
        lastMaintenance: new Date('2024-02-01'),
        nextMaintenance: new Date('2024-05-01'),
        assignedTo: 'Sarah Wilson',
        notes: 'Heavy-duty articulated dump truck',
        maintenanceHistory: []
      },
      {
        id: this.generateId(),
        assetCode: 'ITE-0156',
        name: 'Server Dell PowerEdge R740',
        category: 'IT Equipment',
        location: 'Data Center',
        department: 'IT',
        purchaseDate: new Date('2023-03-10'),
        purchaseValue: 15000,
        currentValue: 12000,
        depreciationRate: 20,
        status: 'Active',
        manufacturer: 'Dell',
        model: 'PowerEdge R740',
        serialNumber: 'DELLR740-156',
        warrantyExpiry: new Date('2026-03-10'),
        lastMaintenance: new Date('2024-01-15'),
        nextMaintenance: new Date('2024-07-15'),
        assignedTo: 'IT Department',
        notes: 'Main database server',
        maintenanceHistory: []
      },
      {
        id: this.generateId(),
        assetCode: 'HMC-0002',
        name: 'Bulldozer Komatsu D65',
        category: 'Heavy Machinery',
        location: 'Site A - Mining Area',
        department: 'Mining Operations',
        purchaseDate: new Date('2020-09-05'),
        purchaseValue: 180000,
        currentValue: 108000,
        depreciationRate: 12,
        status: 'Under Maintenance',
        manufacturer: 'Komatsu',
        model: 'D65EX-18',
        serialNumber: 'KMD65-2020002',
        warrantyExpiry: new Date('2023-09-05'),
        lastMaintenance: new Date('2024-02-20'),
        nextMaintenance: new Date('2024-02-25'),
        assignedTo: 'David Brown',
        notes: 'Currently undergoing engine overhaul',
        maintenanceHistory: []
      },
      {
        id: this.generateId(),
        assetCode: 'SAF-0089',
        name: 'Gas Detection System',
        category: 'Safety Equipment',
        location: 'Underground Mine',
        department: 'Safety',
        purchaseDate: new Date('2023-07-01'),
        purchaseValue: 25000,
        currentValue: 22500,
        depreciationRate: 5,
        status: 'Active',
        manufacturer: 'MSA',
        model: 'ALTAIR 5X',
        serialNumber: 'MSA5X-089',
        warrantyExpiry: new Date('2025-07-01'),
        lastMaintenance: new Date('2024-01-01'),
        nextMaintenance: new Date('2024-04-01'),
        assignedTo: 'Safety Team',
        notes: 'Multi-gas detection for underground operations',
        maintenanceHistory: []
      }
    ];

    return sampleAssets;
  }

  saveAssets(): void {
    localStorage.setItem('erpAssets', JSON.stringify(this.assets));
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  calculateMetrics(): void {
    this.totalAssets = this.assets.length;
    this.totalValue = this.assets.reduce((sum, asset) => sum + asset.currentValue, 0);
    this.assetsUnderMaintenance = this.assets.filter(a => a.status === 'Under Maintenance').length;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    this.upcomingMaintenance = this.assets.filter(a =>
      a.nextMaintenance && a.nextMaintenance <= thirtyDaysFromNow && a.status === 'Active'
    ).length;
  }

  initializeCharts(): void {
    this.createCategoryChart();
    this.createStatusChart();
    this.createDepreciationChart();
  }

  createCategoryChart(): void {
    const ctx = document.getElementById('categoryChart') as HTMLCanvasElement;
    if (!ctx) return;

    const categoryCounts = this.categories.map(cat => ({
      name: cat.name,
      count: this.assets.filter(a => a.category === cat.name).length,
      color: cat.color
    }));

    this.categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categoryCounts.map(c => c.name),
        datasets: [{
          data: categoryCounts.map(c => c.count),
          backgroundColor: categoryCounts.map(c => c.color),
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12 }
            }
          }
        }
      }
    });
  }

  createStatusChart(): void {
    const ctx = document.getElementById('statusChart') as HTMLCanvasElement;
    if (!ctx) return;

    const statusCounts = this.statusOptions.map(status =>
      this.assets.filter(a => a.status === status).length
    );

    this.statusChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: this.statusOptions,
        datasets: [{
          label: 'Assets by Status',
          data: statusCounts,
          backgroundColor: ['#2ECC71', '#F39C12', '#95A5A6', '#E74C3C'],
          borderRadius: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: { stepSize: 1 }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  createDepreciationChart(): void {
    const ctx = document.getElementById('depreciationChart') as HTMLCanvasElement;
    if (!ctx) return;

    const topAssets = this.assets
      .sort((a, b) => b.currentValue - a.currentValue)
      .slice(0, 5);

    this.depreciationChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: topAssets.map(a => a.name.substring(0, 20) + '...'),
        datasets: [
          {
            label: 'Purchase Value',
            data: topAssets.map(a => a.purchaseValue),
            borderColor: '#3498DB',
            backgroundColor: 'rgba(52, 152, 219, 0.1)',
            tension: 0.4
          },
          {
            label: 'Current Value',
            data: topAssets.map(a => a.currentValue),
            borderColor: '#E74C3C',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function(context) {
                return context.dataset.label + ': $' + context.parsed.y.toLocaleString();
              }
            }
          }
        }
      }
    });
  }

  applyFilter(event: Event): void {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  openAssetForm(asset?: Asset): void {
    this.showAssetForm = true;
    this.editMode = !!asset;

    if (asset) {
      this.selectedAsset = asset;
      this.assetForm.patchValue({
        ...asset,
        purchaseDate: this.formatDate(asset.purchaseDate),
        warrantyExpiry: this.formatDate(asset.warrantyExpiry)
      });
    } else {
      this.selectedAsset = null;
      this.assetForm.reset({ status: 'Active' });
    }
  }

  closeAssetForm(): void {
    this.showAssetForm = false;
    this.assetForm.reset();
    this.selectedAsset = null;
  }

  saveAsset(): void {
    if (this.assetForm.invalid) return;

    const formValue = this.assetForm.value;
    const assetData: Asset = {
      ...formValue,
      id: this.editMode ? this.selectedAsset!.id : this.generateId(),
      purchaseDate: new Date(formValue.purchaseDate),
      warrantyExpiry: new Date(formValue.warrantyExpiry),
      currentValue: this.calculateCurrentValue(
        formValue.purchaseValue,
        formValue.depreciationRate,
        new Date(formValue.purchaseDate)
      ),
      lastMaintenance: this.editMode ? this.selectedAsset!.lastMaintenance : null,
      nextMaintenance: this.calculateNextMaintenance(formValue.category),
      maintenanceHistory: this.editMode ? this.selectedAsset!.maintenanceHistory : []
    };

    if (this.editMode) {
      const index = this.assets.findIndex(a => a.id === this.selectedAsset!.id);
      this.assets[index] = assetData;
    } else {
      this.assets.push(assetData);
    }

    this.saveAssets();
    this.loadAssets();
    this.calculateMetrics();
    this.updateCharts();
    this.closeAssetForm();
  }

  deleteAsset(asset: Asset): void {
    if (confirm(`Are you sure you want to delete ${asset.name}?`)) {
      this.assets = this.assets.filter(a => a.id !== asset.id);
      this.saveAssets();
      this.loadAssets();
      this.calculateMetrics();
      this.updateCharts();
    }
  }

  openMaintenanceForm(asset: Asset): void {
    this.selectedAsset = asset;
    this.showMaintenanceForm = true;
    this.maintenanceForm.reset({
      type: 'Preventive',
      date: new Date()
    });
  }

  closeMaintenanceForm(): void {
    this.showMaintenanceForm = false;
    this.maintenanceForm.reset();
    this.selectedAsset = null;
  }

  saveMaintenance(): void {
    if (this.maintenanceForm.invalid || !this.selectedAsset) return;

    const maintenanceRecord: MaintenanceRecord = {
      id: this.generateId(),
      ...this.maintenanceForm.value,
      date: new Date(this.maintenanceForm.value.date)
    };

    const assetIndex = this.assets.findIndex(a => a.id === this.selectedAsset!.id);
    this.assets[assetIndex].maintenanceHistory.push(maintenanceRecord);
    this.assets[assetIndex].lastMaintenance = maintenanceRecord.date;
    this.assets[assetIndex].nextMaintenance = this.calculateNextMaintenance(
      this.assets[assetIndex].category,
      maintenanceRecord.date
    );

    if (maintenanceRecord.type === 'Emergency' || maintenanceRecord.type === 'Corrective') {
      this.assets[assetIndex].status = 'Under Maintenance';
    }

    this.saveAssets();
    this.loadAssets();
    this.closeMaintenanceForm();
  }

  viewAssetDetails(asset: Asset): void {
    this.selectedAsset = asset;
    // In a real app, this would open a detailed view dialog
  }

  calculateCurrentValue(purchaseValue: number, depreciationRate: number, purchaseDate: Date): number {
    const yearsOwned = (new Date().getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365);
    const depreciation = purchaseValue * (depreciationRate / 100) * yearsOwned;
    return Math.max(0, purchaseValue - depreciation);
  }

  calculateNextMaintenance(category: string, lastMaintenance?: Date): Date {
    const baseDate = lastMaintenance || new Date();
    const nextDate = new Date(baseDate);

    switch (category) {
      case 'Heavy Machinery':
        nextDate.setMonth(nextDate.getMonth() + 3); // Quarterly
        break;
      case 'Vehicles':
        nextDate.setMonth(nextDate.getMonth() + 3); // Quarterly
        break;
      case 'IT Equipment':
        nextDate.setMonth(nextDate.getMonth() + 6); // Semi-annual
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 12); // Annual
    }

    return nextDate;
  }

  updateCharts(): void {
    if (this.categoryChart) this.categoryChart.destroy();
    if (this.statusChart) this.statusChart.destroy();
    if (this.depreciationChart) this.depreciationChart.destroy();

    setTimeout(() => this.initializeCharts(), 100);
  }

  formatDate(date: Date): string {
    if (!date) return '';
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'Active': return 'success';
      case 'Under Maintenance': return 'warning';
      case 'Retired': return 'secondary';
      case 'Disposed': return 'danger';
      default: return 'primary';
    }
  }

  getCategoryIcon(category: string): string {
    const cat = this.categories.find(c => c.name === category);
    return cat ? cat.icon : 'category';
  }

  getCategoryColor(category: string): string {
    const cat = this.categories.find(c => c.name === category);
    return cat ? cat.color : '#95a5a6';
  }

  exportToExcel(): void {
    // In a real app, this would export data to Excel
    console.log('Exporting to Excel...');
  }

  generateReport(): void {
    // In a real app, this would generate a PDF report
    console.log('Generating report...');
  }
}
