import { expect, type Page, test } from '@playwright/test';

test('opts into a cookie session and restores it after a page reload', async ({ page }) => {
  await page.addInitScript(() => {
    window.__POSV2_SUBSCRIPTIONS_CONFIG__ = { apiBaseUrl: '/api/v1' };
  });
  let loginBody: unknown;
  let refreshesWithCookie = 0;
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith('/auth/web/login')) {
      loginBody = request.postDataJSON();
      await route.fulfill({
        ...json(session()),
        headers: {
          'Set-Cookie':
            'posv2-admin-refresh=session-id.refresh-secret; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000',
        },
      });
      return;
    }
    if (path.endsWith('/auth/web/refresh')) {
      if (!request.headers()['cookie']?.includes('posv2-admin-refresh=')) {
        await route.fulfill(json({ message: 'Browser session is unavailable.' }, 403));
        return;
      }
      refreshesWithCookie += 1;
      await route.fulfill(json(session()));
      return;
    }
    if (path.endsWith('/health')) {
      await route.fulfill(json({ status: 'ok' }));
      return;
    }
    if (/\/(clients|plans|subscriptions)$/.test(path)) {
      await route.fulfill(json({ items: [], page: 1, pageSize: 5, total: 0, totalPages: 0 }));
      return;
    }
    await route.fulfill(json({ message: 'Not found' }, 404));
  });

  await page.goto('/login');
  await expect(page.getByLabel('Remember me')).toBeVisible();
  await page.getByLabel('Username').fill('administrator');
  await page.locator('#password').fill('StrongPassword123!');
  await page.getByLabel('Remember me').check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(loginBody).toEqual({
    username: 'administrator',
    password: 'StrongPassword123!',
    rememberMe: true,
  });
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((key) => /token|session|user/i.test(key)),
    ),
  ).toBe(false);

  // Route fulfillment does not reliably persist Set-Cookie across Playwright projects,
  // so install the same HttpOnly credential the production API emitted.
  await page.context().addCookies([
    {
      name: 'posv2-admin-refresh',
      value: 'session-id.refresh-secret',
      url: 'http://127.0.0.1:4300',
      httpOnly: true,
      sameSite: 'Strict',
      expires: Math.floor(Date.now() / 1000) + 2_592_000,
    },
  ]);

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('heading', { name: /Good day/ })).toBeVisible();
  expect(refreshesWithCookie).toBeGreaterThan(0);
});

function session() {
  return {
    accessToken: 'access-token',
    user: {
      id: '10000000-0000-4000-8000-000000000001',
      username: 'administrator',
      displayName: 'Subscription Admin',
      role: 'SUPER_ADMIN',
    },
  };
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}
