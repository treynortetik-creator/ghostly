import { test, expect } from '@playwright/test';

test.describe('AppShell - Layout and Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  // -- Sidebar Visibility ------------------------------------------------------

  test('sidebar is visible on desktop', async ({ page }) => {
    const sidebar = page.locator('aside');
    await expect(sidebar.first()).toBeVisible();
  });

  test('sidebar displays Ghostly logo and branding', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    // Use heading role to avoid matching "ghostly.ai" substring
    await expect(sidebar.getByRole('heading', { name: 'Ghostly' })).toBeVisible();
    await expect(sidebar.getByText('ghostly.ai')).toBeVisible();
  });

  // -- Sidebar Collapse/Expand -------------------------------------------------

  test('sidebar can be collapsed and expanded', async ({ page }) => {
    const sidebar = page.locator('aside').first();

    // Find the collapse button by its title
    const collapseBtn = sidebar.getByTitle('Collapse sidebar');
    await expect(collapseBtn).toBeVisible();

    // Sidebar should start expanded (w-64 = 256px)
    const initialWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    expect(initialWidth).toBeGreaterThan(200);

    // Click collapse
    await collapseBtn.click();
    await page.waitForTimeout(400);

    // Sidebar should be collapsed (w-[68px])
    const collapsedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    expect(collapsedWidth).toBeLessThan(100);

    // Nav text should be hidden (opacity-0, w-0)
    const dashboardLabel = sidebar.locator('a[href="/dashboard"] span').first();
    await expect(dashboardLabel).toHaveCSS('opacity', '0');

    // Expand button should now show "Expand sidebar" title
    const expandBtn = sidebar.getByTitle('Expand sidebar');
    await expect(expandBtn).toBeVisible();

    // Click expand
    await expandBtn.click();
    await page.waitForTimeout(400);

    // Should be back to expanded width
    const expandedWidth = await sidebar.evaluate(el => el.getBoundingClientRect().width);
    expect(expandedWidth).toBeGreaterThan(200);
  });

  // -- Theme Toggle ------------------------------------------------------------

  test('theme toggle cycles through Light, Dark, System', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    // The bottom section has theme button, section toggles also have text like "SYSTEM"
    // but the theme button is in the bottom area and has the exact theme label text.
    // Use a more specific selector: the button in the bottom section with a theme icon
    const bottomSection = sidebar.locator('.mt-auto');
    const themeButton = bottomSection.locator('button').filter({ hasText: /^(Light|Dark|System)$/ }).first();
    await expect(themeButton).toBeVisible();

    const initialTheme = (await themeButton.innerText()).trim();

    // Click to cycle
    await themeButton.click();
    await page.waitForTimeout(200);

    const secondTheme = (await themeButton.innerText()).trim();
    expect(secondTheme).not.toBe(initialTheme);

    // Click again
    await themeButton.click();
    await page.waitForTimeout(200);

    const thirdTheme = (await themeButton.innerText()).trim();
    expect(thirdTheme).not.toBe(secondTheme);

    // Click once more to complete the cycle
    await themeButton.click();
    await page.waitForTimeout(200);

    const fourthTheme = (await themeButton.innerText()).trim();
    expect(fourthTheme).toBe(initialTheme);
  });

  test('dark theme adds "dark" class to html element', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const bottomSection = sidebar.locator('.mt-auto');
    const themeButton = bottomSection.locator('button').filter({ hasText: /^(Light|Dark|System)$/ }).first();

    // Cycle until we hit "Dark"
    for (let i = 0; i < 3; i++) {
      const text = (await themeButton.innerText()).trim();
      if (text === 'Dark') break;
      await themeButton.click();
      await page.waitForTimeout(200);
    }

    // When theme is Dark, html element should have class "dark"
    const currentText = (await themeButton.innerText()).trim();
    if (currentText === 'Dark') {
      await expect(page.locator('html')).toHaveClass(/dark/);
    }
  });

  // -- Navigation Completeness -------------------------------------------------

  test('sidebar has all primary nav links', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const primaryLinks = ['Dashboard', 'Events', 'Calendar'];

    for (const linkName of primaryLinks) {
      await expect(sidebar.getByRole('link', { name: linkName, exact: true })).toBeVisible();
    }
  });

  test('sidebar has all Manage section nav links', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const manageLinks = ['Expenses', 'Categories', 'Contacts', 'Team', 'Documents', 'ROI'];

    for (const linkName of manageLinks) {
      await expect(sidebar.getByRole('link', { name: linkName, exact: true })).toBeVisible();
    }
  });

  test('sidebar has all System section nav links', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const systemLinks = ['Integrations', 'Webhooks', 'Settings', 'Admin'];

    for (const linkName of systemLinks) {
      await expect(sidebar.getByRole('link', { name: linkName, exact: true })).toBeVisible();
    }
  });

  // -- Navigate to Every Page --------------------------------------------------

  const navTargets = [
    { name: 'Dashboard', url: '/dashboard' },
    { name: 'Events', url: '/events' },
    { name: 'Calendar', url: '/calendar' },
    { name: 'Expenses', url: '/expenses' },
    { name: 'Categories', url: '/categories' },
    { name: 'Contacts', url: '/contacts' },
    { name: 'Team', url: '/team' },
    { name: 'Documents', url: '/documents' },
    { name: 'ROI', url: '/roi' },
    { name: 'Integrations', url: '/integrations' },
    { name: 'Webhooks', url: '/webhooks' },
    { name: 'Settings', url: '/settings' },
    { name: 'Admin', url: '/admin' },
  ];

  for (const target of navTargets) {
    test(`navigate to ${target.name} page via sidebar`, async ({ page }) => {
      const sidebar = page.locator('aside').first();
      const link = sidebar.getByRole('link', { name: target.name, exact: true });
      await link.click();
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(new RegExp(target.url));
    });
  }

  // -- Active Link Highlighting ------------------------------------------------

  test('active nav link has spectral highlighting on dashboard', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
    await expect(dashboardLink).toBeVisible();

    // Active link should have spectral/10 background and border-spectral class
    const classAttr = await dashboardLink.getAttribute('class');
    expect(classAttr).toContain('bg-spectral/10');
    expect(classAttr).toContain('border-spectral');
  });

  test('navigating to Events updates active link', async ({ page }) => {
    const sidebar = page.locator('aside').first();

    // Navigate to events
    await sidebar.getByRole('link', { name: 'Events', exact: true }).click();
    await expect(page).toHaveURL(/\/events/);
    await page.waitForLoadState('networkidle');

    // Wait for React to re-render with active state
    const eventsLink = sidebar.getByRole('link', { name: 'Events', exact: true });
    await expect(eventsLink).toHaveClass(/bg-spectral/, { timeout: 5_000 });

    // Dashboard link should no longer be active
    const dashboardLink = sidebar.getByRole('link', { name: 'Dashboard', exact: true });
    const dashClass = await dashboardLink.getAttribute('class');
    expect(dashClass).not.toContain('bg-spectral/10');
  });

  // -- Section Collapse in Sidebar ---------------------------------------------

  test('Manage section can be collapsed and expanded', async ({ page }) => {
    const sidebar = page.locator('aside').first();

    // The section toggle button contains the uppercase label "MANAGE"
    const manageToggle = sidebar.locator('button').filter({ hasText: 'MANAGE' });
    await expect(manageToggle).toBeVisible();

    // Verify aria-expanded is true initially
    await expect(manageToggle).toHaveAttribute('aria-expanded', 'true');

    // Collapse the Manage section
    await manageToggle.click();
    await page.waitForTimeout(400);

    // aria-expanded should now be false
    await expect(manageToggle).toHaveAttribute('aria-expanded', 'false');

    // The containing grid should have collapsed style (grid-rows-[0fr] opacity-0)
    const expensesLink = sidebar.getByRole('link', { name: 'Expenses', exact: true });
    // The link's parent grid wrapper should have opacity 0
    const sectionWrapper = expensesLink.locator('xpath=ancestor::div[contains(@class,"grid")]');
    await expect(sectionWrapper.first()).toHaveCSS('opacity', '0');

    // Expand again
    await manageToggle.click();
    await page.waitForTimeout(400);

    await expect(manageToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(sectionWrapper.first()).toHaveCSS('opacity', '1');
  });

  test('System section can be collapsed and expanded', async ({ page }) => {
    const sidebar = page.locator('aside').first();

    // The SYSTEM section toggle in the nav area (not the theme button)
    const systemToggle = sidebar.locator('nav button').filter({ hasText: 'SYSTEM' });
    await expect(systemToggle).toBeVisible();

    await expect(systemToggle).toHaveAttribute('aria-expanded', 'true');

    // Collapse
    await systemToggle.click();
    await page.waitForTimeout(400);

    await expect(systemToggle).toHaveAttribute('aria-expanded', 'false');

    // Expand
    await systemToggle.click();
    await page.waitForTimeout(400);

    await expect(systemToggle).toHaveAttribute('aria-expanded', 'true');
  });

  // -- Sign Out ----------------------------------------------------------------

  test('sign out button is visible in sidebar', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const signOutBtn = sidebar.locator('button').filter({ hasText: 'Sign Out' });
    await expect(signOutBtn).toBeVisible();
  });

  // NOTE: We skip actually clicking sign out to avoid invalidating the auth state
  // for other tests. The button visibility check above confirms it's present.

  // -- Mobile Responsive -------------------------------------------------------

  test('sidebar is hidden at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    // Desktop sidebar uses "hidden md:flex" so should not be visible at mobile
    const desktopSidebar = page.locator('aside').first();
    await expect(desktopSidebar).toBeHidden();
  });

  test('mobile hamburger menu button is visible at mobile width', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
    await expect(menuButton).toBeVisible();
  });

  test('mobile nav drawer opens and shows nav links', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    // Open mobile menu
    const menuButton = page.getByRole('button', { name: 'Open navigation menu' });
    await menuButton.click();
    await page.waitForTimeout(300);

    // Mobile drawer should be open - it creates a new aside in a fixed overlay
    const mobileDrawer = page.locator('.fixed.inset-0 aside');
    await expect(mobileDrawer).toBeVisible();

    // Nav links should be visible in the drawer
    await expect(mobileDrawer.getByRole('link', { name: 'Dashboard', exact: true })).toBeVisible();
    await expect(mobileDrawer.getByRole('link', { name: 'Events', exact: true })).toBeVisible();
    await expect(mobileDrawer.getByRole('link', { name: 'Expenses', exact: true })).toBeVisible();
    await expect(mobileDrawer.getByRole('link', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('mobile nav drawer can navigate to a page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    // Open mobile menu
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.waitForTimeout(300);

    // Click Events link in the mobile drawer
    const mobileDrawer = page.locator('.fixed.inset-0 aside');
    await mobileDrawer.getByRole('link', { name: 'Events', exact: true }).click();
    await page.waitForLoadState('networkidle');

    // Should navigate to events page
    await expect(page).toHaveURL(/\/events/);

    // Drawer should be closed after navigation
    await expect(mobileDrawer).not.toBeVisible();
  });

  test('mobile close button dismisses the nav drawer', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    // Open mobile menu
    await page.getByRole('button', { name: 'Open navigation menu' }).click();
    await page.waitForTimeout(300);

    const mobileDrawer = page.locator('.fixed.inset-0 aside');
    await expect(mobileDrawer).toBeVisible();

    // Close button
    const closeButton = page.getByRole('button', { name: 'Close navigation menu' });
    await closeButton.click();
    await page.waitForTimeout(300);

    await expect(mobileDrawer).not.toBeVisible();
  });

  // -- Mobile header branding --------------------------------------------------

  test('mobile header shows Ghostly branding', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(200);

    const header = page.locator('header');
    await expect(header.getByText('Ghostly')).toBeVisible();
  });
});
