import { test, expect } from '@playwright/test';

test.describe('Admin - Error Logs (/admin)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Watchman title', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Watchman/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('error stats cards are visible', async ({ page }) => {
    await expect(page.getByText('Total Logs')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Errors', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Warnings', { exact: true })).toBeVisible({ timeout: 10_000 });
    // "Info" stat card - use the uppercase tracking label inside the stats grid
    await expect(page.locator('.grid >> text=Info').first()).toBeVisible({ timeout: 10_000 });
  });

  test('filter by level dropdown is visible', async ({ page }) => {
    const levelFilter = page.locator('#level-filter');
    await expect(levelFilter).toBeVisible({ timeout: 10_000 });

    // Verify options exist
    await expect(levelFilter.locator('option[value="all"]')).toHaveText('All Levels');
    await expect(levelFilter.locator('option[value="error"]')).toHaveText('Errors Only');
    await expect(levelFilter.locator('option[value="warn"]')).toHaveText('Warnings Only');
    await expect(levelFilter.locator('option[value="info"]')).toHaveText('Info Only');
  });

  test('filter by source dropdown is visible', async ({ page }) => {
    const sourceFilter = page.locator('#source-filter');
    await expect(sourceFilter).toBeVisible({ timeout: 10_000 });
    await expect(sourceFilter.locator('option[value="all"]')).toHaveText('All Sources');
  });

  test('error log table or empty state renders', async ({ page }) => {
    // Wait for loading to finish
    await page.waitForLoadState('networkidle');

    // Either the table with "Error Log Entries" heading or the empty "All Clear" state
    const hasTable = await page.getByText('Error Log Entries').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('All Clear, Watchman').isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('click error row to view details in modal, then close', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Check if there are any log entries with a "View" button
    const viewButton = page.getByRole('button', { name: /View/i }).first();
    const hasLogs = await viewButton.isVisible().catch(() => false);

    if (hasLogs) {
      await viewButton.click();

      // Modal should show detail content
      await expect(page.getByText('Details').first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Timestamp').first()).toBeVisible();
      await expect(page.getByText('Source').first()).toBeVisible();
      await expect(page.getByText('Message').first()).toBeVisible();

      // Close the modal via the X button with aria-label="Close"
      const closeBtn = page.locator('dialog button[aria-label="Close"]');
      await closeBtn.click();
      // Dialog should close
      await expect(page.locator('dialog[open]')).not.toBeVisible();
    } else {
      // No logs exist - just verify the empty state
      await expect(page.getByText('All Clear, Watchman')).toBeVisible();
    }
  });

  test('refresh button works', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForLoadState('networkidle');
    // Page should still show the title after refresh
    await expect(
      page.getByRole('heading', { name: /The Watchman/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('level filter changes trigger reload', async ({ page }) => {
    const levelFilter = page.locator('#level-filter');
    await expect(levelFilter).toBeVisible({ timeout: 10_000 });

    // Change to "Errors Only"
    await levelFilter.selectOption('error');
    await page.waitForLoadState('networkidle');

    // Page should still be functional
    await expect(page.getByText('Total Logs')).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Admin - Audit Log (/admin/audit)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/audit');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Chronicle title', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Chronicle/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('audit entries table or empty state renders', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasTable = await page.getByText('Audit Log Entries').isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No Audit Entries Found').isVisible().catch(() => false);

    expect(hasTable || hasEmpty).toBeTruthy();
  });

  test('filter by entity type dropdown is visible', async ({ page }) => {
    // Entity type is a <select> with "All Entity Types" as default option
    const entitySelect = page.locator('select').filter({ hasText: 'All Entity Types' });
    await expect(entitySelect).toBeVisible({ timeout: 10_000 });
  });

  test('filter by action dropdown is visible', async ({ page }) => {
    const actionSelect = page.locator('select').filter({ hasText: 'All Actions' });
    await expect(actionSelect).toBeVisible({ timeout: 10_000 });
  });

  test('filter by actor text input is visible', async ({ page }) => {
    const actorInput = page.getByPlaceholder('Filter by actor...');
    await expect(actorInput).toBeVisible({ timeout: 10_000 });
  });

  test('clear filters button appears when filter is active', async ({ page }) => {
    // Initially, no Clear button should be visible since all filters are empty
    const clearBtn = page.getByRole('button', { name: /Clear/i });

    // Set a filter
    const actorInput = page.getByPlaceholder('Filter by actor...');
    await actorInput.fill('test-user');
    await page.waitForLoadState('networkidle');

    // Now Clear should be visible
    await expect(clearBtn).toBeVisible({ timeout: 10_000 });

    // Click clear
    await clearBtn.click();

    // Actor input should be empty
    await expect(actorInput).toHaveValue('');
  });

  test('expand a row to see details', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasEntries = await page.getByText('Audit Log Entries').isVisible().catch(() => false);

    if (hasEntries) {
      // Click the first expandable row (the rows have a cursor-pointer div)
      const firstRow = page.locator('tbody tr').first().locator('div.cursor-pointer');
      await firstRow.click();

      // Should show expanded details with "Full Entity ID" and "Changes / Metadata"
      await expect(page.getByText('Full Entity ID')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Changes / Metadata')).toBeVisible({ timeout: 10_000 });

      // Click again to collapse
      await firstRow.click();
      await expect(page.getByText('Full Entity ID')).not.toBeVisible();
    }
  });

  test('pagination controls are visible when entries exist', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasEntries = await page.getByText('Audit Log Entries').isVisible().catch(() => false);

    if (hasEntries) {
      // Pagination bar should show "Showing X-Y of Z"
      await expect(page.getByText(/Showing \d/).first()).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Page \d/i).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /Previous/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /Next/i })).toBeVisible();
    }
  });

  test('refresh button works', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /The Chronicle/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});
