import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SeperationOverviewComponent } from './seperation-overview.component';

describe('SeperationOverviewComponent', () => {
  let component: SeperationOverviewComponent;
  let fixture: ComponentFixture<SeperationOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SeperationOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SeperationOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
