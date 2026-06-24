import { test, expect } from '@playwright/test';

test.describe('Settings - Main (/settings)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with settings title', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /The Configuration Chambers/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('fiscal year selector is visible', async ({ page }) => {
    // FiscalYearSelector component renders as a card in the settings grid
    await expect(page.locator('body')).toContainText(/fiscal year/i, { timeout: 10_000 });
  });

  test('budget overview section visible with total budget', async ({ page }) => {
    await expect(
      page.getByText('Budget Overview', { exact: false })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Total Annual Budget')).toBeVisible({ timeout: 10_000 });
  });

  test('AI model selector is visible', async ({ page }) => {
    // The ModelSelector component is in the settings grid
    await expect(page.locator('body')).toContainText(/model/i, { timeout: 10_000 });
  });

  test('configurable sections are visible (Checklist Phases, Note Types)', async ({ page }) => {
    // Checklist Phases and Note Types sections are always visible
    await expect(page.getByText('Checklist Phases')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Note Types')).toBeVisible({ timeout: 10_000 });
  });

  test('API Keys section is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /API Keys/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Manage keys for MCP connections')).toBeVisible({ timeout: 10_000 });
  });

  test('Save and Discard buttons are visible', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Save Settings/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Discard Changes/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('save and discard buttons are disabled when no changes', async ({ page }) => {
    const saveBtn = page.getByRole('button', { name: /Save Settings/i });
    const discardBtn = page.getByRole('button', { name: /Discard Changes/i });
    await expect(saveBtn).toBeVisible({ timeout: 10_000 });
    await expect(saveBtn).toBeDisabled();
    await expect(discardBtn).toBeDisabled();
  });

  test('discard changes works after modifying total budget', async ({ page }) => {
    const budgetInput = page.locator('#total_budget');
    await expect(budgetInput).toBeVisible({ timeout: 10_000 });

    // Store original value
    const originalValue = await budgetInput.inputValue();

    // Modify budget
    await budgetInput.fill('999999');
    await expect(budgetInput).toHaveValue('999999');

    // Discard changes should now be enabled
    const discardBtn = page.getByRole('button', { name: /Discard Changes/i });
    await expect(discardBtn).toBeEnabled();
    await discardBtn.click();

    // Value should revert
    await expect(budgetInput).toHaveValue(originalValue);
  });

  test('API key section shows active keys heading', async ({ page }) => {
    await expect(
      page.getByText(/Active Keys/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test('New Key button opens create form', async ({ page }) => {
    const newKeyBtn = page.getByRole('button', { name: /New Key/i });
    await expect(newKeyBtn).toBeVisible({ timeout: 10_000 });
    await newKeyBtn.click();

    // Form should appear
    await expect(
      page.getByRole('heading', { name: /Generate New API Key/i })
    ).toBeVisible();
    await expect(page.getByPlaceholder('e.g. claude, my-agent')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. Production key')).toBeVisible();
    await expect(page.getByRole('button', { name: /Generate Key/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();
  });

  test('create new API key - fill form, submit, verify key displayed', async ({ page }) => {
    const newKeyBtn = page.getByRole('button', { name: /New Key/i });
    await expect(newKeyBtn).toBeVisible({ timeout: 10_000 });
    await newKeyBtn.click();

    // Fill the form
    const agentNameInput = page.getByPlaceholder('e.g. claude, my-agent');
    await agentNameInput.fill(`e2e-test-${Date.now()}`);
    const labelInput = page.getByPlaceholder('e.g. Production key');
    await labelInput.fill('E2E Test Key');

    // Submit
    await page.getByRole('button', { name: /Generate Key/i }).click();

    // Should show the revealed key with save warning
    await expect(
      page.getByText('Save this key now')
    ).toBeVisible({ timeout: 10_000 });

    // Copy button should be present near the revealed key
    await expect(
      page.getByRole('button', { name: /Copy/i }).first()
    ).toBeVisible();

    // Dismiss the revealed key
    await page.getByRole('button', { name: /Dismiss/i }).click();
    await expect(page.getByText('Save this key now')).not.toBeVisible();
  });

  test('MCP Configuration section is visible with copy button', async ({ page }) => {
    await expect(
      page.getByText('MCP Configuration')
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByRole('button', { name: /Copy Config/i })
    ).toBeVisible();
  });
});

test.describe('Settings - Organization (/settings/organization)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/organization');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Organization Settings heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Organization Settings/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('organization name field is visible', async ({ page }) => {
    await expect(
      page.getByLabel('Organization Name')
    ).toBeVisible({ timeout: 10_000 });
  });

  test('members list is visible', async ({ page }) => {
    await expect(
      page.getByText(/Members/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test('edit organization name, discard reverts', async ({ page }) => {
    const nameInput = page.getByLabel('Organization Name');
    await expect(nameInput).toBeVisible({ timeout: 10_000 });

    const originalName = await nameInput.inputValue();

    // Modify
    await nameInput.fill(originalName + ' TEST');
    const discardBtn = page.getByRole('button', { name: /Discard/i });
    await expect(discardBtn).toBeEnabled();
    await discardBtn.click();

    // Should revert
    await expect(nameInput).toHaveValue(originalName);
  });
});

test.describe('Settings - Agent (/settings/agent)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/settings/agent');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with AI Agent Settings heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /AI Agent Settings/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('agent identity section with agent name field visible', async ({ page }) => {
    await expect(page.getByText('Agent Identity')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByLabel('Agent Name')).toBeVisible({ timeout: 10_000 });
  });

  test('collapsible sections expand and collapse', async ({ page }) => {
    // Agent Identity section should be expanded by default, showing the label
    const agentNameLabel = page.getByLabel('Agent Name');
    await expect(agentNameLabel).toBeVisible({ timeout: 10_000 });

    // Click the "Agent Identity" header to collapse it
    await page.getByText('Agent Identity').click();

    // The agent name input should now be hidden
    await expect(agentNameLabel).not.toBeVisible();

    // Click again to expand
    await page.getByText('Agent Identity').click();
    await expect(agentNameLabel).toBeVisible();
  });

  test('tool permissions section is visible', async ({ page }) => {
    await expect(page.getByText('Tool Permissions')).toBeVisible({ timeout: 10_000 });
  });

  test('heartbeat section is visible', async ({ page }) => {
    // The Heartbeat section header - use the CardTitle which renders as a heading-like element
    await expect(page.getByText('Heartbeat', { exact: true }).first()).toBeVisible({ timeout: 10_000 });
  });
});
