import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  test('login page renders at /login', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Sign In/i })
    ).toBeVisible();

    // Form inputs
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();

    // Submit button
    await expect(
      page.getByRole('button', { name: /Sign In/i })
    ).toBeVisible();

    // Link to register
    await expect(page.getByRole('link', { name: /Create one/i })).toBeVisible();
  });

  test('register page renders at /register', async ({ page }) => {
    await page.goto('/register');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Create Account/i })
    ).toBeVisible();

    // Form inputs
    await expect(page.getByLabel(/First Name/i)).toBeVisible();
    await expect(page.getByLabel(/Last Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
  });

  test('login with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Email/i).fill('customer@denimisia.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Should redirect to home after successful login
    await page.waitForURL('/', { timeout: 15000 });
    expect(page.url()).toContain('/');
  });

  test('login with invalid credentials shows error', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Email/i).fill('wrong@example.com');
    await page.getByLabel(/Password/i).fill('WrongPassword!');
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Error message should appear
    await expect(
      page.getByText(/Invalid email or password/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('after login, account page is accessible', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Email/i).fill('customer@denimisia.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('/', { timeout: 15000 });

    // Navigate to account
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Should see account page heading (not redirected to login)
    await expect(
      page.getByRole('heading', { name: /My Account/i })
    ).toBeVisible();

    // Should see account navigation links
    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Orders' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Wishlist' })).toBeVisible();
  });

  test('logout works (redirect to home)', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    await page.getByLabel(/Email/i).fill('customer@denimisia.com');
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: /Sign In/i }).click();
    await page.waitForURL('/', { timeout: 15000 });

    // Go to account page where logout might be available
    await page.goto('/account');
    await page.waitForLoadState('networkidle');

    // Look for a logout/sign-out button or link
    const logoutButton = page.getByRole('button', { name: /log\s?out|sign\s?out/i });
    const logoutLink = page.getByRole('link', { name: /log\s?out|sign\s?out/i });

    const hasButton = await logoutButton.isVisible().catch(() => false);
    const hasLink = await logoutLink.isVisible().catch(() => false);

    if (hasButton) {
      await logoutButton.click();
    } else if (hasLink) {
      await logoutLink.click();
    } else {
      // Try the API signout route directly
      await page.goto('/api/auth/signout');
      // NextAuth signout confirmation page — click confirm if present
      const confirmBtn = page.getByRole('button', { name: /sign out/i });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
    }

    await page.waitForLoadState('networkidle');

    // After logout, navigating to /account should redirect to /login
    await page.goto('/account');
    await page.waitForLoadState('networkidle');
    expect(page.url()).toContain('/login');
  });
});
