import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, User } from './auth.service';
import { Post, ReportTargetType } from './post.service';

export type AdminReportStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'DISMISSED';
export type AdminResolutionAction =
  | 'NO_ACTION'
  | 'REMOVE_POST'
  | 'REMOVE_COMMENT'
  | 'SUSPEND_ACCOUNT'
  | 'DELETE_ACCOUNT';
export type BroadcastRecipientScope = 'ALL' | 'TARGETED';

export interface AdminFlaggedPost extends Post {
  moderationScore?: number;
  moderationReviewed?: boolean;
}

export interface AdminForceEditRequest {
  content: string;
  adminNote?: string;
}

export interface AdminReport {
  reportId: number;
  reporterId: number;
  targetType: ReportTargetType;
  targetId: number;
  reason: string;
  details?: string;
  status: AdminReportStatus;
  reviewedBy?: number;
  reviewedAt?: string;
  resolutionAction?: AdminResolutionAction;
  moderatorNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResolveReportRequest {
  status: AdminReportStatus;
  resolutionAction?: AdminResolutionAction;
  moderatorNote?: string;
}

export interface AdminPlatformStats {
  totalUsers: number;
  dailyActiveUsers: number;
  totalPosts: number;
  trendingHashtags: Array<{ tag: string; postCount: number }>;
}

export interface AdminBroadcastRequest {
  recipientScope: BroadcastRecipientScope;
  recipientIds?: number[];
  message: string;
}

export interface AdminBroadcastResponse {
  recipientsCount: number;
  message: string;
}

export interface ForceDeletePostResponse {
  message: string;
  adminNote: string;
}

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authApiUrl = `${environment.apiUrl}/auth/admin`;
  private postModerationApiUrl = `${environment.apiUrl}/posts/admin/posts`;
  private reportApiUrl = `${environment.apiUrl}/posts/admin/reports`;
  private dashboardApiUrl = `${environment.apiUrl}/posts/admin/dashboard`;

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.authApiUrl}/users`).pipe(
      map((response) => response?.data ?? [])
    );
  }

  suspendUser(userId: number): Observable<void> {
    return this.http.patch<ApiResponse<null>>(`${this.authApiUrl}/users/${userId}/suspend`, {}).pipe(
      map(() => void 0)
    );
  }

  reactivateUser(userId: number): Observable<void> {
    return this.http.patch<ApiResponse<null>>(`${this.authApiUrl}/users/${userId}/reactivate`, {}).pipe(
      map(() => void 0)
    );
  }

  permanentlyDeleteUser(userId: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.authApiUrl}/users/${userId}`).pipe(
      map(() => void 0)
    );
  }

  getPlatformStats(): Observable<AdminPlatformStats> {
    return this.http.get<AdminPlatformStats>(`${this.dashboardApiUrl}/stats`);
  }

  getAllFlaggedPosts(): Observable<AdminFlaggedPost[]> {
    return this.http.get<AdminFlaggedPost[]>(`${this.postModerationApiUrl}/flagged`);
  }

  forceDeletePost(postId: number, adminNote?: string): Observable<ForceDeletePostResponse> {
    let params = new HttpParams();
    if (adminNote?.trim()) {
      params = params.set('adminNote', adminNote.trim());
    }
    return this.http.delete<ForceDeletePostResponse>(
      `${this.postModerationApiUrl}/${postId}/force-delete`,
      { params }
    );
  }

  forceEditPost(postId: number, data: AdminForceEditRequest): Observable<AdminFlaggedPost> {
    return this.http.put<AdminFlaggedPost>(`${this.postModerationApiUrl}/${postId}/force-edit`, data);
  }

  markFlaggedPostReviewed(postId: number, adminNote?: string): Observable<AdminFlaggedPost> {
    let params = new HttpParams();
    if (adminNote?.trim()) {
      params = params.set('adminNote', adminNote.trim());
    }
    return this.http.patch<AdminFlaggedPost>(
      `${this.postModerationApiUrl}/${postId}/mark-reviewed`,
      null,
      { params }
    );
  }

  getAllReports(filters?: { status?: AdminReportStatus; targetType?: ReportTargetType }): Observable<AdminReport[]> {
    let params = new HttpParams();
    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.targetType) {
      params = params.set('targetType', filters.targetType);
    }

    return this.http.get<AdminReport[]>(this.reportApiUrl, { params });
  }

  // There is no `/comments/admin/moderation/queue` endpoint in the current backend.
  // Reported comments are sourced from the central moderation reports endpoint.
  getReportedComments(): Observable<AdminReport[]> {
    return this.getAllReports({ targetType: 'COMMENT', status: 'OPEN' });
  }

  resolveReport(reportId: number, data: ResolveReportRequest): Observable<AdminReport> {
    return this.http.patch<AdminReport>(`${this.reportApiUrl}/${reportId}/status`, data);
  }

  broadcastNotification(data: AdminBroadcastRequest): Observable<AdminBroadcastResponse> {
    return this.http.post<AdminBroadcastResponse>(`${this.dashboardApiUrl}/broadcast`, data);
  }
}
