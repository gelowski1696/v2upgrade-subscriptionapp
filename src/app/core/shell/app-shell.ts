import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideActivity,
  LucideBuilding2,
  LucideCreditCard,
  LucideLayoutDashboard,
  LucideLogOut,
  LucidePackageOpen,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../api/api.service';
import { AuthService } from '../auth/auth.service';
import { SessionStore } from '../auth/session.store';
import { RuntimeConfigService } from '../config/runtime-config';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    LucideActivity,
    RouterLink,
    RouterLinkActive,
    LucideBuilding2,
    LucideCreditCard,
    LucideLayoutDashboard,
    LucideLogOut,
    LucidePackageOpen,
  ],
  templateUrl: './app-shell.html',
})
export class AppShell implements OnInit, OnDestroy {
  readonly online = signal<boolean | null>(null);
  private healthTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    readonly session: SessionStore,
    readonly runtime: RuntimeConfigService,
    private readonly auth: AuthService,
    private readonly api: ApiService,
  ) {}

  ngOnInit(): void {
    void this.checkHealth();
    this.healthTimer = setInterval(() => void this.checkHealth(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.healthTimer) clearInterval(this.healthTimer);
  }

  logout(): void {
    void this.auth.logout();
  }

  private async checkHealth(): Promise<void> {
    try {
      await firstValueFrom(this.api.get<{ status: string }>('/health'));
      this.online.set(true);
    } catch {
      this.online.set(false);
    }
  }
}
