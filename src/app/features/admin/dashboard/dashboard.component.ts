import { Component, OnInit } from '@angular/core';
import { inject } from '@angular/core';
import { AdminService } from '../../../core/services/admin.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private adminService = inject(AdminService);

  users: any[] = [];
  reportedComments: any[] = [];
  activeTab = 'users';
  loading = true;

  ngOnInit(): void {
    this.loadUsers();
  }

  setTab(tab: string): void {
    this.activeTab = tab;
    if (tab === 'users') {
      this.loadUsers();
    } else {
      this.loadReportedComments();
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.adminService.getAllUsers().subscribe({
      next: (response: any) => {
        this.users = response.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  loadReportedComments(): void {
    this.loading = true;
    this.adminService.getReportedComments().subscribe({
      next: (response: any) => {
        this.reportedComments = response.data || [];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  toggleSuspend(user: any): void {
    if (user.isSuspended) {
      this.adminService.reactivateUser(user.userId).subscribe(() => {
        user.isSuspended = false;
        user.isActive = true;
      });
    } else {
      this.adminService.suspendUser(user.userId).subscribe(() => {
        user.isSuspended = true;
      });
    }
  }

  deleteComment(commentId: number): void {
    if (confirm('Are you sure you want to delete this sensitive content?')) {
      this.adminService.deleteComment(commentId).subscribe(() => {
        this.reportedComments = this.reportedComments.filter((c: any) => c.commentId !== commentId);
      });
    }
  }
}
