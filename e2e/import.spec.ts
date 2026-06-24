import { test, expect } from '@playwright/test';

test.describe('Import Hub Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "The Receiving Ledger" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Receiving Ledger/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /import', async ({ page }) => {
    await expect(page).toHaveURL(/\/import/);
  });

  test('page description is visible', async ({ page }) => {
    await expect(
      page.getByText('Import expenses from external sources into your ledger')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Brex Card Transactions import option is visible', async ({ page }) => {
    await expect(page.getByText('Brex Card Transactions')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Import expenses from your Brex CSV export/)).toBeVisible();
  });

  test('PDF Invoice Upload import option is visible', async ({ page }) => {
    await expect(page.getByText('PDF Invoice Upload')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Extract expense details from PDF invoices/)).toBeVisible();
  });

  test('Begin Import buttons are visible for both options', async ({ page }) => {
    const beginButtons = page.getByRole('button', { name: /Begin Import/i });
    await expect(beginButtons.first()).toBeVisible({ timeout: 10_000 });
    const count = await beginButtons.count();
    expect(count).toBe(2);
  });

  test('Brex CSV Format help section is visible', async ({ page }) => {
    await expect(page.getByText('Brex CSV Format')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Transaction date, Amount, Original amount/)).toBeVisible();
  });

  test('clicking Brex Begin Import navigates to /import/brex', async ({ page }) => {
    const beginLink = page.locator('a[href="/import/brex"]');
    await expect(beginLink).toBeVisible({ timeout: 10_000 });
    await beginLink.click();
    await expect(page).toHaveURL(/\/import\/brex/);
  });
});

test.describe('Brex Import Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "Brex CSV Import" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Brex CSV Import/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /import/brex', async ({ page }) => {
    await expect(page).toHaveURL(/\/import\/brex/);
  });

  test('back link to Import Hub is visible', async ({ page }) => {
    await expect(
      page.getByText('Back to Import Hub')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('progress indicator shows Upload step as active', async ({ page }) => {
    // The progress labels should be visible
    await expect(page.getByText('Upload', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
    await expect(page.getByText('Confirm', { exact: true })).toBeVisible();
    await expect(page.getByText('Complete', { exact: true })).toBeVisible();
  });

  test('file upload area is visible with Upload Brex Export title', async ({ page }) => {
    await expect(page.getByText('Upload Brex Export')).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Upload your Brex CSV export file/)
    ).toBeVisible();
  });

  test('AI-Powered Suggestions note is visible', async ({ page }) => {
    await expect(page.getByText('AI-Powered Suggestions')).toBeVisible({ timeout: 10_000 });
  });

  test('back link navigates to /import', async ({ page }) => {
    await page.getByText('Back to Import Hub').click();
    await expect(page).toHaveURL(/\/import$/);
  });
});

test.describe('PDF Import Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import/pdf');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with "PDF Invoice Import" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /PDF Invoice Import/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /import/pdf', async ({ page }) => {
    await expect(page).toHaveURL(/\/import\/pdf/);
  });

  test('back link to Import Hub is visible', async ({ page }) => {
    await expect(
      page.getByText('Back to Import Hub')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('progress indicator shows Upload, Review, Complete steps', async ({ page }) => {
    await expect(page.getByText('Upload', { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Review', { exact: true })).toBeVisible();
    await expect(page.getByText('Complete', { exact: true })).toBeVisible();
  });

  test('file upload area is visible with Upload PDF Invoice title', async ({ page }) => {
    await expect(page.getByText('Upload PDF Invoice').first()).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/Upload a PDF invoice or receipt/)
    ).toBeVisible();
  });

  test('Extraction Tips note is visible', async ({ page }) => {
    await expect(page.getByText('Extraction Tips')).toBeVisible({ timeout: 10_000 });
  });

  test('back link navigates to /import', async ({ page }) => {
    await page.getByText('Back to Import Hub').click();
    await expect(page).toHaveURL(/\/import$/);
  });
});
