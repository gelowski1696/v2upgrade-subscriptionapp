import { expect, test, type Page } from '@playwright/test';

const client = {
  id: 'client-1',
  code: 'LPG-001',
  businessName: 'Northside LPG Retail',
  ownerName: 'Ana Reyes',
  email: 'ana@example.test',
  phone: '0917 555 0101',
  address: 'Quezon City',
  notes: null,
  status: 'ACTIVE',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-20T08:00:00.000Z',
};

const plan = {
  id: 'plan-1',
  code: 'PRO',
  name: 'POSV2 Professional',
  status: 'ACTIVE',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-20T08:00:00.000Z',
  versions: [
    {
      id: 'version-1',
      planId: 'plan-1',
      version: 2,
      billingInterval: 'MONTHLY',
      amount: '1499.00',
      currency: 'PHP',
      trialDays: 14,
      graceDays: 7,
      maxDevices: 3,
      features: { reports: true, backups: true, multiUser: true },
      publishedAt: '2026-09-01T08:00:00.000Z',
      createdAt: '2026-09-01T08:00:00.000Z',
    },
  ],
};

const subscription = {
  id: 'subscription-1',
  clientId: client.id,
  planVersionId: plan.versions[0].id,
  status: 'ACTIVE',
  startsAt: '2026-09-01T00:00:00.000Z',
  renewsAt: '2026-10-01T00:00:00.000Z',
  expiresAt: '2026-10-01T00:00:00.000Z',
  amount: '1499.00',
  currency: 'PHP',
  billingInterval: 'MONTHLY',
  maxDevices: 3,
  notes: 'Primary store subscription',
  device: {
    id: 'device-row-1',
    installationId: 'POS-DEVICE-0001',
    label: 'Primary POS',
    platform: 'windows',
    status: 'ACTIVE',
    lastSeenAt: null,
  },
  client: { id: client.id, code: client.code, businessName: client.businessName },
  planVersion: {
    id: plan.versions[0].id,
    version: 2,
    plan: { id: plan.id, code: plan.code, name: plan.name },
  },
};

function pageOf<T>(items: T[], total = items.length) {
  return { items, page: 1, pageSize: 20, total, totalPages: Math.max(1, Math.ceil(total / 20)) };
}

async function mockApi(page: Page, role = 'SUPER_ADMIN'): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body: unknown = {};

    if (path.endsWith('/auth/login')) {
      body = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: {
          id: 'user-1',
          username: 'admin',
          displayName: 'Subscription Admin',
          role,
        },
      };
    } else if (path.endsWith('/health')) {
      body = { status: 'ok' };
    } else if (path.endsWith('/clients')) {
      body = pageOf([client], 24);
    } else if (path.endsWith('/plans')) {
      body = pageOf([plan], 4);
    } else if (path.endsWith('/subscriptions')) {
      const items = url.searchParams.get('status') === 'GRACE' ? [] : [subscription];
      body = pageOf(items, items.length ? 18 : 2);
    } else if (path.endsWith(`/subscriptions/${subscription.id}`)) {
      body = subscription;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

test('primary responsive workflows render and open their editors', async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto('/login');

  await expect(page.getByRole('heading', { name: 'Subscription control' })).toBeVisible();
  await page.screenshot({
    path: `test-results/login-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Good day, Subscription Admin' })).toBeVisible();
  await expect(page.getByText('Northside LPG Retail')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.screenshot({
    path: `test-results/dashboard-${testInfo.project.name}.png`,
    fullPage: true,
  });

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();
  await page.getByRole('button', { name: 'Add client' }).click();
  await expect(page.getByRole('heading', { name: 'Add client' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Plans' })).toBeVisible();
  await page.getByRole('button', { name: 'Add plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Subscriptions' })).toBeVisible();
  await page.getByRole('button', { name: 'New subscription' }).click();
  await expect(page.getByRole('heading', { name: 'Create subscription' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Northside LPG Retail (LPG-001)' })).toHaveCount(1);
  await expect(
    page.getByText("Enter the Device ID shown by the client's Windows POS."),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Subscription control' })).toBeVisible();
});

test('viewer sessions remain read-only', async ({ page }) => {
  await mockApi(page, 'VIEWER');
  await page.goto('/login');
  await page.getByLabel('Username').fill('viewer');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add client' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add plan', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New subscription' })).toHaveCount(0);
  await page.getByText('Northside LPG Retail').first().click();
  await expect(page.getByLabel('Subscription Device ID')).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Update' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
});

test('operator sessions expose operational actions but not administrator actions', async ({
  page,
}) => {
  await mockApi(page, 'OPERATOR');
  await page.goto('/login');
  await page.getByLabel('Username').fill('operator');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add client' })).toBeVisible();

  await page.getByRole('link', { name: 'Plans', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add plan', exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Subscriptions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New subscription' })).toBeVisible();
  await page.getByText('Northside LPG Retail').first().click();
  await expect(page.getByRole('button', { name: 'Update' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Renew' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Suspend', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
});

test('the memory-only session requires sign-in after a full reload', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Clients' })).toBeVisible();

  await page.reload();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Subscription control' })).toBeVisible();
});

test('concurrent expired requests use one refresh rotation', async ({ page }) => {
  let refreshCount = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown = {};

    if (path.endsWith('/auth/login')) {
      body = {
        accessToken: 'expired-access-token',
        refreshToken: 'refresh-token',
        user: {
          id: 'user-1',
          username: 'admin',
          displayName: 'Subscription Admin',
          role: 'SUPER_ADMIN',
        },
      };
    } else if (path.endsWith('/auth/refresh')) {
      refreshCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 150));
      body = {
        accessToken: 'fresh-access-token',
        refreshToken: 'rotated-refresh-token',
        user: {
          id: 'user-1',
          username: 'admin',
          displayName: 'Subscription Admin',
          role: 'SUPER_ADMIN',
        },
      };
    } else if (path.endsWith('/health')) {
      body = { status: 'ok' };
    } else if (request.headers()['authorization'] === 'Bearer expired-access-token') {
      await route.fulfill({ status: 401, contentType: 'application/json', body: '{}' });
      return;
    } else if (path.endsWith('/clients')) {
      body = pageOf([client]);
    } else if (path.endsWith('/plans')) {
      body = pageOf([plan]);
    } else if (path.endsWith('/subscriptions')) {
      body = pageOf([subscription]);
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  await page.goto('/login');
  await page.getByLabel('Username').fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Good day, Subscription Admin' })).toBeVisible();
  await expect.poll(() => refreshCount).toBe(1);
});
