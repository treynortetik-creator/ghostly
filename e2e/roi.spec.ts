import { test, expect } from '@playwright/test';

test.describe('ROI Dashboard (/roi)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/roi');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Return on Investment title', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Return on Investment/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('summary cards are visible', async ({ page }) => {
    await expect(page.getByText('Total Spend')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Pipeline')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Revenue')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Overall ROI')).toBeVisible({ timeout: 10_000 });
  });

  test('ROI by Event Type table renders', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /ROI by Event Type/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Performance breakdown across event categories')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Event Performance table renders', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Event Performance/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('All events sorted by ROI')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('ROI percentages are displayed', async ({ page }) => {
    // The page should display ROI values as percentages (e.g., "50.0%" or "N/A")
    await expect(page.getByText('Overall ROI')).toBeVisible({ timeout: 10_000 });

    // The overall ROI stat card should show either a percentage or N/A
    const overallRoiCard = page.locator('text=Overall ROI').locator('..');
    const cardText = await overallRoiCard.textContent();
    expect(cardText).toMatch(/([\d.]+%|N\/A)/);
  });

  test('refresh button works', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();

    // Should show loading state then re-render
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /Return on Investment/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('click event name navigates to event detail', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Find the first event link in the Event Performance table
    // Events are rendered as links with href="/events/{id}"
    const eventLink = page.locator('a[href^="/events/"]').first();
    const linkVisible = await eventLink.isVisible().catch(() => false);

    if (linkVisible) {
      await eventLink.click();
      await expect(page).toHaveURL(/\/events\/[a-f0-9-]+/i, { timeout: 10_000 });
    } else {
      // No events to click - just verify the empty message
      await expect(page.getByText('No events found')).toBeVisible();
    }
  });

  test('subtitle shows event count', async ({ page }) => {
    // The subtitle reads "Event ROI performance across N events"
    await expect(
      page.getByText(/Event ROI performance across \d+ events/i)
    ).toBeVisible({ timeout: 10_000 });
  });
});
