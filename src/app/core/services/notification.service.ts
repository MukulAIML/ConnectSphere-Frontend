import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import {
  BehaviorSubject,
  catchError,
  forkJoin,
  Observable,
  Subject,
  distinctUntilChanged,
  map,
  of,
  switchMap,
  tap
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

interface ApiResponse<T> {
  timestamp: string;
  status: number;
  message: string;
  data: T;
}

export interface Notification {
  notificationId: number;
  recipientId: number;
  senderId?: number;
  actorId?: number;
  type: string;
  message: string;
  referenceId?: number;
  targetId?: number;
  targetType?: string;
  isRead: boolean;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private apiUrl = `${environment.apiUrl}/notifications`;
  private websocketUrl = `${environment.apiUrl.replace(/\/+$/, '')}/ws-notifications`;

  private unreadCountSubject = new BehaviorSubject<number>(0);
  readonly unreadCount$ = this.unreadCountSubject.asObservable();

  private realtimeNotificationSubject = new Subject<Notification>();
  readonly realtimeNotifications$ = this.realtimeNotificationSubject.asObservable();

  private stompClient: Client | null = null;
  private connectedUserId: number | null = null;
  private recentlyReceivedIds = new Set<number>();

  constructor(private http: HttpClient, private authService: AuthService) {
    this.authService.currentUser$
      .pipe(
        map((user) => user?.userId ?? null),
        distinctUntilChanged()
      )
      .subscribe((userId) => {
        this.handleUserSession(userId);
      });
  }

  refreshUnreadCount(): Observable<number> {
    const userId = this.authService.currentUserValue?.userId;
    if (!userId) {
      this.unreadCountSubject.next(0);
      return of(0);
    }

    return this.getUnreadCount().pipe(
      tap((count) => this.unreadCountSubject.next(count))
    );
  }

  getMyNotifications(): Observable<Notification[]> {
    return this.http.get<ApiResponse<Notification[]>>(`${this.apiUrl}`).pipe(
      map((res) => res.data || [])
    );
  }

  getUnreadNotifications(): Observable<Notification[]> {
    const userId = this.authService.currentUserValue?.userId;
    if (!userId) {
      return of([]);
    }

    return this.http.get<ApiResponse<Notification[]>>(`${this.apiUrl}/unread/${userId}`).pipe(
      map((res) => res.data || [])
    );
  }

  getUnreadCount(): Observable<number> {
    return this.http.get<ApiResponse<number>>(`${this.apiUrl}/unread/count`).pipe(
      map((res) => res.data || 0),
      tap((count) => this.unreadCountSubject.next(count))
    );
  }

  markAsRead(notificationId: number): Observable<Notification> {
    return this.http.put<ApiResponse<Notification>>(`${this.apiUrl}/${notificationId}/read`, {}).pipe(
      map((res) => res.data),
      tap(() => this.decrementUnreadCount())
    );
  }

  markAllAsRead(): Observable<void> {
    return this.http.put<ApiResponse<null>>(`${this.apiUrl}/read-all`, {}).pipe(
      tap(() => this.unreadCountSubject.next(0)),
      map(() => void 0)
    );
  }

  deleteNotification(notificationId: number, wasUnread = false): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${notificationId}`).pipe(
      tap(() => {
        if (wasUnread) {
          this.decrementUnreadCount();
        }
      }),
      map(() => void 0)
    );
  }

  deleteAllNotifications(): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/delete-all`).pipe(
      tap(() => this.unreadCountSubject.next(0)),
      map(() => void 0),
      catchError(() =>
        this.getMyNotifications().pipe(
          switchMap((notifications) => {
            if (!notifications.length) {
              return of(void 0);
            }

            const deleteRequests = notifications.map((notification) =>
              this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${notification.notificationId}`).pipe(
                catchError(() => of<ApiResponse<null> | null>(null))
              )
            );
            return forkJoin(deleteRequests).pipe(map(() => void 0));
          }),
          tap(() => this.unreadCountSubject.next(0))
        )
      )
    );
  }

  private handleUserSession(userId: number | null): void {
    if (!userId) {
      this.disconnectRealtime();
      this.unreadCountSubject.next(0);
      return;
    }

    if (this.connectedUserId === userId) {
      this.refreshUnreadCount().subscribe({
        error: () => this.unreadCountSubject.next(0)
      });
      return;
    }

    this.disconnectRealtime();
    this.connectRealtime(userId);
    this.refreshUnreadCount().subscribe({
      error: () => this.unreadCountSubject.next(0)
    });
  }

  private connectRealtime(userId: number): void {
    const token = this.authService.getToken();
    const connectHeaders: Record<string, string> = {};
    if (token) {
      connectHeaders['Authorization'] = `Bearer ${token}`;
    }

    this.stompClient = new Client({
      webSocketFactory: () => new SockJS(this.websocketUrl),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      connectHeaders,
      debug: () => {}
    });

    this.stompClient.onConnect = () => {
      this.connectedUserId = userId;

      this.stompClient?.subscribe(`/user/${userId}/queue/notifications`, (message) => {
        this.handleIncomingNotification(message);
      });

      this.stompClient?.subscribe('/user/queue/notifications', (message) => {
        this.handleIncomingNotification(message);
      });
    };

    this.stompClient.activate();
  }

  private disconnectRealtime(): void {
    if (this.stompClient) {
      this.stompClient.deactivate();
      this.stompClient = null;
    }
    this.connectedUserId = null;
    this.recentlyReceivedIds.clear();
  }

  private handleIncomingNotification(message: IMessage): void {
    if (!message.body) {
      return;
    }

    try {
      const raw = JSON.parse(message.body) as Notification;
      const notification = this.normalizeNotification(raw);
      if (this.isDuplicateRealtimeNotification(notification.notificationId)) {
        return;
      }

      this.realtimeNotificationSubject.next(notification);
      if (!notification.isRead) {
        this.unreadCountSubject.next(this.unreadCountSubject.value + 1);
      }
    } catch {
      // Ignore malformed payloads.
    }
  }

  private normalizeNotification(notification: Notification): Notification {
    return {
      ...notification,
      senderId: notification.senderId ?? notification.actorId,
      referenceId: notification.referenceId ?? notification.targetId
    };
  }

  private isDuplicateRealtimeNotification(notificationId: number | undefined): boolean {
    if (!notificationId) {
      return false;
    }

    if (this.recentlyReceivedIds.has(notificationId)) {
      return true;
    }

    this.recentlyReceivedIds.add(notificationId);
    setTimeout(() => this.recentlyReceivedIds.delete(notificationId), 30000);
    return false;
  }

  private decrementUnreadCount(): void {
    this.unreadCountSubject.next(Math.max(0, this.unreadCountSubject.value - 1));
  }
}
