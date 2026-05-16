import { Component, OnDestroy, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.css']
})
export class HeaderComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);
  private userSubscription?: Subscription;
  private unreadSubscription?: Subscription;

  user: any = null;
  unreadCount = 0;

  ngOnInit(): void {
    this.userSubscription = this.authService.currentUser$.subscribe((u: any) => this.user = u);
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
    this.userSubscription?.unsubscribe();
    this.unreadSubscription?.unsubscribe();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
