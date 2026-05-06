import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Post {
  postId: number;
  authorId: number;
  content: string;
  postType: string;
  createdAt: string;
  visibility?: string;

  reactionsSummary?: Record<string, number>;
  userReactionType?: string;
  commentsCount?: number;
}

@Injectable({
  providedIn: 'root'
})
export class PostService {
  private apiUrl = `${environment.apiUrl}/posts`;
  private likeUrl = `${environment.apiUrl}/likes`;

  constructor(private http: HttpClient) {}

  getFeed(userId: number, page: number = 0, size: number = 20): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/feed/${userId}?page=${page}&size=${size}`);
  }

  createPost(data: {
    content: string;
    mediaUrls: string[];
    postType: string;
    visibility: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}`, data);
  }


  reactToPost(postId: number, reactionType: string): Observable<any> {
    return this.http.post<any>(`${this.likeUrl}/posts/${postId}/react?reactionType=${reactionType}`, {});
  }

  removeReaction(postId: number): Observable<any> {
    return this.http.delete<any>(`${this.likeUrl}/posts/${postId}/react`);
  }
}
