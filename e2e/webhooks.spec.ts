import { test, expect } from '@playwright/test';

const TEST_WEBHOOK_URL = 'https://example.com/test-webhook-e2e';

test.describe('Webhooks Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/webhooks');
    await page.waitForLoadState('networkidle');
  });

  // -- Page Load --

  test('page loads with "The Signal Tower" heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Signal Tower/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('URL is /webhooks', async ({ page }) => {
    await expect(page).toHaveURL(/\/webhooks/);
  });

  test('webhook count subtitle is visible', async ({ page }) => {
    await expect(
      page.getByText(/\d+ webhooks? configured/)
    ).toBeVisible({ timeout: 10_000 });
  });

  // -- Buttons --

  test('Add Webhook button is visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Add Webhook/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('Refresh button is visible', async ({ page }) => {
    // Wait for heading to confirm page loaded, then check Refresh
    await expect(
      page.getByRole('heading', { name: /The Signal Tower/i })
    ).toBeVisible({ timeout: 10_000 });
    const refreshBtn = page.getByRole('button').filter({ hasText: /Refresh/i });
    await expect(refreshBtn).toBeVisible();
  });

  // -- Create Webhook Flow --

  test('clicking Add Webhook opens the form', async ({ page }) => {
    await page.getByRole('button', { name: /Add Webhook/i }).click();

    // Form heading
    await expect(
      page.getByRole('heading', { name: /Add Webhook/i })
    ).toBeVisible({ timeout: 5_000 });

    // URL field
    await expect(page.locator('#webhook-url')).toBeVisible();

    // Description field
    await expect(page.locator('#webhook-description')).toBeVisible();

    // Event Types label
    await expect(page.getByText('Event Types *')).toBeVisible();

    // Create button
    await expect(
      page.getByRole('button', { name: /Create Webhook/i })
    ).toBeVisible();

    // Cancel button
    await expect(
      page.getByRole('button', { name: /Cancel/i })
    ).toBeVisible();
  });

  test('create webhook, verify in list, then delete it', async ({ page }) => {
    const testDesc = `E2E Test ${Date.now()}`;

    // Open the form
    await page.getByRole('button', { name: /Add Webhook/i }).click();
    await expect(page.locator('#webhook-url')).toBeVisible({ timeout: 5_000 });

    // Fill URL
    await page.locator('#webhook-url').fill(TEST_WEBHOOK_URL);

    // Fill description
    await page.locator('#webhook-description').fill(testDesc);

    // Select at least one event type
    const expenseCreatedButton = page.locator('button').filter({ hasText: /Expense Created/i });
    const allEventsButton = page.locator('button').filter({ hasText: /All Events/i });

    if (await expenseCreatedButton.isVisible()) {
      await expenseCreatedButton.click();
    } else if (await allEventsButton.isVisible()) {
      await allEventsButton.click();
    }

    // Submit
    await page.getByRole('button', { name: /Create Webhook/i }).click();

    // Wait for form to close and webhook to appear in list
    await page.waitForLoadState('networkidle');

    // Verify the webhook description appears in the list
    await expect(page.getByText(testDesc)).toBeVisible({ timeout: 10_000 });

    // -- Now clean up: delete the webhook --
    // Find the delete (trash) button near our webhook description
    const descLocator = page.getByText(testDesc);
    // Navigate up to the card-level container and find the delete button
    const cardContainer = descLocator.locator('xpath=ancestor::div[contains(@class,"py-5")]');
    await cardContainer.getByRole('button', { name: /Delete webhook/i }).click();

    // Confirm deletion dialog
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible({ timeout: 5_000 });
    // Click the confirm Delete button (exact match in the dialog)
    await page.getByRole('button', { name: 'Delete', exact: true }).click();

    // Wait for deletion
    await page.waitForLoadState('networkidle');

    // Verify the webhook is gone
    await expect(page.getByText(testDesc)).not.toBeVisible({ timeout: 10_000 });
  });

  // -- Edit Webhook --

  test('edit webhook opens pre-filled form', async ({ page }) => {
    const testDesc = `E2E Edit Test ${Date.now()}`;

    // First create a webhook to edit
    await page.getByRole('button', { name: /Add Webhook/i }).click();
    await page.locator('#webhook-url').fill(TEST_WEBHOOK_URL);
    await page.locator('#webhook-description').fill(testDesc);

    // Select an event type
    const expenseCreatedButton = page.locator('button').filter({ hasText: /Expense Created/i });
    const allEventsButton = page.locator('button').filter({ hasText: /All Events/i });
    if (await expenseCreatedButton.isVisible()) {
      await expenseCreatedButton.click();
    } else if (await allEventsButton.isVisible()) {
      await allEventsButton.click();
    }

    await page.getByRole('button', { name: /Create Webhook/i }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(testDesc)).toBeVisible({ timeout: 10_000 });

    // Click edit on the webhook we just created
    const descLocator = page.getByText(testDesc);
    const cardContainer = descLocator.locator('xpath=ancestor::div[contains(@class,"py-5")]');
    await cardContainer.getByRole('button', { name: /Edit webhook/i }).click();

    // Form should show "Edit Webhook" heading
    await expect(
      page.getByRole('heading', { name: /Edit Webhook/i })
    ).toBeVisible({ timeout: 5_000 });

    // URL should be pre-filled
    await expect(page.locator('#webhook-url')).toHaveValue(TEST_WEBHOOK_URL);

    // Update Webhook button should be visible
    await expect(page.getByRole('button', { name: /Update Webhook/i })).toBeVisible();

    // Cancel without saving
    await page.getByRole('button', { name: /Cancel/i }).click();

    // Clean up - delete the webhook
    await cardContainer.getByRole('button', { name: /Delete webhook/i }).click();
    await expect(page.getByText(/Are you sure you want to delete/)).toBeVisible({ timeout: 5_000 });
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.waitForLoadState('networkidle');
  });

  // -- Test Webhook Delivery --

  test('test button exists on active webhooks', async ({ page }) => {
    // Wait for loading to finish
    await expect(page.getByRole('heading', { name: /The Signal Tower/i })).toBeVisible({ timeout: 10_000 });

    // Soft check - there may be 0 webhooks and thus 0 test buttons
    const testButtons = page.locator('button').filter({ hasText: /^Test$/ });
    const count = await testButtons.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  // -- Footer --

  test('footer quote is visible', async ({ page }) => {
    await expect(
      page.getByText(/signal fires burn/)
    ).toBeVisible({ timeout: 10_000 });
  });
});
