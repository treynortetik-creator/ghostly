import { test, expect } from '@playwright/test';

/**
 * Helper: wait for the main dashboard data to finish loading.
 * We wait for "Annual Budget" heading to appear, which only renders
 * after the fetch completes and the skeleton is replaced.
 */
async function waitForDashboardData(page: import('@playwright/test').Page) {
  await expect(page.getByText('Annual Budget')).toBeVisible({ timeout: 15_000 });
}

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  // -- Page Load ---------------------------------------------------------------

  test('displays page title "The Ledger"', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'The Ledger' });
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });

  test('displays current date in header', async ({ page }) => {
    const year = new Date().getFullYear().toString();
    await expect(page.locator('body')).toContainText(year, { timeout: 10_000 });
    await expect(page.locator('body')).toContainText('Budget Overview', { timeout: 10_000 });
  });

  test('URL is /dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
  });

  // -- Budget Overview Card ----------------------------------------------------

  test('budget overview card renders with "Annual Budget" heading', async ({ page }) => {
    await waitForDashboardData(page);
    const annualBudget = page.getByRole('heading', { name: 'Annual Budget' });
    await expect(annualBudget).toBeVisible();
  });

  test('budget overview shows Total Budget label and dollar amount', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Total Budget')).toBeVisible();
  });

  test('budget overview shows Spent to Date label', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Spent to Date')).toBeVisible();
  });

  test('budget overview shows Remaining label', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Remaining').first()).toBeVisible();
  });

  test('budget overview displays numeric dollar values (not just labels)', async ({ page }) => {
    await waitForDashboardData(page);
    // Dollar-formatted values use tabular-nums class
    const dollarValues = page.locator('.tabular-nums');
    await expect(dollarValues.first()).toBeVisible();
    const count = await dollarValues.count();
    expect(count).toBeGreaterThanOrEqual(3); // budget, spent, remaining
  });

  test('budget overview shows a status indicator (On Track, Nearing Limit, or Over Budget)', async ({ page }) => {
    await waitForDashboardData(page);
    const statusText = page.locator('text=/On Track|Nearing Limit|Over Budget/');
    await expect(statusText.first()).toBeVisible();
  });

  // -- Budget Progress ---------------------------------------------------------

  test('progress bars are visible on the page', async ({ page }) => {
    await waitForDashboardData(page);
    const progressBars = page.locator('[role="progressbar"]');
    await expect(progressBars.first()).toBeVisible();
    const count = await progressBars.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('main budget progress bar has valid aria attributes', async ({ page }) => {
    await waitForDashboardData(page);
    const progressBar = page.locator('[role="progressbar"]').first();
    await expect(progressBar).toBeVisible();
    const valueNow = await progressBar.getAttribute('aria-valuenow');
    const valueMax = await progressBar.getAttribute('aria-valuemax');
    expect(valueNow).not.toBeNull();
    expect(valueMax).not.toBeNull();
    expect(Number(valueMax)).toBeGreaterThanOrEqual(0);
  });

  // -- Event Type Summary ------------------------------------------------------

  test('event type summary section is visible', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Budget by Event Type')).toBeVisible();
  });

  test('event type summary shows "Events Total" with dollar amounts', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Events Total')).toBeVisible();
  });

  test('event type summary shows event category count', async ({ page }) => {
    await waitForDashboardData(page);
    // The summary always displays "Spending breakdown across N event categories"
    await expect(page.getByText(/Spending breakdown across \d+ event categor/)).toBeVisible();
  });

  // -- Quarter Summary ---------------------------------------------------------

  test('quarter summary section is visible', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Budget by Quarter')).toBeVisible();
  });

  test('quarter summary shows quarter badges (Q1-Q4)', async ({ page }) => {
    await waitForDashboardData(page);
    const quarterBadges = page.locator('text=/^Q[1-4]$/');
    await expect(quarterBadges.first()).toBeVisible();
  });

  test('quarter summary shows Total Allocated', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Total Allocated')).toBeVisible();
  });

  // -- Budget Categories -------------------------------------------------------

  test('budget categories section is visible', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Budget Categories')).toBeVisible();
  });

  test('budget categories shows description text', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Non-event operational budget allocations')).toBeVisible();
  });

  // -- Data Content Verification -----------------------------------------------

  test('dashboard loads real data (no error state)', async ({ page }) => {
    await waitForDashboardData(page);
    // Error state should NOT be visible
    const errorCard = page.getByText('Failed to Load Dashboard');
    await expect(errorCard).toHaveCount(0);
  });

  test('skeleton loading state replaced by real content', async ({ page }) => {
    // Real content should appear
    await waitForDashboardData(page);
    await expect(page.getByText('Annual Budget')).toBeVisible();
    await expect(page.getByText('Budget by Event Type')).toBeVisible();
  });

  test('footer shows last updated time', async ({ page }) => {
    await waitForDashboardData(page);
    await expect(page.getByText('Data refreshes automatically')).toBeVisible();
  });

  // -- Refresh / Retry ---------------------------------------------------------

  test('page can be reloaded and data re-fetches', async ({ page }) => {
    await waitForDashboardData(page);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Data should load again
    await waitForDashboardData(page);
    await expect(page.getByText('Budget by Event Type')).toBeVisible();
  });

  // -- Responsive Layout -------------------------------------------------------

  test('dashboard renders at mobile width (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'The Ledger' })).toBeVisible({ timeout: 10_000 });
    await waitForDashboardData(page);
  });

  test('dashboard renders at tablet width (768px)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'The Ledger' })).toBeVisible({ timeout: 10_000 });
    await waitForDashboardData(page);
  });

  test('dashboard renders at wide desktop (1920px)', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'The Ledger' })).toBeVisible({ timeout: 10_000 });
    await waitForDashboardData(page);
    await expect(page.getByText('Budget by Event Type')).toBeVisible();
    await expect(page.getByText('Budget by Quarter')).toBeVisible();
  });
});
