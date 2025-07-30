import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeaveAllocationDetailsComponent } from './leave-allocation-details.component';

describe('LeaveAllocationDetailsComponent', () => {
  let component: LeaveAllocationDetailsComponent;
  let fixture: ComponentFixture<LeaveAllocationDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeaveAllocationDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LeaveAllocationDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
