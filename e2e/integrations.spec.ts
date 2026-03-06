import { test, expect } from '@playwright/test';

test.describe('Integrations Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/integrations');
    await page.waitForLoadState('networkidle');
  });

  // -- Page Load --

  test('page loads with "Integrations" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Integrations', exact: true })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /integrations', async ({ page }) => {
    await expect(page).toHaveURL(/\/integrations/);
  });

  test('page description mentions external services and notifications', async ({ page }) => {
    await expect(
      page.getByText(/Connect external services/)
    ).toBeVisible({ timeout: 10_000 });
  });

  // -- Refresh Button --

  test('Refresh button is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Integrations', exact: true })
    ).toBeVisible({ timeout: 10_000 });
    const refreshBtn = page.getByRole('button').filter({ hasText: /Refresh/i });
    await expect(refreshBtn).toBeVisible();
  });

  // -- Slack Connection Section --

  test('Slack Connection section is visible', async ({ page }) => {
    await expect(page.getByText('Slack Connection')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText('Connect your Slack workspace to receive notifications')
    ).toBeVisible();
  });

  test('Slack section shows either Connect button or Connected status', async ({ page }) => {
    // Wait for loading to complete
    await expect(page.getByText('Slack Connection')).toBeVisible({ timeout: 10_000 });

    // Either "Connect Slack" button or "Connected" badge should be present
    const connectButton = page.getByRole('button', { name: /Connect Slack/i });
    const connectedBadge = page.getByText('Connected', { exact: true });

    const hasConnect = await connectButton.isVisible().catch(() => false);
    const hasConnected = await connectedBadge.isVisible().catch(() => false);

    expect(hasConnect || hasConnected).toBeTruthy();
  });

  // -- Section Collapse/Expand --

  test('Slack Connection section can be collapsed and expanded', async ({ page }) => {
    // The section description should initially be visible
    const description = page.getByText('Connect your Slack workspace to receive notifications');
    await expect(description).toBeVisible({ timeout: 10_000 });

    // The section header is a button containing the title text - click to collapse
    const sectionToggle = page.getByRole('button', { name: /Slack Connection/i });
    await sectionToggle.click();

    // After collapsing, the "No Slack workspace connected" text or "Connected" status should be hidden
    // Use a generic check: the description inside CardContent should not be visible
    const noSlackText = page.getByText('No Slack workspace connected');
    const connectedText = page.getByText('Connected', { exact: true });

    const noSlackVisible = await noSlackText.isVisible().catch(() => false);
    const connectedVisible = await connectedText.isVisible().catch(() => false);
    expect(noSlackVisible || connectedVisible).toBeFalsy();

    // Click again to expand
    await sectionToggle.click();
    await page.waitForTimeout(300);

    // Content should reappear
    const noSlackVisible2 = await noSlackText.isVisible().catch(() => false);
    const connectedVisible2 = await connectedText.isVisible().catch(() => false);
    expect(noSlackVisible2 || connectedVisible2).toBeTruthy();
  });

  // -- About Integrations Info Card --

  test('About Integrations info card is visible', async ({ page }) => {
    await expect(page.getByText('About Integrations')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Connect Slack to receive real-time notifications/)
    ).toBeVisible();
  });
});
