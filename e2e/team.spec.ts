import { test, expect } from '@playwright/test';

const TEST_MEMBER_NAME = 'PW-Test-Member-' + Date.now();
const EDITED_MEMBER_NAME = 'PW-Test-MemberEdited-' + Date.now();

test.describe('Team', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/team');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with team heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /partners.*staff/i })).toBeVisible({ timeout: 10_000 });
  });

  test('team member count displayed', async ({ page }) => {
    // Shows "X member(s) on the rolls"
    await expect(page.getByText(/\d+ members? on the rolls/i)).toBeVisible({ timeout: 10_000 });
  });

  test('team member list renders', async ({ page }) => {
    // Either member cards are present or empty state shows
    const body = page.locator('body');
    await expect(body).toBeVisible({ timeout: 10_000 });
    const pageContent = await body.textContent();
    const hasMembers = pageContent?.includes('on the rolls') ?? false;
    expect(hasMembers).toBeTruthy();
  });

  test('add team member button visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /appoint new staff/i })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Team CRUD', () => {
  test('create, edit, and delete team member', async ({ page }) => {
    // --- CREATE ---
    await page.goto('/team');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /appoint new staff/i }).click();

    // Form modal - use heading to avoid ambiguity with button text
    await expect(page.getByRole('heading', { name: 'Appoint New Staff' })).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('Full name').fill(TEST_MEMBER_NAME);
    await page.getByPlaceholder('e.g., Event Marketing Manager').fill('PW Test Role');
    await page.getByPlaceholder('email@safelyou.com').fill('pw-test-member@example.com');

    // Submit using the button inside the form
    await page.locator('form').getByRole('button', { name: /^appoint$/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify appears in list
    await expect(page.getByText(TEST_MEMBER_NAME)).toBeVisible({ timeout: 10_000 });

    // --- EDIT ---
    const memberCard = page.locator('[class*="card"]').filter({ hasText: TEST_MEMBER_NAME });
    await memberCard.getByRole('button', { name: /edit member/i }).click();

    await expect(page.getByRole('heading', { name: 'Edit Staff Member' })).toBeVisible({ timeout: 10_000 });

    const nameInput = page.getByPlaceholder('Full name');
    await nameInput.clear();
    await nameInput.fill(EDITED_MEMBER_NAME);

    await page.locator('form').getByRole('button', { name: /^update$/i }).click();
    await page.waitForLoadState('networkidle');

    await expect(page.getByText(EDITED_MEMBER_NAME)).toBeVisible({ timeout: 10_000 });

    // --- DELETE ---
    const editedCard = page.locator('[class*="card"]').filter({ hasText: EDITED_MEMBER_NAME });
    await editedCard.getByRole('button', { name: /delete member/i }).click();

    // Confirm dialog
    await expect(page.getByText(/remove .+ from the staff rolls/i)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: /^remove$/i }).click();
    await page.waitForLoadState('networkidle');

    // Member should be gone
    await expect(page.getByText(EDITED_MEMBER_NAME)).not.toBeVisible({ timeout: 5_000 });
  });
});
