import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { RuntimeConfigService } from '../config/runtime-config';
import type { AuthResult } from '../models/api.models';
import { SessionRefreshService } from './session-refresh.service';
import { SessionStore } from './session.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly working = signal(false);
  readonly browserSessionSupported: boolean;
  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private restorePromise: Promise<boolean> | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly config: RuntimeConfigService,
    private readonly session: SessionStore,
    private readonly sessionRefresh: SessionRefreshService,
    private readonly router: Router,
  ) {
    this.browserSessionSupported = config.platform === 'web';
  }

  async login(username: string, password: string, rememberMe = false): Promise<void> {
    this.working.set(true);
    try {
      const result = await firstValueFrom(
        this.browserSessionSupported
          ? this.api.browserSessionPost<AuthResult>('/auth/web/login', {
              username,
              password,
              rememberMe,
            })
          : this.api.post<AuthResult>('/auth/login', { username, password }),
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
    try {
      if (this.browserSessionSupported) {
        await firstValueFrom(this.api.browserSessionPost<void>('/auth/web/logout'));
      } else if (refreshToken) {
        await firstValueFrom(this.api.post<void>('/auth/logout', { refreshToken }));
      }
    } catch {
      // Local logout must succeed even if the server is unavailable.
    } finally {
      this.session.clear();
      await this.router.navigateByUrl('/login');
    }
  }

  restoreBrowserSession(): Promise<boolean> {
    if (!this.browserSessionSupported) return Promise.resolve(false);
    if (!this.restorePromise) {
      this.restorePromise = this.sessionRefresh.refresh().then((restored) => {
        if (restored) this.scheduleRefresh();
        return restored;
      });
    }
    return this.restorePromise;
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
