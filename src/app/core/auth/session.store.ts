import { Injectable, computed, signal } from '@angular/core';
import type { AuthenticatedUser, AuthResult, UserRole } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly accessTokenState = signal<string | null>(null);
  private readonly refreshTokenState = signal<string | null>(null);
  readonly user = signal<AuthenticatedUser | null>(null);
  readonly authenticated = computed(() => Boolean(this.accessTokenState() && this.user()));

  get accessToken(): string | null {
    return this.accessTokenState();
  }

  get refreshToken(): string | null {
    return this.refreshTokenState();
  }

  hasAnyRole(...roles: UserRole[]): boolean {
    const role = this.user()?.role;
    return Boolean(role && roles.includes(role));
  }

  setSession(result: AuthResult): void {
    this.accessTokenState.set(result.accessToken);
    this.refreshTokenState.set(result.refreshToken ?? null);
    this.user.set(result.user);
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.user.set(null);
  }
}
