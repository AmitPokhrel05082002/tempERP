import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ELMRComponent } from './elmr.component';

describe('ELMRComponent', () => {
  let component: ELMRComponent;
  let fixture: ComponentFixture<ELMRComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ELMRComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ELMRComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
