import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BalanceleaveComponent } from './balanceleave.component';

describe('BalanceleaveComponent', () => {
  let component: BalanceleaveComponent;
  let fixture: ComponentFixture<BalanceleaveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BalanceleaveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BalanceleaveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
