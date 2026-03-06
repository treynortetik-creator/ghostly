import { test, expect, type Page } from '@playwright/test';

const TEST_PREFIX = 'PW UI Test';

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

    // Cancel the clone
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

test.describe('Full Event CRUD via UI', () => {
  test('create event via UI, verify in list, navigate to detail, edit, then delete', async ({ page }) => {
    const uniqueSuffix = Date.now();
    const testEventName = `${TEST_PREFIX} ${uniqueSuffix}`;
    const updatedLocation = 'Updated City, UC';

    // =============================================
    // STEP 1: CREATE EVENT VIA UI
    // =============================================
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Click "Add Event"
    await page.getByRole('button', { name: /Add Event/i }).click();
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    // Fill in event name
    await page.locator('#name').fill(testEventName);

    // Wait for event types dropdown to populate (the bug fix ensures types load)
    const eventTypeSelect = page.locator('#event_type_id');
    await expect(eventTypeSelect).toBeVisible();

    // Wait for the dropdown to have real options (not just "Select event type...")
    await expect(eventTypeSelect.locator('option')).toHaveCount(
      await eventTypeSelect.locator('option').count(), // just wait for it to stabilize
    );
    // Wait until there's more than 1 option (the placeholder + at least one type)
    await page.waitForFunction(
      () => {
        const select = document.querySelector('#event_type_id') as HTMLSelectElement;
        return select && select.options.length > 1;
      },
      { timeout: 15_000 },
    );

    // Select the first real event type
    const firstTypeOption = eventTypeSelect.locator('option').nth(1);
    const firstTypeValue = await firstTypeOption.getAttribute('value');
    expect(firstTypeValue).toBeTruthy();
    await eventTypeSelect.selectOption(firstTypeValue!);

    // Select quarter Q2
    await page.locator('#quarter').selectOption('Q2');

    // Enter budget amount
    await page.locator('#budget_amount').fill('7500');

    // Enter location
    await page.locator('#location').fill('Test City, TS');

    // Submit the form
    await page.getByRole('button', { name: /Create Event/i }).click();

    // Wait for the form to close (event created successfully)
    await expect(page.locator('text=Register New Event')).not.toBeVisible({ timeout: 15_000 });

    // =============================================
    // STEP 2: VERIFY EVENT APPEARS IN THE LIST
    // =============================================
    // Search for the newly created event
    const searchInput = page.getByPlaceholder('Search events...');
    await expect(searchInput).toBeVisible({ timeout: 10_000 });
    await searchInput.fill(testEventName);
    await page.waitForTimeout(1000);

    // The event should appear in the list
    await expect(page.locator(`text=${testEventName}`)).toBeVisible({ timeout: 10_000 });

    // =============================================
    // STEP 3: NAVIGATE TO EVENT DETAIL PAGE
    // =============================================
    await page.locator(`a`, { hasText: testEventName }).click();
    await page.waitForLoadState('networkidle');

    // Verify we're on the detail page
    await expect(page).toHaveURL(/\/events\/[a-f0-9-]+/);
    await expect(page.locator('h1', { hasText: testEventName })).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('span', { hasText: 'Q2' })).toBeVisible();
    await expect(page.locator('text=Test City, TS')).toBeVisible();

    // =============================================
    // STEP 4: EDIT THE EVENT VIA UI
    // =============================================
    await page.getByRole('button', { name: /Edit/i }).click();
    await expect(page.locator('text=Edit Event Details')).toBeVisible({ timeout: 10_000 });

    // Change location
    const locationInput = page.locator('#location');
    await locationInput.clear();
    await locationInput.fill(updatedLocation);

    // Save changes
    await page.getByRole('button', { name: /Save Changes/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify changes persisted - should be back in detail view
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('text=Updated City, UC')).toBeVisible();

    // =============================================
    // STEP 5: DELETE THE EVENT VIA UI
    // =============================================
    await page.getByRole('button', { name: /Delete/i }).click();

    // Wait for confirmation dialog
    await expect(page.getByText(/are you sure you want to delete/i)).toBeVisible({ timeout: 5_000 });

    // Confirm deletion - the ConfirmDialog uses confirmLabel="Delete"
    await page.getByRole('button', { name: 'Delete' }).last().click();

    // Should redirect back to events list
    await expect(page).toHaveURL(/\/events$/, { timeout: 15_000 });

    // Verify deleted event is no longer in the list
    await page.waitForLoadState('networkidle');
    const searchAfterDelete = page.getByPlaceholder('Search events...');
    await expect(searchAfterDelete).toBeVisible({ timeout: 10_000 });
    await searchAfterDelete.fill(testEventName);
    await page.waitForTimeout(1000);

    // Should not find the deleted event
    await expect(page.locator(`text=${testEventName}`)).not.toBeVisible({ timeout: 5_000 });
  });
});
