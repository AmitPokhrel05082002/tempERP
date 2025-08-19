import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { NgxDocViewerModule } from 'ngx-doc-viewer';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { environment } from 'src/environments/environment';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-doc-view-file',
  standalone: true,
  imports: [CommonModule, NgxDocViewerModule],
  templateUrl: './doc-view-file.component.html',
  styleUrls: ['./doc-view-file.component.scss']
})
export class DocViewFileComponent implements OnInit {
  documentCode!: string;
  fileName!: string;
  fileType!: string;
  safeUrl!: SafeResourceUrl;
  viewerType: 'iframe' | 'csv' | 'text' | 'image' | 'pdf' | 'unsupported' = 'iframe';
  csvData: any[][] = [];
  csvHeaders: string[] = [];
  showCsvViewer = false;
  textContent = '';
  showTextViewer = false;
  showImageViewer = false;
  isLoading = false;
  errorMessage = '';
  
  // Browser compatibility flags
  isPdfNativeSupported = false;
  isIframeBlocked = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer,
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Check PDF native support
    this.isPdfNativeSupported = this.checkPdfSupport();
  }

  ngOnInit(): void {
    // Get parameters from route
    this.route.queryParams.subscribe(params => {
      this.documentCode = params['documentCode'];
      this.fileName = params['fileName'];
      this.fileType = params['fileType'];

      if (this.documentCode && this.fileName && this.fileType) {
        this.setupViewer();
      } else {
        this.errorMessage = 'Missing document parameters';
      }
    });
  }

  private checkPdfSupport(): boolean {
    try {
      // Check if browser supports PDF viewing
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext && canvas.getContext('2d'));
    } catch {
      return false;
    }
  }

  private setupViewer(): void {
    this.isLoading = true;
    this.errorMessage = '';
    
    // Reset all viewers
    this.showCsvViewer = false;
    this.showTextViewer = false;
    this.showImageViewer = false;
    this.safeUrl = '';

    const fileType = this.fileType.toLowerCase();
    console.log('Setting up viewer for file type:', fileType);

    switch (fileType) {
      case 'pdf':
        this.setupPdfViewer();
        break;

      case 'docx':
      case 'doc':
      case 'xlsx':
      case 'xls':
      case 'ppt':
      case 'pptx':
        this.setupOfficeViewer();
        break;

      case 'csv':
        this.setupCsvViewer();
        break;

      case 'txt':
      case 'log':
      case 'md':
      case 'json':
      case 'xml':
      case 'html':
      case 'css':
      case 'js':
      case 'ts':
        this.setupTextViewer();
        break;

      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
      case 'svg':
        this.setupImageViewer();
        break;

      default:
        this.setupGenericViewer();
        break;
    }
  }

  private setupPdfViewer(): void {
    this.viewerType = 'pdf';
    const viewUrl = this.getViewUrl();
    
    // For PDF, try multiple approaches for cross-browser compatibility
    if (this.isPdfNativeSupported) {
      // Use direct URL with authorization header (works in most modern browsers)
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
    } else {
      // Fallback to Google Docs viewer
      this.setupGoogleDocsViewer();
    }
    
    this.isLoading = false;
  }

  private setupOfficeViewer(): void {
    this.viewerType = 'iframe';
    
    // Try multiple viewers for Office documents
    const viewUrl = this.getViewUrl();
    
    // First try: Microsoft Office Online Viewer
    const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(viewUrl)}`;
    
    // Check if the URL is accessible
    this.testUrlAccessibility(officeViewerUrl).then(accessible => {
      if (accessible) {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(officeViewerUrl);
      } else {
        // Fallback to Google Docs viewer
        this.setupGoogleDocsViewer();
      }
      this.isLoading = false;
    });
  }

  private setupCsvViewer(): void {
    this.viewerType = 'csv';
    this.showCsvViewer = true;
    this.loadDocumentContent('text');
  }

  private setupTextViewer(): void {
    this.viewerType = 'text';
    this.showTextViewer = true;
    this.loadDocumentContent('text');
  }

  private setupImageViewer(): void {
    this.viewerType = 'image';
    this.showImageViewer = true;
    const viewUrl = this.getViewUrl();
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
    this.isLoading = false;
  }

  private setupGenericViewer(): void {
    this.viewerType = 'iframe';
    // Try Google Docs viewer for unknown file types
    this.setupGoogleDocsViewer();
  }

  private setupGoogleDocsViewer(): void {
    const viewUrl = this.getViewUrl();
    const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(viewUrl)}&embedded=true`;
    
    this.testUrlAccessibility(googleViewerUrl).then(accessible => {
      if (accessible) {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(googleViewerUrl);
      } else {
        // Final fallback - direct iframe
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
      }
      this.isLoading = false;
    });
  }

  private getViewUrl(): string {
    return `${environment.documentUploadUrl}/api/archive/view/${this.documentCode}`;
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Authorization': `Bearer ${this.authService.getToken()}`,
      'Accept': '*/*'
    });
  }

  private async testUrlAccessibility(url: string): Promise<boolean> {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' });
      return true;
    } catch {
      return false;
    }
  }

  private loadDocumentContent(responseType: 'text' | 'blob' = 'text'): void {
    const viewUrl = this.getViewUrl();
    const headers = this.getHeaders();

    this.http.get(viewUrl, { 
      headers, 
      responseType: responseType as 'text',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const content = response.body;
        
        if (this.viewerType === 'csv') {
          this.parseCsvData(content || '');
        } else if (this.viewerType === 'text') {
          this.textContent = content || '';
        }
        
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading document content:', error);
        this.errorMessage = 'Failed to load document content';
        this.isLoading = false;
        
        // Fallback to iframe viewer
        this.viewerType = 'iframe';
        this.showCsvViewer = false;
        this.showTextViewer = false;
        const viewUrl = this.getViewUrl();
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(viewUrl);
      }
    });
  }

  private parseCsvData(csvText: string): void {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) {
      this.errorMessage = 'Empty CSV file';
      return;
    }

    try {
      // Parse headers
      this.csvHeaders = this.parseCsvLine(lines[0]);
      
      // Parse data rows
      this.csvData = [];
      for (let i = 1; i < lines.length; i++) {
        const row = this.parseCsvLine(lines[i]);
        if (row.length > 0) {
          // Ensure row has same number of columns as headers
          while (row.length < this.csvHeaders.length) {
            row.push('');
          }
          this.csvData.push(row);
        }
      }
    } catch (error) {
      console.error('Error parsing CSV:', error);
      this.errorMessage = 'Error parsing CSV data';
    }
  }

  private parseCsvLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Handle escaped quotes
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim().replace(/^"|"$/g, '')); // Remove surrounding quotes
    return result;
  }

  downloadDocument(): void {
    if (!this.documentCode) return;

    const downloadUrl = `${environment.documentUploadUrl}/api/archive/downloadFile/${this.documentCode}`;
    const headers = this.getHeaders();

    this.http.get(downloadUrl, { 
      headers, 
      responseType: 'blob',
      observe: 'response'
    }).subscribe({
      next: (response) => {
        const blob = response.body;
        
        if (blob && blob.size > 0) {
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = this.fileName || 'document';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          
          setTimeout(() => {
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          }, 100);
        }
      },
      error: (error) => {
        console.error('Download failed:', error);
        alert('Failed to download document');
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/documents']); // Adjust route as needed
  }

  retryLoad(): void {
    this.setupViewer();
  }

  openInNewTab(): void {
    const viewUrl = this.getViewUrl();
    const token = this.authService.getToken();
    
    // Create a temporary form to submit with authorization
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = viewUrl;
    form.target = '_blank';
    
    const tokenInput = document.createElement('input');
    tokenInput.type = 'hidden';
    tokenInput.name = 'authorization';
    tokenInput.value = token;
    
    form.appendChild(tokenInput);
    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  }

  // Copy text content to clipboard
  copyToClipboard(): void {
    if (this.textContent) {
      navigator.clipboard.writeText(this.textContent).then(() => {
        // You can add a toast notification here
        console.log('Content copied to clipboard');
      }).catch(err => {
        console.error('Failed to copy content: ', err);
        // Fallback method
        this.fallbackCopyTextToClipboard(this.textContent);
      });
    }
  }

  // Fallback copy method for older browsers
  private fallbackCopyTextToClipboard(text: string): void {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
      const successful = document.execCommand('copy');
      if (successful) {
        console.log('Fallback: Content copied to clipboard');
      }
    } catch (err) {
      console.error('Fallback: Failed to copy content', err);
    }
    
    document.body.removeChild(textArea);
  }

  // Utility method to get file icon class
  getFileIconClass(): string {
    const iconMap: { [key: string]: string } = {
      'pdf': 'fas fa-file-pdf',
      'doc': 'fas fa-file-word',
      'docx': 'fas fa-file-word',
      'xls': 'fas fa-file-excel',
      'xlsx': 'fas fa-file-excel',
      'csv': 'fas fa-file-csv',
      'txt': 'fas fa-file-alt',
      'log': 'fas fa-file-alt',
      'md': 'fas fa-file-alt',
      'jpg': 'fas fa-file-image',
      'jpeg': 'fas fa-file-image',
      'png': 'fas fa-file-image',
      'gif': 'fas fa-file-image',
      'json': 'fas fa-file-code',
      'xml': 'fas fa-file-code',
      'html': 'fas fa-file-code',
      'css': 'fas fa-file-code',
      'js': 'fas fa-file-code',
      'ts': 'fas fa-file-code'
    };
    
    return iconMap[this.fileType?.toLowerCase()] || 'fas fa-file';
  }

  // Utility method to get file icon color
  getFileIconColor(): string {
    const colorMap: { [key: string]: string } = {
      'pdf': '#ff0000',
      'doc': '#2b579a',
      'docx': '#2b579a',
      'xls': '#217346',
      'xlsx': '#217346',
      'csv': '#10b981',
      'txt': '#6b7280',
      'log': '#6b7280',
      'md': '#6b7280',
      'jpg': '#4a6baf',
      'jpeg': '#4a6baf',
      'png': '#4a6baf',
      'gif': '#4a6baf',
      'json': '#10b981',
      'xml': '#10b981',
      'html': '#f97316',
      'css': '#3b82f6',
      'js': '#eab308',
      'ts': '#3b82f6'
    };
    
    return colorMap[this.fileType?.toLowerCase()] || '#666';
  }

  // Get file type display name
  getFileTypeDisplayName(): string {
    const typeNames: { [key: string]: string } = {
      'pdf': 'PDF Document',
      'doc': 'Word Document',
      'docx': 'Word Document',
      'xls': 'Excel Spreadsheet',
      'xlsx': 'Excel Spreadsheet',
      'csv': 'CSV File',
      'txt': 'Text File',
      'log': 'Log File',
      'md': 'Markdown File',
      'jpg': 'JPEG Image',
      'jpeg': 'JPEG Image',
      'png': 'PNG Image',
      'gif': 'GIF Image',
      'json': 'JSON File',
      'xml': 'XML File',
      'html': 'HTML File',
      'css': 'CSS File',
      'js': 'JavaScript File',
      'ts': 'TypeScript File'
    };
    
    return typeNames[this.fileType?.toLowerCase()] || this.fileType?.toUpperCase() + ' File';
  }
}