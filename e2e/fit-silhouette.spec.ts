import { test, expect } from '@playwright/test';

// Note: the test catalog has one product with full fit data set up by the smoke
// test — `womens-high-waist-balloon-jeans` (PANTS, high-waisted, ankle, skinny).
// E2E tests target this product directly to avoid catalog-page selector fragility.
const TEST_PRODUCT_SLUG = 'womens-high-waist-balloon-jeans';

test.describe('Size & Fit modal (storefront)', () => {
  test('PDP shows Size & Fit button (no separate Size Chart / Find My Size buttons)', async ({
    page,
  }) => {
    await page.goto(`/products/${TEST_PRODUCT_SLUG}`);

    // PDP loads — wait for the product title area.
    await expect(page.getByRole('heading').first()).toBeVisible({
      timeout: 15_000,
    });

    // The new single button is present.
    const sizeAndFitButton = page.getByRole('button', {
      name: /size\s*&\s*fit/i,
    });
    await expect(sizeAndFitButton).toBeVisible();

    // Legacy buttons are gone.
    await expect(page.getByRole('button', { name: /^size chart$/i })).toHaveCount(
      0,
    );
    await expect(
      page.getByRole('button', { name: /^find my size$/i }),
    ).toHaveCount(0);
  });

  test('Size & Fit modal opens with silhouette + size chart + Help me pick', async ({
    page,
  }) => {
    await page.goto(`/products/${TEST_PRODUCT_SLUG}`);
    await page.getByRole('button', { name: /size\s*&\s*fit/i }).click();

    const dialog = page.getByRole('dialog', { name: /size & fit/i });
    await expect(dialog).toBeVisible();

    // Silhouette area renders something (SVG once loaded, or loading text).
    // Use a generous timeout because the silhouette fetch is async.
    await expect(
      dialog.locator('svg, [role="img"], p').first(),
    ).toBeVisible({ timeout: 10_000 });

    // Help me pick CTA is wired and clickable.
    const helpCta = dialog.getByRole('button', { name: /help me pick/i });
    await expect(helpCta).toBeVisible();

    // Header in/cm toggle works (clicking it changes label).
    const toggle = dialog.getByRole('button', { name: /show (cm|in)/i });
    if (await toggle.isVisible()) {
      const before = await toggle.textContent();
      await toggle.click();
      const after = await toggle.textContent();
      expect(before).not.toBe(after);
    }
  });

  test('Help me pick opens the chat bot', async ({ page }) => {
    await page.goto(`/products/${TEST_PRODUCT_SLUG}`);
    await page.getByRole('button', { name: /size\s*&\s*fit/i }).click();
    await page
      .getByRole('dialog', { name: /size & fit/i })
      .getByRole('button', { name: /help me pick/i })
      .click();

    // Chat panel becomes visible (existing flow we don't want to break).
    await expect(
      page.getByText(/Looking for something|find my size|shopping for/i),
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Silhouettes API', () => {
  const apiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

  test('GET /silhouettes returns men + women', async ({ request }) => {
    const res = await request.get(`${apiBase}/silhouettes`);
    expect(res.ok()).toBe(true);
    const body = (await res.json()) as
      | Array<{
          gender: string;
          svgPath: string;
          landmarks: Record<string, { y: number }>;
        }>
      | {
          data?: Array<{
            gender: string;
            svgPath: string;
            landmarks: Record<string, { y: number }>;
          }>;
        };
    const rows = Array.isArray(body) ? body : (body.data ?? []);
    const genders = rows.map((r) => r.gender).sort();
    expect(genders).toContain('FEMALE');
    expect(genders).toContain('MALE');
    for (const row of rows) {
      expect(row.svgPath.length).toBeGreaterThan(50);
      expect(row.landmarks.naturalWaist?.y).toBeGreaterThan(0);
      expect(row.landmarks.ankle?.y).toBeGreaterThan(
        row.landmarks.naturalWaist!.y,
      );
    }
  });

  test('PUT /admin/silhouettes/:gender is guarded (returns 401 without token)', async ({
    request,
  }) => {
    const res = await request.put(`${apiBase}/admin/silhouettes/FEMALE`, {
      data: { landmarks: { ankle: { y: 999 } } },
      headers: { 'Content-Type': 'application/json' },
    });
    // Unauth should be rejected — accept 401 (no token) or 403 (token without role)
    expect([401, 403]).toContain(res.status());
  });

  test('Product response includes fitLandmarks key (may be null)', async ({
    request,
  }) => {
    const list = await request.get(`${apiBase}/products?limit=1`);
    expect(list.ok()).toBe(true);
    const listJson = (await list.json()) as
      | { products?: Array<{ slug: string }> }
      | { data?: { products?: Array<{ slug: string }> } };
    const products =
      (listJson as { products?: Array<{ slug: string }> }).products ??
      (listJson as { data?: { products?: Array<{ slug: string }> } }).data
        ?.products ??
      [];
    if (products.length === 0) return; // catalog empty, skip
    const detailRes = await request.get(
      `${apiBase}/products/${products[0]!.slug}`,
    );
    expect(detailRes.ok()).toBe(true);
    const detail = (await detailRes.json()) as Record<string, unknown> & {
      data?: Record<string, unknown>;
    };
    const product = detail.data ?? detail;
    expect(Object.keys(product as object)).toContain('fitLandmarks');
  });
});
