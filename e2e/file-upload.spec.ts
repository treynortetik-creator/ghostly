import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const FIXTURES_DIR = path.resolve(__dirname, 'fixtures');

// ============================================
// BREX CSV IMPORT — FILE UPLOAD TESTS
// ============================================

test.describe('Brex CSV Import — File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /Brex CSV Import/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('upload valid CSV and see parsed transactions in review step', async ({ page }) => {
    const csvPath = path.join(FIXTURES_DIR, 'test-expenses.csv');

    // Target the specific CSV file input (not the chat widget's file input)
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    // After upload + API processing, should move to review step
    await expect(
      page.getByText('test-expenses.csv').or(page.getByText('3 transactions')).first()
    ).toBeVisible({ timeout: 30_000 });

    // Should show the review step — look for a vendor name from the CSV
    await expect(page.getByText('Office Supplies Co')).toBeVisible({ timeout: 15_000 });
  });

  test('review step shows action buttons after CSV upload', async ({ page }) => {
    const csvPath = path.join(FIXTURES_DIR, 'test-expenses.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for review step
    await expect(
      page.getByText('test-expenses.csv').or(page.getByText('3 transactions')).first()
    ).toBeVisible({ timeout: 30_000 });

    // Should have action buttons in the review step
    await expect(page.getByRole('button', { name: /Start Over/i })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Continue to Confirm/i })).toBeVisible();
  });

  test('Start Over button returns to upload step', async ({ page }) => {
    const csvPath = path.join(FIXTURES_DIR, 'test-expenses.csv');
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await fileInput.setInputFiles(csvPath);

    // Wait for review step
    await expect(
      page.getByRole('button', { name: /Start Over/i })
    ).toBeVisible({ timeout: 30_000 });

    // Click Start Over
    await page.getByRole('button', { name: /Start Over/i }).click();

    // Should be back at upload step
    await expect(page.getByText('Upload Brex Export')).toBeVisible({ timeout: 10_000 });
  });

  test('file input accepts .csv files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".csv"]');
    await expect(fileInput).toHaveCount(1);
    await expect(fileInput).toHaveAttribute('accept', '.csv');
  });

  test('Browse Files button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Browse Files/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ============================================
// PDF IMPORT — FILE UPLOAD TESTS
// ============================================

test.describe('PDF Import — File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/import/pdf');
    await page.waitForLoadState('networkidle');
    await expect(
      page.getByRole('heading', { name: /PDF Invoice Import/i })
    ).toBeVisible({ timeout: 15_000 });
  });

  test('file input accepts only PDF files', async ({ page }) => {
    const fileInput = page.locator('input[type="file"][accept=".pdf,application/pdf"]');
    await expect(fileInput).toHaveCount(1);
    await expect(fileInput).toHaveAttribute('accept', '.pdf,application/pdf');
  });

  test('uploading a CSV as PDF shows client-side validation error', async ({ page }) => {
    const csvPath = path.join(FIXTURES_DIR, 'test-expenses.csv');
    const fileInput = page.locator('input[type="file"][accept=".pdf,application/pdf"]');

    // Force upload a CSV file to a PDF-only input
    await fileInput.setInputFiles(csvPath);

    // The PDFUpload component validates client-side and shows "Upload Error" heading
    await expect(page.getByText('Upload Error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Invalid file type/i)).toBeVisible();
  });

  test('uploading a fake PDF file shows server-side error', async ({ page }) => {
    // Create a fake .pdf file (just text content, not a real PDF)
    const fakePdfPath = path.join(FIXTURES_DIR, 'fake-invoice.pdf');
    fs.writeFileSync(fakePdfPath, 'This is not a real PDF file. Just plain text.');

    try {
      const fileInput = page.locator('input[type="file"][accept=".pdf,application/pdf"]');
      await fileInput.setInputFiles(fakePdfPath);

      // The file passes client-side validation (has .pdf extension)
      // but the server should reject it or fail to parse it
      // Look for the page-level error display (not the component-level)
      await expect(
        page.locator('.text-destructive').first()
      ).toBeVisible({ timeout: 30_000 });
    } finally {
      if (fs.existsSync(fakePdfPath)) fs.unlinkSync(fakePdfPath);
    }
  });

  test('Browse Files button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Browse Files/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('upload area shows PDF-specific instructions', async ({ page }) => {
    await expect(page.getByText('Upload PDF Invoice').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Drag and drop your PDF/)).toBeVisible();
    await expect(page.getByText(/PDF files/)).toBeVisible();
  });
});

