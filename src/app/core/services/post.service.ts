import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type PostType = 'TEXT' | 'MEDIA';
export type PostVisibility = 'PUBLIC' | 'FOLLOWERS_ONLY' | 'PRIVATE';
export type ReportTargetType = 'POST' | 'COMMENT' | 'ACCOUNT';
export type ReportReason =
  | 'SPAM'
  | 'HARASSMENT'
  | 'HATE_SPEECH'
  | 'VIOLENCE'
  | 'NUDITY'
  | 'MISINFORMATION'
  | 'IMPERSONATION'
  | 'SELF_HARM'
  | 'OTHER';

export interface Post {
  postId: number;
  authorId: number;
  content: string;
  mediaUrls: string[];
  postType: PostType;
  visibility: PostVisibility;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: string;
  updatedAt: string;
  isFlagged?: boolean;
  moderationLabel?: string;

  // Client-side enrichment from like-service
  reactionsSummary?: Record<string, number>;
  userReactionType?: string;
}

export interface CreateOrUpdatePostRequest {
  content: string;
  mediaUrls: string[];
  postType: PostType;
  visibility: PostVisibility;
}

export interface ReportPostRequest {
  reason: ReportReason;
  details?: string;
  targetType?: ReportTargetType;
  targetId?: number;
}

export interface ReportResponse {
  reportId: number;
  reporterId: number;
  targetType: ReportTargetType;
  targetId: number;
  reason: ReportReason;
  details?: string;
  status: string;
  reviewedBy?: number;
  reviewedAt?: string;
  resolutionAction?: string;
  moderatorNote?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private apiUrl = `${environment.apiUrl}/posts`;
  private likeUrl = `${environment.apiUrl}/likes`;

  constructor(private http: HttpClient) {}

  getFeed(userId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/feed/${userId}`);
  }

  getPostsByUser(userId: number): Observable<Post[]> {
    return this.http.get<Post[]>(`${this.apiUrl}/user/${userId}`);
  }

  getPostById(postId: number): Observable<Post> {
    return this.http.get<Post>(`${this.apiUrl}/${postId}`);
  }

  searchPosts(keyword: string): Observable<Post[]> {
    const params = new HttpParams().set('keyword', keyword.trim());
    return this.http.get<Post[]>(`${this.apiUrl}/search`, { params });
  }

  createPost(data: CreateOrUpdatePostRequest): Observable<Post> {
    return this.http.post<Post>(`${this.apiUrl}`, data);
  }

  updatePost(postId: number, data: CreateOrUpdatePostRequest): Observable<Post> {
    return this.http.put<Post>(`${this.apiUrl}/${postId}`, data);
  }

  changeVisibility(postId: number, visibility: PostVisibility): Observable<Post> {
    const params = new HttpParams().set('visibility', visibility);
    return this.http.put<Post>(`${this.apiUrl}/${postId}/visibility`, {}, { params });
  }

  deletePost(postId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${postId}`);
  }

  reportPost(postId: number, data: ReportPostRequest): Observable<ReportResponse> {
    return this.http.post<ReportResponse>(`${this.apiUrl}/reports`, {
      targetType: data.targetType ?? 'POST',
      targetId: data.targetId ?? postId,
      reason: data.reason,
      details: data.details
    });
  }

  sharePost(postId: number): Observable<void> {
    const shareUrl = this.buildShareUrl(postId);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      return from(
        navigator.share({
          title: 'ConnectSphere Post',
          text: 'Check out this post on ConnectSphere.',
          url: shareUrl
        })
      ).pipe(map(() => void 0));
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      return from(navigator.clipboard.writeText(shareUrl)).pipe(map(() => void 0));
    }

    return of(void 0);
  }

  private buildShareUrl(postId: number): string {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}/feed?postId=${postId}`;
    }
    return `/feed?postId=${postId}`;
  }

  // Like-service integration — correct endpoints
  reactToPost(postId: number, reactionType: string): Observable<any> {
    return this.http.post<any>(
      `${this.likeUrl}?targetId=${postId}&targetType=POST&reactionType=${reactionType}`,
      {}
    );
  }

  changeReaction(postId: number, newReaction: string): Observable<any> {
    const params = new HttpParams()
      .set('targetId', String(postId))
      .set('targetType', 'POST')
      .set('newReaction', newReaction);
    return this.http.put<any>(`${this.likeUrl}`, {}, { params });
  }

  removeReaction(postId: number): Observable<any> {
    return this.http.delete<any>(
      `${this.likeUrl}?targetId=${postId}&targetType=POST`
    );
  }

  getReactionSummary(postId: number): Observable<any> {
    return this.http.get<any>(`${this.likeUrl}/target/POST/${postId}/summary`);
  }

  getUserReaction(postId: number): Observable<any> {
    return this.http.get<any>(`${this.likeUrl}/target/POST/${postId}/me`);
  }
}
