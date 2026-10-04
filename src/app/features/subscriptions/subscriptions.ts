import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  LucideChevronLeft,
  LucideChevronRight,
  LucideCirclePause,
  LucideCreditCard,
  LucidePlus,
  LucideRefreshCw,
  LucideSearch,
  LucideShieldCheck,
  LucideTrash2,
  LucideX,
  LucideXCircle,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  ClientGroupRecord,
  ClientRecord,
  GroupSubscriptionCreateResult,
  GroupSubscriptionMemberOption,
  GroupSubscriptionOptions,
  PlanRecord,
  SubscriptionRecord,
  SubscriptionRenewalRecord,
  SubscriptionRenewalResult,
  SubscriptionStatus,
} from '../../core/models/api.models';
import { ToastService } from '../../core/notifications/toast.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';
import {
  FEATURE_MOD_KEYS,
  type FeatureValues,
  type FeatureMods,
  featureOverridesFrom,
  featureModsFrom,
  featureValuesFrom,
  webDashboardFrom,
} from '../../core/models/feature-mods';
import { FeatureEditorComponent } from '../../shared/feature-editor/feature-editor';

interface SubscriptionForm {
  clientId: string;
  planVersionId: string;
  deviceId: string;
  startsAt: string;
  expiresAt: string;
  notes: string;
  features: FeatureValues;
}

interface GroupSubscriptionMemberDraft extends GroupSubscriptionMemberOption {
  selected: boolean;
  deviceId: string;
}

type SubscriptionAction = 'activate' | 'suspend' | 'reactivate' | 'cancel' | 'renew';
type ConfirmedSubscriptionAction = Extract<SubscriptionAction, 'suspend' | 'cancel'> | 'delete';
type SubscriptionEditorTab = 'setup' | 'features';
type SubscriptionDetailTab = 'overview' | 'features' | 'renewals';
type SubscriptionCreationTarget = 'CLIENT' | 'GROUP';

interface SubscriptionConfirmation {
  subscription: SubscriptionRecord;
  action: ConfirmedSubscriptionAction;
}