// ============================================
// ERROR HANDLING TESTS
// ============================================

test.describe('File Upload — Error Handling', () => {
  test('Brex import: uploading empty CSV shows error', async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');

    const emptyPath = path.join(FIXTURES_DIR, 'empty.csv');
    fs.writeFileSync(emptyPath, '');

    try {
      const fileInput = page.locator('input[type="file"][accept=".csv"]');
      await fileInput.setInputFiles(emptyPath);

      // Should show the page-level error with destructive styling
      await expect(page.locator('p.text-destructive').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      if (fs.existsSync(emptyPath)) fs.unlinkSync(emptyPath);
    }
  });

  test('Brex import: CSV with header only (no data rows) shows error', async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');

    const headerOnlyPath = path.join(FIXTURES_DIR, 'header-only.csv');
    fs.writeFileSync(
      headerOnlyPath,
      'Transaction date,Amount,Original amount,Original currency,Merchant,Memo,Expense status,Payment status\n'
    );

    try {
      const fileInput = page.locator('input[type="file"][accept=".csv"]');
      await fileInput.setInputFiles(headerOnlyPath);

      // Should show error (header-only CSV may trigger "must have a header row and at least one data row" or "No valid transactions")
      await expect(
        page.locator('p.text-destructive').first()
      ).toBeVisible({ timeout: 15_000 });
    } finally {
      if (fs.existsSync(headerOnlyPath)) fs.unlinkSync(headerOnlyPath);
    }
  });

  test('Brex import: CSV with wrong columns shows error', async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');

    const badColumnsPath = path.join(FIXTURES_DIR, 'bad-columns.csv');
    fs.writeFileSync(
      badColumnsPath,
      'Name,Email,Phone\nJohn,john@example.com,555-1234\n'
    );

    try {
      const fileInput = page.locator('input[type="file"][accept=".csv"]');
      await fileInput.setInputFiles(badColumnsPath);

      // Should show error about missing required columns (e.g. "must have a")
      await expect(page.getByText(/must have/i).first()).toBeVisible({ timeout: 15_000 });
    } finally {
      if (fs.existsSync(badColumnsPath)) fs.unlinkSync(badColumnsPath);
    }
  });

  test('Brex import: uploading a non-CSV file shows error', async ({ page }) => {
    await page.goto('/import/brex');
    await page.waitForLoadState('networkidle');

    const txtPath = path.join(FIXTURES_DIR, 'test.txt');
    fs.writeFileSync(txtPath, 'This is a text file, not a CSV.');

    try {
      const fileInput = page.locator('input[type="file"][accept=".csv"]');
      await fileInput.setInputFiles(txtPath);

      // Client-side validation should reject non-.csv file
      await expect(page.getByText('Upload Error')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/Invalid file type/i)).toBeVisible();
    } finally {
      if (fs.existsSync(txtPath)) fs.unlinkSync(txtPath);
    }
  });

  test('PDF import: uploading empty file shows error', async ({ page }) => {
    await page.goto('/import/pdf');
    await page.waitForLoadState('networkidle');

    const emptyPdfPath = path.join(FIXTURES_DIR, 'empty.pdf');
    fs.writeFileSync(emptyPdfPath, '');

    try {
      const fileInput = page.locator('input[type="file"][accept=".pdf,application/pdf"]');
      await fileInput.setInputFiles(emptyPdfPath);

      // Should show error (either client-side or server-side)
      await expect(page.locator('.text-destructive').first()).toBeVisible({ timeout: 15_000 });
    } finally {
      if (fs.existsSync(emptyPdfPath)) fs.unlinkSync(emptyPdfPath);
    }
  });
});
