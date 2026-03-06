import { test, expect, type Page } from '@playwright/test';

/**
 * Delete events matching a name pattern via Supabase REST API.
 * Used for cleanup after test runs.
 */
async function deleteEventsByNamePattern(namePattern: string): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.test');
  }

  await fetch(
    `${url}/rest/v1/events?name=like.${encodeURIComponent(`%${namePattern}%`)}`,
    {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'return=minimal',
      },
    },
  );
}

const TEST_PREFIX = 'PW Test Event';

test.describe('Events List Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
  });

  test('page loads with title "The Event Ledger"', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible();
  });

  test('event list renders with event cards', async ({ page }) => {
    // Wait for loading to complete - the summary stats bar appears once events load
    const summaryBar = page.locator('text=events');
    await expect(summaryBar.first()).toBeVisible({ timeout: 15_000 });

    // There should be at least one event card (link to /events/<id>)
    const eventLinks = page.locator('a[href^="/events/"]');
    await expect(eventLinks.first()).toBeVisible({ timeout: 10_000 });
  });

  test('each event card shows name, type badge, quarter badge, and budget info', async ({ page }) => {
    // Wait for events to load
    const firstCard = page.locator('a[href^="/events/"]').first();
    await expect(firstCard).toBeVisible({ timeout: 15_000 });

    // Event name (h3 inside the card)
    await expect(firstCard.locator('h3').first()).toBeVisible();

    // Quarter badge (Q1, Q2, Q3, Q4, or TBD)
    await expect(firstCard.locator('span', { hasText: /^(Q[1-4]|TBD)$/ }).first()).toBeVisible();

    // Budget info (contains "$" and "of")
    await expect(firstCard.locator('text=/\\$/').first()).toBeVisible();
  });

  test('"Add Event" button is visible', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Add Event/i })).toBeVisible();
  });

  test('"Refresh" button is visible and works', async ({ page }) => {
    const refreshBtn = page.getByText('Refresh', { exact: true });
    await expect(refreshBtn).toBeVisible();

    // Click refresh and verify page doesn't error out
    await refreshBtn.click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible();
  });

  test('search events filters the list', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder('Search events...');
    await expect(searchInput).toBeVisible();

    // Type a search that likely matches nothing
    await searchInput.fill('xyznonexistent999');
    await page.waitForTimeout(500);

    // Should show "No Events Found" or 0 events
    const noResults = page.locator('text=No Events Found');
    const zeroCount = page.locator('text=/^0\\s+events$/');
    const hasNoResults = await noResults.isVisible().catch(() => false);
    const hasZeroCount = await zeroCount.isVisible().catch(() => false);
    expect(hasNoResults || hasZeroCount).toBeTruthy();
  });

  test('filter by quarter updates the list', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });

    const quarterSelect = page.locator('#filter-quarter');
    await expect(quarterSelect).toBeVisible();

    // Select Q1
    await quarterSelect.selectOption('Q1');
    await page.waitForTimeout(500);

    // Verify a filter pill shows up or the URL updates
    const urlHasQuarter = page.url().includes('quarter=Q1');
    const hasPill = await page.locator('text=Quarter: Q1').isVisible().catch(() => false);
    expect(urlHasQuarter || hasPill).toBeTruthy();
  });

  test('filter by event type updates the list', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });

    const typeSelect = page.locator('#filter-type');
    await expect(typeSelect).toBeVisible();

    // Get the available options (skip "All Types")
    const options = typeSelect.locator('option');
    const optionCount = await options.count();

    if (optionCount > 1) {
      // Select the second option (first real type)
      const secondOptionValue = await options.nth(1).getAttribute('value');
      if (secondOptionValue) {
        await typeSelect.selectOption(secondOptionValue);
        await page.waitForTimeout(500);

        // URL should now include a type parameter
        expect(page.url()).toContain('type=');
      }
    }
  });

  test('clear filters resets the list', async ({ page }) => {
    // Wait for events to load
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });

    // Apply a quarter filter first
    const quarterSelect = page.locator('#filter-quarter');
    await quarterSelect.selectOption('Q1');
    await page.waitForTimeout(500);

    // Click clear button
    const clearBtn = page.getByRole('button', { name: /Clear/i });
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await page.waitForTimeout(500);

      // Filters should be reset - URL should not have quarter param
      expect(page.url()).not.toContain('quarter=Q1');
    }
  });

  test('clicking an event navigates to detail page', async ({ page }) => {
    // Wait for events to load
    const firstEventLink = page.locator('a[href^="/events/"]').first();
    await expect(firstEventLink).toBeVisible({ timeout: 15_000 });

    // Get the href to verify navigation
    const href = await firstEventLink.getAttribute('href');
    expect(href).toBeTruthy();

    await firstEventLink.click();
    await page.waitForLoadState('networkidle');

    // Should now be on an event detail page
    await expect(page).toHaveURL(/\/events\/[a-f0-9-]+/);
  });
});

