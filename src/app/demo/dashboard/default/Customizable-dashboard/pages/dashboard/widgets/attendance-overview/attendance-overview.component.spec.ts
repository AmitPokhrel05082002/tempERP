import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendanceOverviewComponent } from './attendance-overview.component';

describe('AttendanceOverviewComponent', () => {
  let component: AttendanceOverviewComponent;
  let fixture: ComponentFixture<AttendanceOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttendanceOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
