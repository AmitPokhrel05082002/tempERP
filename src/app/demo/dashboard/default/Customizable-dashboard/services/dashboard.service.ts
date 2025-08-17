import { computed, effect, Injectable, signal } from '@angular/core';
import { Widget } from '../models/dashboard';
import { AttendanceOverviewComponent } from '../pages/dashboard/widgets/attendance-overview/attendance-overview.component';
import { EmployeeOverviewComponent } from '../pages/dashboard/widgets/employee-overview/employee-overview.component';
import { LeaveOverviewComponent } from '../pages/dashboard/widgets/leave-overview/leave-overview.component';
import { SeperationOverviewComponent } from '../pages/dashboard/widgets/seperation-overview/seperation-overview.component';
import { EmployeeChartComponent } from '../pages/dashboard/widgets/employee-chart/employee-chart.component';
import { EmployeeStatusComponent } from '../pages/dashboard/widgets/employee-status/employee-status.component';
import { AttendanceOverviewChartComponent } from '../pages/dashboard/widgets/attendance-overview-chart/attendance-overview-chart.component';
import { ClockInOutComponent } from '../pages/dashboard/widgets/clock-in-out/clock-in-out.component';

@Injectable()
export class DashboardService {
  widgets = signal<Widget[]>([
    {
      id: 1,
      label: 'Attendance',
      content: AttendanceOverviewComponent,
      rows:1,
      columns: 1,
      backgroundColor: '#ffffff',
      color: 'whitesmoke'
    },
    {
      id: 2,
      label: 'Employee',
      content: EmployeeOverviewComponent,
      rows:1,
      columns: 1,
    },
    {
      id: 3,
      label: 'Leave',
      content: LeaveOverviewComponent,
      rows:1,
      columns: 1
    },
    {
      id:4,
      label: 'Separation',
      content: SeperationOverviewComponent,
      rows:1,
      columns: 1
    },
    {
      id:5,
      label: 'Employees By Department',
      content: EmployeeChartComponent,
      rows:3,
      columns: 2
    },
    {
      id:6,
      label: 'Employees Status',
      content: EmployeeStatusComponent,
      rows:3,
      columns: 2
    },
    {
      id:7,
      label: 'Attendance Overview',
      content: AttendanceOverviewChartComponent,
      rows:3,
      columns: 2
    },
    {
      id:8,
      label: 'Clock-In/Out',
      content: ClockInOutComponent,
      rows:3,
      columns: 2
    }
  ]);

  addedWidgets = signal<Widget[]>([]);

  widgetsToAdd = computed(() => {
    const addedIds = this.addedWidgets().map(w => w.id);
    return this.widgets().filter(w => !addedIds.includes(w.id));
  });

  addWidget(w: Widget){
    this.addedWidgets.set([...this.addedWidgets(), { ...w }])
  }

  updateWidget(id:number, widget: Partial<Widget>){
    const index = this.addedWidgets().findIndex(w => w.id === id);
    if(index !== -1){
      const newWidgets = [...this.addedWidgets()];
      newWidgets[index] = { ...newWidgets[index], ...widget };
      this.addedWidgets.set(newWidgets)
    }
  }

  moveWidgetToRight(id:number){
    const index = this.addedWidgets().findIndex(w => w.id === id);
    if(index === this.addedWidgets().length -1){
      return;
    }

    const newWidgets = [...this.addedWidgets()];
    [newWidgets[index], newWidgets[index + 1]] = [{ ...newWidgets[index + 1]}, { ...newWidgets[index]}]

    this.addedWidgets.set(newWidgets);
  }

  moveWidgetToLeft(id:number){
    const index = this.addedWidgets().findIndex(w => w.id === id);
    if(index === 0){
      return;
    }

    const newWidgets = [...this.addedWidgets()];
    [newWidgets[index], newWidgets[index - 1]] = [{ ...newWidgets[index - 1]}, { ...newWidgets[index]}]

    this.addedWidgets.set(newWidgets);
  }

  removeWidget(id: number){
    this.addedWidgets.set(this.addedWidgets().filter(w => w.id !== id));
  }

  updateWidgetPosition(sourceWidgetId: number, targetWidgetId:number){
    const sourceIndex = this.addedWidgets().findIndex(
      (w) => w.id === sourceWidgetId
    );

    if(sourceIndex === -1){
      return;
    }

    const newWidgets = [...this.addedWidgets()];
    const sourceWidget = newWidgets.splice(sourceIndex, 1)[0];

    const targetIndex = newWidgets.findIndex((w) => w.id === targetWidgetId);
    if(targetIndex == -1){
      return;
    }

    const insertAt = targetIndex === sourceIndex ? targetIndex + 1 : targetIndex;

    newWidgets.splice(insertAt, 0, sourceWidget);
    this.addedWidgets.set(newWidgets);
  }

  fetchWidgets(){
    const widgetsAsString = localStorage.getItem('dashboardWidgets');
    if(widgetsAsString) {
      const widgets = JSON.parse(widgetsAsString) as Widget[];
      widgets.forEach(widget => {
        const content = this.widgets().find(w => w.id === widget.id)?.content;
        if(content) {
          widget.content = content;
        }
      });

      this.addedWidgets.set(widgets);
      }
  }

  constructor() {
    this.fetchWidgets();
  }

  saveWidgets = effect(() => {
    const widgetsWithoutContent: Partial<Widget>[] = this.addedWidgets().map(w => ({ ...w }));
    widgetsWithoutContent.forEach(w => {
      delete w.content;
    });

    localStorage.setItem('dashboardWidgets', JSON.stringify(widgetsWithoutContent));
  })
}