test.describe('Event Detail Page', () => {
  let eventDetailUrl: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to events list, then click the first event
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const firstEventLink = page.locator('a[href^="/events/"]').first();
    await expect(firstEventLink).toBeVisible({ timeout: 15_000 });

    const href = await firstEventLink.getAttribute('href');
    eventDetailUrl = href!;

    await page.goto(eventDetailUrl);
    await page.waitForLoadState('networkidle');
  });

  test('event header shows name, type badge, and quarter badge', async ({ page }) => {
    // Event name as h1
    const eventName = page.locator('h1').first();
    await expect(eventName).toBeVisible({ timeout: 10_000 });

    // Quarter badge (Q1-Q4 or TBD)
    await expect(page.locator('span', { hasText: /^(Q[1-4]|TBD)$/ }).first()).toBeVisible();
  });

  test('tab navigation exists with multiple tabs', async ({ page }) => {
    const tabList = page.locator('[role="tablist"]');
    await expect(tabList).toBeVisible({ timeout: 10_000 });

    // Verify key tabs are present
    await expect(page.locator('#tab-details')).toBeVisible();
    await expect(page.locator('#tab-documents')).toBeVisible();
    await expect(page.locator('#tab-team')).toBeVisible();
    await expect(page.locator('#tab-checklist')).toBeVisible();
    await expect(page.locator('#tab-notes')).toBeVisible();
    await expect(page.locator('#tab-roi')).toBeVisible();
  });

  test('switch between tabs loads correct content', async ({ page }) => {
    // Wait for page to load
    await expect(page.locator('#tab-details')).toBeVisible({ timeout: 10_000 });

    // Details tab should be active by default
    await expect(page.locator('#tab-details')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-details')).toBeVisible();

    // Click Team tab
    await page.locator('#tab-team').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#tab-team')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-team')).toBeVisible();

    // Click Checklist tab
    await page.locator('#tab-checklist').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#tab-checklist')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-checklist')).toBeVisible();

    // Click Notes tab
    await page.locator('#tab-notes').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#tab-notes')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-notes')).toBeVisible();

    // Click ROI tab
    await page.locator('#tab-roi').click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#tab-roi')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-roi')).toBeVisible();

    // Switch back to details
    await page.locator('#tab-details').click();
    await expect(page.locator('#panel-details')).toBeVisible();
  });

  test('back button navigates to events list', async ({ page }) => {
    // Find the "Back to Events" link
    const backLink = page.locator('a', { hasText: 'Back to Events' });
    await expect(backLink).toBeVisible({ timeout: 10_000 });

    await backLink.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/events$/);
  });

  test('edit, clone, and delete buttons are visible', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByRole('button', { name: /Edit/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Clone/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Delete/i })).toBeVisible();
  });

  test('edit mode shows event form', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    // Click Edit
    await page.getByRole('button', { name: /Edit/i }).click();

    // Should show the edit form with "Edit Event Details" title
    await expect(page.locator('text=Edit Event Details')).toBeVisible({ timeout: 10_000 });

    // Form fields should be visible
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#budget_amount')).toBeVisible();
    await expect(page.locator('#location')).toBeVisible();

    // Cancel should return to detail view
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10_000 });
  });

  test('clone dialog opens and shows fields', async ({ page }) => {
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });

    // Click Clone
    await page.getByRole('button', { name: /Clone$/i }).click();

    // Clone dialog should appear
    await expect(page.locator('text=Clone Event').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByPlaceholder('Enter a name for the cloned event')).toBeVisible();

    // Cancel the clone - use the one inside the clone card (not the delete confirm dialog)
    const cloneCard = page.locator('text=Clone Event').first().locator('..');
    await page.getByRole('button', { name: 'Cancel' }).last().click();
  });
});

