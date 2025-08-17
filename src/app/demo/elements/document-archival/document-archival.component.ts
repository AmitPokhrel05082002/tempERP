  import { Component, OnInit } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { Router } from '@angular/router';
  import { HttpClient, HttpHeaders } from '@angular/common/http';
  import { environment } from 'src/environments/environment';
  import { AuthService } from 'src/app/core/services/auth.service';

  interface Document {
    id: number;
    documentCode: string;
    fileName: string;
    userInputFileName: string;
    fileType: string;
    fileSize: number;
    uploadedBy: string;
    uploadDate: string;
    updatedBy?: string;
    lastModified?: string;
    visibleOnlyToMe: boolean;
  }

  @Component({
    selector: 'app-document-archival',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './document-archival.component.html',
    styleUrls: ['./document-archival.component.scss']
  })
  export class DocumentArchivalComponent implements OnInit {
    constructor(
      private router: Router,
      private http: HttpClient,
      private authService: AuthService
    ) {
      this.filteredDocuments = [...this.documents];
    }

    documents: Document[] = [];
    searchQuery: string = '';
    selectedFileType: string = '';
    filteredDocuments: Document[] = [];
    years: number[] = [];
    selectedYear: number = new Date().getFullYear();

    showModal = false;
    showUploadModal = false;
    selectedDocument: Document | null = null;

    fileName: string = '';
    fileDescription: string = '';
    selectedFile: File | null = null;
    visibleOnlyToMe: boolean = false;

    private readonly documentUploadUrl = `${environment.documentUploadUrl}`;
    private getHttpOptions() {
      return {
        headers: new HttpHeaders({
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.authService.getToken()}`
        })
      };
    }

    ngOnInit(): void {
      this.loadDocuments();
      this.generateYearOptions();
    }

    generateYearOptions(): void {
      const currentYear = new Date().getFullYear();
      for (let year = currentYear; year >= currentYear - 5; year--) {
        this.years.push(year);
      }
    }



 loadDocuments(): void {
    this.http.get<any>(`${this.documentUploadUrl}/api/archive/getAllDocument`, this.getHttpOptions())
        .subscribe({
            next: (response) => {
                console.log('Documents loaded:', response.data); // Add this line
                this.documents = response.data || [];
                this.filteredDocuments = [...this.documents];
            },
            error: (error) => {
                console.error('Error loading documents:', error);
                alert('Failed to load documents. Please try again later.');
            }
        });
}

    filterByYear(): void {
      this.http.get<any>(`${this.documentUploadUrl}/files/${this.selectedYear}`, this.getHttpOptions())
        .subscribe({
          next: (response) => {
            this.documents = response.data || [];
            this.filteredDocuments = [...this.documents];
          },
          error: (error) => {
            console.error('Error filtering by year:', error);
          }
        });
    }

    searchDocuments(): void {
      if (!this.searchQuery.trim()) {
        this.filteredDocuments = [...this.documents];
        return;
      }

      const request = {
        filename: this.searchQuery.trim()
      };

      this.http.post<any>(`${this.documentUploadUrl}/searchByFileName`, request, this.getHttpOptions())
        .subscribe({
          next: (response) => {
            this.filteredDocuments = response.data || [];
          },
          error: (error) => {
            console.error('Search error:', error);
          }
        });
    }

    highlightMatches(text: string): string {
      if (!this.searchQuery.trim() || !text) return text;
      const query = this.searchQuery.toLowerCase();
      const textStr = String(text);
      const regex = new RegExp(query, 'gi');
      return textStr.replace(regex, match => `<span class="highlight">${match}</span>`);
    }

    getFileIconClass(fileName: string): string {
      const extension = fileName.split('.').pop()?.toLowerCase();
      const iconMap: Record<string, string> = {
        'pdf': 'fas fa-file-pdf',
        'doc': 'fas fa-file-word',
        'docx': 'fas fa-file-word',
        'xls': 'fas fa-file-excel',
        'xlsx': 'fas fa-file-excel',
        'jpg': 'fas fa-file-image',
        'jpeg': 'fas fa-file-image',
        'png': 'fas fa-file-image',
        'default': 'fas fa-file'
      };
      return iconMap[extension || ''] || iconMap['default'];
    }

    getFileIconColor(fileName: string): string {
      const extension = fileName.split('.').pop()?.toLowerCase();
      const colorMap: Record<string, string> = {
        'pdf': '#ff0000',
        'doc': '#2b579a',
        'docx': '#2b579a',
        'xls': '#217346',
        'xlsx': '#217346',
        'jpg': '#4a6baf',
        'jpeg': '#4a6baf',
        'png': '#4a6baf'
      };
      return colorMap[extension || ''] || '#4a6baf';
    }

    openEditModal(document: Document): void {
      this.selectedDocument = { ...document };
      this.showModal = true;
    }

    closeModal(): void {
      this.showModal = false;
      this.selectedDocument = null;
    }

    saveChanges(): void {
      if (!this.selectedDocument) return;

      const formData = new FormData();
      formData.append('id', this.selectedDocument.id.toString());
      formData.append('userInputFileName', this.selectedDocument.userInputFileName);
      formData.append('updatedBy', this.authService.currentUserValue?.userId?.toString() || '0');

      if (this.selectedFile) {
        formData.append('file', this.selectedFile);
      }

      this.http.put(`${this.documentUploadUrl}/update`, formData, {
        headers: new HttpHeaders({
          'Authorization': `Bearer ${this.authService.getToken()}`
        })
      }).subscribe({
        next: () => {
          this.loadDocuments();
          this.closeModal();
        },
        error: (error) => {
          console.error('Update failed:', error);
        }
      });
    }

    openUploadModal(): void {
      this.showUploadModal = true;
    }

    closeUploadModal(): void {
      this.showUploadModal = false;
      this.selectedFile = null;
      this.fileName = '';
      this.fileDescription = '';
      this.visibleOnlyToMe = false;
    }

    onFileSelected(event: any): void {
      const file: File = event.target.files[0];
      if (file) {
        this.selectedFile = file;
        if (!this.fileName) {
          this.fileName = file.name.split('.')[0];
        }
      }
    }

    uploadFile(): void {
    if (!this.selectedFile) return;

    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('fileName', this.fileName || this.selectedFile.name);
    formData.append('visibleOnlyToMe', this.visibleOnlyToMe.toString());

    // Use absolute URL for debugging
    const uploadUrl = 'http://localhost:8090/api/archive/upload';
    
    this.http.post(uploadUrl, formData, {
      headers: new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      })
    }).subscribe({
      next: () => {
        this.loadDocuments();
        this.closeUploadModal();
        alert('File uploaded successfully!');
      },
      error: (error) => {
        console.error('Upload failed:', error);
        alert(`Upload failed: ${error.message}`);
      }
    });
  }

    viewDocument(documentCode: string): void {
      window.open(`${this.documentUploadUrl}/view/${documentCode}`, '_blank');
    }

    downloadDocument(documentCode: string): void {
      window.open(`${this.documentUploadUrl}/downloadFile/${documentCode}`, '_blank');
    }

    deleteDocument(documentId: number): void {
      if (confirm('Are you sure you want to delete this document?')) {
        // Note: Your controller doesn't have a delete endpoint, so this is just a placeholder
        // You would need to implement this on your backend
        console.log('Document deletion would happen here for ID:', documentId);
        // Temporary frontend-only removal for demo purposes
        this.documents = this.documents.filter(doc => doc.id !== documentId);
        this.filteredDocuments = this.filteredDocuments.filter(doc => doc.id !== documentId);
      }
    }

    formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString: string): string {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    }

    filterByType(): void {
      if (!this.selectedFileType) {
        this.filteredDocuments = [...this.documents];
        return;
      }
      this.filteredDocuments = this.documents.filter(doc => 
        doc.fileName.toLowerCase().endsWith(this.selectedFileType.toLowerCase())
      );
    }
  }