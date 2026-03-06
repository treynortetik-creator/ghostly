import { test, expect } from '@playwright/test';

test.describe('Export Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/export');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "The Ledger Dispatch" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Ledger Dispatch/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /export', async ({ page }) => {
    await expect(page).toHaveURL(/\/export/);
  });

  test('page description text is visible', async ({ page }) => {
    await expect(
      page.getByText('Export your ledger records for analysis or archival purposes')
    ).toBeVisible({ timeout: 10_000 });
  });

  // -- Scope Options --

  test('scope options are visible (Year, Quarter, Month, Custom)', async ({ page }) => {
    await expect(page.getByText('Entire Fiscal Year')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Specific Quarter')).toBeVisible();
    await expect(page.getByText('Specific Month')).toBeVisible();
    await expect(page.getByText('Custom Date Range').first()).toBeVisible();
  });

  // -- Format Options --

  test('format options are visible (CSV, Excel)', async ({ page }) => {
    await expect(page.getByText('CSV File', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Excel Workbook', { exact: true })).toBeVisible();
  });

  // -- Preview Section --

  test('preview section loads (not stuck loading forever)', async ({ page }) => {
    // The export button should become enabled once preview finishes loading
    const exportButton = page.getByRole('button', { name: /Export as/i });
    await expect(exportButton).toBeVisible({ timeout: 15_000 });
    // Wait for it to not be in loading/disabled state (preview loaded)
    await expect(exportButton).toBeEnabled({ timeout: 15_000 });
  });

  // -- Export Button --

  test('export button shows correct format label', async ({ page }) => {
    // Default format is Excel
    const exportButton = page.getByRole('button', { name: /Export as Excel/i });
    await expect(exportButton).toBeVisible({ timeout: 15_000 });
  });

  test('clicking CSV format updates export button text', async ({ page }) => {
    // Wait for page to fully load
    await expect(page.getByText('CSV File', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Click the CSV option
    await page.getByText('CSV File', { exact: true }).click();

    // Export button should now say CSV
    await expect(
      page.getByRole('button', { name: /Export as CSV/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  // -- Export Notes --

  test('export notes section is visible', async ({ page }) => {
    await expect(page.getByText('Export Notes')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/CSV files contain a single sheet/)).toBeVisible();
    await expect(page.getByText(/Excel files include separate worksheets/)).toBeVisible();
    await expect(page.getByText(/All monetary values are in USD/)).toBeVisible();
  });

  // -- Footer --

  test('footer quote is visible', async ({ page }) => {
    await expect(
      page.getByText(/well-kept ledger/)
    ).toBeVisible({ timeout: 10_000 });
  });
});
