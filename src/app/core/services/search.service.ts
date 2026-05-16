import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { Post } from './post.service';

export interface ApiResponse<T> {
  timestamp: string;
  status: number;
  message: string;
  data: T;
}

export interface SearchUser {
  userId: number;
  username: string;
  email: string;
  fullName: string;
  bio?: string;
  profilePicUrl?: string;
  role: string;
  provider?: string;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: string;
}

export interface HashtagResponse {
  hashtagId: number;
  tag: string;
  postCount: number;
  lastUsedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SearchService {
  private userSearchUrl = `${environment.apiUrl}/auth/search`;
  private searchApiUrl = `${environment.apiUrl}/search`;
  private hashtagApiUrl = `${environment.apiUrl}/hashtags`;
  private postsApiUrl = `${environment.apiUrl}/posts`;

  constructor(private http: HttpClient) {}

  searchUsers(query: string): Observable<SearchUser[]> {
    return this.http.get<ApiResponse<SearchUser[]>>(
      `${this.userSearchUrl}?q=${encodeURIComponent(query)}`
    ).pipe(
      map(response => response.data || [])
    );
  }

  searchPosts(keyword: string): Observable<Post[]> {
    const normalizedKeyword = (keyword || '').trim();
    if (!normalizedKeyword) {
      return of([]);
    }

    if (normalizedKeyword.startsWith('#')) {
      return this.getPostsByHashtag(normalizedKeyword);
    }

    const params = new HttpParams().set('keyword', normalizedKeyword);
    return this.http.get<ApiResponse<number[]>>(`${this.searchApiUrl}/posts`, { params }).pipe(
      map(response => response.data || []),
      switchMap(postIds => this.fetchPostsByIds(postIds))
    );
  }

  getTrendingHashtags(): Observable<HashtagResponse[]> {
    return this.http.get<ApiResponse<HashtagResponse[]>>(`${this.hashtagApiUrl}/trending`).pipe(
      map(response => response.data || [])
    );
  }

  getPostsByHashtag(tag: string): Observable<Post[]> {
    const normalizedTag = this.normalizeTag(tag);
    return this.http.get<ApiResponse<number[]>>(`${this.hashtagApiUrl}/${encodeURIComponent(normalizedTag)}`).pipe(
      map(response => response.data || []),
      switchMap(postIds => this.fetchPostsByIds(postIds))
    );
  }

  searchHashtags(query: string): Observable<HashtagResponse[]> {
    const normalizedQuery = this.normalizeTag(query);
    if (!normalizedQuery) {
      return of([]);
    }

    const params = new HttpParams().set('keyword', normalizedQuery);
    return this.http.get<ApiResponse<HashtagResponse[]>>(`${this.hashtagApiUrl}/search`, { params }).pipe(
      map(response => response.data || [])
    );
  }

  getHashtagsForPost(postId: number): Observable<HashtagResponse[]> {
    return this.http.get<ApiResponse<HashtagResponse[]>>(`${this.hashtagApiUrl}/post/${postId}`).pipe(
      map(response => response.data || [])
    );
  }

  private fetchPostsByIds(postIds: number[]): Observable<Post[]> {
    if (!postIds || postIds.length === 0) {
      return of([]);
    }

    const requests = postIds.map((postId) =>
      this.http.get<Post>(`${this.postsApiUrl}/${postId}`).pipe(
        catchError(() => of<Post | null>(null))
      )
    );

    return forkJoin(requests).pipe(
      map(posts => posts.filter((post): post is Post => post !== null))
    );
  }

  private normalizeTag(tag: string): string {
    const trimmed = (tag || '').trim();
    return trimmed.replace(/^#+/, '').replace(/#+$/, '');
  }
}
