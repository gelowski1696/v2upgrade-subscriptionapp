import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  LucideChartColumn,
  LucideCircleDollarSign,
  LucidePlus,
  LucideReceiptText,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { firstValueFrom, forkJoin } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { apiErrorMessage } from '../../core/api/error-message';
import { SessionStore } from '../../core/auth/session.store';
import type {
  ApiPage,
  ExpenseCategory,
  ExpenseRecord,
  FinanceOverview,
  SubscriptionRecord,
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
  subscriptionId: string;
  amount: string;
  paidAt: string;
  reference: string;
  notes: string;
}

@Component({
  selector: 'app-finance',
  imports: [
    FormsModule,
    LucideChartColumn,
    LucideCircleDollarSign,
    LucidePlus,
    LucideReceiptText,
    LucideTrash2,
    LucideX,
    DialogFocusDirective,
  ],
  templateUrl: './finance.html',
  styleUrl: './finance.css',
})
export class FinancePage implements OnInit {
  readonly categories: Array<{ value: ExpenseCategory; label: string }> = [
    { value: 'INFRASTRUCTURE', label: 'Infrastructure' },
    { value: 'SOFTWARE', label: 'Software' },
    { value: 'MARKETING', label: 'Marketing' },
    { value: 'OPERATIONS', label: 'Operations' },
    { value: 'PROFESSIONAL_SERVICES', label: 'Professional services' },
    { value: 'TAXES', label: 'Taxes' },
    { value: 'OTHER', label: 'Other' },
  ];
  readonly overview = signal<FinanceOverview | null>(null);
  readonly expenses = signal<ExpenseRecord[]>([]);
  readonly subscriptions = signal<SubscriptionRecord[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly expenseOpen = signal(false);
  readonly paymentOpen = signal(false);
  readonly chart = computed(() => this.chartPoints(this.overview()?.daily ?? []));
  readonly chartMaximum = computed(() =>
    Math.max(1, ...this.chart().flatMap((point) => [point.revenue, point.expenses])),
  );
  currency = 'PHP';
  from = '';
  to = '';
  expenseForm = this.emptyExpense();
  paymentForm = this.emptyPayment();

  constructor(
    private readonly api: ApiService,
    private readonly toasts: ToastService,
    readonly session: SessionStore,
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
      const params = { from: this.from, to: this.to, currency: this.currency };
      const result = await firstValueFrom(
        forkJoin({
          overview: this.api.get<FinanceOverview>('/finance/overview', params),
          expenses: this.api.get<ApiPage<ExpenseRecord>>('/finance/expenses', {
            ...params,
            page: 1,
            pageSize: 100,
          }),
          subscriptions: this.api.get<ApiPage<SubscriptionRecord>>('/subscriptions', {
            page: 1,
            pageSize: 100,
          }),
        }),
      );
      this.overview.set(result.overview);
      this.expenses.set(result.expenses.items);
      this.subscriptions.set(result.subscriptions.items);
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
    this.expenseForm = this.emptyExpense();
    this.expenseOpen.set(true);
  }

  openPayment(): void {
    this.paymentForm = this.emptyPayment();
    this.paymentOpen.set(true);
  }

  paymentSubscriptionChanged(): void {
    const subscription = this.subscriptions().find(
      (item) => item.id === this.paymentForm.subscriptionId,
    );
    if (subscription) this.paymentForm.amount = subscription.amount;
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
      await firstValueFrom(
        this.api.post('/finance/payments', {
          ...this.paymentForm,
          paidAt: `${this.paymentForm.paidAt}T00:00:00.000Z`,
          currency: this.currency,
          reference: this.paymentForm.reference.trim() || undefined,
          notes: this.paymentForm.notes.trim() || undefined,
        }),
      );
      this.paymentOpen.set(false);
      this.toasts.show('Subscription payment recorded', 'success');
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

  async deleteExpense(expense: ExpenseRecord): Promise<void> {
    if (!this.canAdminister || this.saving()) return;
    if (!window.confirm(`Delete the expense “${expense.description}”?`)) return;
    this.saving.set(true);
    try {
      await firstValueFrom(this.api.delete(`/finance/expenses/${expense.id}`));
      this.toasts.show('Expense deleted', 'success');
      await this.load();
    } catch (error) {
      this.toasts.show(
        'Expense could not be deleted',
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

  barHeight(value: number): string {
    if (!value) return '0%';
    return `${Math.max(3, (value / this.chartMaximum()) * 100)}%`;
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
    return (
      Boolean(this.paymentForm.subscriptionId) &&
      Number(this.paymentForm.amount) > 0 &&
      Boolean(this.paymentForm.paidAt)
    );
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
      subscriptionId: '',
      amount: '',
      paidAt: new Date().toISOString().slice(0, 10),
      reference: '',
      notes: '',
    };
  }
}
