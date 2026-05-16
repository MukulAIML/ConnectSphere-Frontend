import { Injectable, inject } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpErrorResponse,
  HttpContextToken
} from '@angular/common/http';
import { BehaviorSubject, Observable, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';

const RETRY_WITH_REFRESH = new HttpContextToken<boolean>(() => false);

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private authService = inject(AuthService);
  private router = inject(Router);
  private isRefreshing = false;
  private refreshedToken$ = new BehaviorSubject<string | null>(null);

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();
    const isRefreshRequest = this.isRefreshRequest(request);

    if (token && !isRefreshRequest) {
      request = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }

    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status !== 401) {
          return throwError(() => error);
        }

        if (isRefreshRequest || this.shouldSkipRefresh(request) || request.context.get(RETRY_WITH_REFRESH)) {
          this.handleAuthFailure();
          return throwError(() => error);
        }

        if (!this.authService.getToken()) {
          this.handleAuthFailure();
          return throwError(() => error);
        }

        return this.handleUnauthorizedError(request, next, error);
      })
    );
  }

  private handleUnauthorizedError(
    request: HttpRequest<unknown>,
    next: HttpHandler,
    originalError: HttpErrorResponse
  ): Observable<HttpEvent<unknown>> {
    if (this.isRefreshing) {
      return this.refreshedToken$.pipe(
        filter((token): token is string => !!token),
        take(1),
        switchMap((newToken) => {
          const retriedRequest = this.withAuthToken(
            request.clone({ context: request.context.set(RETRY_WITH_REFRESH, true) }),
            newToken
          );
          return next.handle(retriedRequest);
        })
      );
    }

    this.isRefreshing = true;
    this.refreshedToken$.next(null);

    return this.authService.refreshToken().pipe(
      switchMap((newToken: string) => {
        this.isRefreshing = false;
        this.refreshedToken$.next(newToken);

        const retriedRequest = this.withAuthToken(
          request.clone({ context: request.context.set(RETRY_WITH_REFRESH, true) }),
          newToken
        );
        return next.handle(retriedRequest);
      }),
      catchError((refreshError) => {
        this.isRefreshing = false;
        this.refreshedToken$.next(null);
        this.handleAuthFailure();
        return throwError(() => refreshError ?? originalError);
      })
    );
  }

  private withAuthToken(request: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    if (!token) {
      return request;
    }
    return request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  private isRefreshRequest(request: HttpRequest<unknown>): boolean {
    return request.url.includes('/auth/refresh');
  }

  private shouldSkipRefresh(request: HttpRequest<unknown>): boolean {
    return request.url.includes('/auth/login') || request.url.includes('/auth/register');
  }

  private handleAuthFailure(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
