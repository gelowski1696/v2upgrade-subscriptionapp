import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  LucideBan,
  LucideChartColumn,
  LucideCircleAlert,
  LucideCircleDollarSign,
  LucideEye,
  LucideMail,
  LucidePlus,
  LucideReceiptText,
  LucideTrash2,
  LucideSend,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  BillingStatementPreview,
  BillingStatementSendResult,
  BillingStatementTarget,
  ClientGroupRecord,
  ClientRecord,
  ExpenseCategory,
  ExpenseRecord,
  FinanceOverview,
  PaymentPurpose,
  PaymentRecord,
  SubscriptionRecord,
  SubscriptionRenewalRecord,
} from '../../core/models/api.models';
import { ToastService } from '../../core/notifications/toast.service';
import { DialogFocusDirective } from '../../shared/dialog-focus.directive';

interface ChartPoint {
  label: string;
  revenue: number;
  expenses: number;
}

interface ExpenseForm {
  category: ExpenseCategory;
  description: string;
  amount: string;
  incurredAt: string;
  vendor: string;
  reference: string;
  notes: string;
}

interface PaymentForm {
  target: 'CLIENT' | 'GROUP';
  clientId: string;
  groupId: string;
  purpose: PaymentPurpose;
  subscriptionId: string;
  renewalId: string;
  description: string;
  amount: string;
  paidAt: string;
  reference: string;
  notes: string;
}

interface GroupPaymentAllocation {
  clientId: string;
  businessName: string;
  code: string;
  selected: boolean;
  subscriptionId: string;
  renewalId: string;
  amount: string;
}

interface BillingStatementForm {
  targetType: BillingStatementTarget;
  targetId: string;
  recipientEmail: string;
  rememberEmail: boolean;
  statementDate: string;
  dueDate: string;
  subject: string;
  message: string;
}

type FinanceTab = 'overview' | 'payments' | 'expenses';
type ConfirmationState =
  { kind: 'expense'; expense: ExpenseRecord } | { kind: 'payment'; payment: PaymentRecord };

