import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { NgxDocViewerModule } from 'ngx-doc-viewer';

@Component({
  selector: 'app-doc-view-file',
  standalone: true,
  imports: [CommonModule, NgxDocViewerModule],
  templateUrl: './doc-view-file.component.html',
  styleUrls: ['./doc-view-file.component.scss']
})
export class DocViewFileComponent implements OnInit {
  documentId!: number;
  safeUrl!: SafeResourceUrl;
  viewerType: 'google' | 'microsoft' = 'google';

  allDocuments = [
    {
      id: 1,
      fileType: 'pdf',
      fileUrl: 'assets/images/2008623.pdf'
    },
    {
      id: 2,
      fileType: 'docx',
      fileUrl: 'assets/images/Payroll.docx'
    },
    {
      id: 3,
      fileType: 'xlsx',
      fileUrl: 'assets/images/SIT.xlsx'
    },
    {
      id: 4,
      fileType: 'pdf',
      fileUrl: 'assets/images/2008623.pdf'
    },
  ];

  constructor(private route: ActivatedRoute, private sanitizer: DomSanitizer) {}

 ngOnInit(): void {
  const id = Number(this.route.snapshot.paramMap.get('id'));
  const doc = this.allDocuments.find(d => d.id === id);

  if (doc) {
    const absoluteUrl = location.origin + '/' + doc.fileUrl;

    if (doc.fileType === 'pdf') {
      // Use browser-native PDF viewing
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(absoluteUrl);
    } else if (['docx', 'xlsx'].includes(doc.fileType)) {
      // Use Microsoft Viewer for docx and xlsx
      const publicUrl = 'https://yourdomain.com/assets/images/Payroll.docx';
      // const officeViewerUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(publicUrl);
    }
  }
}

}
