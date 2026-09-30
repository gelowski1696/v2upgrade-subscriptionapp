import { expect, type Page, test } from '@playwright/test';

test('shows privacy-safe website analytics to super administrators', async ({ page }, testInfo) => {
  await mockApi(page, 'SUPER_ADMIN');
  await signIn(page);
  await page.locator('a[href="/web-analytics"]:visible').click();

  await expect(page.getByRole('heading', { name: 'Website analytics' })).toBeVisible();
  await expect(page.getByText('42', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Page views by day' })).toBeVisible();
  await expect(page.getByText('Sales', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Low sample').first()).toBeVisible();
  await expect(page.getByText('Unhandled Frontend Error')).toBeVisible();
  await expect(page.getByText(/exclude usernames, emails, IP addresses/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: `test-results/web-analytics-${testInfo.project.name}.png`,
    fullPage: true,
  });
});

test('redirects non-super administrators away from website analytics', async ({ page }) => {
  await mockApi(page, 'ADMIN');
  await signIn(page);
  await page.evaluate(() => {
    window.history.pushState({}, '', '/web-analytics');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good day/ })).toBeVisible();
});

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Username').fill('administrator');
  await page.locator('#password').fill('StrongPassword123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

async function mockApi(page: Page, role: 'SUPER_ADMIN' | 'ADMIN'): Promise<void> {
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/login')) {
      await route.fulfill(
        json({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
          user: {
            id: '10000000-0000-4000-8000-000000000001',
            username: 'administrator',
            displayName: 'Subscription Admin',
            role,
          },
        }),
      );
      return;
    }
    if (path.endsWith('/health')) {
      await route.fulfill(json({ status: 'ok' }));
      return;
    }
    if (path.endsWith('/admin/web-analytics/filters')) {
      await route.fulfill(
        json({
          generatedAt: '2026-09-30T02:00:00.000Z',
          clients: [
            {
              id: '10000000-0000-4000-8000-000000000010',
              code: 'DEMO',
              businessName: 'Demo Retail Group',
              stores: [
                {
                  id: '10000000-0000-4000-8000-000000000011',
                  code: 'MAIN',
                  name: 'Main Store',
                },
              ],
            },
          ],
        }),
      );
      return;
    }
    if (path.endsWith('/admin/web-analytics/overview')) {
      await route.fulfill(json(analyticsOverview()));
      return;
    }
    if (/\/(clients|plans|subscriptions)$/.test(path)) {
      await route.fulfill(json({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }));
      return;
    }
    await route.fulfill(json({ message: 'Not found' }, 404));
  });
}

function analyticsOverview() {
  return {
    range: { from: '2026-09-24', to: '2026-09-30', timezone: 'UTC' },
    scope: { clientId: null, storeId: null },
    generatedAt: '2026-09-30T02:00:00.000Z',
    metricVersion: '1.0',
    summary: {
      activeUsers: 42,
      sessions: 58,
      pageViews: 236,
      frontendErrors: 3,
      apiFailures: 1,
      affectedSessions: 3,
      affectedSessionRate: 5.17,
    },
    usage: [
      { day: '2026-09-24', activeUsers: 12, sessions: 14, pageViews: 36 },
      { day: '2026-09-25', activeUsers: 14, sessions: 17, pageViews: 42 },
      { day: '2026-09-26', activeUsers: 9, sessions: 10, pageViews: 25 },
      { day: '2026-09-27', activeUsers: 8, sessions: 9, pageViews: 18 },
      { day: '2026-09-28', activeUsers: 15, sessions: 20, pageViews: 48 },
      { day: '2026-09-29', activeUsers: 17, sessions: 21, pageViews: 52 },
      { day: '2026-09-30', activeUsers: 7, sessions: 8, pageViews: 15 },
    ],
    routes: [
      { name: '/dashboard/sales', count: 82 },
      { name: '/dashboard/overview', count: 65 },
      { name: '/dashboard/inventory', count: 44 },
    ],
    features: [
      { name: 'REPORT_OPENED', count: 91 },
      { name: 'FILTER_APPLIED', count: 37 },
      { name: 'REPORT_EXPORTED', count: 12 },
    ],
    performance: [
      {
        route: '/dashboard/overview',
        metricName: 'LCP',
        deviceClass: 'DESKTOP',
        sampleCount: 14,
        p75: 1850,
        insufficientSample: true,
      },
      {
        route: '/dashboard/sales',
        metricName: 'CLS',
        deviceClass: 'MOBILE',
        sampleCount: 24,
        p75: 0.08,
        insufficientSample: false,
      },
    ],
    errors: [
      {
        eventType: 'FRONTEND_ERROR',
        errorCode: 'UNHANDLED_FRONTEND_ERROR',
        appRelease: '810464f',
        count: 3,
        affectedSessions: 2,
        firstSeenAt: '2026-09-29T08:00:00.000Z',
        lastSeenAt: '2026-09-30T01:30:00.000Z',
      },
    ],
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}
