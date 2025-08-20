import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShiftManagementComponent } from './shift-management.component';

describe('ShiftManagementComponent', () => {
  let component: ShiftManagementComponent;
  let fixture: ComponentFixture<ShiftManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShiftManagementComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShiftManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
