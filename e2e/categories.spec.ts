import { test, expect } from '@playwright/test';

test.describe('Categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Category Ledger title', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /category ledger/i })).toBeVisible({ timeout: 10_000 });
  });

  test('category list renders with summary stats', async ({ page }) => {
    // Summary stats bar shows categories count, budget, spent, remaining
    await expect(page.getByText(/Budget:/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Spent:/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Remaining:/i)).toBeVisible({ timeout: 10_000 });
  });

  test('each category shows name and budget info', async ({ page }) => {
    // Category cards are links to detail pages
    const firstCard = page.locator('a[href^="/categories/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });
    // Budget progress info shows dollar amounts and "left"
    await expect(firstCard.getByText(/left$/)).toBeVisible({ timeout: 10_000 });
  });

  test('Add Category button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /add category/i })).toBeVisible({ timeout: 10_000 });
  });

  test('back navigation works from detail page', async ({ page }) => {
    // Click first category to go to detail
    const firstCategoryLink = page.locator('a[href^="/categories/"]').first();
    await expect(firstCategoryLink).toBeVisible({ timeout: 10_000 });
    await firstCategoryLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/categories\/.+/);

    // Click back link
    await page.getByText('Back to Categories').first().click();
    await page.waitForLoadState('networkidle');

    // Should be back on categories list
    await expect(page).toHaveURL(/\/categories$/);
    await expect(page.getByRole('heading', { name: /category ledger/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Categories CRUD', () => {
  test('create, navigate, edit (save), and delete category', async ({ page }) => {
    const TEST_CATEGORY_NAME = 'PW-Test-Category-' + Date.now();
    const EDITED_CATEGORY_NAME = TEST_CATEGORY_NAME + '-Edited';

    // --- CREATE ---
    await page.goto('/categories');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add category/i }).click();
    await expect(page.getByRole('heading', { name: /create new category/i })).toBeVisible({ timeout: 10_000 });

    await page.locator('#name').fill(TEST_CATEGORY_NAME);
    await page.locator('#budget_amount').fill('5000');
    await page.locator('#description').fill('Playwright E2E test category');

    await page.getByRole('button', { name: /create category/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify appears in list
    await expect(page.getByText(TEST_CATEGORY_NAME)).toBeVisible({ timeout: 10_000 });

    // --- NAVIGATE TO DETAIL ---
    await page.getByText(TEST_CATEGORY_NAME).click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/categories\/.+/);

    // Category name as heading
    await expect(page.getByRole('heading', { name: TEST_CATEGORY_NAME })).toBeVisible({ timeout: 10_000 });

    // Budget Overview card
    await expect(page.getByText('Budget Overview')).toBeVisible({ timeout: 10_000 });

    // Expenses heading
    await expect(page.getByRole('heading', { name: /expenses/i })).toBeVisible({ timeout: 10_000 });

    // Edit and Delete buttons
    await expect(page.getByRole('button', { name: /^edit$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^delete$/i })).toBeVisible();

    // Back to Categories link
    await expect(page.getByText('Back to Categories').first()).toBeVisible();

    // --- EDIT (change name and budget, then save) ---
    await page.getByRole('button', { name: /^edit$/i }).click();
    await expect(page.getByRole('heading', { name: /edit category details/i })).toBeVisible({ timeout: 10_000 });

    // Verify form is pre-populated with current values
    await expect(page.locator('#name')).toHaveValue(TEST_CATEGORY_NAME);
    await expect(page.locator('#budget_amount')).toHaveValue('5000');

    // Change the name and budget
    await page.locator('#name').clear();
    await page.locator('#name').fill(EDITED_CATEGORY_NAME);
    await page.locator('#budget_amount').clear();
    await page.locator('#budget_amount').fill('7500');

    // Save changes (bug fix: categories PUT now sanitizes empty fiscal_year_id to null)
    await page.getByRole('button', { name: /save changes/i }).click();
    await page.waitForLoadState('networkidle');

    // Should be back on detail view with updated name
    await expect(page.getByRole('heading', { name: EDITED_CATEGORY_NAME })).toBeVisible({ timeout: 10_000 });

    // --- DELETE ---
    await page.getByRole('button', { name: /^delete$/i }).click();
    await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /delete category/i }).click();
    await page.waitForLoadState('networkidle');

    // Should redirect back to categories list
    await expect(page).toHaveURL(/\/categories$/, { timeout: 10_000 });

    // Deleted category should not be in list (check both original and edited names)
    await expect(page.getByText(EDITED_CATEGORY_NAME)).not.toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(TEST_CATEGORY_NAME)).not.toBeVisible({ timeout: 5_000 });
  });
});
