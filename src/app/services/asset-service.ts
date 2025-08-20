import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Asset, AssetStats, FilterOptions } from '../constants/asset.model';

@Injectable({
  providedIn: 'root'
})
export class AssetService {
  private assets: Asset[] = [];
  private assetsSubject = new BehaviorSubject<Asset[]>([]);
  public assets$ = this.assetsSubject.asObservable();

  constructor() {
    this.loadAssets();
  }

  private loadAssets(): void {
    const stored = localStorage.getItem('assets');
    if (stored) {
      this.assets = JSON.parse(stored);
    } else {
      this.assets = this.getInitialAssets();
      this.saveAssets();
    }
    this.assetsSubject.next(this.assets);
  }

  private saveAssets(): void {
    localStorage.setItem('assets', JSON.stringify(this.assets));
    this.assetsSubject.next(this.assets);
  }

  getAssets(): Observable<Asset[]> {
    return this.assets$;
  }

  getAssetById(id: string): Asset | undefined {
    return this.assets.find(a => a.id === id);
  }

  addAsset(asset: Asset): void {
    asset.id = this.generateId();
    asset.qrCode = this.generateQRCode(asset.assetId);
    this.assets.push(asset);
    this.saveAssets();
  }

  updateAsset(id: string, asset: Asset): void {
    const index = this.assets.findIndex(a => a.id === id);
    if (index !== -1) {
      this.assets[index] = { ...asset, id };
      this.saveAssets();
    }
  }

  deleteAsset(id: string): void {
    this.assets = this.assets.filter(a => a.id !== id);
    this.saveAssets();
  }

  getStats(): AssetStats {
    const stats: AssetStats = {
      total: this.assets.length,
      operational: this.assets.filter(a => a.status === 'Operational').length,
      maintenance: this.assets.filter(a => a.status === 'Maintenance').length,
      repair: this.assets.filter(a => a.status === 'Repair').length,
      retired: this.assets.filter(a => a.status === 'Retired').length,
      totalValue: this.assets.reduce((sum, a) => sum + (a.currentValue || 0), 0),
      avgCondition: this.assets.reduce((sum, a) => sum + (a.condition || 0), 0) / this.assets.length || 0,
      upcomingMaintenance: this.getUpcomingMaintenanceCount()
    };
    return stats;
  }

  private getUpcomingMaintenanceCount(): number {
    const today = new Date();
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    return this.assets.filter(a => {
      if (a.nextMaintenance) {
        const maintenanceDate = new Date(a.nextMaintenance);
        return maintenanceDate >= today && maintenanceDate <= thirtyDaysFromNow;
      }
      return false;
    }).length;
  }

  filterAssets(assets: Asset[], filters: FilterOptions): Asset[] {
    return assets.filter(asset => {
      const matchesSearch = !filters.searchTerm ||
        asset.assetId.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        asset.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        asset.location.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        asset.serialNumber?.toLowerCase().includes(filters.searchTerm.toLowerCase());

      const matchesCategory = !filters.category || asset.category === filters.category;
      const matchesStatus = !filters.status || asset.status === filters.status;
      const matchesPriority = !filters.priority || asset.priority === filters.priority;
      const matchesLocation = !filters.location || asset.location.includes(filters.location);
      const matchesDepartment = !filters.department || asset.department === filters.department;

      return matchesSearch && matchesCategory && matchesStatus && matchesPriority &&
             matchesLocation && matchesDepartment;
    });
  }