@Component({
  selector: 'app-finance',
  imports: [
    FormsModule,
    LucideBan,
    LucideChartColumn,
    LucideCircleAlert,
    LucideCircleDollarSign,
    LucideEye,
    LucideMail,
    LucidePlus,
    LucideReceiptText,
    LucideTrash2,
    LucideSend,
    LucideX,
    DialogFocusDirective,
  ],
  templateUrl: './finance.html',
  styleUrl: './finance.css',
})
export class FinancePage implements OnInit {
  readonly tabs: ReadonlyArray<{ id: FinanceTab; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'payments', label: 'Payments' },
    { id: 'expenses', label: 'Expenses' },
  ];
  readonly activeTab = signal<FinanceTab>('overview');
  readonly categories: Array<{ value: ExpenseCategory; label: string }> = [
    { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'OPERATIONS', label: 'Operations' },
    { value: 'PROFESSIONAL_SERVICES', label: 'Professional services' },
    { value: 'TAXES', label: 'Taxes' },
    { value: 'OTHER', label: 'Other' },
  ];
  readonly paymentPurposes: Array<{ value: PaymentPurpose; label: string }> = [
    { value: 'INITIAL', label: 'Initial payment' },
    { value: 'RENEWAL', label: 'Renewal' },
    { value: 'MODIFICATION', label: 'Modification' },
    { value: 'OTHER', label: 'Other' },
  ];
  readonly overview = signal<FinanceOverview | null>(null);
  readonly expenses = signal<ExpenseRecord[]>([]);
  readonly payments = signal<PaymentRecord[]>([]);
  readonly subscriptions = signal<SubscriptionRecord[]>([]);
  readonly clients = signal<ClientRecord[]>([]);
  readonly groups = signal<ClientGroupRecord[]>([]);
  readonly renewals = signal<SubscriptionRenewalRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly expenseOpen = signal(false);
  readonly paymentOpen = signal(false);
  readonly billingOpen = signal(false);
  readonly billingLoading = signal(false);
  readonly billingPreview = signal<BillingStatementPreview | null>(null);
  readonly billingError = signal('');
  readonly selectedExpense = signal<ExpenseRecord | null>(null);
  readonly selectedPayment = signal<PaymentRecord | null>(null);
  readonly groupClientsLoading = signal(false);
  readonly groupAllocations = signal<GroupPaymentAllocation[]>([]);
  readonly confirmation = signal<ConfirmationState | null>(null);
  readonly chart = computed(() => this.chartPoints(this.overview()?.daily ?? []));
  readonly chartMaximum = computed(() =>
    Math.max(1, ...this.chart().flatMap((point) => [point.revenue, point.expenses])),
  );
  readonly paymentSubscriptions = computed(() =>
    this.subscriptions().filter((item) => item.clientId === this.paymentForm.clientId),
  );
  currency = 'PHP';
  from = '';
  to = '';
  groupFilter = '';
  purposeFilter: PaymentPurpose | '' = '';
  expenseForm = this.emptyExpense();
  paymentForm = this.emptyPayment();
  billingForm = this.emptyBillingStatement();
  groupDefaultAmount = '';
  voidReason = '';
  private handledPaymentLink = false;

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {
    this.setPreset(30, false);
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const params = {
        from: this.from,
        to: this.to,
        currency: this.currency,
      };
      const result = await firstValueFrom(
        forkJoin({
          overview: this.api.get<FinanceOverview>('/finance/overview', params),
          expenses: this.api.get<ApiPage<ExpenseRecord>>('/finance/expenses', {
            from: this.from,
            to: this.to,
            currency: this.currency,
            page: 1,
            pageSize: 100,
          }),
          payments: this.api.get<ApiPage<PaymentRecord>>('/finance/payments', {
            ...params,
            groupId: this.groupFilter || undefined,
            purpose: this.purposeFilter || undefined,
            page: 1,
            pageSize: 100,
          }),
          subscriptions: this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
            page: 1,
            pageSize: 100,
          }),
          clients: this.api.get<ApiPage<ClientRecord>>('/clients', {
            page: 1,
            pageSize: 100,
          }),
          groups: this.api.get<ApiPage<ClientGroupRecord>>('/client-groups', {
            page: 1,
            pageSize: 100,
          }),
        }),
      );
      this.overview.set(result.overview);
      this.expenses.set(result.expenses.items);
      this.payments.set(result.payments.items);
      const subscriptions = [...result.subscriptions.items];
      for (let page = 2; page <= result.subscriptions.totalPages; page += 1) {
        const nextPage = await firstValueFrom(
          this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
            page,
            pageSize: 100,
          }),
        );
        subscriptions.push(...nextPage.items);
      }
      this.subscriptions.set(subscriptions);
      this.clients.set(result.clients.items);
      this.groups.set(result.groups.items);
      await this.openLinkedPayment();
    } catch (error) {
      this.error.set(apiErrorMessage(error, 'Finance data could not be loaded.'));
    } finally {
      this.loading.set(false);
    }
  }

  setPreset(days: number, reload = true): void {
    const end = new Date();
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - days + 1),
    );
    this.from = start.toISOString().slice(0, 10);
    this.to = end.toISOString().slice(0, 10);
    if (reload) void this.load();
  }

  openExpense(): void {
    this.activeTab.set('expenses');
    this.expenseForm = this.emptyExpense();
    this.expenseOpen.set(true);
  }

  openPayment(): void {
    this.activeTab.set('payments');
    this.paymentForm = this.emptyPayment();
    this.groupAllocations.set([]);
    this.groupDefaultAmount = '';
    this.paymentOpen.set(true);
  }

  openBillingStatement(): void {
    this.billingForm = this.emptyBillingStatement();
    this.billingPreview.set(null);
    this.billingError.set('');
    this.billingOpen.set(true);
  }

  closeBillingStatement(): void {
    if (this.saving()) return;
    this.billingOpen.set(false);
    this.billingPreview.set(null);
    this.billingError.set('');
  }

  billingTargetTypeChanged(targetType: BillingStatementTarget): void {
    this.billingForm.targetType = targetType;
    this.billingForm.targetId = '';
    this.billingForm.recipientEmail = '';
    this.billingForm.subject = '';
    this.billingPreview.set(null);
    this.billingError.set('');
  }

  async billingTargetChanged(): Promise<void> {
    const targetType = this.billingForm.targetType;
    const targetId = this.billingForm.targetId;
    this.billingPreview.set(null);
    this.billingError.set('');
    this.billingForm.recipientEmail = '';
    this.billingForm.subject = '';
    if (!targetId) return;

    this.billingLoading.set(true);
    try {
      const preview = await firstValueFrom(
        this.api.get<BillingStatementPreview>('/finance/billing-statements/preview', {
          targetType,
          targetId,
        }),
      );
      if (this.billingForm.targetType !== targetType || this.billingForm.targetId !== targetId) {
        return;
      }
      this.billingPreview.set(preview);
      this.billingForm.recipientEmail = preview.savedRecipientEmail ?? '';
      this.billingForm.subject = preview.defaultSubject;
    } catch (error) {
      this.billingError.set(
        apiErrorMessage(error, 'The billing statement preview could not be prepared.'),
      );
    } finally {
      this.billingLoading.set(false);
    }
  }

  async sendBillingStatement(): Promise<void> {
    if (!this.validBillingStatement || this.saving()) return;
    this.saving.set(true);
    this.billingError.set('');
    try {
      const result = await firstValueFrom(
        this.api.post<BillingStatementSendResult>('/finance/billing-statements/send', {
          targetType: this.billingForm.targetType,
          targetId: this.billingForm.targetId,
          recipientEmail: this.billingForm.recipientEmail.trim(),
          rememberEmail: this.billingForm.rememberEmail,
          statementDate: this.billingForm.statementDate,
          dueDate: this.billingForm.dueDate || undefined,
          subject: this.billingForm.subject.trim(),
          message: this.billingForm.message.trim() || undefined,
        }),
      );
      this.billingOpen.set(false);
      this.billingPreview.set(null);
      this.toasts.show(
        'Billing statement sent',
        'success',
        `${result.statementNumber} was sent to ${result.recipientEmail}.`,
      );
    } catch (error) {
      this.billingError.set(
        apiErrorMessage(error, 'The billing statement could not be sent. Try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  viewExpense(expense: ExpenseRecord): void {
    this.selectedPayment.set(null);
    this.selectedExpense.set(expense);
  }

  viewPayment(payment: PaymentRecord): void {
    this.selectedExpense.set(null);
    this.selectedPayment.set(payment);
  }

  closeRecordDetails(): void {
    this.selectedExpense.set(null);
    this.selectedPayment.set(null);
  }

  paymentTargetChanged(target: 'CLIENT' | 'GROUP'): void {
    this.paymentForm.target = target;
    this.paymentForm.clientId = '';
    this.paymentForm.groupId = '';
    this.paymentForm.subscriptionId = '';
    this.paymentForm.renewalId = '';
    this.paymentForm.amount = '';
    this.groupDefaultAmount = '';
    this.groupAllocations.set([]);
    this.renewals.set([]);
  }

  paymentClientChanged(): void {
    this.paymentForm.subscriptionId = '';
    this.paymentForm.renewalId = '';
    this.paymentForm.amount = '';
    this.renewals.set([]);
  }

  paymentPurposeChanged(): void {
    if (this.paymentForm.purpose !== 'RENEWAL') this.paymentForm.renewalId = '';
    if (this.paymentForm.target === 'GROUP') {
      this.groupAllocations.update((allocations) =>
        allocations.map((allocation) => {
          const subscription = this.preferredSubscription(allocation.clientId);
          return {
            ...allocation,
            subscriptionId:
              this.paymentForm.purpose === 'RENEWAL'
                ? (subscription?.id ?? '')
                : allocation.subscriptionId,
            amount:
              this.paymentForm.purpose === 'RENEWAL' && subscription
                ? subscription.amount
                : allocation.amount,
          };
        }),
      );
    }
  }

  async paymentGroupChanged(): Promise<void> {
    const groupId = this.paymentForm.groupId;
    this.groupAllocations.set([]);
    this.groupDefaultAmount = '';
    if (!groupId) return;

    this.groupClientsLoading.set(true);
    try {
      const firstPage = await firstValueFrom(
        this.api.get<ApiPage<ClientRecord>>('/clients', {
          groupId,
          status: 'ACTIVE',
          page: 1,
          pageSize: 100,
        }),
      );
      const clients = [...firstPage.items];
      for (let page = 2; page <= firstPage.totalPages; page += 1) {
        const nextPage = await firstValueFrom(
          this.api.get<ApiPage<ClientRecord>>('/clients', {
            groupId,
            status: 'ACTIVE',
            page,
            pageSize: 100,
          }),
        );
        clients.push(...nextPage.items);
      }
      if (this.paymentForm.groupId !== groupId) return;
      this.groupAllocations.set(
        clients.map((client) => {
          const subscription = this.preferredSubscription(client.id);
          return {
            clientId: client.id,
            businessName: client.businessName,
            code: client.code,
            selected: true,
            subscriptionId: this.paymentForm.purpose === 'RENEWAL' ? (subscription?.id ?? '') : '',
            renewalId: '',
            amount: this.paymentForm.purpose === 'RENEWAL' ? (subscription?.amount ?? '') : '',
          };
        }),
      );
    } catch (error) {
      this.toasts.show(
        'Group clients could not be loaded',
        'error',
        apiErrorMessage(error, 'Try selecting the group again.'),
      );
    } finally {
      this.groupClientsLoading.set(false);
    }
  }

  groupSubscriptions(clientId: string): SubscriptionRecord[] {
    return this.subscriptions().filter((subscription) => subscription.clientId === clientId);
  }

  groupSubscriptionChanged(allocation: GroupPaymentAllocation): void {
    const subscription = this.subscriptions().find((item) => item.id === allocation.subscriptionId);
    allocation.renewalId = '';
    if (subscription && !allocation.amount) allocation.amount = subscription.amount;
  }

  toggleAllGroupClients(selected: boolean): void {
    this.groupAllocations.update((allocations) =>
      allocations.map((allocation) => ({ ...allocation, selected })),
    );
  }

  applyGroupDefaultAmount(): void {
    if (Number(this.groupDefaultAmount) <= 0) return;
    this.groupAllocations.update((allocations) =>
      allocations.map((allocation) =>
        allocation.selected ? { ...allocation, amount: this.groupDefaultAmount } : allocation,
      ),
    );
  }

  async paymentSubscriptionChanged(): Promise<void> {
    const subscription = this.subscriptions().find(
      (item) => item.id === this.paymentForm.subscriptionId,
    );
    this.paymentForm.renewalId = '';
    this.renewals.set([]);
    if (subscription) {
      this.paymentForm.clientId = subscription.clientId;
      this.paymentForm.amount = subscription.amount;
      if (this.paymentForm.purpose === 'RENEWAL') {
        try {
          this.renewals.set(
            await firstValueFrom(
              this.api.get<SubscriptionRenewalRecord[]>(
                `/subscriptions/${subscription.id}/renewals`,
              ),
            ),
          );
        } catch {
          this.renewals.set([]);
        }
      }
    }
  }

  async saveExpense(): Promise<void> {
    if (!this.validExpense || this.saving()) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.api.post<ExpenseRecord>('/finance/expenses', {
          ...this.expenseForm,
          description: this.expenseForm.description.trim(),
          incurredAt: `${this.expenseForm.incurredAt}T00:00:00.000Z`,
          currency: this.currency,
          vendor: this.expenseForm.vendor.trim() || undefined,
          reference: this.expenseForm.reference.trim() || undefined,
          notes: this.expenseForm.notes.trim() || undefined,
        }),
      );
      this.expenseOpen.set(false);
      this.toasts.show('Expense recorded', 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Expense could not be recorded',
        'error',
        apiErrorMessage(error, 'Review the expense details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  async savePayment(): Promise<void> {
    if (!this.validPayment || this.saving()) return;
    this.saving.set(true);
    try {
      if (this.paymentForm.target === 'GROUP') {
        const allocations = this.selectedGroupAllocations.map((allocation) => ({
          clientId: allocation.clientId,
          subscriptionId: allocation.subscriptionId || undefined,
          renewalId: allocation.renewalId || undefined,
          amount: allocation.amount,
        }));
        await firstValueFrom(
          this.api.post('/finance/payments/group', {
            groupId: this.paymentForm.groupId,
            purpose: this.paymentForm.purpose,
            allocations,
            description: this.paymentForm.description.trim() || undefined,
            paidAt: `${this.paymentForm.paidAt}T00:00:00.000Z`,
            currency: this.currency,
            reference: this.paymentForm.reference.trim() || undefined,
            notes: this.paymentForm.notes.trim() || undefined,
          }),
        );
        this.toasts.show(`Group payment recorded for ${allocations.length} clients`, 'success');
      } else {
        await firstValueFrom(
          this.api.post('/finance/payments', {
            clientId: this.paymentForm.clientId,
            purpose: this.paymentForm.purpose,
            subscriptionId: this.paymentForm.subscriptionId || undefined,
            renewalId: this.paymentForm.renewalId || undefined,
            description: this.paymentForm.description.trim() || undefined,
            amount: this.paymentForm.amount,
            paidAt: `${this.paymentForm.paidAt}T00:00:00.000Z`,
            currency: this.currency,
            reference: this.paymentForm.reference.trim() || undefined,
            notes: this.paymentForm.notes.trim() || undefined,
          }),
        );
        this.toasts.show('Payment recorded', 'success');
      }
      this.paymentOpen.set(false);
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Payment could not be recorded',
        'error',
        apiErrorMessage(error, 'Review the payment details.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  requestDeleteExpense(expense: ExpenseRecord): void {
    if (!this.canAdminister || this.saving()) return;
    this.voidReason = '';
    this.confirmation.set({ kind: 'expense', expense });
  }

  requestVoidPayment(payment: PaymentRecord): void {
    if (!this.canAdminister || this.saving() || payment.status === 'VOIDED') return;
    this.voidReason = '';
    this.confirmation.set({ kind: 'payment', payment });
  }

  closeConfirmation(): void {
    if (this.saving()) return;
    this.confirmation.set(null);
    this.voidReason = '';
  }

  async confirmDestructiveAction(): Promise<void> {
    const confirmation = this.confirmation();
    if (!confirmation || !this.validConfirmation || this.saving()) return;
    this.saving.set(true);
    try {
      if (confirmation.kind === 'expense') {
        await firstValueFrom(this.api.delete(`/finance/expenses/${confirmation.expense.id}`));
        this.toasts.show('Expense deleted', 'success');
      } else {
        await firstValueFrom(
          this.api.post(`/finance/payments/${confirmation.payment.id}/void`, {
            reason: this.voidReason.trim(),
          }),
        );
        this.toasts.show('Payment voided', 'success');
      }
      this.confirmation.set(null);
      this.voidReason = '';
      await this.load();
    } catch (error) {
      const subject = confirmation.kind === 'expense' ? 'Expense' : 'Payment';
      this.toasts.show(
        `${subject} could not be updated`,
        'error',
        apiErrorMessage(error, 'Try again.'),
      );
    } finally {
      this.saving.set(false);
    }
  }

  money(value: number | string): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: this.currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  date(value: string): string {
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeZone: 'UTC' }).format(
      new Date(value),
    );
  }

  categoryLabel(value: ExpenseCategory): string {
    return this.categories.find((category) => category.value === value)?.label ?? value;
  }

  paymentPurposeLabel(value: PaymentPurpose): string {
    return this.paymentPurposes.find((purpose) => purpose.value === value)?.label ?? value;
  }

  barHeight(value: number): string {
    if (!value) return '0%';
    return `${Math.max(3, (value / this.chartMaximum()) * 100)}%`;
  }

  selectTab(tab: FinanceTab): void {
    this.activeTab.set(tab);
  }

  handleTabKeydown(event: KeyboardEvent, current: FinanceTab): void {
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

  get canAdminister(): boolean {
    return this.session.hasAnyRole('SUPER_ADMIN', 'ADMIN');
  }

  get validExpense(): boolean {
    return (
      this.expenseForm.description.trim().length > 0 &&
      Number(this.expenseForm.amount) > 0 &&
      Boolean(this.expenseForm.incurredAt)
    );
  }

  get validPayment(): boolean {
    const validTarget =
      this.paymentForm.target === 'GROUP'
        ? Boolean(this.paymentForm.groupId) &&
          this.selectedGroupAllocations.length > 0 &&
          this.selectedGroupAllocations.every(
            (allocation) =>
              Number(allocation.amount) > 0 &&
              (this.paymentForm.purpose !== 'RENEWAL' || Boolean(allocation.subscriptionId)),
          )
        : Boolean(this.paymentForm.clientId) &&
          Number(this.paymentForm.amount) > 0 &&
          (this.paymentForm.purpose !== 'RENEWAL' || Boolean(this.paymentForm.subscriptionId));
    return (
      validTarget &&
      Boolean(this.paymentForm.paidAt) &&
      (!['MODIFICATION', 'OTHER'].includes(this.paymentForm.purpose) ||
        this.paymentForm.description.trim().length > 0)
    );
  }

  get validBillingStatement(): boolean {
    const preview = this.billingPreview();
    return Boolean(
      preview?.emailConfigured &&
      this.billingForm.targetId &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.billingForm.recipientEmail.trim()) &&
      this.billingForm.statementDate &&
      (!this.billingForm.dueDate || this.billingForm.dueDate >= this.billingForm.statementDate) &&
      this.billingForm.subject.trim(),
    );
  }

  billingMoney(value: number | string, currency: string): string {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(Number(value));
  }

  get selectedGroupAllocations(): GroupPaymentAllocation[] {
    return this.groupAllocations().filter((allocation) => allocation.selected);
  }

  get groupPaymentTotal(): number {
    return this.selectedGroupAllocations.reduce(
      (total, allocation) => total + (Number(allocation.amount) || 0),
      0,
    );
  }

  get allGroupClientsSelected(): boolean {
    return (
      this.groupAllocations().length > 0 &&
      this.groupAllocations().every((allocation) => allocation.selected)
    );
  }

  get validConfirmation(): boolean {
    const confirmation = this.confirmation();
    return confirmation?.kind === 'payment' ? this.voidReason.trim().length >= 3 : true;
  }

  private chartPoints(rows: FinanceOverview['daily']): ChartPoint[] {
    const groupSize = rows.length > 120 ? 30 : rows.length > 45 ? 7 : 1;
    const points: ChartPoint[] = [];
    for (let index = 0; index < rows.length; index += groupSize) {
      const group = rows.slice(index, index + groupSize);
      points.push({
        label: group[0]?.day ?? '',
        revenue: group.reduce((total, row) => total + row.revenue, 0),
        expenses: group.reduce((total, row) => total + row.expenses, 0),
      });
    }
    return points;
  }

  private emptyExpense(): ExpenseForm {
    return {
      category: 'OPERATIONS',
      description: '',
      amount: '',
      incurredAt: new Date().toISOString().slice(0, 10),
      vendor: '',
      reference: '',
      notes: '',
    };
  }

  private emptyPayment(): PaymentForm {
    return {
      target: 'CLIENT',
      clientId: '',
      groupId: '',
      purpose: 'INITIAL',
      subscriptionId: '',
      renewalId: '',
      description: '',
      amount: '',
      paidAt: new Date().toISOString().slice(0, 10),
      reference: '',
      notes: '',
    };
  }

  private emptyBillingStatement(): BillingStatementForm {
    const statementDate = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(`${statementDate}T00:00:00.000Z`);
    dueDate.setUTCDate(dueDate.getUTCDate() + 7);
    return {
      targetType: 'CLIENT',
      targetId: '',
      recipientEmail: '',
      rememberEmail: true,
      statementDate,
      dueDate: dueDate.toISOString().slice(0, 10),
      subject: '',
      message: '',
    };
  }

  private preferredSubscription(clientId: string): SubscriptionRecord | undefined {
    const priority: Record<SubscriptionRecord['status'], number> = {
      ACTIVE: 0,
      GRACE: 1,
      TRIAL: 2,
      DRAFT: 3,
      SUSPENDED: 4,
      EXPIRED: 5,
      CANCELLED: 6,
    };
    return this.groupSubscriptions(clientId)
      .filter((subscription) => subscription.currency === this.currency)
      .sort((left, right) => priority[left.status] - priority[right.status])[0];
  }

  private async openLinkedPayment(): Promise<void> {
    if (this.handledPaymentLink) return;
    const params = this.route.snapshot.queryParamMap;
    if (params.get('payment') !== 'renewal') return;
    this.handledPaymentLink = true;
    this.activeTab.set('payments');
    this.paymentForm = {
      ...this.emptyPayment(),
      clientId: params.get('clientId') ?? '',
      subscriptionId: params.get('subscriptionId') ?? '',
      renewalId: params.get('renewalId') ?? '',
      purpose: 'RENEWAL',
    };
    await this.paymentSubscriptionChanged();
    this.paymentForm.renewalId = params.get('renewalId') ?? '';
    this.paymentOpen.set(true);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }
}
