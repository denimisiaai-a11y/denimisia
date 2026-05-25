import { test, expect } from '@playwright/test';

test.describe('Chat handoff to human inbox', () => {
  test('Talk to support chip routes to the guest identity form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open product finder/i }).click();

    // The permanent "Talk to support" button is at the bottom of the panel
    await page.getByRole('button', { name: /talk to support/i }).click();

    // Identity form should appear
    await expect(page.getByPlaceholder('Name')).toBeVisible();
    await expect(page.getByPlaceholder('Email')).toBeVisible();
    await expect(page.getByPlaceholder(/01XXXXXXXXX/i)).toBeVisible();
  });

  test('Identity form validates BD phone format', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open product finder/i }).click();
    await page.getByRole('button', { name: /talk to support/i }).click();

    await page.getByPlaceholder('Name').fill('Test Guest');
    await page.getByPlaceholder('Email').fill('test+e2e@example.com');
    await page.getByPlaceholder(/01XXXXXXXXX/i).fill('+1-555-0100'); // wrong format
    await page.getByRole('button', { name: /connect to support/i }).click();

    await expect(page.getByText(/Bangladesh phone number/i)).toBeVisible();
  });

  test('Leave a message chip from bot reply triggers handoff', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open product finder/i }).click();

    // Trigger an off-script question that goes to the LLM fallback path,
    // which surfaces a "Leave a message" chip.
    await page.getByPlaceholder(/Type a product/i).fill('do you have curtains');
    await page.getByRole('button', { name: 'Send' }).click();

    const leaveMessage = page.getByRole('button', { name: /leave a message/i });
    await expect(leaveMessage).toBeVisible({ timeout: 8000 });

    await leaveMessage.click();
    await expect(page.getByPlaceholder('Name')).toBeVisible();
  });
});