test.describe('Create Event Form UI', () => {
  test('add event form renders with all required fields', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Click "Add Event"
    await page.getByRole('button', { name: /Add Event/i }).click();

    // Form title
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    // Required fields are visible
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#event_type_id')).toBeVisible();
    await expect(page.locator('#quarter')).toBeVisible();
    await expect(page.locator('#budget_amount')).toBeVisible();

    // Optional fields
    await expect(page.locator('#location')).toBeVisible();
    await expect(page.locator('#date_start')).toBeVisible();
    await expect(page.locator('#date_end')).toBeVisible();

    // Section headers
    await expect(page.locator('text=Basic Information')).toBeVisible();
    await expect(page.locator('text=Budget & Goals')).toBeVisible();
    await expect(page.locator('text=Planning Notes')).toBeVisible();

    // Buttons
    await expect(page.getByRole('button', { name: /Create Event/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cancel/i })).toBeVisible();

    // Cancel closes the form
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.locator('text=Register New Event')).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe('Create, Edit, and Clone Event', () => {
  const uniqueSuffix = Date.now();
  const testEventName = `${TEST_PREFIX} ${uniqueSuffix}`;
  const clonedEventName = `${TEST_PREFIX} Clone ${uniqueSuffix}`;
  let testEventId: string | null = null;

  test.afterAll(async () => {
    // Clean up test events via Supabase
    await deleteEventsByNamePattern(`${TEST_PREFIX} ${uniqueSuffix}`);
    await deleteEventsByNamePattern(`${TEST_PREFIX} Clone ${uniqueSuffix}`);
  });

  test('create event via API, verify in list, edit via UI, then clone', async ({ page }) => {
    // --- Step 1: Get org ID and event type via Supabase to seed test data ---
    const sbUrl = process.env.SUPABASE_URL!;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Get the first organization
    const orgRes = await fetch(`${sbUrl}/rest/v1/organizations?select=id&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    });
    const orgs = await orgRes.json();
    const orgId = orgs[0]?.id;
    expect(orgId).toBeTruthy();

    // Get the first event type
    const etRes = await fetch(`${sbUrl}/rest/v1/event_types?select=id&organization_id=eq.${orgId}&limit=1`, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
    });
    const eventTypes = await etRes.json();
    const eventTypeId = eventTypes[0]?.id;
    expect(eventTypeId).toBeTruthy();

    // --- Step 2: Create event directly via Supabase ---
    const insertRes = await fetch(`${sbUrl}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({
        organization_id: orgId,
        name: testEventName,
        event_type_id: eventTypeId,
        quarter: 'Q2',
        budget_amount: 5000,
        location: 'Test City, TS',
      }),
    });
    const insertedEvents = await insertRes.json();
    testEventId = insertedEvents[0]?.id;
    expect(testEventId).toBeTruthy();

    // --- Step 3: Verify event appears in the UI list ---
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Search for our event
    const searchInput = page.getByPlaceholder('Search events...');
    await expect(searchInput).toBeVisible({ timeout: 15_000 });
    await searchInput.fill(testEventName);
    await page.waitForTimeout(1000);

    await expect(page.locator(`text=${testEventName}`)).toBeVisible({ timeout: 10_000 });

    // --- Step 4: Navigate to the event detail page ---
    await page.goto(`/events/${testEventId}`);
    await page.waitForLoadState('networkidle');

    // Verify event header
    await expect(page.locator('h1', { hasText: testEventName })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('span', { hasText: 'Q2' })).toBeVisible();
    await expect(page.locator('text=Test City, TS')).toBeVisible();

    // --- Step 5: Edit the event via UI ---
    await page.getByRole('button', { name: /Edit/i }).click();
    await expect(page.locator('text=Edit Event Details')).toBeVisible({ timeout: 10_000 });

    // Change location
    const locationInput = page.locator('#location');
    await locationInput.clear();
    await locationInput.fill('Updated City, UC');

    // Save
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify changes persisted - should be back in detail view
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Updated City, UC')).toBeVisible();

    // --- Step 6: Clone the event ---
    const originalUrl = page.url();

    await page.getByRole('button', { name: /Clone$/i }).click();
    await expect(page.locator('h3', { hasText: 'Clone Event' })).toBeVisible({ timeout: 5_000 });

    // Fill in the clone name
    const cloneNameInput = page.getByPlaceholder('Enter a name for the cloned event');
    await cloneNameInput.clear();
    await cloneNameInput.fill(clonedEventName);

    // Click the "Clone Event" submit button (the primary button, not the header text)
    // Use a more targeted selector: the button with variant=primary inside the clone card
    const cloneSubmitBtn = page.locator('button', { hasText: 'Clone Event' }).filter({ has: page.locator('svg') });
    await cloneSubmitBtn.click();

    // Wait for the clone API call to complete and redirect
    await page.waitForResponse(
      (resp) => resp.url().includes('/clone') && resp.request().method() === 'POST',
      { timeout: 15_000 },
    );
    await page.waitForLoadState('networkidle');

    // Should redirect to the new cloned event (different URL)
    // Wait for navigation to happen
    await page.waitForTimeout(2000);
    const newUrl = page.url();
    expect(newUrl).not.toBe(originalUrl);

    // Verify the cloned event name is shown
    await expect(page.locator('h1', { hasText: clonedEventName })).toBeVisible({ timeout: 10_000 });
  });
});
