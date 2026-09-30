import { HttpBackend, HttpClient } from '@angular/common/http';
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
    if (!refreshToken) return Promise.resolve(false);

    const requestGeneration = this.generation;
    this.refreshInFlight = firstValueFrom(
      this.http.post<AuthResult>(`${this.config.baseUrl()}/auth/refresh`, { refreshToken }),
    )
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

  cancel(): void {
    this.generation += 1;
    this.refreshInFlight = null;
  }
}
