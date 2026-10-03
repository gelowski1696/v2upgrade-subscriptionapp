import { expect, type Page, test } from '@playwright/test';

test('replaces browser confirmations across administration flows', async ({ page }) => {
  await mockApi(page);
  await signIn(page);

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: 'Edit client' }).click();
  await page.getByLabel('Status').selectOption('ARCHIVED');
  await page.getByRole('button', { name: 'Save changes' }).click();

  let dialog = page.getByRole('alertdialog', { name: 'Archive client?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Demo Store', { exact: true })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Keep client active' })).toBeFocused();
  await dialog.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Save changes' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Archive client?' });
  await dialog.getByRole('button', { name: 'Archive client' }).click();
  await expect(page.getByRole('status').getByText('Client updated')).toBeVisible();

  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await page.getByRole('button', { name: 'Add plan version' }).click();
  await page.getByRole('button', { name: /Features/ }).click();
  await expect(page.getByLabel('Search features')).toBeVisible();
  await page.getByRole('button', { name: 'Archive plan' }).click();
  dialog = page.getByRole('alertdialog', { name: 'Archive plan?' });
  await expect(dialog.getByText('Standard', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep plan available' }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await page
    .getByRole('button', { name: /Demo Store/ })
    .first()
    .click();
  await page.getByRole('button', { name: /Features/ }).click();
  await expect(page.getByRole('heading', { name: 'Subscription features' })).toBeVisible();
  await page.getByRole('button', { name: /Renewals/ }).click();
  await expect(page.getByRole('heading', { name: 'Renewal history' })).toBeVisible();
  await page.getByRole('button', { name: 'Suspend', exact: true }).click();
  dialog = page.getByRole('alertdialog', { name: 'Suspend subscription?' });
  await expect(dialog.getByText(/POS access will stop/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep access active' }).click();

  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  dialog = page.getByRole('alertdialog', { name: 'Cancel subscription?' });
  await expect(dialog.getByText(/cannot be reactivated/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Keep subscription' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  dialog = page.getByRole('alertdialog', { name: 'Delete subscription?' });
  await expect(dialog.getByText(/Finance and audit records are retained/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Delete subscription' }).click();
  await expect(page.getByRole('status').getByText('Subscription deleted')).toBeVisible();
});

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill('administrator');
  await page.locator('#password').fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function mockApi(page: Page): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/web/refresh')) {
      await route.fulfill(json({ message: 'Browser session is unavailable.' }, 403));
      return;
    }
    if (path.endsWith('/auth/web/login')) {
      await route.fulfill(
        json({
          accessToken: 'access-token',
          user: {
            id: '10000000-0000-4000-8000-000000000001',
            username: 'administrator',
            displayName: 'Subscription Admin',
            role: 'SUPER_ADMIN',
          },
        }),
      );
      return;
    }
    if (path.endsWith('/health')) {
      await route.fulfill(json({ status: 'ok' }));
      return;
    }
    if (path.endsWith('/clients') && request.method() === 'GET') {
      await route.fulfill(json(pageOf(client())));
      return;
    }
    if (path.endsWith('/client-groups') && request.method() === 'GET') {
      await route.fulfill(json({ items: [], page: 1, pageSize: 100, total: 0, totalPages: 1 }));
      return;
    }
    if (/\/clients\/[^/]+$/.test(path) && request.method() === 'PATCH') {
      await route.fulfill(json({ ...client(), status: 'ARCHIVED' }));
      return;
    }
    if (path.endsWith('/plans') && request.method() === 'GET') {
      await route.fulfill(json(pageOf(plan())));
      return;
    }
    if (path.endsWith('/subscriptions') && request.method() === 'GET') {
      await route.fulfill(json(pageOf(subscription())));
      return;
    }
    if (/\/subscriptions\/[^/]+\/renewals$/.test(path) && request.method() === 'GET') {
      await route.fulfill(json([]));
      return;
    }
    if (/\/subscriptions\/[^/]+$/.test(path) && request.method() === 'DELETE') {
      await route.fulfill(json({ deleted: true, deletedAt: '2026-09-30T10:00:00.000Z' }));
      return;
    }
    await route.fulfill(json({ message: 'Not found' }, 404));
  });
}

function client() {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'DEMO',
    businessName: 'Demo Store',
    ownerName: 'Demo Owner',
    email: 'owner@example.com',
    phone: null,
    address: null,
    notes: null,
    status: 'ACTIVE',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function plan() {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    code: 'STANDARD',
    name: 'Standard',
    status: 'ACTIVE',
    versions: [
      {
        id: '40000000-0000-4000-8000-000000000001',
        planId: '30000000-0000-4000-8000-000000000001',
        version: 1,
        billingInterval: 'MONTHLY',
        amount: '1500.00',
        currency: 'PHP',
        trialDays: 0,
        graceDays: 7,
        maxDevices: 1,
        features: {},
        publishedAt: '2026-09-01T00:00:00.000Z',
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function subscription() {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    clientId: client().id,
    planVersionId: plan().versions[0].id,
    status: 'ACTIVE',
    startsAt: '2026-09-01T00:00:00.000Z',
    renewsAt: '2026-10-01T00:00:00.000Z',
    expiresAt: '2026-10-01T00:00:00.000Z',
    amount: '1500.00',
    currency: 'PHP',
    billingInterval: 'MONTHLY',
    maxDevices: 1,
    entitlements: {},
    notes: null,
    device: {
      id: '60000000-0000-4000-8000-000000000001',
      installationId: 'POS-DEMO-001',
      label: null,
      platform: 'windows',
      status: 'ACTIVE',
      lastSeenAt: null,
    },
    client: { id: client().id, code: 'DEMO', businessName: 'Demo Store' },
    planVersion: {
      id: plan().versions[0].id,
      version: 1,
      features: {},
      plan: { id: plan().id, code: 'STANDARD', name: 'Standard' },
    },
  };
}

function pageOf(item: unknown) {
  return { items: [item], page: 1, pageSize: 20, total: 1, totalPages: 1 };
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}
