import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/auth/session.store';
import type {
  SubscriptionRecord,
  SubscriptionRenewalResult,
} from '../../core/models/api.models';
import type { ToastService } from '../../core/notifications/toast.service';
import { SubscriptionsPage } from './subscriptions';

describe('SubscriptionsPage renewal workflow', () => {
  it('previews and submits a renewal without replacing the original start date', async () => {
    const subscription = subscriptionRecord();
    const result: SubscriptionRenewalResult = {
      subscription: {
        ...subscription,
        expiresAt: '2099-12-02T00:00:00.000Z',
        renewsAt: '2099-12-02T00:00:00.000Z',
      },
      renewal: {
        id: 'renewal-1',
        subscriptionId: subscription.id,
        previousExpiresAt: subscription.expiresAt,
        periodStartsAt: '2099-11-02T00:00:00.000Z',
        periodEndsAt: '2099-12-02T00:00:00.000Z',
        amount: subscription.amount,
        currency: subscription.currency,
        billingInterval: subscription.billingInterval,
        reason: null,
        createdById: 'admin-1',
        createdAt: '2026-10-02T00:00:00.000Z',
      },
    };
    const post = vi.fn().mockReturnValue(of(result));
    const page = createPage({ post });
    page.subscriptions.set([subscription]);

    page.openRenewal(subscription);

    expect(page.renewalForm.periodStartsAt).toBe('2099-11-02');
    expect(page.renewalForm.periodEndsAt).toBe('2099-12-02');
    expect(page.validRenewal).toBe(true);

    await page.confirmRenewal();

    expect(post).toHaveBeenCalledOnce();
    const [path, body] = post.mock.calls[0] as [
      string,
      { periodStartsAt?: string; periodEndsAt?: string; startsAt?: string },
    ];
    expect(path).toBe('/subscriptions/subscription-1/renew');
    expect(body.startsAt).toBeUndefined();
    expect(body.periodStartsAt).toBeUndefined();
    expect(body.periodEndsAt).toBeUndefined();
    expect(page.selected()?.startsAt).toBe('2026-10-02T00:00:00.000Z');
    expect(page.lastRenewal()?.id).toBe('renewal-1');
  });

  it('requires an administrator reason before submitting overridden dates', () => {
    const page = createPage({ post: vi.fn() });
    page.openRenewal(subscriptionRecord());
    page.renewalOverride = true;

    expect(page.validRenewal).toBe(false);

    page.renewalForm.reason = 'Client requested aligned billing dates';
    expect(page.validRenewal).toBe(true);
  });
});

function createPage(api: { post: ReturnType<typeof vi.fn> }): SubscriptionsPage {
  const session = new SessionStore();
  session.setSession({
    accessToken: 'token',
    user: {
      id: 'admin-1',
      username: 'admin',
      displayName: 'Administrator',
      role: 'ADMIN',
    },
  });
  return new SubscriptionsPage(
    api as unknown as ApiService,
    { show: vi.fn() } as unknown as ToastService,
    session,
    { navigate: vi.fn().mockResolvedValue(true) } as never,
  );
}

function subscriptionRecord(): SubscriptionRecord {
  return {
    id: 'subscription-1',
    clientId: 'client-1',
    planVersionId: 'version-1',
    status: 'ACTIVE',
    startsAt: '2026-10-02T00:00:00.000Z',
    renewsAt: '2099-11-02T00:00:00.000Z',
    expiresAt: '2099-11-02T00:00:00.000Z',
    amount: '1499.00',
    currency: 'PHP',
    billingInterval: 'MONTHLY',
    maxDevices: 1,
    entitlements: {},
    notes: null,
    device: null,
    client: { id: 'client-1', code: 'CLIENT-1', businessName: 'Demo Store' },
    planVersion: {
      id: 'version-1',
      version: 1,
      plan: { id: 'plan-1', code: 'MONTHLY', name: 'Monthly' },
    },
  };
}
