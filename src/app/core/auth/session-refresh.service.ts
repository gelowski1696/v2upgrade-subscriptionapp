import { HttpBackend, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RuntimeConfigService } from '../config/runtime-config';
import type { AuthResult } from '../models/api.models';
import { SessionStore } from './session.store';

@Injectable({ providedIn: 'root' })
export class SessionRefreshService {
  private readonly http: HttpClient;
  private refreshInFlight: Promise<boolean> | null = null;
  private generation = 0;

  constructor(
    backend: HttpBackend,
    private readonly config: RuntimeConfigService,
    private readonly session: SessionStore,
  ) {
    this.http = new HttpClient(backend);
  }

  refresh(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    const refreshToken = this.session.refreshToken;
    if (this.config.platform === 'tauri' && !refreshToken) return Promise.resolve(false);

    const requestGeneration = this.generation;
    this.refreshInFlight = this.requestRefresh(refreshToken)
      .then((result) => {
        if (requestGeneration !== this.generation) return false;
        this.session.setSession(result);
        return true;
      })
      .catch(() => {
        if (requestGeneration === this.generation) this.session.clear();
        return false;
      })
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  private async requestRefresh(
    refreshToken: string | null,
    concurrentRetries = 2,
  ): Promise<AuthResult> {
    try {
      if (this.config.platform === 'web') {
        return await firstValueFrom(
          this.http.post<AuthResult>(
            `${this.config.baseUrl()}/auth/web/refresh`,
            {},
            {
              withCredentials: true,
              headers: { 'X-POSV2-CSRF': '1' },
            },
          ),
        );
      }
      return await firstValueFrom(
        this.http.post<AuthResult>(`${this.config.baseUrl()}/auth/refresh`, { refreshToken }),
      );
    } catch (error) {
      if (concurrentRetries > 0 && error instanceof HttpErrorResponse && error.status === 409) {
        await new Promise((resolve) => setTimeout(resolve, 150));
        return this.requestRefresh(refreshToken, concurrentRetries - 1);
      }
      throw error;
    }
  }

  cancel(): void {
    this.generation += 1;
    this.refreshInFlight = null;
  }
}
