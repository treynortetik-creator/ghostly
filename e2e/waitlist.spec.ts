import { test, expect } from '@playwright/test';
import { deleteWaitlistEntry, getWaitlistEntry } from './helpers/supabase';

const TEST_EMAIL = 'playwright-e2e-test@ghostly.test';

test.describe('Waitlist Form', () => {
  test.beforeAll(async () => {
    await deleteWaitlistEntry(TEST_EMAIL);
  });

  test.afterAll(async () => {
    await deleteWaitlistEntry(TEST_EMAIL);
  });

  test('submits the waitlist form and stores in Supabase', async ({ page }) => {
    await page.goto('/');

    await page.fill('#hero-waitlist-name', 'E2E Test User');
    await page.fill('#hero-waitlist-email', TEST_EMAIL);
    await page.fill('#hero-waitlist-company', 'Test Corp');
    await page.fill('#hero-waitlist-role', 'QA Engineer');

    await page.click('button:has-text("Join the Waitlist")');

    await expect(page.getByText("You're on the list!")).toBeVisible({ timeout: 10_000 });

    const entry = await getWaitlistEntry(TEST_EMAIL);
    expect(entry).not.toBeNull();
    expect(entry!.name).toBe('E2E Test User');
    expect(entry!.company).toBe('Test Corp');
    expect(entry!.role).toBe('QA Engineer');
    expect(entry!.source).toBe('landing-page');
  });

  test('browser validation prevents submit without name', async ({ page }) => {
    await page.goto('/');
    await page.fill('#hero-waitlist-email', 'no-name@test.com');
    await page.click('button:has-text("Join the Waitlist")');
    // Form should still be visible (browser blocked submit)
    await expect(page.locator('#hero-waitlist-name')).toBeVisible();
  });

  test('browser validation prevents submit without email', async ({ page }) => {
    await page.goto('/');
    await page.fill('#hero-waitlist-name', 'No Email User');
    await page.click('button:has-text("Join the Waitlist")');
    // Form should still be visible
    await expect(page.locator('#hero-waitlist-email')).toBeVisible();
  });
});
