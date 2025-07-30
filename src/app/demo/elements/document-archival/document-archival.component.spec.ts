import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocumentArchivalComponent } from './document-archival.component';

describe('DocumentArchivalComponent', () => {
  let component: DocumentArchivalComponent;
  let fixture: ComponentFixture<DocumentArchivalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentArchivalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocumentArchivalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
