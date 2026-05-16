import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AdminBroadcastRequest,
  AdminFlaggedPost,
  AdminPlatformStats,
  AdminReport,
  AdminReportStatus,
  AdminResolutionAction,
  AdminService,
  BroadcastRecipientScope
} from '../../../core/services/admin.service';
import { AuthService, User } from '../../../core/services/auth.service';
import { ReportTargetType } from '../../../core/services/post.service';

type AdminTab =
  | 'users'
  | 'reported-comments'
  | 'flagged-posts'
  | 'reports'
  | 'stats'
  | 'broadcast';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private adminService = inject(AdminService);
  private authService = inject(AuthService);

  users: User[] = [];
  reportedComments: AdminReport[] = [];
  flaggedPosts: AdminFlaggedPost[] = [];
  reports: AdminReport[] = [];
  platformStats: AdminPlatformStats | null = null;

  activeTab: AdminTab = 'users';
  loading = true;
  actionMessage = '';
  actionError = '';

  reportStatusFilter: AdminReportStatus | '' = '';
  reportTargetFilter: ReportTargetType | '' = '';

  broadcastMessage = '';
  broadcastRecipientScope: BroadcastRecipientScope = 'ALL';
  broadcastRecipientIdsText = '';

  readonly reportStatuses: AdminReportStatus[] = ['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'];
  readonly reportTargetTypes: ReportTargetType[] = ['POST', 'COMMENT', 'ACCOUNT'];

  ngOnInit(): void {
    this.loadActiveTabData();
  }

  get canManageAdminOnlyActions(): boolean {
    return this.authService.hasRole('ROLE_ADMIN');
  }

  setTab(tab: AdminTab): void {
    this.activeTab = tab;
    this.clearMessages();
    this.loadActiveTabData();
  }

  loadActiveTabData(): void {
    switch (this.activeTab) {
      case 'users':
        this.loadUsers();
        break;
      case 'reported-comments':
        this.loadReportedComments();
        break;
      case 'flagged-posts':
        this.loadFlaggedPosts();
        break;
      case 'reports':
        this.loadAllReports();
        break;
      case 'stats':
        this.loadPlatformStats();
        break;
      case 'broadcast':
        this.loading = false;
        break;
      default:
        this.loading = false;
        break;
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.adminService.getAllUsers().subscribe({
      next: (users) => {
        this.users = users;
        this.actionError = '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Unable to load users.';
      }
    });
  }

  loadReportedComments(): void {
    this.loading = true;
    this.adminService.getReportedComments().subscribe({
      next: (reports) => {
        this.reportedComments = reports;
        this.actionError = '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Unable to load reported comments.';
      }
    });
  }

  loadFlaggedPosts(): void {
    this.loading = true;
    this.adminService.getAllFlaggedPosts().subscribe({
      next: (posts) => {
        this.flaggedPosts = posts;
        this.actionError = '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Unable to load flagged posts.';
      }
    });
  }

  loadAllReports(): void {
    this.loading = true;
    const filters: { status?: AdminReportStatus; targetType?: ReportTargetType } = {};
    if (this.reportStatusFilter) {
      filters.status = this.reportStatusFilter;
    }
    if (this.reportTargetFilter) {
      filters.targetType = this.reportTargetFilter;
    }

    this.adminService.getAllReports(filters).subscribe({
      next: (reports) => {
        this.reports = reports;
        this.actionError = '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Unable to load reports.';
      }
    });
  }

  clearReportFilters(): void {
    this.reportStatusFilter = '';
    this.reportTargetFilter = '';
    this.loadAllReports();
  }

  loadPlatformStats(): void {
    this.loading = true;
    this.adminService.getPlatformStats().subscribe({
      next: (stats) => {
        this.platformStats = stats;
        this.actionError = '';
        this.loading = false;
      },
      error: () => {
        this.loading = false;
        this.actionError = 'Unable to load platform stats.';
      }
    });
  }

  toggleSuspend(user: User): void {
    if (user.isSuspended) {
      this.adminService.reactivateUser(user.userId).subscribe({
        next: () => {
          user.isSuspended = false;
          user.isActive = true;
          this.actionError = '';
          this.actionMessage = `${user.username} reactivated successfully.`;
        },
        error: () => {
          this.actionError = `Unable to reactivate ${user.username}.`;
        }
      });
    } else {
      this.adminService.suspendUser(user.userId).subscribe({
        next: () => {
          user.isSuspended = true;
          user.isActive = false;
          this.actionError = '';
          this.actionMessage = `${user.username} suspended successfully.`;
        },
        error: () => {
          this.actionError = `Unable to suspend ${user.username}.`;
        }
      });
    }
  }

  permanentlyDeleteUser(user: User): void {
    if (!this.canManageAdminOnlyActions) {
      this.actionError = 'Only admins can permanently delete accounts.';
      return;
    }
    if (confirm(`Permanently delete ${user.username}? This cannot be undone.`)) {
      this.adminService.permanentlyDeleteUser(user.userId).subscribe({
        next: () => {
          this.users = this.users.filter((u) => u.userId !== user.userId);
          this.actionError = '';
          this.actionMessage = `${user.username} permanently deleted.`;
        },
        error: () => {
          this.actionError = 'Unable to permanently delete user.';
        }
      });
    }
  }

  markReportUnderReview(report: AdminReport): void {
    this.updateReportStatus(report, {
      status: 'UNDER_REVIEW',
      resolutionAction: 'NO_ACTION'
    }, 'Report moved to under review.');
  }

  dismissReport(report: AdminReport): void {
    this.updateReportStatus(report, {
      status: 'DISMISSED',
      resolutionAction: 'NO_ACTION'
    }, 'Report dismissed.');
  }

  resolveReportWithoutAction(report: AdminReport): void {
    this.updateReportStatus(report, {
      status: 'RESOLVED',
      resolutionAction: 'NO_ACTION'
    }, 'Report resolved.');
  }

  resolveReportWithAction(report: AdminReport, action: AdminResolutionAction): void {
    const note = prompt('Optional moderator note:', report.moderatorNote ?? '');
    if (note === null) {
      return;
    }
    this.updateReportStatus(report, {
      status: 'RESOLVED',
      resolutionAction: action,
      moderatorNote: note.trim() || undefined
    }, 'Report resolved.');
  }

  forceDeletePost(post: AdminFlaggedPost): void {
    if (!confirm(`Force delete post #${post.postId}?`)) {
      return;
    }
    const note = prompt('Admin note (optional):', 'Removed for policy violation');
    if (note === null) {
      return;
    }
    this.adminService.forceDeletePost(post.postId, note).subscribe({
      next: () => {
        this.flaggedPosts = this.flaggedPosts.filter((item) => item.postId !== post.postId);
        this.actionError = '';
        this.actionMessage = `Post #${post.postId} removed.`;
      },
      error: () => {
        this.actionError = 'Unable to force-delete post.';
      }
    });
  }

  forceEditPost(post: AdminFlaggedPost): void {
    const newContent = prompt('Enter replacement content:', post.content ?? '');
    if (newContent === null || !newContent.trim()) {
      return;
    }
    const adminNote = prompt('Admin note (optional):', post.moderationLabel ?? '');
    if (adminNote === null) {
      return;
    }
    this.adminService.forceEditPost(post.postId, {
      content: newContent.trim(),
      adminNote: adminNote.trim() || undefined
    }).subscribe({
      next: (updatedPost) => {
        this.flaggedPosts = this.flaggedPosts.map((item) =>
          item.postId === updatedPost.postId ? updatedPost : item
        );
        this.actionError = '';
        this.actionMessage = `Post #${post.postId} updated.`;
      },
      error: () => {
        this.actionError = 'Unable to force-edit post.';
      }
    });
  }

  markFlaggedPostReviewed(post: AdminFlaggedPost): void {
    const note = prompt('Optional review note:', '');
    if (note === null) {
      return;
    }
    this.adminService.markFlaggedPostReviewed(post.postId, note.trim() || undefined).subscribe({
      next: () => {
        this.flaggedPosts = this.flaggedPosts.filter((item) => item.postId !== post.postId);
        this.actionError = '';
        this.actionMessage = `Post #${post.postId} marked as reviewed.`;
      },
      error: () => {
        this.actionError = 'Unable to mark post as reviewed.';
      }
    });
  }

  sendBroadcast(): void {
    const message = this.broadcastMessage.trim();
    if (!message) {
      this.actionError = 'Broadcast message cannot be empty.';
      return;
    }

    const payload: AdminBroadcastRequest = {
      recipientScope: this.broadcastRecipientScope,
      message
    };

    if (this.broadcastRecipientScope === 'TARGETED') {
      const parsedIds = this.parseRecipientIds(this.broadcastRecipientIdsText);
      if (parsedIds.length === 0) {
        this.actionError = 'Provide at least one valid user ID for targeted broadcast.';
        return;
      }
      payload.recipientIds = parsedIds;
    }

    this.loading = true;
    this.adminService.broadcastNotification(payload)
      .pipe(finalize(() => { this.loading = false; }))
      .subscribe({
        next: (response) => {
          this.actionError = '';
          this.actionMessage = `Broadcast sent to ${response.recipientsCount} recipient(s).`;
          this.broadcastMessage = '';
          if (this.broadcastRecipientScope === 'TARGETED') {
            this.broadcastRecipientIdsText = '';
          }
        },
        error: () => {
          this.actionError = 'Unable to send broadcast notification.';
        }
      });
  }

  reportNeedsModerationActions(report: AdminReport): boolean {
    return report.status === 'OPEN' || report.status === 'UNDER_REVIEW';
  }

  private updateReportStatus(
    report: AdminReport,
    payload: {
      status: AdminReportStatus;
      resolutionAction: AdminResolutionAction;
      moderatorNote?: string;
    },
    successMessage: string
  ): void {
    this.adminService.resolveReport(report.reportId, payload).subscribe({
      next: (updated) => {
        this.actionError = '';
        this.actionMessage = successMessage;
        this.reports = this.reports.map((item) =>
          item.reportId === updated.reportId ? updated : item
        );
        this.reportedComments = this.reportedComments.filter((item) =>
          item.reportId !== updated.reportId
        );
        if (this.activeTab === 'reports') {
          this.loadAllReports();
        }
      },
      error: () => {
        this.actionError = 'Unable to update report.';
      }
    });
  }

  private parseRecipientIds(rawIds: string): number[] {
    const uniqueIds = new Set<number>();
    for (const chunk of rawIds.split(',')) {
      const numericId = Number(chunk.trim());
      if (Number.isInteger(numericId) && numericId > 0) {
        uniqueIds.add(numericId);
      }
    }
    return Array.from(uniqueIds);
  }

  private clearMessages(): void {
    this.actionMessage = '';
    this.actionError = '';
  }
}
