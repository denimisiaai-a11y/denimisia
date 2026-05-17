import { test, expect } from '@playwright/test';

/**
 * Admin E2E tests are skipped for now.
 *
 * The admin app runs on port 3002, which is not included in the Playwright
 * webServer configuration. These tests focus on verifying that the admin
 * port is separate from the customer-facing app and that the customer
 * app does not expose admin routes.
 */
test.describe('Admin Flow', () => {
  test.skip('admin app is not configured in webServer — skipping', () => {
    // Admin app runs on port 3002, outside the current Playwright config.
    // To enable admin E2E tests, add the admin webServer to playwright.config.ts:
    //
    //   {
    //     command: 'pnpm --filter admin dev',
    //     port: 3002,
    //     reuseExistingServer: !process.env.CI,
    //     timeout: 30000,
    //   }
  });

  test('customer app does not expose /admin route', async ({ page }) => {
    const response = await page.goto('/admin');
    // Should get a 404 or redirect — not a 200 with admin content
    if (response) {
      const status = response.status();
      expect([200, 404, 308, 307, 302]).toContain(status);
    }
    // Should not contain admin dashboard content
    const adminDashboard = page.getByText(/Admin Dashboard/i);
    const hasAdmin = await adminDashboard.isVisible().catch(() => false);
    expect(hasAdmin).toBeFalsy();
  });
});
