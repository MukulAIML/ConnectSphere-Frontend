import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private authApiUrl = `${environment.apiUrl}/auth/admin`;
  private commentApiUrl = `${environment.apiUrl}/comments/admin`;
  private postApiUrl = `${environment.apiUrl}/posts/admin`; // if available

  constructor(private http: HttpClient) {}

  getAllUsers(): Observable<any> {
    return this.http.get<any>(`${this.authApiUrl}/users`);
  }

  suspendUser(userId: number): Observable<any> {
    return this.http.patch<any>(`${this.authApiUrl}/users/${userId}/suspend`, {});
  }

  reactivateUser(userId: number): Observable<any> {
    return this.http.patch<any>(`${this.authApiUrl}/users/${userId}/reactivate`, {});
  }

  getReportedComments(): Observable<any> {
    return this.http.get<any>(`${this.commentApiUrl}/moderation/queue`);
  }

  deleteComment(commentId: number): Observable<any> {
    return this.http.delete<any>(`${this.commentApiUrl}/${commentId}`);
  }
}
