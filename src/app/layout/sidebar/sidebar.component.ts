import { Component, OnDestroy, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private unreadSubscription?: Subscription;
  unreadCount = 0;

  ngOnInit(): void {
    this.unreadSubscription = this.notificationService.unreadCount$.subscribe((count) => {
      this.unreadCount = count;
    });

    if (this.authService.currentUserValue) {
      this.notificationService.refreshUnreadCount().subscribe({
        error: () => {
          this.unreadCount = 0;
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.unreadSubscription?.unsubscribe();
  }
}
