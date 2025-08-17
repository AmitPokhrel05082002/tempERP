import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { WidgetComponent } from "../../components/widget/widget.component";
import { DashboardService } from '../../services/dashboard.service';
import { MatButtonModule } from '@angular/material/button'
import { MatIconModule } from '@angular/material/icon'
import { MatMenuModule } from '@angular/material/menu'
import { wrapGrid } from 'animate-css-grid'
import {
  CdkDragDrop,
  CdkDrag,
  CdkDropList,
  CdkDropListGroup,
} from '@angular/cdk/drag-drop';

@Component({
  selector: 'app-dashboard',
  imports: [WidgetComponent, MatButtonModule, MatIconModule, MatMenuModule, CdkDropListGroup, CdkDropList, CdkDrag],
  providers: [DashboardService],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
  store = inject(DashboardService);

  dashboard = viewChild.required<ElementRef>('dashboard');

  ngOnInit(){
    wrapGrid(this.dashboard().nativeElement, { duration: 300 });
  }

  drop(event: CdkDragDrop<number, any>) {
    const { previousContainer, container} = event;
    this.store.updateWidgetPosition(previousContainer.data, container.data);
  }

}
