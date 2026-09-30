import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { SessionRefreshService } from './session-refresh.service';
import { SessionStore } from './session.store';
import { RuntimeConfigService } from '../config/runtime-config';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const session = inject(SessionStore);
  const sessionRefresh = inject(SessionRefreshService);
  const config = inject(RuntimeConfigService);
  const router = inject(Router);
  const token = session.accessToken;
  const authenticatedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authenticatedRequest).pipe(
    catchError((error: unknown) => {
      const canRefresh =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        (config.platform === 'web' || Boolean(session.refreshToken)) &&
        !request.url.includes('/auth/login') &&
        !request.url.includes('/auth/refresh') &&
        !request.url.includes('/auth/web/');
      if (canRefresh) {
        return from(sessionRefresh.refresh()).pipe(
          switchMap((refreshed) => {
            const refreshedToken = session.accessToken;
            if (!refreshed || !refreshedToken) {
              void router.navigateByUrl('/login');
              return throwError(() => error);
            }
            return next(
              request.clone({ setHeaders: { Authorization: `Bearer ${refreshedToken}` } }),
            );
          }),
        );
      }
      if (error instanceof HttpErrorResponse && error.status === 401) {
        session.clear();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
