import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RBACComponent } from './RBAC.component';

describe('RBACComponent', () => {
  let component: RBACComponent;
  let fixture: ComponentFixture<RBACComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RBACComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RBACComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
