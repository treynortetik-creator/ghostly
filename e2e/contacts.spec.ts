import { test, expect } from '@playwright/test';

const TEST_FIRST_NAME = 'PW-Test';
const TEST_LAST_NAME = 'Contact-' + Date.now();
const EDITED_LAST_NAME = 'ContactEdited-' + Date.now();
const TEST_FULL_NAME = `${TEST_FIRST_NAME} ${TEST_LAST_NAME}`;
const EDITED_FULL_NAME = `${TEST_FIRST_NAME} ${EDITED_LAST_NAME}`;

test.describe('Contacts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Contacts heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 10_000 });
  });

  test('contact count displayed', async ({ page }) => {
    // Shows "X contact(s) in your network"
    await expect(page.getByText(/\d+ contacts? in your network/i)).toBeVisible({ timeout: 10_000 });
  });

  test('search input visible', async ({ page }) => {
    await expect(page.getByPlaceholder('Search contacts...')).toBeVisible({ timeout: 10_000 });
  });

  test('filter buttons visible', async ({ page }) => {
    // Scope to main content area to avoid duplicate buttons in sidebar
    const main = page.getByRole('main');
    await expect(main.getByRole('button', { name: 'All' })).toBeVisible({ timeout: 10_000 });
    await expect(main.getByRole('button', { name: 'Vendors' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Leads' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Organizers' })).toBeVisible();
    await expect(main.getByRole('button', { name: 'Partners' })).toBeVisible();
  });

  test('contact list renders', async ({ page }) => {
    // Either cards are present or an empty state shows
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
    const pageContent = await body.textContent();
    const hasContacts = pageContent?.includes('in your network') ?? false;
    expect(hasContacts).toBeTruthy();
  });

  test('filter by type', async ({ page }) => {
    const main = page.getByRole('main');

    // Click "Vendors" filter
    await main.getByRole('button', { name: 'Vendors' }).click();
    await page.waitForLoadState('networkidle');

    // Page should still render without error
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 10_000 });

    // Click "All" to reset
    await main.getByRole('button', { name: 'All' }).click();
    await page.waitForLoadState('networkidle');
  });
});

test.describe('Contacts CRUD', () => {
  test('create, search, edit, and delete contact', async ({ page }) => {
    // --- CREATE ---
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add contact/i }).click();

    // Form modal should appear - use heading role to avoid ambiguity
    await expect(page.getByRole('heading', { name: 'Add Contact' })).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('First name').fill(TEST_FIRST_NAME);
    await page.getByPlaceholder('Last name').fill(TEST_LAST_NAME);
    await page.getByPlaceholder('Company name').fill('PW-Test Corp');
    await page.getByPlaceholder('email@company.com').fill('pw-test@example.com');
    await page.locator('select').selectOption('vendor');

    // Submit using the button inside the form
    await page.locator('form').getByRole('button', { name: /add contact/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify appears in list
    await expect(page.getByText(TEST_FULL_NAME)).toBeVisible({ timeout: 10_000 });

    // --- SEARCH ---
    const searchInput = page.getByPlaceholder('Search contacts...');
    await searchInput.fill(TEST_LAST_NAME);
    await page.waitForLoadState('networkidle');

    // Our test contact should be visible
    await expect(page.getByText(TEST_FULL_NAME)).toBeVisible({ timeout: 10_000 });

    // Clear search
    await searchInput.clear();
    await page.waitForLoadState('networkidle');

    // --- EDIT ---
    await expect(page.getByText(TEST_FULL_NAME)).toBeVisible({ timeout: 10_000 });
    const contactCard = page.locator('[class*="card"]').filter({ hasText: TEST_FULL_NAME });
    await contactCard.getByRole('button', { name: /edit contact/i }).click();

    await expect(page.getByRole('heading', { name: 'Edit Contact' })).toBeVisible({ timeout: 10_000 });

    const lastNameInput = page.getByPlaceholder('Last name');
    await lastNameInput.clear();
    await lastNameInput.fill(EDITED_LAST_NAME);

    await page.locator('form').getByRole('button', { name: /update/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(EDITED_FULL_NAME)).toBeVisible({ timeout: 10_000 });

    // --- DELETE ---
    const editedCard = page.locator('[class*="card"]').filter({ hasText: EDITED_FULL_NAME });
    await editedCard.getByRole('button', { name: /delete contact/i }).click();

    // Confirm dialog
    await expect(page.getByText(/remove .+ from your contacts/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^remove$/i }).click();
    await page.waitForLoadState('networkidle');

    // Contact should be gone
    await expect(page.getByText(EDITED_FULL_NAME)).not.toBeVisible({ timeout: 5_000 });
  });
});