  private generateId(): string {
    return 'asset_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateQRCode(assetId: string): string {
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${assetId}`;
  }

  getCategories(): string[] {
    return ['Heavy Machinery', 'Vehicles', 'IT Equipment', 'Safety Equipment', 'Tools',
            'Facilities', 'Production Equipment', 'Testing Equipment'];
  }

  getDepartments(): string[] {
    return ['Mining Operations', 'Transportation', 'Maintenance', 'IT', 'Safety',
            'Production', 'Quality Control', 'Administration'];
  }

  getLocations(): string[] {
    const uniqueLocations = [...new Set(this.assets.map(a => a.location))];
    return uniqueLocations;
  }

  private getInitialAssets(): Asset[] {
    return [
      {
        id: 'asset_1',
        assetId: 'EXC-001',
        name: 'Excavator CAT 320',
        category: 'Heavy Machinery',
        manufacturer: 'Caterpillar',
        model: '320 GC',
        serialNumber: 'CAT320GC2024001',
        location: 'Site A - Mining Pit 1',
        department: 'Mining Operations',
        status: 'Operational',
        priority: 'High',
        condition: 92,
        purchaseDate: '2024-01-15',
        purchaseValue: 250000,
        currentValue: 230000,
        depreciationRate: 8,
        warrantyExpiry: '2027-01-15',
        lastMaintenance: '2024-12-01',
        nextMaintenance: '2025-03-01',
        operatingHours: 1250,
        assignedTo: 'John Smith',
        image: 'https://images.unsplash.com/photo-1567348182039-e6b3d5e0f8e8?w=400',
        notes: 'Primary excavator for mining operations',
        tags: ['critical', 'heavy-duty', 'mining'],
        maintenanceHistory: [
          {
            date: '2024-12-01',
            type: 'Routine',
            description: 'Oil change and filter replacement',
            cost: 1200,
            technician: 'Mike Johnson'
          }
        ]
      },
      {
        id: 'asset_2',
        assetId: 'DMP-002',
        name: 'Dump Truck Volvo A40G',
        category: 'Vehicles',
        manufacturer: 'Volvo',
        model: 'A40G',
        serialNumber: 'VLVA40G2024002',
        location: 'Site A - Mining Pit 1',
        department: 'Transportation',
        status: 'Operational',
        priority: 'High',
        condition: 88,
        purchaseDate: '2024-02-20',
        purchaseValue: 380000,
        currentValue: 365000,
        depreciationRate: 7,
        warrantyExpiry: '2027-02-20',
        lastMaintenance: '2024-11-15',
        nextMaintenance: '2025-02-15',
        operatingHours: 980,
        assignedTo: 'David Wilson',
        image: 'https://images.unsplash.com/photo-1567347464030-46e3d5e0f8e8?w=400',
        notes: 'Heavy-duty hauling truck for ore transportation',
        tags: ['transport', 'heavy-duty']
      },
      {
        id: 'asset_3',
        assetId: 'DRL-003',
        name: 'Drill Rig Atlas Copco',
        category: 'Heavy Machinery',
        manufacturer: 'Atlas Copco',
        model: 'FlexiROC T45',
        serialNumber: 'ACT452024003',
        location: 'Site B - Mining Pit 2',
        department: 'Mining Operations',
        status: 'Maintenance',
        priority: 'Medium',
        condition: 75,
        purchaseDate: '2023-11-10',
        purchaseValue: 450000,
        currentValue: 420000,
        depreciationRate: 6,
        warrantyExpiry: '2026-11-10',
        lastMaintenance: '2024-12-20',
        nextMaintenance: '2025-01-20',
        operatingHours: 2100,
        assignedTo: 'Robert Brown',
        notes: 'Scheduled maintenance for hydraulic system',
        tags: ['drilling', 'maintenance-due']
      },
      {
        id: 'asset_4',
        assetId: 'LDR-004',
        name: 'Wheel Loader Komatsu WA500',
        category: 'Heavy Machinery',
        manufacturer: 'Komatsu',
        model: 'WA500-8',
        serialNumber: 'KMTWA5002024004',
        location: 'Site A - Loading Zone',
        department: 'Mining Operations',
        status: 'Operational',
        priority: 'High',
        condition: 95,
        purchaseDate: '2024-03-05',
        purchaseValue: 320000,
        currentValue: 310000,
        depreciationRate: 7,
        warrantyExpiry: '2027-03-05',
        lastMaintenance: '2024-12-10',
        nextMaintenance: '2025-03-10',
        operatingHours: 750,
        assignedTo: 'Sarah Davis',
        notes: 'Main loader for ore loading operations',
        tags: ['loading', 'critical']
      },
      {
        id: 'asset_5',
        assetId: 'GEN-005',
        name: 'Generator Cummins 500kVA',
        category: 'Facilities',
        manufacturer: 'Cummins',
        model: 'C500D5',
        serialNumber: 'CMNS5002024005',
        location: 'Power Station A',
        department: 'Maintenance',
        status: 'Operational',
        priority: 'High',
        condition: 90,
        purchaseDate: '2024-01-01',
        purchaseValue: 85000,
        currentValue: 82000,
        depreciationRate: 5,
        warrantyExpiry: '2026-01-01',
        lastMaintenance: '2024-11-20',
        nextMaintenance: '2025-01-20',
        operatingHours: 3200,
        notes: 'Backup power generation unit',
        tags: ['power', 'backup', 'critical']
      },
      {
        id: 'asset_6',
        assetId: 'SRV-006',
        name: 'Dell PowerEdge Server R750',
        category: 'IT Equipment',
        manufacturer: 'Dell',
        model: 'PowerEdge R750',
        serialNumber: 'DELLR7502024006',
        location: 'Data Center',
        department: 'IT',
        status: 'Operational',
        priority: 'High',
        condition: 100,
        purchaseDate: '2024-05-10',
        purchaseValue: 25000,
        currentValue: 24000,
        depreciationRate: 15,
        warrantyExpiry: '2027-05-10',
        lastMaintenance: '2024-11-10',
        nextMaintenance: '2025-02-10',
        assignedTo: 'IT Team',
        notes: 'Main ERP system server',
        tags: ['server', 'critical', 'erp']
      },
      {
        id: 'asset_7',
        assetId: 'BLD-007',
        name: 'Bulldozer CAT D8T',
        category: 'Heavy Machinery',
        manufacturer: 'Caterpillar',
        model: 'D8T',
        serialNumber: 'CATD8T2024007',
        location: 'Site C - Construction',
        department: 'Mining Operations',
        status: 'Repair',
        priority: 'High',
        condition: 60,
        purchaseDate: '2023-07-15',
        purchaseValue: 480000,
        currentValue: 440000,
        depreciationRate: 8,
        warrantyExpiry: '2026-07-15',
        lastMaintenance: '2024-10-01',
        nextMaintenance: '2025-01-01',
        operatingHours: 3500,
        assignedTo: 'James Miller',
        notes: 'Undergoing engine repair - expected completion in 2 weeks',
        tags: ['repair', 'engine-issue']
      },
      {
        id: 'asset_8',
        assetId: 'CRN-008',
        name: 'Mobile Crane Grove GMK',
        category: 'Heavy Machinery',
        manufacturer: 'Grove',
        model: 'GMK5250L',
        serialNumber: 'GRVGMK2024008',
        location: 'Maintenance Yard',
        department: 'Maintenance',
        status: 'Operational',
        priority: 'Medium',
        condition: 85,
        purchaseDate: '2023-09-20',
        purchaseValue: 550000,
        currentValue: 520000,
        depreciationRate: 6,
        warrantyExpiry: '2026-09-20',
        lastMaintenance: '2024-11-01',
        nextMaintenance: '2025-02-01',
        operatingHours: 1800,
        notes: 'Support equipment for heavy lifting operations',
        tags: ['crane', 'support']
      }
    ].map(asset => ({
      ...asset,
      qrCode: this.generateQRCode(asset.assetId)
    }));
  }

  exportToCSV(): void {
    const headers = ['Asset ID', 'Name', 'Category', 'Status', 'Location', 'Current Value', 'Condition'];
    const rows = this.assets.map(a => [
      a.assetId,
      a.name,
      a.category,
      a.status,
      a.location,
      a.currentValue?.toString() || '',
      a.condition?.toString() || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assets_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  }
}
