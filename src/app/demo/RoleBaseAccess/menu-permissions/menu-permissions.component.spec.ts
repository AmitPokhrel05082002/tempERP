import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuPermissionsComponent } from './menu-permissions.component';

describe('MenuPermissionsComponent', () => {
  let component: MenuPermissionsComponent;
  let fixture: ComponentFixture<MenuPermissionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuPermissionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuPermissionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
