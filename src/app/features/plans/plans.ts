import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideArchive,
  LucideChevronLeft,
  LucideChevronRight,
  LucideLayers3,
  LucidePlus,
  LucideSearch,
  LucideUpload,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  BillingInterval,
  PlanRecord,
  PlanStatus,
  PlanVersionRecord,
} from '../../core/models/api.models';
import { ToastService } from '../../core/notifications/toast.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';
import {
  FEATURE_GROUPS,
  type FeatureValues,
  featureValuesFrom,
} from '../../core/models/feature-mods';
import { FeatureEditorComponent } from '../../shared/feature-editor/feature-editor';

interface PlanForm {
  code: string;
  name: string;
  billingInterval: BillingInterval;
  amount: string;
  currency: string;
  trialDays: number;
  graceDays: number;
  maxDevices: number;
  features: FeatureValues;
}

type PlanEditorTab = 'details' | 'features' | 'review';

@Component({
  selector: 'app-plans',
  imports: [
    FormsModule,
    LucideArchive,
    LucideChevronLeft,
    LucideChevronRight,
    LucideLayers3,
    LucidePlus,
    LucideSearch,
    LucideUpload,
    LucideX,
    ConfirmDialogComponent,
    DialogFocusDirective,
    FeatureEditorComponent,
  ],
  templateUrl: './plans.html',
})
export class PlansPage implements OnInit {
  readonly plans = signal<PlanRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly editorOpen = signal(false);
  readonly archiveConfirmation = signal<PlanRecord | null>(null);
  readonly total = signal(0);
  readonly totalPages = signal(1);
  search = '';
  status: PlanStatus | '' = '';
  page = 1;
  readonly pageSize = 20;
  versioningPlan: PlanRecord | null = null;
  form: PlanForm = this.emptyForm();
  editorTab: PlanEditorTab = 'details';
  baselineFeatures: FeatureValues = featureValuesFrom();

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
        this.api.get<ApiPage<PlanRecord>>('/plans', {
          page: this.page,
          pageSize: this.pageSize,
          search: this.search.trim() || undefined,
          status: this.status || undefined,
        }),
      );
      this.plans.set(result.items);
      this.total.set(result.total);
      this.totalPages.set(result.totalPages);
    } catch (error) {
      this.toasts.show(
        'Plans could not be loaded',
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

  selectStatus(status: PlanStatus | ''): void {
    this.status = status;
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.page = page;
    void this.load();
  }

  openCreate(): void {
    this.versioningPlan = null;
    this.form = this.emptyForm();
    this.baselineFeatures = featureValuesFrom();
    this.editorTab = 'details';
    this.editorOpen.set(true);
  }

  openVersion(plan: PlanRecord): void {
    const latest = plan.versions[0];
    this.versioningPlan = plan;
    this.form = {
      ...this.emptyForm(),
      code: plan.code,
      name: plan.name,
      billingInterval: latest?.billingInterval ?? 'MONTHLY',
      amount: latest?.amount ?? '',
      currency: latest?.currency ?? 'PHP',
      trialDays: latest?.trialDays ?? 0,
      graceDays: latest?.graceDays ?? 7,
      maxDevices: latest?.maxDevices ?? 1,
      features: featureValuesFrom(latest?.features),
    };
    this.baselineFeatures = featureValuesFrom(latest?.features);
    this.editorTab = 'details';
    this.editorOpen.set(true);
  }

  closeEditor(): void {
    if (!this.saving()) this.editorOpen.set(false);
  }

  async save(): Promise<void> {
    if (!this.form.code.trim() || !this.form.name.trim() || !this.form.amount) return;
    this.saving.set(true);
    const version = {
      billingInterval: this.form.billingInterval,
      amount: this.form.amount,
      currency: this.form.currency.toUpperCase(),
      trialDays: Number(this.form.trialDays),
      graceDays: Number(this.form.graceDays),
      maxDevices: Number(this.form.maxDevices),
      features: this.form.features,
    };
    try {
      if (this.versioningPlan) {
        await firstValueFrom(
          this.api.post<PlanVersionRecord>(`/plans/${this.versioningPlan.id}/versions`, version),
        );
      } else {
        await firstValueFrom(
          this.api.post<PlanRecord>('/plans', {
            code: this.form.code.trim(),
            name: this.form.name.trim(),
            ...version,
          }),
        );
      }
      this.editorOpen.set(false);
      this.toasts.show(this.versioningPlan ? 'Plan version added' : 'Plan created', 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Plan could not be saved',
        'error',
        apiErrorMessage(error, 'Review the plan details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async publish(plan: PlanRecord): Promise<void> {
    const version = plan.versions[0];
    if (!version) return;
    try {
      await firstValueFrom(this.api.post(`/plans/${plan.id}/versions/${version.id}/publish`));
      this.toasts.show(`${plan.name} published`, 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Plan could not be published',
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
    }
  }

  archive(plan: PlanRecord): void {
    if (this.saving()) return;
    this.archiveConfirmation.set(plan);
  }

  async confirmArchive(): Promise<void> {
    const plan = this.archiveConfirmation();
    if (!plan || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.post(`/plans/${plan.id}/archive`));
      this.archiveConfirmation.set(null);
      this.editorOpen.set(false);
      this.toasts.show(`${plan.name} archived`, 'success');
      await this.load();
    } catch (error) {
      this.toasts.show('Plan could not be archived', 'error', apiErrorMessage(error, 'Try again.'));
    } finally {
      this.saving.set(false);
    }
  }

  money(version?: PlanVersionRecord): string {
    if (!version) return 'No version';
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: version.currency }).format(
      Number(version.amount),
    );
  }

  featureCount(version?: PlanVersionRecord): number {
    if (!version) return 0;
    return Object.values(featureValuesFrom(version.features)).filter(Boolean).length;
  }

  get canManage(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN');
  }

  setEditorTab(tab: PlanEditorTab): void {
    this.editorTab = tab;
  }

  updateFeatures(features: FeatureValues): void {
    this.form = { ...this.form, features };
  }

  get enabledFeatureCount(): number {
    return Object.values(this.form.features).filter(Boolean).length;
  }

  get changedFeatureLabels(): string[] {
    return FEATURE_GROUPS.flatMap((group) => group.features)
      .filter((feature) => this.baselineFeatures[feature.key] !== this.form.features[feature.key])
      .map((feature) => feature.label);
  }

  get addedFeatureLabels(): string[] {
    return FEATURE_GROUPS.flatMap((group) => group.features)
      .filter(
        (feature) =>
          this.baselineFeatures[feature.key] !== true && this.form.features[feature.key] === true,
      )
      .map((feature) => feature.label);
  }

  get removedFeatureLabels(): string[] {
    return FEATURE_GROUPS.flatMap((group) => group.features)
      .filter(
        (feature) =>
          this.baselineFeatures[feature.key] === true && this.form.features[feature.key] !== true,
      )
      .map((feature) => feature.label);
  }

  private emptyForm(): PlanForm {
    return {
      code: '',
      name: '',
      billingInterval: 'MONTHLY',
      amount: '',
      currency: 'PHP',
      trialDays: 0,
      graceDays: 7,
      maxDevices: 1,
      features: featureValuesFrom({
        reports: true,
        backups: true,
        multiUser: true,
        webDashboard: true,
      }),
    };
  }
}
