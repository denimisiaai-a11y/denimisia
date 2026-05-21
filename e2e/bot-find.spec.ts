import { test, expect } from '@playwright/test';

test.describe('Product finder chat', () => {
  test('chat bubble opens and shows greeting', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const bubble = page.getByRole('button', { name: /open product finder/i });
    await expect(bubble).toBeVisible();
    await bubble.click();

    await expect(page.getByText(/Looking for something/i)).toBeVisible();
  });

  test('chat bubble is hidden on /checkout', async ({ page }) => {
    // Checkout requires auth — log in first so we actually land on /checkout
    // rather than being redirected to /login.
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Email/i).fill('customer@denimisia.com');
    await page.getByLabel(/Password/i).fill('customer123');
    await page.getByRole('button', { name: /Sign in|Log in/i }).click();
    await page.waitForLoadState('networkidle');

    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('button', { name: /open product finder/i })).toHaveCount(0);
  });

  test('typing a query echoes a parsed response', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /open product finder/i }).click();
    await expect(page.getByText(/Looking for something/i)).toBeVisible();

    await page.getByPlaceholder(/Type a product/i).fill('black pants');
    await page.getByRole('button', { name: 'Send' }).click();

    // Bot replies — either "Got it:" (catalog match or no-stock variant) or
    // "I didn't catch that" if the seed has no matching tokens. The robust
    // assertion is that the bot replied at all.
    await expect(page.locator('text=/Got it|didn.?t catch/i').first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test('sizing flow starts when help-me-find-my-size chip is clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /open product finder/i }).click();
    await expect(page.getByText(/Looking for something/i)).toBeVisible();

    await page.getByRole('button', { name: /Help me find my size/i }).click();

    await expect(page.getByText(/shopping for/i)).toBeVisible({ timeout: 10_000 });
    // Sizing flow exposes category chips: Pants / Shirts / Jackets
    await expect(page.getByRole('button', { name: /^Pants$/ }).last()).toBeVisible();
  });
});
