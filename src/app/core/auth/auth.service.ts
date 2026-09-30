import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import type { AuthResult } from '../models/api.models';
import { SessionRefreshService } from './session-refresh.service';
import { SessionStore } from './session.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly working = signal(false);
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly session: SessionStore,
    private readonly sessionRefresh: SessionRefreshService,
    private readonly router: Router,
  ) {}

  async login(username: string, password: string): Promise<void> {
    this.working.set(true);
    try {
      const result = await firstValueFrom(
        this.api.post<AuthResult>('/auth/login', { username, password }),
      );
      this.acceptSession(result);
      await this.router.navigateByUrl('/dashboard');
    } finally {
      this.working.set(false);
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.session.refreshToken;
    this.clearRefreshTimer();
    this.sessionRefresh.cancel();
    this.session.clear();
    await this.router.navigateByUrl('/login');
    if (refreshToken) {
      this.api.post<void>('/auth/logout', { refreshToken }).subscribe({ error: () => undefined });
    }
  }

  private acceptSession(result: AuthResult): void {
    this.session.setSession(result);
    this.scheduleRefresh();
  }

  private scheduleRefresh(): void {
    this.clearRefreshTimer();
    this.refreshTimer = setTimeout(() => void this.refresh(), 13 * 60 * 1000);
  }

  private async refresh(): Promise<void> {
    const refreshed = await this.sessionRefresh.refresh();
    if (refreshed) {
      this.scheduleRefresh();
    } else {
      await this.logout();
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = null;
  }
}
