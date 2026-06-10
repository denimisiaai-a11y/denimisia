import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('page loads without errors', async ({ page }) => {
    await expect(page).toHaveTitle(/Denimisia/);
    // No uncaught console errors
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('navbar is visible with logo "DENIMISIA"', async ({ page }) => {
    const navbar = page.locator('header');
    await expect(navbar).toBeVisible();

    const logo = page.getByRole('link', { name: 'DENIMISIA' });
    await expect(logo).toBeVisible();
    await expect(logo).toHaveAttribute('href', '/');
  });

  test('hero section renders', async ({ page }) => {
    const hero = page.locator('section').first();
    await expect(hero).toBeVisible();

    // Hero contains collection title and CTA
    await expect(page.getByRole('heading', { name: /Raw Collection/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Explore the Collection/i })).toBeVisible();
  });

  test('category cards section renders', async ({ page }) => {
    // Category cards are image links in a grid — there should be at least 2
    const categoryLinks = page.locator('section.grid a[href^="/shop"]');
    await expect(categoryLinks.first()).toBeVisible();
    const count = await categoryLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('New Arrivals section shows product cards', async ({ page }) => {
    const heading = page.getByText('New Arrivals', { exact: true });
    await expect(heading).toBeVisible();

    // Product cards are links to /products/[slug]
    const productCards = page.locator('a[href^="/products/"]');
    const count = await productCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('footer renders with social links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();

    // Footer contains copyright
    await expect(footer.getByText(/Denimisia Ltd/i)).toBeVisible();

    // Social links (external links with aria-labels)
    const socialLinks = footer.locator('a[target="_blank"]');
    const count = await socialLinks.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('announcement bar is visible', async ({ page }) => {
    // Announcement bar is a div inside the header with bg-ink styling
    // It should be visible at the top of the page before scrolling
    const announcementBar = page.locator('header div').filter({ hasText: /free shipping|sale|delivery/i }).first();
    // Fallback: check for the bg-ink marquee container in header
    const marquee = page.locator('header .animate-marquee');
    const barVisible = await announcementBar.isVisible().catch(() => false);
    const marqueeVisible = await marquee.isVisible().catch(() => false);
    expect(barVisible || marqueeVisible).toBeTruthy();
  });
});
