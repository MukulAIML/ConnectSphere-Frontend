import { Component, OnDestroy, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { NotificationService, Notification } from '../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-notifications',
  imports: [DatePipe],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  private unreadCountSubscription?: Subscription;
  private realtimeSubscription?: Subscription;

  notifications: Notification[] = [];
  loading = true;
  unreadCount = 0;
  clearingAll = false;

  ngOnInit(): void {
    this.loadNotifications();

    this.unreadCountSubscription = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount = count;
    });

    this.realtimeSubscription = this.notificationService.realtimeNotifications$.subscribe((notification) => {
      this.upsertRealtimeNotification(notification);
    });

    this.notificationService.refreshUnreadCount().subscribe({
      error: () => {
        this.unreadCount = 0;
      }
    });
  }

  loadNotifications(): void {
    this.notificationService.getMyNotifications().subscribe({
      next: (notifications) => {
        this.notifications = notifications || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  markAsRead(notification: Notification): void {
    if (notification.isRead) return;
    this.notificationService.markAsRead(notification.notificationId).subscribe({
      next: () => {
        notification.isRead = true;
      }
    });
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications.forEach(n => n.isRead = true);
      }
    });
  }

  deleteNotification(notificationId: number, index: number): void {
    const removed = this.notifications[index];
    const wasUnread = !!removed && !removed.isRead;

    this.notificationService.deleteNotification(notificationId, wasUnread).subscribe({
      next: () => {
        this.notifications.splice(index, 1);
      }
    });
  }

  clearAllNotifications(): void {
    if (this.clearingAll || this.notifications.length === 0) {
      return;
    }

    this.clearingAll = true;
    this.notificationService.deleteAllNotifications().subscribe({
      next: () => {
        this.notifications = [];
        this.unreadCount = 0;
        this.clearingAll = false;
      },
      error: () => {
        this.clearingAll = false;
      }
    });
  }

  getNotificationIcon(type: string): string {
    switch (type?.toUpperCase()) {
      case 'LIKE': case 'REACTION': return '👍';
      case 'COMMENT': return '💬';
      case 'FOLLOW': return '👤';
      case 'MENTION': return '🔔';
      default: return '🔔';
    }
  }

  ngOnDestroy(): void {
    this.unreadCountSubscription?.unsubscribe();
    this.realtimeSubscription?.unsubscribe();
  }

  private upsertRealtimeNotification(notification: Notification): void {
    const existingIndex = this.notifications.findIndex(
      (item) => item.notificationId === notification.notificationId
    );

    if (existingIndex >= 0) {
      this.notifications[existingIndex] = {
        ...this.notifications[existingIndex],
        ...notification
      };
      return;
    }

    this.notifications = [notification, ...this.notifications];
  }
}
