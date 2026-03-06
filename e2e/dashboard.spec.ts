import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
  });

  test('loads the dashboard page with budget overview', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    // The dashboard shows budget-related content
    await expect(page.locator('body')).toContainText(/budget|total|actual/i);
  });

  test('sidebar navigation is visible with key links', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /dashboard/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /events/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /expenses/i })).toBeVisible();
  });

  test('can navigate to events page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /events/i }).click();
    await expect(page).toHaveURL(/\/events/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('can navigate to expenses page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /expenses/i }).click();
    await expect(page).toHaveURL(/\/expenses/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('can navigate to calendar page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /calendar/i }).click();
    await expect(page).toHaveURL(/\/calendar/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('can navigate to team page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /team/i }).click();
    await expect(page).toHaveURL(/\/team/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('can navigate to documents page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /documents/i }).click();
    await expect(page).toHaveURL(/\/documents/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('can navigate to settings page', async ({ page }) => {
    await page.locator('aside').getByRole('link', { name: /settings/i }).first().click();
    await expect(page).toHaveURL(/\/settings/);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
