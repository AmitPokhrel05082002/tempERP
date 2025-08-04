import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import Swal from 'sweetalert2';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  read: boolean;
  timestamp: Date;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private notifications = new BehaviorSubject<Notification[]>([]);
  notifications$ = this.notifications.asObservable();

  addNotification(notification: Omit<Notification, 'id' | 'read' | 'timestamp'>): void {
    const newNotification: Notification = {
      id: Math.random().toString(36).substr(2, 9),
      ...notification,
      read: false,
      timestamp: new Date()
    };
    
    this.notifications.next([...this.notifications.value, newNotification]);
    
    // Show toast notification
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: notification.type,
      title: notification.title,
      text: notification.message,
      showConfirmButton: false,
      timer: 3000
    });
  }

  markAsRead(id: string): void {
    const updated = this.notifications.value.map(n => 
      n.id === id ? {...n, read: true} : n
    );
    this.notifications.next(updated);
  }

  clearAll(): void {
    this.notifications.next([]);
  }
}