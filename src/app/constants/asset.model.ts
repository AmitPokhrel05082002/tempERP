export interface Asset {
  id?: string;
  assetId: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location: string;
  department?: string;
  status: 'Operational' | 'Maintenance' | 'Repair' | 'Retired';
  priority: 'High' | 'Medium' | 'Low';
  condition?: number; // 1-100 percentage
  purchaseDate?: Date | string;
  purchaseValue?: number;
  currentValue?: number;
  depreciationRate?: number;
  warrantyExpiry?: Date | string;
  lastMaintenance?: Date | string;
  nextMaintenance?: Date | string;
  operatingHours?: number;
  assignedTo?: string;
  image?: string;
  documents?: string[];
  maintenanceHistory?: MaintenanceRecord[];
  notes?: string;
  tags?: string[];
  qrCode?: string;
  coordinates?: { lat: number; lng: number };
}

export interface MaintenanceRecord {
  date: Date | string;
  type: string;
  description: string;
  cost: number;
  technician: string;
}

export interface AssetStats {
  total: number;
  operational: number;
  maintenance: number;
  repair: number;
  retired: number;
  totalValue: number;
  avgCondition: number;
  upcomingMaintenance: number;
}

export interface FilterOptions {
  searchTerm: string;
  category: string;
  status: string;
  priority: string;
  location: string;
  department: string;
  dateRange?: { start: Date; end: Date };
}
