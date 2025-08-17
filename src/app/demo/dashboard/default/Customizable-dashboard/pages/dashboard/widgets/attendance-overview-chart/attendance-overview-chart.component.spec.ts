import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttendanceOverviewChartComponent } from './attendance-overview-chart.component';

describe('AttendanceOverviewChartComponent', () => {
  let component: AttendanceOverviewChartComponent;
  let fixture: ComponentFixture<AttendanceOverviewChartComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AttendanceOverviewChartComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttendanceOverviewChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
