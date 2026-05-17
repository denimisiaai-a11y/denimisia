import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('navigate to /shop/women — page loads with products', async ({ page }) => {
    await page.goto('/shop/women');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Shop Women/i);
    await expect(
      page.getByRole('heading', { name: /Women.*Collection/i })
    ).toBeVisible();

    // Should show product cards or a "no products" message
    const productCards = page.locator('a[href^="/products/"]');
    const noProducts = page.getByText('No products found');
    const hasProducts = (await productCards.count()) > 0;
    const hasEmptyMessage = await noProducts.isVisible().catch(() => false);
    expect(hasProducts || hasEmptyMessage).toBeTruthy();
  });

  test('navigate to /about — about page with 5 sections', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/About/i);

    // Section 1: Hero — "Our Story"
    await expect(page.getByRole('heading', { name: 'Our Story' })).toBeVisible();

    // Section 2: Story — "Crafted to Last"
    await expect(page.getByRole('heading', { name: 'Crafted to Last' })).toBeVisible();

    // Section 3: Values — "Our Values"
    await expect(page.getByRole('heading', { name: 'Our Values' })).toBeVisible();

    // Section 4: Numbers — stats section with figures
    await expect(page.getByText('500+')).toBeVisible();
    await expect(page.getByText('50,000+')).toBeVisible();

    // Section 5: CTA — "Visit Our Store"
    await expect(page.getByRole('heading', { name: 'Visit Our Store' })).toBeVisible();
  });

  test('navigate to /blog — blog listing with posts', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Blog/i);

    // Blog cards link to /blog/[slug]
    const blogLinks = page.locator('a[href^="/blog/"]');
    const count = await blogLinks.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('navigate to /contact — contact form renders', async ({ page }) => {
    await page.goto('/contact');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Contact Us/i })
    ).toBeVisible();

    // Form fields
    await expect(page.getByLabel(/Name/i)).toBeVisible();
    await expect(page.getByLabel(/Email/i)).toBeVisible();
    await expect(page.getByLabel(/Subject/i)).toBeVisible();
    await expect(page.getByLabel(/Message/i)).toBeVisible();
  });

  test('navigate to /size-guide — size guide loads', async ({ page }) => {
    await page.goto('/size-guide');
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Size Guide/i })
    ).toBeVisible();

    // Should have size tables with headers
    await expect(page.getByText('Waist (cm)')).toBeVisible();
    await expect(page.getByText('Hip (cm)')).toBeVisible();
  });

  test('click a product card navigates to /products/[slug]', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Find the first product card link
    const firstProduct = page.locator('a[href^="/products/"]').first();
    await expect(firstProduct).toBeVisible();

    const href = await firstProduct.getAttribute('href');
    expect(href).toBeTruthy();

    await firstProduct.click();
    await page.waitForLoadState('networkidle');

    // URL should match the product slug
    expect(page.url()).toContain('/products/');
  });

  test('navigate to /blog/[slug] from blog listing', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Click the first blog post link
    const firstPost = page.locator('a[href^="/blog/"]').first();
    await expect(firstPost).toBeVisible();

    const href = await firstPost.getAttribute('href');
    expect(href).toBeTruthy();

    await firstPost.click();
    await page.waitForLoadState('networkidle');

    // URL should be /blog/[slug]
    expect(page.url()).toContain('/blog/');

    // Blog post page should have a heading (the post title)
    const postTitle = page.locator('article h1');
    await expect(postTitle).toBeVisible();
  });
});
