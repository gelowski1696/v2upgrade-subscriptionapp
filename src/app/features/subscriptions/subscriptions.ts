import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideCirclePause,
  LucideCreditCard,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideShieldCheck,
  LucideX,
  LucideXCircle,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  ClientRecord,
  PlanRecord,
  SubscriptionRecord,
  SubscriptionStatus,
} from '../../core/models/api.models';
import { ToastService } from '../../core/notifications/toast.service';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';
import {
  FEATURE_MOD_GROUPS,
  type FeatureMods,
  featureModsFrom,
  webDashboardFrom,
} from '../../core/models/feature-mods';

interface SubscriptionForm {
  clientId: string;
  planVersionId: string;
  deviceId: string;
  startsAt: string;
  expiresAt: string;
  notes: string;
}

@Component({
  selector: 'app-subscriptions',
  imports: [
    FormsModule,
    LucideChevronLeft,
    LucideChevronRight,
    LucideCirclePause,
    LucideCreditCard,
    LucidePlus,
    LucideRefreshCw,
    LucideSearch,
    LucideShieldCheck,
    LucideX,
    LucideXCircle,
    DialogFocusDirective,
  ],
  templateUrl: './subscriptions.html',
})
export class SubscriptionsPage implements OnInit {
  readonly featureModGroups = FEATURE_MOD_GROUPS;
  readonly subscriptions = signal<SubscriptionRecord[]>([]);
  readonly clients = signal<ClientRecord[]>([]);
  readonly plans = signal<PlanRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly selected = signal<SubscriptionRecord | null>(null);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  search = '';
  status: SubscriptionStatus | '' = '';
  page = 1;
  deviceIdDraft = '';
  featureModsDraft: FeatureMods = featureModsFrom();
  webDashboardDraft = true;
  readonly pageSize = 20;
  form: SubscriptionForm = this.emptyForm();

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
  ) {}

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const result = await firstValueFrom(
        this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
          page: this.page,
          pageSize: this.pageSize,
          search: this.search.trim() || undefined,
          status: this.status || undefined,
        }),
      );
      this.subscriptions.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
      const selectedId = this.selected()?.id;
      if (selectedId) {
        const selected = result.items.find((item) => item.id === selectedId) ?? null;
        this.selected.set(selected);
        if (selected) this.deviceIdDraft = selected.device?.installationId ?? '';
        if (selected) this.featureModsDraft = featureModsFrom(selected.entitlements);
        if (selected) this.webDashboardDraft = webDashboardFrom(selected.entitlements);
      }
    } catch (error) {
      this.toasts.show(
        'Subscriptions could not be loaded',
        'error',
        apiErrorMessage(error, 'Check the server connection.'),
      );
    } finally {
      this.loading.set(false);
    }
  }

  applyFilters(): void {
    this.page = 1;
    void this.load();
  }

  selectStatus(status: SubscriptionStatus | ''): void {
    this.status = status;
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page = page;
    void this.load();
  }

  async openCreate(): Promise<void> {
    this.form = this.emptyForm();
    this.editorOpen.set(true);
    try {
      const result = await firstValueFrom(
        forkJoin({
          clients: this.api.get<ApiPage<ClientRecord>>('/clients', {
            page: 1,
            pageSize: 100,
            status: 'ACTIVE',
          }),
          plans: this.api.get<ApiPage<PlanRecord>>('/plans', {
            page: 1,
            pageSize: 100,
            status: 'ACTIVE',
          }),
        }),
      );
      this.clients.set(result.clients.items);
      this.plans.set(result.plans.items.filter((plan) => plan.versions[0]?.publishedAt));
    } catch (error) {
      this.toasts.show(
        'Form options could not be loaded',
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
      this.editorOpen.set(false);
    }
  }

  planChanged(): void {
    if (!this.form.planVersionId) return;
    const plan = this.plans().find((item) => item.versions[0]?.id === this.form.planVersionId);
    if (plan?.versions[0]?.billingInterval === 'CUSTOM') return;
    this.form.expiresAt = '';
  }

  async save(): Promise<void> {
    if (!this.form.clientId || !this.form.planVersionId || !this.validDeviceId) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.post<SubscriptionRecord>('/subscriptions', {
          clientId: this.form.clientId,
          planVersionId: this.form.planVersionId,
          deviceId: this.form.deviceId.trim().toUpperCase(),
          startsAt: this.form.startsAt || undefined,
          expiresAt: this.form.expiresAt || undefined,
          notes: this.form.notes.trim() || undefined,
        }),
      );
      this.editorOpen.set(false);
      this.toasts.show('Subscription created', 'success', 'Activate it when the client is ready.');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Subscription could not be created',
        'error',
        apiErrorMessage(error, 'Review the subscription details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async action(
    subscription: SubscriptionRecord,
    action: 'activate' | 'suspend' | 'reactivate' | 'cancel' | 'renew',
  ): Promise<void> {
    if (action === 'cancel') {
      if (
        !window.confirm(
          `Cancel the subscription for ${subscription.client.businessName}? This cannot be reactivated.`,
        )
      )
        return;
    }
    if (action === 'suspend') {
      if (
        !window.confirm(
          `Suspend the subscription for ${subscription.client.businessName}? POS access will stop until it is reactivated.`,
        )
      )
        return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.post<SubscriptionRecord>(`/subscriptions/${subscription.id}/${action}`, {}),
      );
      this.toasts.show(
        `Subscription ${action === 'reactivate' ? 'reactivated' : action + 'd'}`,
        'success',
      );
      await this.load();
      if (this.selected()) {
        const refreshed = await firstValueFrom(
          this.api.get<SubscriptionRecord>(`/subscriptions/${subscription.id}`),
        );
        this.selected.set(refreshed);
        this.deviceIdDraft = refreshed.device?.installationId ?? '';
        this.featureModsDraft = featureModsFrom(refreshed.entitlements);
        this.webDashboardDraft = webDashboardFrom(refreshed.entitlements);
      }
    } catch (error) {
      this.toasts.show(
        'Action could not be completed',
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  openDetails(subscription: SubscriptionRecord): void {
    this.deviceIdDraft = subscription.device?.installationId ?? '';
    this.featureModsDraft = featureModsFrom(subscription.entitlements);
    this.webDashboardDraft = webDashboardFrom(subscription.entitlements);
    this.selected.set(subscription);
  }

  async updateWebDashboard(subscription: SubscriptionRecord): Promise<void> {
    if (!this.canAdminister || this.saving()) return;
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.patch<SubscriptionRecord>(`/subscriptions/${subscription.id}/web-dashboard`, {
          enabled: this.webDashboardDraft,
        }),
      );
      this.selected.set(updated);
      this.webDashboardDraft = webDashboardFrom(updated.entitlements);
      this.subscriptions.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      this.toasts.show(
        this.webDashboardDraft ? 'Web dashboard enabled' : 'Web dashboard disabled',
        'success',
        this.webDashboardDraft
          ? 'Desktop sync and web-user access are available.'
          : 'Desktop sync, web-user access, and portal sessions are blocked.',
      );
    } catch (error) {
      this.toasts.show(
        'Web dashboard access could not be updated',
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async updateFeatureMods(subscription: SubscriptionRecord): Promise<void> {
    if (!this.canAdminister || this.saving()) return;
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.patch<SubscriptionRecord>(`/subscriptions/${subscription.id}/feature-mods`, {
          features: this.featureModsDraft,
        }),
      );
      this.selected.set(updated);
      this.featureModsDraft = featureModsFrom(updated.entitlements);
      this.subscriptions.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      this.toasts.show(
        'Feature mods updated',
        'success',
        'The POS applies them on its next license check; the web dashboard uses them immediately.',
      );
    } catch (error) {
      this.toasts.show(
        'Feature mods could not be updated',
        'error',
        apiErrorMessage(error, 'Review the selected features and try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async updateDevice(subscription: SubscriptionRecord): Promise<void> {
    if (!this.validDeviceIdDraft || this.saving()) return;
    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.api.patch<SubscriptionRecord>(`/subscriptions/${subscription.id}/device`, {
          deviceId: this.deviceIdDraft.trim().toUpperCase(),
        }),
      );
      this.selected.set(updated);
      this.deviceIdDraft = updated.device?.installationId ?? '';
      this.subscriptions.update((items) =>
        items.map((item) => (item.id === updated.id ? updated : item)),
      );
      this.toasts.show(
        'Device ID updated',
        'success',
        'The POS can now validate this subscription.',
      );
    } catch (error) {
      this.toasts.show(
        'Device ID could not be updated',
        'error',
        apiErrorMessage(error, 'Check that the Device ID is not assigned elsewhere.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  money(subscription: SubscriptionRecord): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: subscription.currency,
    }).format(Number(subscription.amount));
  }

  date(value: string | null): string {
    return value
      ? new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(value))
      : 'Not set';
  }

  statusClasses(status: SubscriptionStatus): string {
    if (status === 'ACTIVE') return 'bg-success-100 text-success-700';
    if (status === 'GRACE' || status === 'TRIAL') return 'bg-warning-100 text-warning-700';
    if (status === 'SUSPENDED' || status === 'CANCELLED' || status === 'EXPIRED')
      return 'bg-danger-100 text-danger-700';
    return 'bg-champagne-200 text-ink-600';
  }

  get validDeviceId(): boolean {
    return this.isValidDeviceId(this.form.deviceId);
  }

  get validDeviceIdDraft(): boolean {
    return this.isValidDeviceId(this.deviceIdDraft);
  }

  get canOperate(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN', 'OPERATOR');
  }

  get canAdminister(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN');
  }

  private isValidDeviceId(value: string): boolean {
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(value.trim());
  }

  private emptyForm(): SubscriptionForm {
    return {
      clientId: '',
      planVersionId: '',
      deviceId: '',
      startsAt: new Date().toISOString().slice(0, 10),
      expiresAt: '',
      notes: '',
    };
  }
}
