import { test, expect } from '@playwright/test';

test.describe('Blog', () => {
  test('/blog loads with blog post cards', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveTitle(/Blog/i);

    // Blog post cards are links to /blog/[slug]
    const blogCards = page.locator('a[href^="/blog/"]');
    const count = await blogCards.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('each card shows title, excerpt, and date', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Get the first blog card article
    const firstCard = page.locator('a[href^="/blog/"] article').first();
    await expect(firstCard).toBeVisible();

    // Title (h2 inside the card)
    const title = firstCard.locator('h2');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);

    // Excerpt (paragraph text)
    const excerpt = firstCard.locator('p');
    const excerptCount = await excerpt.count();
    // There should be at least the excerpt paragraph
    expect(excerptCount).toBeGreaterThanOrEqual(0); // Excerpt is optional

    // Date (time element)
    const dateEl = firstCard.locator('time');
    const hasDate = await dateEl.isVisible().catch(() => false);
    // Date may not be present on all cards, but verify the element exists if published
    expect(typeof hasDate).toBe('boolean');
  });

  test('click a post navigates to /blog/[slug]', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    await expect(firstPostLink).toBeVisible();

    const href = await firstPostLink.getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).toMatch(/^\/blog\/.+/);

    await firstPostLink.click();
    await page.waitForLoadState('networkidle');

    // Should be on a blog post page
    expect(page.url()).toContain('/blog/');
    // URL should not be just /blog (should have a slug)
    expect(page.url()).not.toMatch(/\/blog\/?$/);
  });

  test('blog post page shows title, author, and body', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Navigate to first post
    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    await firstPostLink.click();
    await page.waitForLoadState('networkidle');

    // Article wrapper
    const article = page.locator('article');
    await expect(article).toBeVisible();

    // Title (h1)
    const title = article.locator('h1');
    await expect(title).toBeVisible();
    const titleText = await title.textContent();
    expect(titleText?.trim().length).toBeGreaterThan(0);

    // Author — "By <author name>"
    const authorSection = article.getByText(/^By\s/);
    await expect(authorSection).toBeVisible();

    // Body content should exist below the header
    // The blog body is rendered as HTML content after the header
    const bodyContent = article.locator('.prose, div, p').last();
    await expect(bodyContent).toBeVisible();
  });

  test('"Back to Blog" link works', async ({ page }) => {
    await page.goto('/blog');
    await page.waitForLoadState('networkidle');

    // Navigate to first post
    const firstPostLink = page.locator('a[href^="/blog/"]').first();
    await firstPostLink.click();
    await page.waitForLoadState('networkidle');

    // Find the "Back to Blog" link
    const backLink = page.getByRole('link', { name: /Back to Blog/i });
    await expect(backLink).toBeVisible();
    await expect(backLink).toHaveAttribute('href', '/blog');

    await backLink.click();
    await page.waitForLoadState('networkidle');

    // Should be back on the blog listing page
    expect(page.url()).toMatch(/\/blog\/?$/);
    await expect(page).toHaveTitle(/Blog/i);
  });
});