interface RenewalForm {
  periodStartsAt: string;
  periodEndsAt: string;
  reason: string;
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
    LucideTrash2,
    LucideX,
    LucideXCircle,
    ConfirmDialogComponent,
    DialogFocusDirective,
    FeatureEditorComponent,
  ],
  templateUrl: './subscriptions.html',
})
export class SubscriptionsPage implements OnInit {
  readonly subscriptions = signal<SubscriptionRecord[]>([]);
  readonly clients = signal<ClientRecord[]>([]);
  readonly groups = signal<ClientGroupRecord[]>([]);
  readonly plans = signal<PlanRecord[]>([]);
  readonly groupMembers = signal<GroupSubscriptionMemberDraft[]>([]);
  readonly groupOptionsLoading = signal(false);
  readonly groupOptionsError = signal('');
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly selected = signal<SubscriptionRecord | null>(null);
  readonly actionConfirmation = signal<SubscriptionConfirmation | null>(null);
  readonly renewalTarget = signal<SubscriptionRecord | null>(null);
  readonly renewalHistory = signal<SubscriptionRenewalRecord[]>([]);
  readonly renewalHistoryLoading = signal(false);
  readonly renewalHistoryError = signal('');
  readonly lastRenewal = signal<SubscriptionRenewalRecord | null>(null);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  search = '';
  status: SubscriptionStatus | '' = '';
  page = 1;
  deviceIdDraft = '';
  featureModsDraft: FeatureMods = featureModsFrom();
  webDashboardDraft = true;
  featureValuesDraft: FeatureValues = featureValuesFrom();
  featureSavedValues: FeatureValues = featureValuesFrom();
  featureBaseline: FeatureValues = featureValuesFrom();
  createFeatureBaseline: FeatureValues = featureValuesFrom();
  editorTab: SubscriptionEditorTab = 'setup';
  detailTab: SubscriptionDetailTab = 'overview';
  clientOptionSearch = '';
  groupMemberSearch = '';
  groupId = '';
  creationTarget: SubscriptionCreationTarget = 'CLIENT';
  planOptionSearch = '';
  renewalVisibleCount = 20;
  readonly pageSize = 20;
  form: SubscriptionForm = this.emptyForm();
  renewalForm: RenewalForm = { periodStartsAt: '', periodEndsAt: '', reason: '' };
  renewalOverride = false;

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
    private readonly router: Router,
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
        if (selected) this.featureBaseline = featureValuesFrom(selected.planVersion.features);
        if (selected) this.featureValuesDraft = featureValuesFrom(selected.entitlements);
        if (selected) this.featureSavedValues = featureValuesFrom(selected.entitlements);
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
    this.createFeatureBaseline = featureValuesFrom();
    this.editorTab = 'setup';
    this.clientOptionSearch = '';
    this.groupMemberSearch = '';
    this.groupId = '';
    this.creationTarget = 'CLIENT';
    this.groupMembers.set([]);
    this.groupOptionsError.set('');
    this.planOptionSearch = '';
    this.editorOpen.set(true);
    try {
      const result = await firstValueFrom(
        forkJoin({
          clients: this.api.get<ApiPage<ClientRecord>>('/clients', {
            page: 1,
            pageSize: 100,
            status: 'ACTIVE',
          }),
          groups: this.api.get<ApiPage<ClientGroupRecord>>('/client-groups', {
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
      this.groups.set(result.groups.items);
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

  setCreationTarget(target: SubscriptionCreationTarget): void {
    if (target === 'GROUP' && !this.canAdminister) return;
    this.creationTarget = target;
    this.groupOptionsError.set('');
    if (target === 'CLIENT') {
      this.groupId = '';
      this.groupMembers.set([]);
    } else {
      this.form.clientId = '';
      this.form.deviceId = '';
    }
  }

  async groupChanged(): Promise<void> {
    this.groupMembers.set([]);
    this.groupOptionsError.set('');
    if (!this.groupId) return;
    this.groupOptionsLoading.set(true);
    try {
      const options = await firstValueFrom(
        this.api.get<GroupSubscriptionOptions>(`/subscriptions/group/${this.groupId}/options`),
      );
      this.groupMembers.set(
        options.members.map((member) => ({
          ...member,
          selected: this.groupMemberEligible(member),
          deviceId: member.suggestedDeviceId ?? '',
        })),
      );
    } catch (error) {
      this.groupOptionsError.set(apiErrorMessage(error, 'Group members could not be loaded.'));
    } finally {
      this.groupOptionsLoading.set(false);
    }
  }

  setGroupMemberSelected(clientId: string, selected: boolean): void {
    this.groupMembers.update((members) =>
      members.map((member) =>
        member.clientId === clientId && this.groupMemberEligible(member)
          ? { ...member, selected }
          : member,
      ),
    );
  }

  updateGroupMemberDevice(clientId: string, deviceId: string): void {
    this.groupMembers.update((members) =>
      members.map((member) => (member.clientId === clientId ? { ...member, deviceId } : member)),
    );
  }

  toggleAllEligibleMembers(selected: boolean): void {
    this.groupMembers.update((members) =>
      members.map((member) =>
        this.groupMemberEligible(member) ? { ...member, selected } : member,
      ),
    );
  }

  planChanged(): void {
    if (!this.form.planVersionId) return;
    const plan = this.plans().find((item) => item.versions[0]?.id === this.form.planVersionId);
    const features = featureValuesFrom(plan?.versions[0]?.features);
    this.createFeatureBaseline = features;
    this.form = { ...this.form, features };
    if (plan?.versions[0]?.billingInterval === 'CUSTOM') return;
    this.form.expiresAt = '';
  }

  async save(): Promise<void> {
    if (!this.validCreation) return;
    this.saving.set(true);
    try {
      if (this.creationTarget === 'GROUP') {
        const result = await firstValueFrom(
          this.api.post<GroupSubscriptionCreateResult>('/subscriptions/group', {
            groupId: this.groupId,
            planVersionId: this.form.planVersionId,
            members: this.selectedGroupMembers.map((member) => ({
              clientId: member.clientId,
              deviceId: member.deviceId.trim().toUpperCase(),
            })),
            startsAt: this.form.startsAt || undefined,
            expiresAt: this.form.expiresAt || undefined,
            notes: this.form.notes.trim() || undefined,
            featureOverrides: this.canAdminister
              ? featureOverridesFrom(this.createFeatureBaseline, this.form.features)
              : undefined,
            webDashboardEnabled:
              this.canAdminister &&
              this.createFeatureBaseline['webDashboard'] !== this.form.features['webDashboard']
                ? this.form.features['webDashboard']
                : undefined,
          }),
        );
        this.editorOpen.set(false);
        this.toasts.show(
          `${result.createdCount} draft subscriptions created`,
          'success',
          'Review and activate each subscription when its store is ready.',
        );
        await this.load();
        return;
      }
      await firstValueFrom(
        this.api.post<SubscriptionRecord>('/subscriptions', {
          clientId: this.form.clientId,
          planVersionId: this.form.planVersionId,
          deviceId: this.form.deviceId.trim().toUpperCase(),
          startsAt: this.form.startsAt || undefined,
          expiresAt: this.form.expiresAt || undefined,
          notes: this.form.notes.trim() || undefined,
          featureOverrides: this.canAdminister
            ? featureOverridesFrom(this.createFeatureBaseline, this.form.features)
            : undefined,
          webDashboardEnabled:
            this.canAdminister &&
            this.createFeatureBaseline['webDashboard'] !== this.form.features['webDashboard']
              ? this.form.features['webDashboard']
              : undefined,
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

  async action(subscription: SubscriptionRecord, action: SubscriptionAction): Promise<void> {
    if (action === 'cancel' || action === 'suspend') {
      this.actionConfirmation.set({ subscription, action });
      return;
    }
    if (action === 'renew') {
      this.openRenewal(subscription);
      return;
    }
    await this.performAction(subscription, action);
  }

  openRenewal(subscription: SubscriptionRecord): void {
    const periodStartsAt = this.defaultRenewalStart(subscription);
    this.renewalForm = {
      periodStartsAt,
      periodEndsAt: this.calculatePeriodEnd(periodStartsAt, subscription.billingInterval),
      reason: '',
    };
    this.renewalOverride = subscription.billingInterval === 'CUSTOM';
    this.lastRenewal.set(null);
    this.renewalTarget.set(subscription);
  }

  renewalStartChanged(): void {
    const target = this.renewalTarget();
    if (!target || target.billingInterval === 'CUSTOM') return;
    this.renewalForm.periodEndsAt = this.calculatePeriodEnd(
      this.renewalForm.periodStartsAt,
      target.billingInterval,
    );
  }

  async confirmRenewal(): Promise<void> {
    const subscription = this.renewalTarget();
    if (!subscription || !this.validRenewal || this.saving()) return;
    this.saving.set(true);
    try {
      const result = await firstValueFrom(
        this.api.post<SubscriptionRenewalResult>(`/subscriptions/${subscription.id}/renew`, {
          periodStartsAt: this.renewalOverride
            ? `${this.renewalForm.periodStartsAt}T00:00:00.000Z`
            : undefined,
          periodEndsAt:
            this.renewalOverride || subscription.billingInterval === 'CUSTOM'
              ? `${this.renewalForm.periodEndsAt}T00:00:00.000Z`
              : undefined,
          reason: this.renewalForm.reason.trim() || undefined,
        }),
      );
      this.lastRenewal.set(result.renewal);
      this.selected.set(result.subscription);
      this.subscriptions.update((items) =>
        items.map((item) => (item.id === result.subscription.id ? result.subscription : item)),
      );
      this.renewalHistory.update((items) => [result.renewal, ...items]);
      this.toasts.show('Subscription renewed', 'success', 'The original start date was preserved.');
    } catch (error) {
      this.toasts.show(
        'Subscription could not be renewed',
        'error',
        apiErrorMessage(error, 'Review the renewal period.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async recordRenewalPayment(): Promise<void> {
    const subscription = this.renewalTarget();
    const renewal = this.lastRenewal();
    if (!subscription || !renewal) return;
    await this.router.navigate(['/finance'], {
      queryParams: {
        payment: 'renewal',
        clientId: subscription.clientId,
        subscriptionId: subscription.id,
        renewalId: renewal.id,
      },
    });
  }

  async confirmAction(): Promise<void> {
    const confirmation = this.actionConfirmation();
    if (!confirmation || this.saving()) return;
    if (confirmation.action === 'delete') {
      await this.deleteSubscription(confirmation.subscription);
      return;
    }
    await this.performAction(confirmation.subscription, confirmation.action);
  }

  requestDelete(subscription: SubscriptionRecord): void {
    if (!this.canAdminister || this.saving()) return;
    this.actionConfirmation.set({ subscription, action: 'delete' });
  }

  confirmationTitle(action: ConfirmedSubscriptionAction): string {
    if (action === 'delete') return 'Delete subscription?';
    return action === 'cancel' ? 'Cancel subscription?' : 'Suspend subscription?';
  }

  confirmationDescription(action: ConfirmedSubscriptionAction): string {
    if (action === 'delete') {
      return 'This removes the subscription from the app and revokes its license and device access. Finance and audit records are retained. This cannot be undone.';
    }
    return action === 'cancel'
      ? 'This permanently ends the subscription and it cannot be reactivated.'
      : 'POS access will stop until an administrator reactivates the subscription.';
  }

  private async performAction(
    subscription: SubscriptionRecord,
    action: SubscriptionAction,
  ): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.post<SubscriptionRecord>(`/subscriptions/${subscription.id}/${action}`, {}),
      );
      this.actionConfirmation.set(null);
      this.toasts.show(`Subscription ${this.actionPastTense(action)}`, 'success');
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

  private async deleteSubscription(subscription: SubscriptionRecord): Promise<void> {
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.delete(`/subscriptions/${subscription.id}`));
      this.actionConfirmation.set(null);
      this.selected.set(null);
      this.toasts.show('Subscription deleted', 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Subscription could not be deleted',
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
    this.featureBaseline = featureValuesFrom(subscription.planVersion.features);
    this.featureValuesDraft = featureValuesFrom(subscription.entitlements);
    this.featureSavedValues = featureValuesFrom(subscription.entitlements);
    this.detailTab = 'overview';
    this.renewalVisibleCount = 20;
    this.selected.set(subscription);
    this.renewalHistory.set([]);
    void this.loadRenewals(subscription.id);
  }

  private async loadRenewals(subscriptionId: string): Promise<void> {
    this.renewalHistoryLoading.set(true);
    this.renewalHistoryError.set('');
    try {
      const history = await firstValueFrom(
        this.api.get<SubscriptionRenewalRecord[]>(`/subscriptions/${subscriptionId}/renewals`),
      );
      if (this.selected()?.id === subscriptionId) this.renewalHistory.set(history);
    } catch (error) {
      this.renewalHistory.set([]);
      this.renewalHistoryError.set(apiErrorMessage(error, 'Renewal history could not be loaded.'));
    } finally {
      this.renewalHistoryLoading.set(false);
    }
  }

  retryRenewals(): void {
    const subscription = this.selected();
    if (subscription) void this.loadRenewals(subscription.id);
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
        this.api.patch<SubscriptionRecord>(`/subscriptions/${subscription.id}/features`, {
          features: featureModsFrom(this.featureValuesDraft),
          webDashboardEnabled: this.featureValuesDraft['webDashboard'] !== false,
        }),
      );
      this.selected.set(updated);
      this.featureModsDraft = featureModsFrom(updated.entitlements);
      this.webDashboardDraft = webDashboardFrom(updated.entitlements);
      this.featureValuesDraft = featureValuesFrom(updated.entitlements);
      this.featureSavedValues = featureValuesFrom(updated.entitlements);
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

  get selectedGroupMembers(): GroupSubscriptionMemberDraft[] {
    return this.groupMembers().filter((member) => member.selected);
  }

  get validCreation(): boolean {
    if (!this.form.planVersionId) return false;
    if (this.creationTarget === 'CLIENT') return Boolean(this.form.clientId && this.validDeviceId);
    const selected = this.selectedGroupMembers;
    if (!this.groupId || selected.length === 0) return false;
    const normalizedIds = selected.map((member) => member.deviceId.trim().toUpperCase());
    return (
      normalizedIds.every((deviceId) => this.isValidDeviceId(deviceId)) &&
      new Set(normalizedIds).size === normalizedIds.length
    );
  }

  get filteredGroupMembers(): GroupSubscriptionMemberDraft[] {
    const query = this.groupMemberSearch.trim().toLowerCase();
    if (!query) return this.groupMembers();
    return this.groupMembers().filter(
      (member) =>
        member.businessName.toLowerCase().includes(query) ||
        member.code.toLowerCase().includes(query) ||
        member.ownerName?.toLowerCase().includes(query),
    );
  }

  get allEligibleMembersSelected(): boolean {
    const eligible = this.groupMembers().filter((member) => this.groupMemberEligible(member));
    return eligible.length > 0 && eligible.every((member) => member.selected);
  }

  groupMemberEligible(member: GroupSubscriptionMemberOption): boolean {
    return member.hasActiveStore && !member.currentSubscription;
  }

  groupMemberIssue(member: GroupSubscriptionMemberOption): string {
    if (!member.hasActiveStore) return 'No active store';
    if (member.currentSubscription) {
      return `${member.currentSubscription.planName} · ${member.currentSubscription.status}`;
    }
    return '';
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

  setCreateFeatures(features: FeatureValues): void {
    this.form = { ...this.form, features };
  }

  setSubscriptionFeatures(features: FeatureValues): void {
    this.featureValuesDraft = features;
    this.featureModsDraft = featureModsFrom(features);
    this.webDashboardDraft = features['webDashboard'] !== false;
  }

  get subscriptionReadOnlyKeys(): readonly string[] {
    if (!this.canAdminister) return Object.keys(this.featureValuesDraft);
    return ['reports', 'backups', 'multiUser'];
  }

  get createReadOnlyKeys(): readonly string[] {
    if (!this.canAdminister) return Object.keys(this.form.features);
    return ['reports', 'backups', 'multiUser'];
  }

  get createOverrideCount(): number {
    return (
      FEATURE_MOD_KEYS.filter((key) => this.createFeatureBaseline[key] !== this.form.features[key])
        .length +
      (this.createFeatureBaseline['webDashboard'] !== this.form.features['webDashboard'] ? 1 : 0)
    );
  }

  get subscriptionOverrideCount(): number {
    return (
      FEATURE_MOD_KEYS.filter((key) => this.featureBaseline[key] !== this.featureValuesDraft[key])
        .length +
      (this.featureBaseline['webDashboard'] !== this.featureValuesDraft['webDashboard'] ? 1 : 0)
    );
  }

  get subscriptionFeaturesDirty(): boolean {
    return Object.keys(this.featureValuesDraft).some(
      (key) => this.featureValuesDraft[key] !== this.featureSavedValues[key],
    );
  }

  get filteredClients(): ClientRecord[] {
    const query = this.clientOptionSearch.trim().toLowerCase();
    if (!query) return this.clients();
    return this.clients().filter(
      (client) =>
        client.businessName.toLowerCase().includes(query) ||
        client.code.toLowerCase().includes(query),
    );
  }

  get filteredPlans(): PlanRecord[] {
    const query = this.planOptionSearch.trim().toLowerCase();
    if (!query) return this.plans();
    return this.plans().filter(
      (plan) => plan.name.toLowerCase().includes(query) || plan.code.toLowerCase().includes(query),
    );
  }

  get visibleRenewals(): SubscriptionRenewalRecord[] {
    return this.renewalHistory().slice(0, this.renewalVisibleCount);
  }

  showOlderRenewals(): void {
    this.renewalVisibleCount += 20;
  }

  overrideCount(subscription: SubscriptionRecord): number {
    const baseline = featureValuesFrom(subscription.planVersion.features);
    const current = featureValuesFrom(subscription.entitlements);
    return (
      FEATURE_MOD_KEYS.filter((key) => baseline[key] !== current[key]).length +
      (baseline['webDashboard'] !== current['webDashboard'] ? 1 : 0)
    );
  }

  get validRenewal(): boolean {
    const target = this.renewalTarget();
    if (!target || !this.renewalForm.periodEndsAt) return false;
    if (
      new Date(`${this.renewalForm.periodEndsAt}T00:00:00.000Z`) <=
      new Date(`${this.renewalForm.periodStartsAt}T00:00:00.000Z`)
    ) {
      return false;
    }
    if (this.renewalOverride && !this.canAdminister) return false;
    return !this.renewalOverride || this.renewalForm.reason.trim().length > 0;
  }

  private isValidDeviceId(value: string): boolean {
    return /^[A-Za-z0-9][A-Za-z0-9._:-]{7,119}$/.test(value.trim());
  }

  private actionPastTense(action: SubscriptionAction): string {
    const labels: Record<SubscriptionAction, string> = {
      activate: 'activated',
      suspend: 'suspended',
      reactivate: 'reactivated',
      cancel: 'cancelled',
      renew: 'renewed',
    };
    return labels[action];
  }

  private emptyForm(): SubscriptionForm {
    return {
      clientId: '',
      planVersionId: '',
      deviceId: '',
      startsAt: new Date().toISOString().slice(0, 10),
      expiresAt: '',
      notes: '',
      features: featureValuesFrom(),
    };
  }

  private defaultRenewalStart(subscription: SubscriptionRecord): string {
    const now = new Date();
    const expiry = subscription.expiresAt ? new Date(subscription.expiresAt) : null;
    const start = expiry && expiry > now ? expiry : now;
    return start.toISOString().slice(0, 10);
  }

  private calculatePeriodEnd(
    startValue: string,
    interval: SubscriptionRecord['billingInterval'],
  ): string {
    if (!startValue || interval === 'CUSTOM') return '';
    const date = new Date(`${startValue}T00:00:00.000Z`);
    const months =
      interval === 'MONTHLY'
        ? 1
        : interval === 'QUARTERLY'
          ? 3
          : interval === 'SEMIANNUAL'
            ? 6
            : 12;
    date.setUTCMonth(date.getUTCMonth() + months);
    return date.toISOString().slice(0, 10);
  }
}
