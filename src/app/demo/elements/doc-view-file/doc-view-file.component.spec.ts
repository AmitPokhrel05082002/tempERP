import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DocViewFileComponent } from './doc-view-file.component';

describe('DocViewFileComponent', () => {
  let component: DocViewFileComponent;
  let fixture: ComponentFixture<DocViewFileComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocViewFileComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DocViewFileComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
