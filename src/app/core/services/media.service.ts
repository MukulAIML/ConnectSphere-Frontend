import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

interface ApiResponse<T> {
  timestamp: string;
  status: number;
  message: string;
  data: T;
}

export interface MediaResponse {
  mediaId: number;
  url: string;
  mediaType: string;
  uploaderId: number;
  linkedPostId: number | null;
  createdAt?: string;
  uploadedAt?: string;
}

export type StoryMediaType = 'IMAGE' | 'VIDEO';

export interface Story {
  storyId: number;
  authorId: number;
  mediaUrl: string;
  caption: string | null;
  mediaType: StoryMediaType;
  viewsCount: number;
  createdAt: string;
  expiresAt: string;
  isActive: boolean;
}

export interface CreateStoryRequest {
  mediaUrl: string;
  caption?: string;
  mediaType: StoryMediaType;
}

@Injectable({
  providedIn: 'root'
})
export class MediaService {
  private apiUrl = `${environment.apiUrl}/media`;
  private storyApiUrl = `${environment.apiUrl}/stories`;

  constructor(private http: HttpClient) {}

  uploadFile(file: File): Observable<MediaResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ApiResponse<MediaResponse>>(`${this.apiUrl}/upload`, formData).pipe(
      map(res => res.data)
    );
  }

  getMediaByPost(postId: number): Observable<MediaResponse[]> {
    return this.http.get<ApiResponse<MediaResponse[]>>(`${this.apiUrl}/post/${postId}`).pipe(
      map(res => res.data || [])
    );
  }

  deleteMedia(mediaId: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/${mediaId}`).pipe(
      map(() => void 0)
    );
  }

  createStory(storyData: CreateStoryRequest): Observable<Story> {
    return this.http.post<ApiResponse<Story>>(`${this.storyApiUrl}`, storyData).pipe(
      map(res => res.data)
    );
  }

  getActiveStories(): Observable<Story[]> {
    return this.http.get<ApiResponse<Story[]>>(`${this.storyApiUrl}/active`).pipe(
      map(res => res.data || [])
    );
  }

  getStoriesByUser(userId: number): Observable<Story[]> {
    return this.http.get<ApiResponse<Story[]>>(`${this.storyApiUrl}/user/${userId}`).pipe(
      map(res => res.data || [])
    );
  }

  viewStory(storyId: number): Observable<void> {
    return this.http.put<ApiResponse<null>>(`${this.storyApiUrl}/${storyId}/view`, {}).pipe(
      map(() => void 0)
    );
  }

  deleteStory(storyId: number): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.storyApiUrl}/${storyId}`).pipe(
      map(() => void 0)
    );
  }
}
