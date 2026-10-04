import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { ApiService } from '../../core/api/api.service';
import { SessionStore } from '../../core/auth/session.store';
import type {
  GroupSubscriptionOptions,
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

describe('SubscriptionsPage group creation', () => {
  it('prefills legacy Device IDs and excludes members that already have subscriptions', async () => {
    const options: GroupSubscriptionOptions = {
      group: { id: 'group-1', code: 'IGNO', name: 'IGNO Clients', status: 'ACTIVE' },
      eligibleCount: 1,
      members: [
        {
          clientId: 'client-1',
          code: 'IGNO-0001',
          businessName: 'RFI LPG STORE',
          ownerName: 'ROCHELLE IGNO',
          suggestedDeviceId: 'C01E7E4C-3068-11B2-A85C-C9E0216CB38D',
          hasActiveStore: true,
          currentSubscription: null,
        },
        {
          clientId: 'client-2',
          code: 'IGNO-0002',
          businessName: 'TAYTAY LPG TRADING',
          ownerName: 'ROBERTO STA. ANA',
          suggestedDeviceId: '22E4FBFB-8402-11E9-8B14-A06610C018AF',
          hasActiveStore: true,
          currentSubscription: {
            id: 'subscription-2',
            status: 'ACTIVE',
            planName: 'Monthly',
          },
        },
      ],
    };
    const get = vi.fn().mockReturnValue(of(options));
    const page = createPage({ get, post: vi.fn() });
    page.setCreationTarget('GROUP');
    page.groupId = 'group-1';

    await page.groupChanged();

    expect(get).toHaveBeenCalledWith('/subscriptions/group/group-1/options');
    expect(page.groupMembers()).toEqual([
      expect.objectContaining({
        clientId: 'client-1',
        selected: true,
        deviceId: 'C01E7E4C-3068-11B2-A85C-C9E0216CB38D',
      }),
      expect.objectContaining({ clientId: 'client-2', selected: false }),
    ]);
    expect(page.groupMemberIssue(page.groupMembers()[1])).toBe('Monthly · ACTIVE');
  });

  it('creates one draft for every selected eligible member', async () => {
    const post = vi.fn().mockReturnValue(
      of({
        groupId: 'group-1',
        createdCount: 2,
        items: [],
      }),
    );
    const get = vi
      .fn()
      .mockReturnValue(of({ items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 }));
    const page = createPage({ get, post });
    page.setCreationTarget('GROUP');
    page.groupId = 'group-1';
    page.form.planVersionId = 'version-1';
    page.form.startsAt = '2026-10-04';
    page.groupMembers.set([
      groupMember('client-1', 'POS-DEVICE-0001'),
      groupMember('client-2', 'pos-device-0002'),
    ]);

    expect(page.validCreation).toBe(true);
    await page.save();

    expect(post).toHaveBeenCalledWith(
      '/subscriptions/group',
      expect.objectContaining({
        groupId: 'group-1',
        planVersionId: 'version-1',
        members: [
          { clientId: 'client-1', deviceId: 'POS-DEVICE-0001' },
          { clientId: 'client-2', deviceId: 'POS-DEVICE-0002' },
        ],
      }),
    );
  });
});

function createPage(api: {
  post: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
}): SubscriptionsPage {
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

function groupMember(clientId: string, deviceId: string) {
  return {
    clientId,
    code: clientId.toUpperCase(),
    businessName: `${clientId} Store`,
    ownerName: null,
    suggestedDeviceId: deviceId,
    hasActiveStore: true,
    currentSubscription: null,
    selected: true,
    deviceId,
  };
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
