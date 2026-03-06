import { test, expect, type Page } from '@playwright/test';

/**
 * Expenses page E2E tests.
 *
 * The page lives at /expenses and renders:
 *  - Header with title "The Expense Register" and total amount
 *  - "Add Expense" button that opens an inline ExpenseForm
 *  - ExpenseList with filters, sort controls, and ExpenseCard items
 *  - Each ExpenseCard shows vendor, amount, date, target (event/category)
 *  - Edit / Delete actions per card
 *  - ConfirmDialog (<dialog>) for delete confirmation
 */

const TEST_VENDOR = 'PW-Test-Vendor';
const TEST_AMOUNT = '42.99';
const TEST_MEMO = 'Playwright test expense';
const EDITED_VENDOR = 'PW-Edited-Vendor';
const EDITED_AMOUNT = '99.50';

/** Wait for the expenses page to finish loading (skeleton pulses gone). */
async function waitForExpensesLoaded(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 15_000 });
  // The summary bar contains "Select all" once data is loaded
  await page.locator('text=Select all').waitFor({ state: 'visible', timeout: 15_000 });
}

/** Locate the main content area (not sidebar) */
function mainContent(page: Page) {
  // The main content is inside a <main> tag from AppShell
  return page.locator('main');
}

test.describe('Expenses Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/expenses');
    await waitForExpensesLoaded(page);
  });

  // ── Page load & header ──────────────────────────────────────────

  test('page loads with title containing "Expense"', async ({ page }) => {
    const heading = page.getByRole('heading', { name: 'The Expense Register' });
    await expect(heading).toBeVisible({ timeout: 10_000 });
    await expect(heading).toContainText('Expense');
  });

  test('total amount displayed in header', async ({ page }) => {
    // The subtitle shows "$X total"
    const subtitle = mainContent(page).locator('p').filter({ hasText: 'total' });
    await expect(subtitle).toBeVisible({ timeout: 10_000 });
    await expect(subtitle).toContainText('$');
  });

  test('expense list renders with entries', async ({ page }) => {
    // The summary bar shows a count like "14 expenses"
    const countText = mainContent(page).locator('span').filter({ hasText: /^\d+\s+expense/ });
    await expect(countText).toBeVisible({ timeout: 10_000 });
  });

  test('each expense shows amount, vendor, date, and target', async ({ page }) => {
    // ExpenseCard components are rendered inside divs with class "space-y-3"
    // Each card has an h3 for vendor, a .tabular-nums for amount, and "(Event)" or "(Category)"
    const expenseCards = mainContent(page).locator('button[aria-label="Edit expense"]');
    const cardCount = await expenseCards.count();
    expect(cardCount).toBeGreaterThan(0);

    // Check the first expense card's parent container
    const firstEditBtn = expenseCards.first();
    // Navigate up to the card container
    const firstCard = firstEditBtn.locator('xpath=ancestor::div[contains(@class,"py-4") or contains(@class,"py-3")]').first();
    await expect(firstCard).toBeVisible({ timeout: 10_000 });

    // Vendor heading (h3)
    await expect(firstCard.locator('h3').first()).toBeVisible();

    // Amount – formatted currency in tabular-nums span
    await expect(firstCard.locator('.tabular-nums').first()).toBeVisible();

    // Target – shows "(Event)" or "(Category)"
    await expect(firstCard.locator('text=/(Event|Category)/')).toBeVisible();
  });

  test('"Add Expense" button is visible', async ({ page }) => {
    const addBtn = page.getByRole('button', { name: /Add Expense/i });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });

  // ── Refresh ──────────────────────────────────────────────────────

  test('refresh button works', async ({ page }) => {
    // Use getByText to target the specific button with "Refresh" text content
    const refreshBtn = mainContent(page).getByRole('button', { name: 'Refresh' });
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    // Page should still show expenses in the summary bar
    const countText = mainContent(page).locator('span').filter({ hasText: /^\d+\s+expense/ });
    await expect(countText).toBeVisible({ timeout: 10_000 });
  });

  // ── Currency formatting ─────────────────────────────────────────

  test('amounts show $ and proper formatting', async ({ page }) => {
    // Check header total uses $ formatting with cents
    const headerSubtitle = mainContent(page).locator('p').filter({ hasText: 'total' });
    const text = await headerSubtitle.textContent();
    expect(text).toMatch(/\$[\d,]+\.\d{2}/);
  });

  // ── Filters ─────────────────────────────────────────────────────

  test('filter by event', async ({ page }) => {
    const eventSelect = page.locator('#filter-event');
    await expect(eventSelect).toBeVisible({ timeout: 10_000 });

    // Pick the first non-empty option
    const options = eventSelect.locator('option');
    const optionCount = await options.count();
    if (optionCount > 1) {
      const optionValue = await options.nth(1).getAttribute('value');
      await eventSelect.selectOption(optionValue!);
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      // A filter pill should appear with "Event:"
      await expect(page.locator('text=/Event:/')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('filter by category', async ({ page }) => {
    const categorySelect = page.locator('#filter-category');
    await expect(categorySelect).toBeVisible({ timeout: 10_000 });

    const options = categorySelect.locator('option');
    const optionCount = await options.count();
    if (optionCount > 1) {
      const optionValue = await options.nth(1).getAttribute('value');
      await categorySelect.selectOption(optionValue!);
      await page.waitForLoadState('networkidle', { timeout: 10_000 });
      await expect(page.locator('text=/Category:/')).toBeVisible({ timeout: 10_000 });
    }
  });

  test('search/filter by vendor', async ({ page }) => {
    const vendorInput = page.locator('input[placeholder="Search vendor..."]');
    await expect(vendorInput).toBeVisible({ timeout: 10_000 });

    // Type a search term that is unlikely to match anything
    await vendorInput.fill('zzzzz-no-match');

    // Should show "No Expenses Found" heading
    await expect(
      page.getByRole('heading', { name: 'No Expenses Found' })
    ).toBeVisible({ timeout: 10_000 });

    // Clear and verify list comes back
    await vendorInput.fill('');
    const countText = mainContent(page).locator('span').filter({ hasText: /^\d+\s+expense/ });
    await expect(countText).toBeVisible({ timeout: 10_000 });
  });

  // ── CRUD: Create → Edit → Delete ───────────────────────────────

  test('create expense flow', async ({ page }) => {
    // Click "Add Expense"
    await page.getByRole('button', { name: /Add Expense/i }).click();

    // The inline form should appear with title "Record New Expense"
    await expect(page.locator('text=Record New Expense')).toBeVisible({ timeout: 10_000 });

    // Fill amount
    await page.locator('#amount').fill(TEST_AMOUNT);

    // Fill vendor
    await page.locator('#vendor').fill(TEST_VENDOR);

    // Fill memo
    await page.locator('#memo').fill(TEST_MEMO);

    // Date defaults to today, leave it

    // Target type defaults to "event" – select the first event
    const eventSelect = page.locator('#event_id');
    const eventOptions = eventSelect.locator('option');
    const eventOptCount = await eventOptions.count();
    expect(eventOptCount).toBeGreaterThan(1); // at least one real event
    const firstEventValue = await eventOptions.nth(1).getAttribute('value');
    await eventSelect.selectOption(firstEventValue!);

    // Submit
    await page.getByRole('button', { name: /Record Expense/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Form should close
    await expect(page.locator('text=Record New Expense')).not.toBeVisible({ timeout: 10_000 });

    // New expense should appear in the list
    await expect(page.locator(`text=${TEST_VENDOR}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('edit expense', async ({ page }) => {
    // Make sure our test expense exists
    await expect(page.locator(`text=${TEST_VENDOR}`).first()).toBeVisible({ timeout: 10_000 });

    // Find the Card that contains our test vendor. Each card is a div.bg-card
    // containing the vendor h3 and action buttons.
    const testCard = page.locator('div.bg-card').filter({ hasText: TEST_VENDOR }).first();
    const editBtn = testCard.locator('button[aria-label="Edit expense"]');
    await editBtn.click();

    // The edit form should appear with "Edit Expense Record"
    await expect(page.locator('text=Edit Expense Record')).toBeVisible({ timeout: 10_000 });

    // Modify vendor
    const vendorInput = page.locator('#vendor');
    await vendorInput.fill(EDITED_VENDOR);

    // Modify amount
    const amountInput = page.locator('#amount');
    await amountInput.fill(EDITED_AMOUNT);

    // Save
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // Form should close
    await expect(page.locator('text=Edit Expense Record')).not.toBeVisible({ timeout: 10_000 });

    // Verify changes reflected
    await expect(page.locator(`text=${EDITED_VENDOR}`).first()).toBeVisible({ timeout: 10_000 });
  });

  test('delete expense', async ({ page }) => {
    // Make sure the edited expense exists
    await expect(page.locator(`text=${EDITED_VENDOR}`).first()).toBeVisible({ timeout: 10_000 });

    // Find the Card that contains our edited vendor
    const testCard = page.locator('div.bg-card').filter({ hasText: EDITED_VENDOR }).first();
    const deleteBtn = testCard.locator('button[aria-label="Delete expense"]');
    await deleteBtn.click();

    // ConfirmDialog should appear — target the open one
    const dialog = page.locator('dialog[open]');
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText('Delete Expense');

    // Click the destructive "Delete" confirm button inside the dialog
    // The ConfirmDialog has a Cancel (secondary) and Delete (destructive) button
    const confirmBtn = dialog.locator('button').filter({ hasText: /^Delete$/ });
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });
    await confirmBtn.click({ force: true });

    // Wait for the dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 10_000 });

    // Wait for optimistic delete and network to settle
    await page.waitForLoadState('networkidle', { timeout: 15_000 });

    // The expense should no longer appear
    await expect(page.locator(`h3:has-text("${EDITED_VENDOR}")`)).toHaveCount(0, { timeout: 10_000 });
  });
});
