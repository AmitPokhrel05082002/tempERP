import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

interface Document {
  id: number;
  name: string;
  fileType: string;
  size: string;
  createdBy: string;
  dateCreated: string;
  lastUpdated: string;
  updatedBy: string;
}

@Component({
  selector: 'app-document-archival',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './document-archival.component.html',
  styleUrls: ['./document-archival.component.scss']
})
export class DocumentArchivalComponent {
  constructor(private router: Router) {
    this.originalDocuments = [...this.documents];
    this.filteredDocuments = [...this.documents];
  }

  documents: Document[] = [
    {
      id: 1,
      name: 'Salary_Report_Jan',
      fileType: 'pdf',
      size: '200KB',
      createdBy: 'Bikash',
      dateCreated: '2025-06-01',
      lastUpdated: '2025-06-10',
      updatedBy: 'Krishna'
    },
    {
      id: 2,
      name: 'Employee_List',
      fileType: 'docx',
      size: '150KB',
      createdBy: 'Amit Sharma',
      dateCreated: '2025-05-20',
      lastUpdated: '2025-06-11',
      updatedBy: 'Bob Lee'
    },
    {
      id: 3,
      name: 'Payroll_March',
      fileType: 'xlsx',
      size: '180KB',
      createdBy: 'Sonam Dorji',
      dateCreated: '2025-04-15',
      lastUpdated: '2025-06-09',
      updatedBy: 'Sara Kim'
    },
    {
      id: 4,
      name: 'Attendance_April',
      fileType: 'pdf',
      size: '250KB',
      createdBy: 'Jigme Dorji',
      dateCreated: '2025-03-30',
      lastUpdated: '2025-05-01',
      updatedBy: 'David Clark'
    }
  ];

  searchQuery: string = '';
  selectedFileType: string = '';
  filteredDocuments: Document[] = [];
  originalDocuments: Document[] = [];

  showModal = false;
  showUploadModal = false;
  selectedDocument: Document | null = null;

  fileName: string = '';
  fileDescription: string = '';
  selectedFile: File | null = null;

  // ==========================
  // Search and Filter Logic
  // ==========================
  searchDocuments(): void {
    const query = this.searchQuery.toLowerCase();

    this.filteredDocuments = this.originalDocuments.filter(doc => {
      const matchesType = this.selectedFileType
        ? doc.fileType.toLowerCase() === this.selectedFileType.toLowerCase()
        : true;

      const matchesQuery = this.searchQuery
        ? (
            doc.name + doc.fileType + doc.createdBy + doc.updatedBy + doc.size
          ).toLowerCase().includes(query)
        : true;

      return matchesType && matchesQuery;
    });
  }

  highlightMatches(text: string): string {
    if (!this.searchQuery.trim() || !text) return text;
    const query = this.searchQuery.toLowerCase();
    const textStr = String(text);
    const regex = new RegExp(query, 'gi');
    return textStr.replace(regex, match => `<span class="highlight">${match}</span>`);
  }

  // ==========================
  // File Icons and Colors
  // ==========================
  getFileIconClass(fileType: string): string {
    const iconMap: Record<string, string> = {
      'pdf': 'fas fa-file-pdf',
      'docx': 'fas fa-file-word',
      'xlsx': 'fas fa-file-excel',
      'default': 'fas fa-file'
    };
    return iconMap[fileType.toLowerCase()] || iconMap['default'];
  }

  getFileIconColor(fileType: string): string {
    const colorMap: Record<string, string> = {
      'pdf': '#ff0000',
      'docx': '#2b579a',
      'xlsx': '#217346'
    };
    return colorMap[fileType.toLowerCase()] || '#4a6baf';
  }

  // ==========================
  // Modal Handling
  // ==========================
  openEditModal(document: Document): void {
    this.selectedDocument = { ...document };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.selectedDocument = null;
  }

  saveChanges(): void {
    if (this.selectedDocument) {
      const index = this.documents.findIndex(doc => doc.id === this.selectedDocument!.id);
      if (index !== -1) {
        this.documents[index] = {
          ...this.selectedDocument,
          lastUpdated: new Date().toISOString().split('T')[0]
        };
        this.originalDocuments = [...this.documents];
        this.searchDocuments();
      }
      this.closeModal();
    }
  }

  openUploadModal(): void {
    this.showUploadModal = true;
  }

  closeUploadModal(): void {
    this.showUploadModal = false;
  }

  // ==========================
  // File Upload Logic
  // ==========================
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      this.fileName = file.name;
    }
  }

  uploadFile(): void {
    if (this.selectedFile) {
      const newDoc: Document = {
        id: this.documents.length + 1,
        name: this.fileName.split('.')[0],
        fileType: this.fileName.split('.').pop() || '',
        size: Math.round(this.selectedFile.size / 1024) + 'KB',
        createdBy: 'Current User',
        dateCreated: new Date().toISOString().split('T')[0],
        lastUpdated: new Date().toISOString().split('T')[0],
        updatedBy: 'Current User'
      };

      this.documents.unshift(newDoc);
      this.originalDocuments = [...this.documents];
      this.searchDocuments();

      this.selectedFile = null;
      this.fileName = '';
      this.fileDescription = '';
      this.closeUploadModal();
    }
  }

  // ==========================
  // Navigation & Date Formatting
  // ==========================
  viewDocument(docId: number): void {
    this.router.navigate(['/doc-view-file', docId]);
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('en-GB', options); // Example: 20 June 2025
  }

  // ==========================
  // Trigger filter when file type dropdown changes
  // ==========================
  filterByType(): void {
    this.searchDocuments();
  }
  
}
