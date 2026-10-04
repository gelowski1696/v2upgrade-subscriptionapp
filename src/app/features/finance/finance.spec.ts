import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/auth/session.store';
import type { ToastService } from '../../core/notifications/toast.service';
import { FinancePage } from './finance';

describe('FinancePage payment validation', () => {
  it('opens and closes payment and expense detail records', () => {
    const page = createPage();
    const payment = paymentRecord();
    const expense = expenseRecord();

    page.viewPayment(payment);
    expect(page.selectedPayment()).toBe(payment);
    expect(page.selectedExpense()).toBeNull();

    page.viewExpense(expense);
    expect(page.selectedExpense()).toBe(expense);
    expect(page.selectedPayment()).toBeNull();

    page.closeRecordDetails();
    expect(page.selectedExpense()).toBeNull();
    expect(page.selectedPayment()).toBeNull();
  });

  it('allows an initial client payment without a subscription', () => {
    const page = createPage();
    page.paymentForm = {
      ...page.paymentForm,
      clientId: 'client-1',
      purpose: 'INITIAL',
      amount: '500.00',
      paidAt: '2026-10-02',
    };

    expect(page.validPayment).toBe(true);
  });

  it('requires descriptions for modification and other payments', () => {
    const page = createPage();
    page.paymentForm = {
      ...page.paymentForm,
      clientId: 'client-1',
      purpose: 'MODIFICATION',
      amount: '2500.00',
      paidAt: '2026-10-02',
    };

    expect(page.validPayment).toBe(false);

    page.paymentForm.description = 'Custom sales report';
    expect(page.validPayment).toBe(true);
  });

  it('requires a subscription for renewal payments', () => {
    const page = createPage();
    page.paymentForm = {
      ...page.paymentForm,
      clientId: 'client-1',
      purpose: 'RENEWAL',
      amount: '1499.00',
      paidAt: '2026-10-02',
    };

    expect(page.validPayment).toBe(false);

    page.paymentForm.subscriptionId = 'subscription-1';
    expect(page.validPayment).toBe(true);
  });

  it('validates every selected client allocation in a group payment', () => {
    const page = createPage();
    page.paymentForm = {
      ...page.paymentForm,
      target: 'GROUP',
      groupId: 'group-1',
      purpose: 'RENEWAL',
      paidAt: '2026-10-03',
    };
    page.groupAllocations.set([
      {
        clientId: 'client-1',
        businessName: 'Store One',
        code: 'ONE',
        selected: true,
        subscriptionId: 'subscription-1',
        renewalId: '',
        amount: '1499.00',
      },
      {
        clientId: 'client-2',
        businessName: 'Store Two',
        code: 'TWO',
        selected: true,
        subscriptionId: '',
        renewalId: '',
        amount: '1499.00',
      },
    ]);

    expect(page.validPayment).toBe(false);

    page.groupAllocations()[1]!.subscriptionId = 'subscription-2';
    expect(page.validPayment).toBe(true);
    expect(page.groupPaymentTotal).toBe(2998);
  });

  it('loads a remembered billing email from the selected client preview', async () => {
    const api = {
      get: vi.fn().mockReturnValue(of(billingPreview())),
    };
    const page = createPage(api as unknown as ApiService);
    page.openBillingStatement();
    page.billingForm.targetId = 'client-1';

    await page.billingTargetChanged();

    expect(api.get).toHaveBeenCalledWith('/finance/billing-statements/preview', {
      targetType: 'CLIENT',
      targetId: 'client-1',
    });
    expect(page.billingForm.recipientEmail).toBe('accounts@example.test');
    expect(page.billingForm.subject).toContain('RFI LPG STORE');
    expect(page.validBillingStatement).toBe(true);
  });

  it('sends the manual email and remember preference', async () => {
    const api = {
      post: vi.fn().mockReturnValue(
        of({
          id: 'delivery-1',
          statementNumber: 'BS-20261004-12345678',
          status: 'SENT',
          providerMessageId: 'email-1',
          recipientEmail: 'manual@example.test',
          sentAt: '2026-10-04T01:00:00.000Z',
        }),
      ),
    };
    const page = createPage(api as unknown as ApiService);
    page.billingOpen.set(true);
    page.billingPreview.set(billingPreview());
    page.billingForm = {
      ...page.billingForm,
      targetId: 'client-1',
      recipientEmail: 'manual@example.test',
      rememberEmail: true,
      statementDate: '2026-10-04',
      dueDate: '2026-10-11',
      subject: 'October statement',
    };

    await page.sendBillingStatement();

    expect(api.post).toHaveBeenCalledWith(
      '/finance/billing-statements/send',
      expect.objectContaining({
        recipientEmail: 'manual@example.test',
        rememberEmail: true,
        targetType: 'CLIENT',
        targetId: 'client-1',
      }),
    );
    expect(page.billingOpen()).toBe(false);
  });
});

function createPage(api: ApiService = {} as ApiService): FinancePage {
  const queryParamMap = { get: vi.fn().mockReturnValue(null) };
  return new FinancePage(
    api,
    { show: vi.fn() } as unknown as ToastService,
    new SessionStore(),
    { snapshot: { queryParamMap } } as never,
    { navigate: vi.fn().mockResolvedValue(true) } as never,
  );
}

function billingPreview() {
  return {
    targetType: 'CLIENT' as const,
    targetId: 'client-1',
    targetCode: 'IGNO-0001',
    targetName: 'RFI LPG STORE',
    savedRecipientEmail: 'accounts@example.test',
    lines: [
      {
        subscriptionId: 'subscription-1',
        clientCode: 'IGNO-0001',
        ownerName: 'ROCHELLE IGNO',
        businessName: 'RFI LPG STORE',
        address: 'Valenzuela City',
        planName: 'LPG POS + Online Access',
        periodStartsAt: '2026-10-01T00:00:00.000Z',
        periodEndsAt: '2026-10-31T00:00:00.000Z',
        amount: 1638,
      },
    ],
    currency: 'PHP',
    totalAmount: 1638,
    company: {
      name: 'VMJAMTECH',
      address: 'Valenzuela City',
      email: 'billing@example.test',
      phone: '09123456789',
      paymentInstructions: ['Contact us for payment instructions.'],
    },
    emailConfigured: true,
    defaultSubject: 'October 2026 LPG POS Billing Statement - RFI LPG STORE',
    recentDeliveries: [],
  };
}

function paymentRecord() {
  return {
    id: 'payment-1',
    batchId: null,
    subscriptionId: null,
    renewalId: null,
    purpose: 'INITIAL' as const,
    description: null,
    amount: '1500.00',
    currency: 'PHP',
    reference: 'OR-001',
    paidAt: '2026-10-02T00:00:00.000Z',
    notes: null,
    status: 'POSTED' as const,
    voidedAt: null,
    voidReason: null,
    client: { id: 'client-1', businessName: 'RFI LPG STORE', group: null },
    plan: null,
    renewal: null,
  };
}

function expenseRecord() {
  return {
    id: 'expense-1',
    category: 'OPERATIONS' as const,
    description: 'VPS hosting',
    amount: '800.00',
    currency: 'PHP',
    incurredAt: '2026-10-02T00:00:00.000Z',
    vendor: 'Hosting vendor',
    reference: null,
    notes: null,
    createdById: 'actor-1',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-02T00:00:00.000Z',
  };
}
