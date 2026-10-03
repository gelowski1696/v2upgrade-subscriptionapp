import { describe, expect, it, vi } from 'vitest';
import type { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/auth/session.store';
import type { ToastService } from '../../core/notifications/toast.service';
import { FinancePage } from './finance';

describe('FinancePage payment validation', () => {
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
});

function createPage(): FinancePage {
  const queryParamMap = { get: vi.fn().mockReturnValue(null) };
  return new FinancePage(
    {} as ApiService,
    { show: vi.fn() } as unknown as ToastService,
    new SessionStore(),
    { snapshot: { queryParamMap } } as never,
    { navigate: vi.fn().mockResolvedValue(true) } as never,
  );
}
