import { expect, type Page, test } from '@playwright/test';

test('shows subscription finance and records an expense', async ({ page }, testInfo) => {
  await mockApi(page);
  await signIn(page);
  await page.locator('a[href="/finance"]:visible').click();

  await expect(page.getByRole('heading', { name: 'Revenue and expenses' })).toBeVisible();
  await expect(page.getByText('₱4,500.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('₱1,200.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('₱3,300.00', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Revenue versus expenses' })).toBeVisible();
  await expect(page.getByText('Standard', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Add expense' }).first().click();
  await page.getByLabel('Description *').fill('Cloud backup');
  await page.getByLabel('Category *').selectOption('INFRASTRUCTURE');
  await page.getByLabel('Amount *').fill('500');
  await page.getByLabel('Vendor').fill('Cloud Vendor');
  await page.getByRole('button', { name: 'Add expense' }).last().click();
  await expect(page.getByRole('status').getByText('Expense recorded')).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/finance-${testInfo.project.name}.png`,
    fullPage: true,
  });
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
    if (path.endsWith('/finance/overview')) {
      await route.fulfill(json(financeOverview()));
      return;
    }
    if (path.endsWith('/finance/expenses') && request.method() === 'GET') {
      await route.fulfill(
        json({ items: [expense()], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
      );
      return;
    }
    if (path.endsWith('/finance/expenses') && request.method() === 'POST') {
      await route.fulfill(json(expense()));
      return;
    }
    if (path.endsWith('/subscriptions')) {
      await route.fulfill(
        json({ items: [subscription()], page: 1, pageSize: 100, total: 1, totalPages: 1 }),
      );
      return;
    }
    if (/\/(clients|plans)$/.test(path)) {
      await route.fulfill(json({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 1 }));
      return;
    }
    await route.fulfill(json({ message: 'Not found' }, 404));
  });
}

function financeOverview() {
  return {
    range: { from: '2026-09-01', to: '2026-09-30', timezone: 'UTC', currency: 'PHP' },
    summary: {
      revenue: 4500,
      expenses: 1200,
      netIncome: 3300,
      paymentCount: 3,
      expenseCount: 1,
    },
    daily: [
      { day: '2026-09-01', revenue: 1500, expenses: 0, netIncome: 1500 },
      { day: '2026-09-15', revenue: 1500, expenses: 1200, netIncome: 300 },
      { day: '2026-09-30', revenue: 1500, expenses: 0, netIncome: 1500 },
    ],
    byPlan: [{ planId: 'plan-1', planName: 'Standard', revenue: 4500, payments: 3 }],
    recentPayments: [
      {
        id: 'payment-1',
        subscriptionId: 'subscription-1',
        amount: '1500.00',
        currency: 'PHP',
        reference: 'RECEIPT-1',
        paidAt: '2026-09-30T00:00:00.000Z',
        notes: null,
        client: { id: 'client-1', businessName: 'Demo Store' },
        plan: { id: 'plan-1', name: 'Standard' },
      },
    ],
  };
}

function expense() {
  return {
    id: 'expense-1',
    category: 'INFRASTRUCTURE',
    description: 'Cloud hosting',
    amount: '1200.00',
    currency: 'PHP',
    incurredAt: '2026-09-15T00:00:00.000Z',
    vendor: 'Cloud Vendor',
    reference: null,
    notes: null,
    createdById: '10000000-0000-4000-8000-000000000001',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-09-15T00:00:00.000Z',
  };
}

function subscription() {
  return {
    id: 'subscription-1',
    clientId: 'client-1',
    planVersionId: 'version-1',
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
    device: null,
    client: { id: 'client-1', code: 'DEMO', businessName: 'Demo Store' },
    planVersion: {
      id: 'version-1',
      version: 1,
      plan: { id: 'plan-1', code: 'STANDARD', name: 'Standard' },
    },
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}
