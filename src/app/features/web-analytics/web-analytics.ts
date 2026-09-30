import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideActivity,
  LucideGauge,
  LucideRefreshCw,
  LucideShieldCheck,
  LucideTriangleAlert,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import type {
  WebAnalyticsFilterClient,
  WebAnalyticsFilterStore,
  WebAnalyticsFilters,
  WebAnalyticsOverview,
} from '../../core/models/api.models';

type AnalyticsTab = 'overview' | 'usage' | 'experience' | 'issues';

@Component({
  selector: 'app-web-analytics',
  imports: [
    FormsModule,
    LucideActivity,
    LucideGauge,
    LucideRefreshCw,
    LucideShieldCheck,
    LucideTriangleAlert,
  ],
  templateUrl: './web-analytics.html',
  styleUrl: './web-analytics.css',
})
export class WebAnalyticsPage {
  readonly tabs: ReadonlyArray<{ id: AnalyticsTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'usage', label: 'Usage' },
    { id: 'experience', label: 'Experience' },
    { id: 'issues', label: 'Issues' },
  ];
  readonly activeTab = signal<AnalyticsTab>('overview');
  readonly loading = signal(false);
  readonly filterLoading = signal(false);
  readonly error = signal('');
  readonly filterError = signal('');
  readonly data = signal<WebAnalyticsOverview | null>(null);
  readonly clients = signal<WebAnalyticsFilterClient[]>([]);
  readonly maximumPageViews = computed(() =>
    Math.max(1, ...(this.data()?.usage.map((point) => point.pageViews) ?? [1])),
  );

  from = dateOffset(-29);
  to = dateOffset(0);
  clientId = '';
  storeId = '';

  constructor(private readonly api: ApiService) {
    void this.initialize();
  }

  get availableStores(): WebAnalyticsFilterStore[] {
    return this.clients().find((client) => client.id === this.clientId)?.stores ?? [];
  }

  get scopeLabel(): string {
    const client = this.clients().find((item) => item.id === this.clientId);
    const store = client?.stores.find((item) => item.id === this.storeId);
    if (store && client) return `${client.businessName} · ${store.name}`;
    if (client) return client.businessName;
    return 'All active clients';
  }

  get invalidRange(): boolean {
    return !this.from || !this.to || this.from > this.to;
  }

  async initialize(): Promise<void> {
    await Promise.all([this.loadFilters(), this.load()]);
  }

  async loadFilters(): Promise<void> {
    this.filterLoading.set(true);
    this.filterError.set('');
    try {
      const result = await firstValueFrom(
        this.api.get<WebAnalyticsFilters>('/admin/web-analytics/filters'),
      );
      this.clients.set(result.clients);
    } catch (error) {
      this.filterError.set(apiErrorMessage(error, 'Client and store filters are unavailable.'));
    } finally {
      this.filterLoading.set(false);
    }
  }

  async load(): Promise<void> {
    if (this.invalidRange) return;
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await firstValueFrom(
        this.api.get<WebAnalyticsOverview>('/admin/web-analytics/overview', {
          from: this.from,
          to: this.to,
          clientId: this.clientId || undefined,
          storeId: this.storeId || undefined,
        }),
      );
      this.data.set(result);
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Website analytics could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  clientChanged(): void {
    this.storeId = '';
  }

  selectTab(tab: AnalyticsTab): void {
    this.activeTab.set(tab);
  }

  handleTabKeydown(event: KeyboardEvent, current: AnalyticsTab): void {
    const currentIndex = this.tabs.findIndex((tab) => tab.id === current);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % this.tabs.length;
    else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + this.tabs.length) % this.tabs.length;
    } else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = this.tabs.length - 1;
    else return;

    event.preventDefault();
    const next = this.tabs[nextIndex];
    if (!next) return;
    this.activeTab.set(next.id);
    const buttons = (
      event.currentTarget as HTMLElement
    ).parentElement?.querySelectorAll<HTMLElement>('[role="tab"]');
    buttons?.[nextIndex]?.focus();
  }

  setPreset(days: number): void {
    this.to = dateOffset(0);
    this.from = dateOffset(-(days - 1));
    void this.load();
  }

  barHeight(value: number): number {
    if (!value) return 0;
    return Math.max(5, Math.round((value / this.maximumPageViews()) * 100));
  }

  dayLabel(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${value}T00:00:00.000Z`));
  }

  timestamp(value: string): string {
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value));
  }

  uptime(seconds: number): string {
    const days = Math.floor(seconds / 86_400);
    const hours = Math.floor((seconds % 86_400) / 3_600);
    if (days) return `${days}d ${hours}h`;
    const minutes = Math.max(1, Math.floor(seconds / 60));
    return `${minutes}m`;
  }

  collectionLabel(state: WebAnalyticsOverview['collection']['state']): string {
    return state === 'ACTIVE' ? 'Active' : state === 'PARTIAL' ? 'Partial' : 'Disabled';
  }

  label(value: string): string {
    return value
      .replace(/^\/dashboard\//, '')
      .replaceAll('-', ' ')
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  vitalValue(metric: WebAnalyticsOverview['performance'][number]): string {
    if (metric.metricName === 'CLS') return metric.p75.toFixed(3);
    return `${Math.round(metric.p75)} ms`;
  }

  vitalTone(metric: WebAnalyticsOverview['performance'][number]): string {
    const good =
      (metric.metricName === 'LCP' && metric.p75 <= 2500) ||
      (metric.metricName === 'INP' && metric.p75 <= 200) ||
      (metric.metricName === 'CLS' && metric.p75 <= 0.1);
    if (good) return 'text-success-700';
    const needsWork =
      (metric.metricName === 'LCP' && metric.p75 <= 4000) ||
      (metric.metricName === 'INP' && metric.p75 <= 500) ||
      (metric.metricName === 'CLS' && metric.p75 <= 0.25);
    return needsWork ? 'text-warning-700' : 'text-danger-700';
  }

  trackName(_index: number, item: { name: string }): string {
    return item.name;
  }
}

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
