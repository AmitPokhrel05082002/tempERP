import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { AuthService } from './services/auth.service';

@Directive({
  selector: '[hasPermission]'
})
export class HasPermissionDirective {
  private hasView = false;
  private checkAll = false;

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private authService: AuthService
  ) {}

  @Input() set hasPermission(permission: string | string[]) {
    this.updateView(permission, this.checkAll);
  }

  @Input() set hasPermissionCheckAll(checkAll: boolean) {
    this.checkAll = checkAll;
    // Re-evaluate permissions when this input changes
    if (typeof this.hasPermission !== 'boolean') {
      this.updateView(this.hasPermission, checkAll);
    }
  }

  private updateView(permission: string | string[], checkAll: boolean): void {
    const permissions = Array.isArray(permission) ? permission : [permission];
    const hasPermission = checkAll
      ? this.authService.hasAllPermissions(permissions)
      : this.authService.hasAnyPermission(permissions);

    if (hasPermission && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!hasPermission && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}