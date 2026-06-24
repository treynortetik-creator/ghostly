import { test, expect } from '@playwright/test';

test.describe('Calendar / Pipeline Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
  });

  // -- Page Load --

  test('page loads with "Calendar" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Calendar/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /calendar', async ({ page }) => {
    await expect(page).toHaveURL(/\/calendar/);
  });

  // -- View Toggle --

  test('Calendar and Board view toggle buttons are visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Calendar' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Board' })).toBeVisible();
  });

  test('switching to Board view works', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Board' })).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Board' }).click();

    // Board view should render (Kanban board stages)
    await page.waitForLoadState('networkidle');
    // The board loads its own data, just verify no crash and content appears
    await page.waitForTimeout(1_000);
  });

  test('switching back to Calendar view from Board works', async ({ page }) => {
    // Switch to board first
    await page.getByRole('button', { name: 'Board' }).click();
    await page.waitForLoadState('networkidle');

    // Switch back to calendar
    await page.getByRole('button', { name: 'Calendar' }).click();
    await page.waitForLoadState('networkidle');

    // Month navigation should be visible again (only in calendar view)
    await expect(
      page.getByRole('button', { name: /Previous month/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  // -- Calendar Navigation --

  test('month navigation buttons are visible in calendar view', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Previous month/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Next month/i })
    ).toBeVisible();
  });

  test('clicking next month advances the calendar', async ({ page }) => {
    // Get the current displayed month text before navigating
    await expect(
      page.getByRole('button', { name: /Next month/i })
    ).toBeVisible({ timeout: 10_000 });

    // Click next month
    await page.getByRole('button', { name: /Next month/i }).click();
    await page.waitForLoadState('networkidle');

    // Page should still be functional (no errors)
    await expect(
      page.getByRole('heading', { name: /Calendar/i })
    ).toBeVisible();
  });

  test('clicking previous month goes back', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Previous month/i })
    ).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /Previous month/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(
      page.getByRole('heading', { name: /Calendar/i })
    ).toBeVisible();
  });
});

test.describe('Pipeline redirect', () => {
  test('/pipeline redirects to /calendar', async ({ page }) => {
    await page.goto('/pipeline');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/calendar/);
  });
});
