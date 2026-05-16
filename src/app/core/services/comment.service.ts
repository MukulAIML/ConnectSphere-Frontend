import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Comment {
  commentId: number;
  postId: number;
  authorId: number;
  content: string;
  parentCommentId: number | null;
  likesCount: number;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];

  // Client-side enrichment from like-service
  reactionsSummary?: Record<string, number>;
  userReactionType?: string;
}

export interface CommentReaction {
  likeId: number;
  userId: number;
  targetId: number;
  targetType: string;
  reactionType: string;
  createdAt: string;
}

export interface CommentReactionSummary {
  targetId: number;
  targetType: string;
  totalCount: number;
  reactions: Record<string, number>;
  topReactions: string[];
}

@Injectable({
  providedIn: 'root'
})
export class CommentService {
  private apiUrl = `${environment.apiUrl}/comments`;
  private likeUrl = `${environment.apiUrl}/likes`;

  constructor(private http: HttpClient) {}

  getCommentsByPost(postId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/post/${postId}`);
  }

  getRepliesByComment(commentId: number): Observable<Comment[]> {
    return this.http.get<Comment[]>(`${this.apiUrl}/${commentId}/replies`);
  }

  getCommentCount(postId: number): Observable<{ commentCount: number }> {
    return this.http.get<{ commentCount: number }>(`${this.apiUrl}/post/${postId}/count`);
  }

  addComment(postId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}`, { postId, content });
  }

  addReply(commentId: number, postId: number, content: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/${commentId}/replies`, { postId, content });
  }

  updateComment(commentId: number, content: string): Observable<Comment> {
    return this.http.put<Comment>(`${this.apiUrl}/${commentId}`, { content });
  }

  deleteComment(commentId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/${commentId}`);
  }

  reactToComment(commentId: number, reactionType: string): Observable<CommentReaction> {
    const params = new HttpParams()
      .set('targetId', String(commentId))
      .set('targetType', 'COMMENT')
      .set('reactionType', reactionType);
    return this.http.post<CommentReaction>(`${this.likeUrl}`, {}, { params });
  }

  changeCommentReaction(commentId: number, newReaction: string): Observable<CommentReaction> {
    const params = new HttpParams()
      .set('targetId', String(commentId))
      .set('targetType', 'COMMENT')
      .set('newReaction', newReaction);
    return this.http.put<CommentReaction>(`${this.likeUrl}`, {}, { params });
  }

  removeCommentReaction(commentId: number): Observable<{ message: string }> {
    const params = new HttpParams()
      .set('targetId', String(commentId))
      .set('targetType', 'COMMENT');
    return this.http.delete<{ message: string }>(`${this.likeUrl}`, { params });
  }

  getCommentReactionSummary(commentId: number): Observable<CommentReactionSummary> {
    return this.http.get<CommentReactionSummary>(`${this.likeUrl}/target/COMMENT/${commentId}/summary`);
  }

  getUserCommentReaction(commentId: number): Observable<CommentReaction> {
    return this.http.get<CommentReaction>(`${this.likeUrl}/target/COMMENT/${commentId}/me`);
  }
}
