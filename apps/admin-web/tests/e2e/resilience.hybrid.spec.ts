import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '33333333-3333-3333-3333-333333333333',
  displayName: 'Boss',
  roles: ['BOSS'],
  currentRole: 'BOSS'
};

const seedSession = async (page: Page, permissionItems: Array<{ code: string; scope: string }> = []) => {
  const permissions = { items: permissionItems };
  await page.addInitScript(({ permissions, user }) => {
    if (window.location.pathname === '/') {
      return;
    }
    localStorage.setItem('tmo:admin:web:auth', JSON.stringify({
      mode: 'dev',
      accessToken: 'cached-admin-token',
      user,
      currentRole: 'BOSS',
      permissions
    }));
  }, { permissions, user });
  return permissions;
};

const emptyPage = { items: [], page: 1, pageSize: 50, total: 0 };

const routeEmptySupport = async (page: Page) => {
  await page.route(/\/api\/admin\/support\/conversations(?:\?|$)/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(emptyPage)
  }));
};

test('a transient bootstrap failure keeps the cached admin session', async ({ page }) => {
  await seedSession(page);
  await page.route(/\/api\/bff\/bootstrap$/, (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'identity_unavailable', message: 'identity temporarily unavailable' })
  }));
  await page.route(/\/api\/bff\/admin\/summary$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ metrics: {}, generatedAt: '2026-08-10T00:00:00Z' })
  }));
  await routeEmptySupport(page);

  await page.goto('/dashboard.html');

  await expect(page).toHaveURL(/\/dashboard\.html$/);
  await expect(page.getByTestId('bootstrap-cache-warning')).toBeVisible();
  await expect(page.getByTestId('dashboard-page-live')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tmo:admin:web:auth'))).not.toBeNull();
});

test('an unauthorized bootstrap still clears the cached session', async ({ page }) => {
  await seedSession(page);
  await page.route(/\/api\/bff\/bootstrap$/, (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ code: 'unauthorized', message: 'token expired' })
  }));

  await page.goto('/dashboard.html');

  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tmo:admin:web:auth'))).toBeNull();
});

test('support polling coalesces while the previous refresh is unresolved', async ({ page }) => {
  const permissions = await seedSession(page);
  await page.route(/\/api\/bff\/bootstrap$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ me: user, permissions })
  }));
  await page.route(/\/api\/bff\/admin\/summary$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ metrics: {}, generatedAt: '2026-08-10T00:00:00Z' })
  }));

  let supportRequestCount = 0;
  await page.route(/\/api\/admin\/support\/conversations(?:\?|$)/, () => {
    supportRequestCount += 1;
    // Deliberately leave both requests unresolved to exercise the in-flight guard.
  });

  await page.goto('/dashboard.html');
  await expect(page.getByTestId('dashboard-page-live')).toBeVisible();
  await expect.poll(() => supportRequestCount).toBe(2);

  await page.waitForTimeout(5_500);
  expect(supportRequestCount).toBe(2);
});

test('import polling does not overlap a slow status request', async ({ page }) => {
  const permissions = await seedSession(page, [{ code: 'import:product', scope: 'ALL' }]);
  await page.route(/\/api\/bff\/bootstrap$/, (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ me: user, permissions })
  }));
  await routeEmptySupport(page);

  let jobRequestCount = 0;
  await page.route(/\/api\/admin\/import-jobs\/job-pending$/, (route) => {
    jobRequestCount += 1;
    if (jobRequestCount === 1) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'job-pending',
          type: 'PRODUCT_IMPORT',
          status: 'PENDING',
          progress: 0,
          createdAt: '2026-08-10T00:00:00Z'
        })
      });
    }
    // Keep the first interval request pending; later intervals must not add requests.
    return undefined;
  });

  await page.goto('/import.html');
  await expect(page.getByTestId('import-page')).toBeVisible();
  await page.getByTestId('import-job-query').fill('job-pending');
  await page.getByTestId('import-job-query-submit').click();
  await expect.poll(() => jobRequestCount).toBe(1);
  await expect(page.getByTestId('latest-import-job-status')).toContainText('PENDING');
  await expect.poll(() => jobRequestCount, { timeout: 4_000 }).toBe(2);

  await page.waitForTimeout(3_500);
  expect(jobRequestCount).toBe(2);
});
