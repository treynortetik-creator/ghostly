import { test, expect } from '@playwright/test';

test.describe('Documents Page (/documents)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with Documents heading', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: /Documents/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('tab navigation shows Templates and Generated tabs', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Templates' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Generated' })).toBeVisible({ timeout: 10_000 });
  });

  test('templates tab is active by default', async ({ page }) => {
    // Templates tab should have the active styling (spectral color class)
    const templatesTab = page.getByRole('button', { name: 'Templates' });
    await expect(templatesTab).toBeVisible({ timeout: 10_000 });
    // Active tab has bg-spectral/15 class
    await expect(templatesTab).toHaveClass(/spectral/);
  });

  test('templates tab shows template cards or empty state', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Either templates are shown (grid of cards) or the empty state "No templates yet"
    const hasTemplates = await page.locator('.grid h3').first().isVisible().catch(() => false);
    const hasEmpty = await page.getByText('No templates yet').isVisible().catch(() => false);

    expect(hasTemplates || hasEmpty).toBeTruthy();
  });

  test('each template shows name and sections count', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    const hasTemplates = await page.locator('.grid h3').first().isVisible().catch(() => false);

    if (hasTemplates) {
      // TemplateCard shows template.name as h3 and "N section(s)" text
      const firstTemplateName = page.locator('.grid h3').first();
      await expect(firstTemplateName).toBeVisible({ timeout: 10_000 });

      // Check for section count text pattern
      await expect(page.getByText(/\d+ sections?/).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test('create template button is visible on templates tab', async ({ page }) => {
    await expect(
      page.getByRole('button', { name: /Create Template/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('switch to Generated tab', async ({ page }) => {
    const generatedTab = page.getByRole('button', { name: 'Generated' });
    await generatedTab.click();
    await page.waitForLoadState('networkidle');

    // Generated tab should now be active
    await expect(generatedTab).toHaveClass(/spectral/);

    // Should show generated documents or empty state
    // The subtitle will change to show "N documents"
    await expect(
      page.getByText(/\d+ documents?/i).or(page.getByText('No generated documents'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('refresh button works', async ({ page }) => {
    const refreshBtn = page.getByRole('button', { name: /Refresh/i }).first();
    await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
    await refreshBtn.click();
    await page.waitForLoadState('networkidle');

    // Page should still show the title after refresh
    await expect(
      page.getByRole('heading', { name: /Documents/i })
    ).toBeVisible({ timeout: 10_000 });
  });

  test('subtitle shows template or document count', async ({ page }) => {
    // Subtitle shows "N template(s)" or "N document(s)"
    await expect(
      page.getByText(/\d+ templates?/i).or(page.getByText(/\d+ documents?/i))
    ).toBeVisible({ timeout: 10_000 });
  });
});
