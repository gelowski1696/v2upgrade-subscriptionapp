import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideArrowRight, LucideCreditCard } from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  ClientRecord,
  PlanRecord,
  SubscriptionRecord,
} from '../../core/models/api.models';

interface DashboardMetric {
  label: string;
  value: number;
  detail: string;
  route: string;
  tone: 'gold' | 'green' | 'amber' | 'ink';
}

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, LucideArrowRight, LucideCreditCard],
  templateUrl: './dashboard.html',
})
export class DashboardPage implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly metrics = signal<DashboardMetric[]>([]);
  readonly recent = signal<SubscriptionRecord[]>([]);

  constructor(
    private readonly api: ApiService,
    readonly session: SessionStore,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        forkJoin({
          clients: this.api.get<ApiPage<ClientRecord>>('/clients', {
            page: 1,
            pageSize: 1,
            status: 'ACTIVE',
          }),
          plans: this.api.get<ApiPage<PlanRecord>>('/plans', {
            page: 1,
            pageSize: 1,
            status: 'ACTIVE',
          }),
          active: this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
            page: 1,
            pageSize: 5,
            status: 'ACTIVE',
          }),
          grace: this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
            page: 1,
            pageSize: 1,
            status: 'GRACE',
          }),
        }),
      );
      this.metrics.set([
        {
          label: 'Active clients',
          value: result.clients.total,
          detail: 'Registered businesses',
          route: '/clients',
          tone: 'ink',
        },
        {
          label: 'Published plans',
          value: result.plans.total,
          detail: 'Available subscriptions',
          route: '/plans',
          tone: 'gold',
        },
        {
          label: 'Active subscriptions',
          value: result.active.total,
          detail: 'Currently licensed',
          route: '/subscriptions',
          tone: 'green',
        },
        {
          label: 'In grace period',
          value: result.grace.total,
          detail: 'Require attention',
          route: '/subscriptions',
          tone: 'amber',
        },
      ]);
      this.recent.set(result.active.items);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Dashboard data could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  currency(value: string, currency: string): string {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency }).format(Number(value));
  }
}
