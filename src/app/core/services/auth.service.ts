import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, map, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  userId: number;
  email: string;
  username: string;
  role: string;
  fullName: string;
  profilePicUrl?: string;
  isActive: boolean;
  isSuspended: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  user: User;
}

export interface ApiResponse<T> {
  timestamp: string;
  status: number;
  message: string;
  data: T;
}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
  fullName?: string;
  bio?: string;
  profilePicUrl?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth`;
  private userCache = new Map<number, User>();
  
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    this.loadUserFromStorage();
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const parsed = JSON.parse(userStr) as Partial<User> | null;
        const user = this.normalizeStoredUser(parsed);

        if (!user) {
          this.clearInvalidSessionStorage();
          return;
        }

        this.currentUserSubject.next(user);
        this.userCache.set(user.userId, user);
      } catch {
        this.clearInvalidSessionStorage();
      }
    }
  }

  login(credentials: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, credentials).pipe(
      tap(response => {
        if (response && response.data && response.data.token) {
          this.setSession(response.data);
        }
      })
    );
  }

  register(userData: any): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/register`, userData).pipe(
      tap(response => {
        if (response && response.data && response.data.token) {
          this.setSession(response.data);
        }
      })
    );
  }

  getUserById(userId: number): Observable<User> {
    const cachedUser = this.userCache.get(userId);
    if (cachedUser) {
      return of(cachedUser);
    }

    return this.http.get<any>(`${this.apiUrl}/users/${userId}`).pipe(
      map(response => response?.data ?? response),
      tap((user: User) => {
        if (user?.userId) {
          this.userCache.set(user.userId, user);
        }
      })
    );
  }

  updateProfile(data: UpdateProfileRequest): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.apiUrl}/profile`, data).pipe(
      map(response => response.data),
      tap((updatedUser) => {
        if (!updatedUser?.userId) {
          return;
        }

        this.userCache.set(updatedUser.userId, updatedUser);
        if (this.currentUserValue?.userId === updatedUser.userId) {
          localStorage.setItem('user', JSON.stringify(updatedUser));
          this.currentUserSubject.next(updatedUser);
        }
      })
    );
  }

  changePassword(data: ChangePasswordRequest): Observable<void> {
    return this.http.put<ApiResponse<null>>(`${this.apiUrl}/password`, data).pipe(
      map(() => void 0)
    );
  }

  deactivateAccount(): Observable<void> {
    return this.http.delete<ApiResponse<null>>(`${this.apiUrl}/deactivate`).pipe(
      tap(() => this.logout()),
      map(() => void 0)
    );
  }

  refreshToken(): Observable<string> {
    const currentToken = this.getToken();
    let params = new HttpParams();
    if (currentToken) {
      params = params.set('token', currentToken);
    }

    return this.http.post<ApiResponse<string>>(
      `${this.apiUrl}/refresh`,
      {},
      { params }
    ).pipe(
      map(response => response.data),
      tap((newToken) => this.setAccessToken(newToken))
    );
  }

  setAccessToken(token: string): void {
    if (!token) {
      return;
    }
    localStorage.setItem('token', token);
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    this.userCache.clear();
    this.currentUserSubject.next(null);
  }

  private setSession(authResult: AuthResponse): void {
    localStorage.setItem('token', authResult.token);
    localStorage.setItem('refreshToken', authResult.refreshToken);
    localStorage.setItem('user', JSON.stringify(authResult.user));
    this.currentUserSubject.next(authResult.user);
    this.userCache.set(authResult.user.userId, authResult.user);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  hasRole(role: string): boolean {
    const user = this.currentUserValue;
    return user ? user.role === role : false;
  }

  private normalizeStoredUser(raw: Partial<User> | null): User | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const userId = Number(raw.userId);
    const username = typeof raw.username === 'string' ? raw.username.trim() : '';
    const email = typeof raw.email === 'string' ? raw.email.trim() : '';

    if (!Number.isFinite(userId) || userId <= 0 || !username || !email) {
      return null;
    }

    return {
      userId,
      username,
      email,
      role: typeof raw.role === 'string' && raw.role ? raw.role : 'ROLE_USER',
      fullName: typeof raw.fullName === 'string' ? raw.fullName : '',
      profilePicUrl: typeof raw.profilePicUrl === 'string' ? raw.profilePicUrl : undefined,
      isActive: typeof raw.isActive === 'boolean' ? raw.isActive : true,
      isSuspended: typeof raw.isSuspended === 'boolean' ? raw.isSuspended : false
    };
  }

  private clearInvalidSessionStorage(): void {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    this.currentUserSubject.next(null);
    this.userCache.clear();
  }
}
