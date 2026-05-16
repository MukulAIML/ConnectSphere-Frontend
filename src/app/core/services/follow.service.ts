import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FollowResponse {
  followId: number;
  followerId: number;
  followeeId: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class FollowService {
  private apiUrl = `${environment.apiUrl}/follows`;

  constructor(private http: HttpClient) {}

  followUser(followeeId: number): Observable<FollowResponse> {
    return this.http.post<any>(`${this.apiUrl}`, { followeeId }).pipe(
      map(res => res.data)
    );
  }

  unfollowUser(followeeId: number): Observable<void> {
    return this.http.delete<any>(`${this.apiUrl}?followeeId=${followeeId}`).pipe(
      map(() => void 0)
    );
  }

  isFollowing(followeeId: number): Observable<boolean> {
    return this.http.get<any>(`${this.apiUrl}/isFollowing?followeeId=${followeeId}`).pipe(
      map(res => res.data)
    );
  }

  getFollowers(userId: number): Observable<FollowResponse[]> {
    return this.http.get<any>(`${this.apiUrl}/followers/${userId}`).pipe(
      map(res => res.data)
    );
  }

  getFollowing(userId: number): Observable<FollowResponse[]> {
    return this.http.get<any>(`${this.apiUrl}/following/${userId}`).pipe(
      map(res => res.data)
    );
  }

  getFollowerCount(userId: number): Observable<number> {
    return this.http.get<any>(`${this.apiUrl}/count/followers/${userId}`).pipe(
      map(res => res.data)
    );
  }

  getFollowingCount(userId: number): Observable<number> {
    return this.http.get<any>(`${this.apiUrl}/count/following/${userId}`).pipe(
      map(res => res.data)
    );
  }

  getSuggestions(userId: number): Observable<number[]> {
    return this.http.get<any>(`${this.apiUrl}/suggestions/${userId}`).pipe(
      map(res => res.data)
    );
  }

  getMutualFollows(userId?: number): Observable<number[]> {
    const endpoint = userId ? `${this.apiUrl}/mutual/${userId}` : `${this.apiUrl}/mutual`;
    return this.http.get<any>(endpoint).pipe(
      map(res => res.data || [])
    );
  }
}
