import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '.auth', 'user.json');

setup('authenticate via legacy login', async ({ page }) => {
  // Increase test timeout for cold starts + rate limit recovery
  setup.setTimeout(60_000);

  await page.goto('/login');
  await expect(page.locator('#username')).toBeVisible({ timeout: 15_000 });

  await page.fill('#username', process.env.E2E_AUTH_USERNAME || 'admin');
  await page.fill('#password', process.env.E2E_AUTH_PASSWORD || '');
  await page.click('button:has-text("Sign In")');

  // Wait for redirect to dashboard (production can be slow on cold start)
  await page.waitForURL('**/dashboard', { timeout: 45_000 });
  await expect(page.locator('body')).toBeVisible();

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
