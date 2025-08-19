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
    this.loadDocuments();
  }

  // Generate year options for filter
  generateYearOptions(): void {
    const currentYear = new Date().getFullYear();
    this.years = [];
    for (let year = currentYear; year >= currentYear - 5; year--) {
      this.years.push(year);
    }
  }

  // Load documents from API
  loadDocuments(): void {
    this.isLoading = true;
    const url = `${environment.documentUploadUrl}/api/archive/getAllDocument`;
    const headers = this.getHeaders();

    this.http.get<any>(url, { headers }).subscribe({
      next: (response) => {
        console.log('API Response:', response);
        
        if (response && response.data && Array.isArray(response.data)) {
          this.documents = response.data;
        } else if (Array.isArray(response)) {
          this.documents = response;
        } else {
          console.warn('Unexpected response format:', response);
          this.documents = [];
        }
        
        this.applyFilters();
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading documents:', error);
        this.isLoading = false;
        alert('Failed to load documents');
        this.documents = [];
        this.filteredDocuments = [];
      }
    });
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

    // Apply search filter
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

    // Apply file type filter
    if (this.selectedFileType) {
      filtered = filtered.filter(doc => {
        const fileName = doc.userInputFileName || '';
        return fileName.toLowerCase().endsWith(this.selectedFileType.toLowerCase());
      });
    }

    // Apply year filter
    if (this.selectedYear) {
      filtered = filtered.filter(doc => {
        if (!doc.createdAt) return false;
        const docYear = new Date(doc.createdAt).getFullYear();
        return docYear === this.selectedYear;
      });
    }

    this.filteredDocuments = filtered;
  }

  // Search documents
  searchDocuments(): void {
    this.applyFilters();
  }

  // Filter by file type
  filterByType(): void {
    this.applyFilters();
  }

  // Filter by year
  filterByYear(): void {
    this.applyFilters();
  }

  // Get file icon class with enhanced icon mapping
  getFileIconClass(fileName: string): string {
    if (!fileName) return 'fas fa-file';
    
    const extension = this.getFileExtension(fileName);
    const iconMap: { [key: string]: string } = {
      // Documents
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'csv': 'fas fa-file-csv',
      'ppt': 'fas fa-file-powerpoint',
      'pptx': 'fas fa-file-powerpoint',
      // Text files
      'txt': 'fas fa-file-alt',
      'log': 'fas fa-file-alt',
      'md': 'fas fa-file-alt',
      'rtf': 'fas fa-file-alt',
      // Images
      'jpg': 'fas fa-file-image',
      'jpeg': 'fas fa-file-image',
      'png': 'fas fa-file-image',
      'gif': 'fas fa-file-image',
      'bmp': 'fas fa-file-image',
      'svg': 'fas fa-file-image',
      'webp': 'fas fa-file-image',
      'tiff': 'fas fa-file-image',
      'ico': 'fas fa-file-image',
      // Archives
      'zip': 'fas fa-file-archive',
      'rar': 'fas fa-file-archive',
      '7z': 'fas fa-file-archive',
      'tar': 'fas fa-file-archive',
      'gz': 'fas fa-file-archive',
      // Media
      'mp4': 'fas fa-file-video',
      'avi': 'fas fa-file-video',
      'mkv': 'fas fa-file-video',
      'mov': 'fas fa-file-video',
      'wmv': 'fas fa-file-video',
      'flv': 'fas fa-file-video',
      'webm': 'fas fa-file-video',
      'mp3': 'fas fa-file-audio',
      'wav': 'fas fa-file-audio',
      'flac': 'fas fa-file-audio',
      'aac': 'fas fa-file-audio',
      'ogg': 'fas fa-file-audio',
      'wma': 'fas fa-file-audio',
      // Code files
      'json': 'fas fa-file-code',
      'xml': 'fas fa-file-code',
      'html': 'fas fa-file-code',
      'htm': 'fas fa-file-code',
      'css': 'fas fa-file-code',
      'js': 'fas fa-file-code',
      'ts': 'fas fa-file-code',
      'jsx': 'fas fa-file-code',
      'tsx': 'fas fa-file-code',
      'php': 'fas fa-file-code',
      'py': 'fas fa-file-code',
      'java': 'fas fa-file-code',
      'cpp': 'fas fa-file-code',
      'c': 'fas fa-file-code',
      'cs': 'fas fa-file-code',
      'sql': 'fas fa-file-code',
      'sh': 'fas fa-file-code',
      'bat': 'fas fa-file-code',
      'ps1': 'fas fa-file-code'
    };
    
    return iconMap[extension] || 'fas fa-file';
  }

  // Get file icon color with enhanced color scheme
  getFileIconColor(fileName: string): string {
    if (!fileName) return '#6b7280';
    
    const extension = this.getFileExtension(fileName);
    const colorMap: { [key: string]: string } = {
      // Documents - Professional colors
      'pdf': '#dc2626', // Red
      'doc': '#2563eb', // Blue
      'docx': '#2563eb', // Blue
      'xls': '#059669', // Green
      'xlsx': '#059669', // Green
      'csv': '#10b981', // Emerald
      'ppt': '#ea580c', // Orange
      'pptx': '#ea580c', // Orange
      // Text files - Gray tones
      'txt': '#6b7280', // Gray
      'log': '#64748b', // Slate
      'md': '#475569', // Slate dark
      'rtf': '#78716c', // Stone
      // Images - Blue/Purple tones
      'jpg': '#3b82f6', // Blue
      'jpeg': '#3b82f6', // Blue
      'png': '#6366f1', // Indigo
      'gif': '#8b5cf6', // Violet
      'bmp': '#a855f7', // Purple
      'svg': '#c084fc', // Purple light
      'webp': '#3b82f6', // Blue
      'tiff': '#6366f1', // Indigo
      'ico': '#8b5cf6', // Violet
      // Archives - Yellow/Amber
      'zip': '#f59e0b', // Amber
      'rar': '#d97706', // Amber dark
      '7z': '#f59e0b', // Amber
      'tar': '#d97706', // Amber dark
      'gz': '#f59e0b', // Amber
      // Video - Purple tones
      'mp4': '#7c3aed', // Violet
      'avi': '#8b5cf6', // Violet
      'mkv': '#a855f7', // Purple
      'mov': '#7c3aed', // Violet
      'wmv': '#8b5cf6', // Violet
      'flv': '#a855f7', // Purple
      'webm': '#7c3aed', // Violet
      // Audio - Pink/Rose tones
      'mp3': '#e11d48', // Rose
      'wav': '#f43f5e', // Rose
      'flac': '#ec4899', // Pink
      'aac': '#e11d48', // Rose
      'ogg': '#f43f5e', // Rose
      'wma': '#ec4899', // Pink
      // Code files - Tech colors
      'json': '#10b981', // Emerald
      'xml': '#059669', // Green
      'html': '#f97316', // Orange
      'htm': '#f97316', // Orange
      'css': '#3b82f6', // Blue
      'js': '#eab308', // Yellow
      'ts': '#3b82f6', // Blue
      'jsx': '#06b6d4', // Cyan
      'tsx': '#06b6d4', // Cyan
      'php': '#8b5cf6', // Violet
      'py': '#eab308', // Yellow
      'java': '#dc2626', // Red
      'cpp': '#3b82f6', // Blue
      'c': '#6b7280', // Gray
      'cs': '#8b5cf6', // Violet
      'sql': '#059669', // Green
      'sh': '#374151', // Gray dark
      'bat': '#6b7280', // Gray
      'ps1': '#3b82f6' // Blue
    };
    
    return colorMap[extension] || '#6b7280';
  }

  // Get file extension safely
  getFileExtension(fileName: string): string {
    if (!fileName || typeof fileName !== 'string') return '';
    const parts = fileName.split('.');
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Format date to yyyy-mm-dd format
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

  // Open upload modal
  openUploadModal(): void {
    this.showUploadModal = true;
    this.resetUploadForm();
  }

  // Close upload modal
  closeUploadModal(): void {
    this.showUploadModal = false;
    this.resetUploadForm();
  }

  // Reset upload form
  private resetUploadForm(): void {
    this.selectedFile = null;
    this.fileName = '';
    this.visibleOnlyToMe = false;
  }

  // File validation
  validateFile(file: File): { valid: boolean; message?: string } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return {
        valid: false,
        message: 'File size must be less than 50MB'
      };
    }

    const allowedExtensions = [
      'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv',
      'txt', 'log', 'md', 'jpg', 'jpeg', 'png',
      'gif', 'bmp', 'svg', 'zip', 'rar', 'ppt',
      'pptx', 'mp4', 'avi', 'mp3', 'wav', 'json',
      'xml', 'html', 'css', 'js', 'ts'
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

  // Handle file selection
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

  // Upload file
  uploadFile(): void {
    if (!this.selectedFile || !this.fileName.trim()) {
      alert('Please select a file and enter a display name');
      return;
    }

    const validation = this.validateFile(this.selectedFile);
    if (!validation.valid) {
      alert(validation.message);
      return;
    }

    this.isLoading = true;
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('fileName', this.fileName.trim());
    formData.append('visibleOnlyToMe', this.visibleOnlyToMe.toString());

    const url = `${environment.documentUploadUrl}/api/archive/upload`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    this.http.post<any>(url, formData, { headers }).subscribe({
      next: (response) => {
        console.log('Upload successful:', response);
        this.isLoading = false;
        alert('File uploaded successfully!');
        this.closeUploadModal();
        this.loadDocuments();
      },
      error: (error) => {
        console.error('Upload failed:', error);
        this.isLoading = false;
        alert('Upload failed: ' + (error.error?.message || 'Please try again'));
      }
    });
  }

  // View document - Enhanced with better browser compatibility
  viewDocument(docItem: DocumentItem): void {
    if (!docItem.documentCode) {
      alert('Document code not available');
      return;
    }

    console.log('Viewing document:', docItem.documentCode, docItem.userInputFileName);
    
    this.selectedDocument = docItem;
    const fileName = docItem.userInputFileName || '';
    const extension = this.getFileExtension(fileName);
    
    // For now, all documents will be handled as downloads since view endpoint needs auth headers
    // which iframes and new tabs cannot provide
    this.openDocumentAsBlob(docItem, extension);
  }

  // Open document by fetching as blob and creating object URL
  private openDocumentAsBlob(docItem: DocumentItem, extension: string): void {
    const viewUrl = `${environment.documentUploadUrl}/api/archive/view/${docItem.documentCode}`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    console.log('Fetching document as blob from:', viewUrl);

    this.http.get(viewUrl, { 
      headers, 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        console.log('Document blob received:', response);
        const blob = response.body;
        
        if (blob && blob.size > 0) {
          // Create object URL from blob
          const objectUrl = window.URL.createObjectURL(blob);
          
          if (this.shouldOpenInNewTab(extension)) {
            // Open in new tab
            const newWindow = window.open(objectUrl, '_blank');
            if (!newWindow) {
              console.warn('Popup blocked, falling back to modal viewer');
              this.openBlobInModal(objectUrl, docItem);
            } else {
              console.log('Document opened in new tab');
              // Clean up URL after some time
              setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
            }
          } else {
            // Open in modal
            this.openBlobInModal(objectUrl, docItem);
          }
        } else {
          throw new Error('Empty document received');
        }
      },
      error: (error) => {
        console.error('Failed to fetch document:', error);
        if (error.status === 400) {
          alert('Document not found or access denied');
        } else {
          alert('Failed to load document. Please try downloading instead.');
        }
      }
    });
  }

  // Open blob URL in modal
  private openBlobInModal(objectUrl: string, docItem: DocumentItem): void {
    try {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(objectUrl);
      this.showViewModal = true;
      this.iframeLoaded = false;
      this.iframeError = false;
      
      // Clean up URL when modal is closed
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

  // Test if view endpoint is accessible
  private testViewEndpoint(documentCode: string): Promise<boolean> {
    return new Promise((resolve) => {
      const viewUrl = `${environment.documentUploadUrl}/api/archive/view/${documentCode}`;
      const headers = new HttpHeaders({
        'Authorization': `Bearer ${this.authService.getToken()}`
      });

      console.log('Testing view endpoint:', viewUrl);

      this.http.head(viewUrl, { headers }).subscribe({
        next: (response) => {
          console.log('View endpoint accessible');
          resolve(true);
        },
        error: (error) => {
          console.error('View endpoint test failed:', error);
          resolve(false);
        }
      });
    });
  }

  // Open document in appropriate viewer
  private openDocumentViewer(docItem: DocumentItem, extension: string): void {
    const viewUrl = `${environment.documentUploadUrl}/api/archive/view/${docItem.documentCode}`;
    
    // For better browser compatibility, we'll use different strategies
    if (this.shouldOpenInNewTab(extension)) {
      this.openInNewTab(docItem);
    } else {
      this.openInModal(docItem, viewUrl);
    }
  }

  // Determine if document should open in new tab for better viewing
  private shouldOpenInNewTab(extension: string): boolean {
    // Only PDFs and images can be viewed reliably in new tabs
    // Office documents (XLS, DOC, etc.) need special viewers
    const newTabTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    return newTabTypes.includes(extension.toLowerCase());
  }

  // Open document in new tab with proper authorization
  private openInNewTab(docItem: DocumentItem): void {
    const viewUrl = `${environment.documentUploadUrl}/api/archive/view/${docItem.documentCode}`;
    
    // For new tab, we'll use download endpoint instead since view needs authorization headers
    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${docItem.documentCode}`;
    const token = this.authService.getToken();
    
    // Try with a temporary download approach
    const urlWithAuth = `${downloadUrl}?authorization=${encodeURIComponent(token)}`;
    
    const newWindow = window.open(urlWithAuth, '_blank');
    
    if (!newWindow) {
      console.warn('Popup blocked, falling back to modal viewer');
      this.openInModal(docItem, viewUrl);
    } else {
      console.log('Document opened in new tab via download URL');
    }
  }

  // Open document in modal viewer
  private openInModal(docItem: DocumentItem, viewUrl: string): void {
    // For modal, we'll create a special viewer that handles authorization headers
    console.log('Opening in modal with URL:', viewUrl);
    
    try {
      // Create iframe with just the base URL - we'll handle auth differently
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
      this.showViewModal = true;
      this.iframeLoaded = false;
      this.iframeError = false;
    } catch (error) {
      console.error('Error creating safe URL:', error);
      alert('Unable to open document viewer. Please try downloading the document.');
    }
  }

  // Alternative method to open document - direct download and open
  openDocumentDirect(docItem: DocumentItem): void {
    if (!docItem.documentCode) {
      alert('Document code not available');
      return;
    }

    // Download the file and open it
    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${docItem.documentCode}`;
    const token = this.authService.getToken();
    
    // Create a temporary link with authorization
    const link = document.createElement('a');
    link.href = `${downloadUrl}?authorization=${encodeURIComponent(token)}`;
    link.target = '_blank';
    link.download = docItem.userInputFileName || 'document';
    
    // Append to body, click, and remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log('Document download initiated');
  }

  // Close view modal
  closeViewModal(): void {
    this.showViewModal = false;
    
    // Revoke object URL if it exists
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

  // Iframe event handlers
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
      // Recreate the safe URL
      const viewUrl = `${environment.documentUploadUrl}/api/archive/view/${this.selectedDocument.documentCode}`;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl + '?retry=' + Date.now());
    }
  }

  // Determine if we should use iframe for this file type
  shouldUseIframe(): boolean {
    if (!this.selectedDocument) return false;
    
    const extension = this.getFileExtension(this.selectedDocument.userInputFileName || '');
    // Only use iframe for PDFs and images
    const iframeTypes = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg'];
    return iframeTypes.includes(extension.toLowerCase());
  }

  // Open with Google Docs viewer
  openWithGoogleDocs(): void {
    if (!this.selectedDocument) return;
    
    // We need a publicly accessible URL for Google Docs viewer
    // Since our backend requires auth, we'll have to download first
    alert('Google Docs viewer requires publicly accessible URLs. Please download the document to view it.');
  }

  // Open with Office Live viewer  
  openWithOfficeLive(): void {
    if (!this.selectedDocument) return;
    
    // Same issue as Google Docs - needs public URL
    alert('Office Online viewer requires publicly accessible URLs. Please download the document to view it.');
  }

  // Check if document is downloading
  isDownloading(documentCode: string): boolean {
    return this.downloadingDocs.has(documentCode);
  }

  // Download document with enhanced debugging
  downloadDocument(documentCode: string, event?: Event): void {
    if (!documentCode) {
      alert('Document code not available');
      return;
    }

    if (event) {
      event.preventDefault();
      event.stopPropagation();
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

    console.log('=== DOWNLOAD DEBUG START ===');
    console.log('Document Code:', documentCode);
    console.log('Download URL:', downloadUrl);

    this.http.get(downloadUrl, { 
      headers, 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        console.log('=== RESPONSE HEADERS ===');
        response.headers.keys().forEach(key => {
          console.log(`${key}: ${response.headers.get(key)}`);
        });

        const blob = response.body;
        const contentType = response.headers.get('Content-Type');
        const contentDisposition = response.headers.get('Content-Disposition');
        
        console.log('=== BLOB INFO ===');
        console.log('Blob size:', blob?.size);
        console.log('Blob type:', blob?.type);
        console.log('Content-Type from header:', contentType);
        console.log('Content-Disposition:', contentDisposition);
        
        if (blob && blob.size > 0) {
          const filename = this.getDownloadFilename(documentCode, response);
          console.log('Final filename:', filename);
          
          // Force correct MIME type based on file extension
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
          
          console.log('=== DOWNLOAD DEBUG END ===');
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

  // Create blob with correct MIME type
  private createCorrectedBlob(originalBlob: Blob, filename: string): Blob {
    const extension = this.getFileExtension(filename);
    
    // MIME type mapping for correct file types
    const mimeTypes: { [key: string]: string } = {
      'csv': 'text/csv',
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'zip': 'application/zip',
      'rar': 'application/vnd.rar',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'json': 'application/json',
      'xml': 'application/xml',
      'html': 'text/html',
      'css': 'text/css',
      'js': 'application/javascript',
      'ts': 'application/typescript'
    };

    const correctMimeType = mimeTypes[extension] || 'application/octet-stream';
    
    console.log(`Correcting MIME type from '${originalBlob.type}' to '${correctMimeType}' for .${extension} file`);
    
    // Create new blob with correct MIME type
    return new Blob([originalBlob], { type: correctMimeType });
  }

  // Get download filename with better extension handling
  private getDownloadFilename(documentCode: string, response: any): string {
    const doc = this.filteredDocuments.find(d => d.documentCode === documentCode) || 
               this.documents.find(d => d.documentCode === documentCode);
    
    let filename = `document_${documentCode}`;
    
    // Always prioritize the original filename from document record
    if (doc && doc.userInputFileName) {
      filename = doc.userInputFileName;
      console.log('Using original document filename:', filename);
      
      // Ensure the filename has the correct extension
      const hasExtension = filename.includes('.');
      if (!hasExtension) {
        // If no extension, try to determine from Content-Type
        const contentType = response.headers.get('Content-Type');
        const extension = this.getExtensionFromContentType(contentType);
        if (extension) {
          filename += `.${extension}`;
          console.log('Added extension based on content type:', filename);
        }
      }
      
      return filename;
    }
    
    // Fallback: try to get filename from Content-Disposition header
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (filenameMatch && filenameMatch[1]) {
        const headerFilename = filenameMatch[1].replace(/['"]/g, '');
        console.log('Using header filename:', headerFilename);
        filename = headerFilename;
      }
    }
    
    // Final fallback: use document code with extension from content type
    if (filename === `document_${documentCode}`) {
      const contentType = response.headers.get('Content-Type');
      const extension = this.getExtensionFromContentType(contentType);
      if (extension) {
        filename += `.${extension}`;
      }
    }
    
    return filename;
  }

  // Get file extension from Content-Type header
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
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'application/zip': 'zip',
      'application/vnd.rar': 'rar',
      'application/vnd.ms-powerpoint': 'ppt',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'video/mp4': 'mp4',
      'audio/mpeg': 'mp3',
      'application/json': 'json',
      'application/xml': 'xml',
      'text/html': 'html',
      'text/css': 'css',
      'application/javascript': 'js'
    };
    
    // Clean up content type (remove charset, etc.)
    const cleanContentType = contentType.split(';')[0].trim().toLowerCase();
    return typeMap[cleanContentType] || '';
  }

  // Add method to test download endpoint and headers
  testDownloadEndpoint(documentCode: string): void {
    if (!documentCode) return;

    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${documentCode}`;
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`
    });

    console.log('=== TESTING DOWNLOAD ENDPOINT ===');
    console.log('URL:', downloadUrl);
    console.log('Document Code:', documentCode);

    // Make a HEAD request to check headers without downloading
    this.http.head(downloadUrl, { 
      headers, 
      observe: 'response' 
    }).subscribe({
      next: (response) => {
        console.log('=== ENDPOINT TEST RESULTS ===');
        console.log('Status:', response.status);
        console.log('Response Headers:');
        
        response.headers.keys().forEach(key => {
          console.log(`  ${key}: ${response.headers.get(key)}`);
        });
        
        const doc = this.filteredDocuments.find(d => d.documentCode === documentCode) || 
                   this.documents.find(d => d.documentCode === documentCode);
        
        if (doc) {
          console.log('=== DOCUMENT INFO ===');
          console.log('Original filename:', doc.userInputFileName);
          console.log('Expected extension:', this.getFileExtension(doc.userInputFileName || ''));
        }
        
        const contentType = response.headers.get('Content-Type');
        const contentDisposition = response.headers.get('Content-Disposition');
        
        console.log('=== ANALYSIS ===');
        console.log('Content-Type suggests extension:', this.getExtensionFromContentType(contentType));
        
        if (doc && doc.userInputFileName) {
          const expectedExt = this.getFileExtension(doc.userInputFileName);
          const serverExt = this.getExtensionFromContentType(contentType);
          
          if (expectedExt !== serverExt) {
            console.warn(`⚠️  MISMATCH: Expected .${expectedExt} but server sends ${contentType} (suggests .${serverExt})`);
            console.warn('This is likely causing the file extension/format issue!');
          } else {
            console.log('✅ Content-Type matches expected file extension');
          }
        }
        
        console.log('=== END TEST ===');
        
        alert(`Test completed! Check console for detailed results.\n\nKey findings:\n- Status: ${response.status}\n- Content-Type: ${contentType}\n- Expected: .${doc ? this.getFileExtension(doc.userInputFileName || '') : 'unknown'}`);
      },
      error: (error) => {
        console.error('Endpoint test failed:', error);
        alert('Endpoint test failed. Check console for details.');
      }
    });
  }

  // Handle download error
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
    } else if (error.error instanceof ErrorEvent) {
      errorMessage = 'Network error. Please check your connection.';
    }
    
    alert(errorMessage);
  }

  // Get display name
  getDisplayName(doc: DocumentItem): string {
    return doc.userInputFileName || 'Unknown File';
  }

  // Get uploaded by name
  getUploadedBy(doc: DocumentItem): string {
    return doc.createdName || 'Unknown';
  }

  // Get department name
  getDepartmentName(doc: DocumentItem): string {
    return doc.createdDeptName || 'Unknown';
  }

  // Get created date
  getCreatedDate(doc: DocumentItem): string {
    return this.formatDate(doc.createdAt);
  }

  // Highlight search matches
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

  // Get file type display name
  getFileTypeDisplayName(extension: string): string {
    const typeNames: { [key: string]: string } = {
      'pdf': 'PDF',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'xls': 'Excel Spreadsheet',
      'xlsx': 'Excel Spreadsheet', 
      'csv': 'CSV File',
      'txt': 'Text File',
      'log': 'Log File',
      'md': 'Markdown',
      'jpg': 'JPEG Image',
      'jpeg': 'JPEG Image',
      'png': 'PNG Image',
      'gif': 'GIF Image',
      'bmp': 'Bitmap Image',
      'svg': 'SVG Image',
      'zip': 'ZIP Archive',
      'rar': 'RAR Archive',
      'ppt': 'PowerPoint',
      'pptx': 'PowerPoint',
      'mp4': 'MP4 Video',
      'avi': 'AVI Video',
      'mp3': 'MP3 Audio',
      'wav': 'WAV Audio',
      'json': 'JSON File',
      'xml': 'XML File',
      'html': 'HTML File',
      'css': 'CSS File',
      'js': 'JavaScript',
      'ts': 'TypeScript'
    };
    
    return typeNames[extension] || extension.toUpperCase();
  }
}