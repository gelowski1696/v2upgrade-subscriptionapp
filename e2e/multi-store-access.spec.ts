import { expect, type Page, test } from '@playwright/test';

test('creates one responsive dashboard invitation for multiple stores', async ({ page }) => {
  await mockApi(page);
  await signIn(page);

  await page.getByRole('link', { name: 'Clients', exact: true }).click();
  await page.getByRole('button', { name: 'Manage dashboard access for Demo Business' }).click();

  const dialog = page.getByRole('dialog', { name: 'Multi-store access' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Demo Business', { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
  await expectDialogInsideViewport(dialog, page);

  await dialog.getByPlaceholder('Business owner').fill('Demo Owner');
  await dialog.getByPlaceholder('owner@example.com').fill('owner@example.com');
  await dialog.getByRole('button', { name: 'Continue' }).click();

  await expect(dialog.getByText('Main Store', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Closed Store', { exact: true })).toBeVisible();
  await expect(dialog.getByText('store inactive', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Continue' }).click();

  await expect(dialog.getByText('2 stores across 1 client')).toBeVisible();
  await dialog.getByRole('button', { name: 'Save dashboard access' }).click();
  await expect(dialog.getByRole('heading', { name: 'Dashboard invitation ready' })).toBeVisible();
  await expect(dialog.getByText('activation-token-once', { exact: true })).toBeVisible();
  await expectNoPageOverflow(page);
  await expectDialogInsideViewport(dialog, page);
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
      await route.fulfill(json(pageOf(null, 0)));
      return;
    }
    if (path.endsWith('/plans') || path.endsWith('/subscriptions')) {
      await route.fulfill(json(pageOf(null, 0)));
      return;
    }
    if (path.endsWith('/admin/portal-access/candidates')) {
      await route.fulfill(
        json({
          items: [
            store('store-1', 'Main Store'),
            store('store-2', 'Uptown Store'),
            {
              ...store('store-3', 'Closed Store'),
              status: 'INACTIVE',
              eligible: false,
              exclusionReason: 'store inactive',
            },
          ],
          total: 3,
          eligible: 2,
        }),
      );
      return;
    }
    if (path.endsWith('/admin/portal-access/users')) {
      await route.fulfill(json([]));
      return;
    }
    if (path.endsWith('/admin/portal-access/invitations') && request.method() === 'POST') {
      const body = request.postDataJSON() as { storeIds: string[] };
      expect(body.storeIds).toEqual(['store-1', 'store-2']);
      await route.fulfill(
        json({
          mode: 'INVITATION_CREATED',
          invitation: {
            id: 'invitation-1',
            username: 'owner@example.com',
            displayName: 'Demo Owner',
            role: 'OWNER',
            storeIds: body.storeIds,
            expiresAt: '2026-10-24T00:00:00.000Z',
            activationToken: 'activation-token-once',
          },
        }),
      );
      return;
    }
    await route.fulfill(json({ message: 'Not found' }, 404));
  });
}

function client() {
  return {
    id: '20000000-0000-4000-8000-000000000001',
    code: 'DEMO',
    businessName: 'Demo Business',
    ownerName: 'Demo Owner',
    email: 'owner@example.com',
    phone: null,
    address: null,
    notes: null,
    status: 'ACTIVE',
    groupId: null,
    group: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  };
}

function store(id: string, name: string) {
  return {
    id,
    code: id.toUpperCase(),
    name,
    status: 'ACTIVE',
    clientId: client().id,
    clientCode: client().code,
    clientName: client().businessName,
    groupId: null,
    eligible: true,
    exclusionReason: null,
    registeredDeviceCount: 1,
    lastSnapshotAt: '2026-10-22T00:00:00.000Z',
  };
}

function pageOf<T>(item: T, total = item ? 1 : 0) {
  return {
    items: item ? [item] : [],
    page: 1,
    pageSize: 20,
    total,
    totalPages: 1,
  };
}

async function expectNoPageOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
}

async function expectDialogInsideViewport(
  dialog: ReturnType<Page['getByRole']>,
  page: Page,
): Promise<void> {
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1);
}

function json(body: unknown, status = 200) {
  return { status, contentType: 'application/json', body: JSON.stringify(body) };
}
