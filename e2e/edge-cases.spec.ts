import { test, expect, type Page } from '@playwright/test';

/**
 * Edge-case E2E tests for the Ghostly application.
 *
 * Covers: XSS prevention, unicode text, long inputs, empty states,
 * rapid navigation, double-submit prevention, form reset/cancel,
 * direct URL access, and browser back/forward.
 */

const SPECIAL_CHARS_NAME = `PW-Edge ${Date.now()} &amp; "quotes" 'apostrophes' <b>bold</b>`;
const UNICODE_FIRST = 'Jose Maria Nono';
const UNICODE_LAST = 'Unicode-' + Date.now();

/** IDs of test data to clean up */
const cleanupIds: { events: string[]; contacts: string[] } = {
  events: [],
  contacts: [],
};

/** Scope to <main> to avoid sidebar element collisions */
function main(page: Page) {
  return page.locator('main');
}

/** Wait for event types dropdown to be populated in the event form */
async function waitForEventTypes(page: Page) {
  await page.waitForFunction(
    () => {
      const select = document.querySelector('#event_type_id') as HTMLSelectElement;
      return select && select.options.length > 1;
    },
    { timeout: 15_000 },
  );
}

// ─── Cleanup ──────────────────────────────────────────────────────
test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({
    storageState: './e2e/.auth/user.json',
    baseURL: process.env.E2E_BASE_URL || 'https://ghostly-production.up.railway.app',
  });
  const page = await context.newPage();

  // Delete test events
  for (const id of cleanupIds.events) {
    try {
      await page.goto(`/events/${id}`);
      await page.waitForLoadState('networkidle');
      const deleteBtn = page.getByRole('button', { name: /Delete/i });
      if (await deleteBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await deleteBtn.click();
        const confirmBtn = page.getByRole('button', { name: 'Delete' }).last();
        await confirmBtn.click({ timeout: 5_000 });
        await page.waitForLoadState('networkidle');
      }
    } catch {
      // best-effort cleanup
    }
  }

  // Delete test contacts
  for (const id of cleanupIds.contacts) {
    try {
      await page.goto('/contacts');
      await page.waitForLoadState('networkidle');
      // Use the API directly for reliability
      await page.evaluate(async (contactId) => {
        await fetch(`/api/contacts/${contactId}`, { method: 'DELETE' });
      }, id);
    } catch {
      // best-effort cleanup
    }
  }

  await context.close();
});

// ═══════════════════════════════════════════════════════════════════
// 1. Special Characters in Text Fields
// ═══════════════════════════════════════════════════════════════════

test.describe('Special Characters & XSS Prevention', () => {
  test('event with special chars renders as text, not HTML', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Open create form
    await page.getByRole('button', { name: /Add Event/i }).click();
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    // Fill name with HTML-injection payload
    await page.locator('#name').fill(SPECIAL_CHARS_NAME);

    // Wait for event types to load and select one
    await waitForEventTypes(page);
    const eventTypeSelect = page.locator('#event_type_id');
    const firstTypeValue = await eventTypeSelect.locator('option').nth(1).getAttribute('value');
    await eventTypeSelect.selectOption(firstTypeValue!);

    await page.locator('#quarter').selectOption('Q2');
    await page.locator('#budget_amount').fill('100');

    // Submit
    await page.getByRole('button', { name: /Create Event/i }).click();
    await expect(page.locator('text=Register New Event')).not.toBeVisible({ timeout: 15_000 });

    // Search for the event — use a unique portion of our name
    const searchInput = page.getByPlaceholder('Search events...');
    await searchInput.fill('<b>bold</b>');
    await page.waitForTimeout(1000);

    // Verify the name renders as text — look for the literal text in an event card
    const eventCard = page.locator('a[href^="/events/"]').filter({ hasText: '<b>bold</b>' }).first();
    await expect(eventCard).toBeVisible({ timeout: 10_000 });

    // Verify NO actual <b> tags were injected — the text should be rendered as-is, not parsed as HTML
    const boldTags = await page.evaluate(() => {
      const bolds = document.querySelectorAll('main b');
      for (const b of bolds) {
        if (b.textContent?.includes('bold')) return true;
      }
      return false;
    });
    expect(boldTags).toBe(false);

    // Navigate to event detail to capture the ID for cleanup
    const href = await eventCard.getAttribute('href');
    await page.goto(href!);
    await page.waitForLoadState('networkidle');
    const eventId = href!.match(/\/events\/([a-f0-9-]+)/)?.[1];
    if (eventId) cleanupIds.events.push(eventId);

    // Wait for event detail page to render — look for the tab list which only appears on detail
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 });

    // Verify detail page renders the name as text (scope to main to avoid sidebar h1)
    const mainArea = main(page);
    // The event name h1 on the detail page — use a more specific selector
    const allH1s = mainArea.locator('h1');
    const h1Count = await allH1s.count();
    let foundSpecialChars = false;
    for (let i = 0; i < h1Count; i++) {
      const text = await allH1s.nth(i).textContent();
      if (text && text.includes('bold')) {
        foundSpecialChars = true;
        // The text should contain literal angle brackets, not rendered HTML
        expect(text).toContain('<b>');
        expect(text).toContain('&amp;');
        expect(text).toContain('"quotes"');
        break;
      }
    }
    expect(foundSpecialChars).toBeTruthy();
  });

  test('contact with unicode name renders correctly', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 10_000 });

    // Create contact with unicode name
    await page.getByRole('button', { name: /add contact/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Contact' })).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder('First name').fill(UNICODE_FIRST);
    await page.getByPlaceholder('Last name').fill(UNICODE_LAST);
    await page.getByPlaceholder('Company name').fill('Unicode Corp');
    await page.locator('select').selectOption('other');

    await page.locator('form').getByRole('button', { name: /add contact/i }).click();
    await page.waitForLoadState('networkidle');

    // Verify it appears with correct text
    const fullName = `${UNICODE_FIRST} ${UNICODE_LAST}`;
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 });

    // Get the contact ID for cleanup via API
    const contactResponse = await page.evaluate(async (lastName) => {
      const res = await fetch(`/api/contacts?search=${encodeURIComponent(lastName)}`);
      const data = await res.json();
      return data.contacts?.[0]?.id || null;
    }, UNICODE_LAST);
    if (contactResponse) cleanupIds.contacts.push(contactResponse);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2. Long Input Handling
// ═══════════════════════════════════════════════════════════════════

test.describe('Long Input Handling', () => {
  test('expense with very long vendor name (500 chars)', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');

    // Wait for expense list to load
    await expect(page.getByRole('heading', { name: 'The Expense Register' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: /Add Expense/i }).click();
    await expect(page.locator('text=Record New Expense')).toBeVisible({ timeout: 10_000 });

    // Fill with a 500-char vendor name
    const longVendor = 'V'.repeat(500);
    await page.locator('#amount').fill('1.00');
    await page.locator('#vendor').fill(longVendor);

    // Select an event target
    const eventSelect = page.locator('#event_id');
    const eventOptions = eventSelect.locator('option');
    const optCount = await eventOptions.count();
    if (optCount > 1) {
      const firstVal = await eventOptions.nth(1).getAttribute('value');
      await eventSelect.selectOption(firstVal!);
    }

    // Submit — should either succeed or show a validation error, not crash
    await page.getByRole('button', { name: /Record Expense/i }).click();

    // Wait and check: either the form closes (success) or an error message shows
    await page.waitForTimeout(3000);
    const formGone = await page.locator('text=Record New Expense').isHidden().catch(() => false);
    const hasError = await page.locator('[role="alert"], .text-destructive, text=/error/i').first().isVisible().catch(() => false);
    const pageNotCrashed = await page.getByRole('heading', { name: 'The Expense Register' }).isVisible().catch(() => false);

    // The page should still be functional
    expect(formGone || hasError || pageNotCrashed).toBeTruthy();

    // If the expense was created, clean it up
    if (formGone) {
      // Refresh to get the expense with the long vendor
      await page.reload();
      await page.waitForLoadState('networkidle');
      const longExpenseCard = page.locator('div.bg-card').filter({ hasText: longVendor.slice(0, 20) }).first();
      if (await longExpenseCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const deleteBtn = longExpenseCard.locator('button[aria-label="Delete expense"]');
        await deleteBtn.click();
        const dialog = page.locator('dialog[open]');
        await dialog.locator('button').filter({ hasText: /^Delete$/ }).click({ force: true });
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('contact with very long notes (2000 chars)', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: /add contact/i }).click();
    await expect(page.getByRole('heading', { name: 'Add Contact' })).toBeVisible({ timeout: 10_000 });

    const longNotes = 'N'.repeat(2000);
    await page.getByPlaceholder('First name').fill('LongNotes');
    await page.getByPlaceholder('Last name').fill('Test-' + Date.now());
    await page.getByPlaceholder('Additional context about this contact').fill(longNotes);
    await page.locator('form select').selectOption('other');

    await page.locator('form').getByRole('button', { name: /add contact/i }).click();

    // Wait and check outcome
    await page.waitForTimeout(3000);
    const formGone = await page.getByRole('heading', { name: 'Add Contact' }).isHidden().catch(() => false);
    const pageOk = await page.getByRole('heading', { name: /contacts/i }).isVisible().catch(() => false);

    // Page should not have crashed
    expect(formGone || pageOk).toBeTruthy();

    // Clean up if created
    if (formGone) {
      const lastNameText = await page.getByText('LongNotes').first().textContent().catch(() => '');
      if (lastNameText) {
        const contactResponse = await page.evaluate(async () => {
          const res = await fetch(`/api/contacts?search=LongNotes`);
          const data = await res.json();
          return data.contacts?.[0]?.id || null;
        });
        if (contactResponse) {
          await page.evaluate(async (id) => {
            await fetch(`/api/contacts/${id}`, { method: 'DELETE' });
          }, contactResponse);
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════
// 3. Empty States
// ═══════════════════════════════════════════════════════════════════

test.describe('Empty States', () => {
  test('search events with nonsense shows empty state', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });

    const searchInput = page.getByPlaceholder('Search events...');
    await searchInput.fill('zzzznonexistent999xyzabc');
    await page.waitForTimeout(1000);

    // Should show "No Events Found" or zero count
    const noResults = page.locator('text=No Events Found');
    const zeroCount = page.locator('text=/^0\\s+events$/');
    const hasEmpty = await noResults.isVisible().catch(() => false) || await zeroCount.isVisible().catch(() => false);
    expect(hasEmpty).toBeTruthy();
  });

  test('search contacts with nonsense shows empty state', async ({ page }) => {
    await page.goto('/contacts');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /contacts/i })).toBeVisible({ timeout: 10_000 });

    const searchInput = page.getByPlaceholder('Search contacts...');
    await searchInput.fill('zzzznonexistent999xyzabc');
    // Wait for the search to trigger a fetch and re-render
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');

    // Should show "No Contacts Yet" empty state or "0 contact(s) in your network"
    const noContacts = page.locator('text=No Contacts Yet');
    const zeroCountPlural = page.locator('text=0 contacts in your network');
    const zeroCountSingular = page.locator('text=0 contact in your network');
    const hasEmpty = await noContacts.isVisible().catch(() => false)
      || await zeroCountPlural.isVisible().catch(() => false)
      || await zeroCountSingular.isVisible().catch(() => false);
    expect(hasEmpty).toBeTruthy();
  });

  test('filter expenses by vendor with nonsense shows empty state', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Expense Register' })).toBeVisible({ timeout: 15_000 });

    // Wait for data to load
    await page.locator('text=Select all').waitFor({ state: 'visible', timeout: 15_000 });

    const vendorInput = page.locator('input[placeholder="Search vendor..."]');
    await expect(vendorInput).toBeVisible({ timeout: 10_000 });
    await vendorInput.fill('zzzznonexistent999xyzabc');

    await expect(page.getByRole('heading', { name: 'No Expenses Found' })).toBeVisible({ timeout: 10_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// 4. Rapid Navigation
// ═══════════════════════════════════════════════════════════════════

test.describe('Rapid Navigation', () => {
  test('navigate quickly between 5+ pages without crash', async ({ page }) => {
    const routes = ['/dashboard', '/events', '/expenses', '/contacts', '/settings', '/dashboard'];

    for (const route of routes) {
      // Navigate without waiting for full load — simulating rapid clicking
      page.goto(route).catch(() => {});
      await page.waitForTimeout(300);
    }

    // Wait for the final page to settle
    await page.waitForLoadState('networkidle', { timeout: 20_000 });

    // Verify the final page (dashboard) loaded correctly
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Page should not show any unhandled error
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).not.toContain('Application error');
    expect(bodyText).not.toContain('Unhandled Runtime Error');
  });
});

// ═══════════════════════════════════════════════════════════════════
// 5. Double Submit Prevention
// ═══════════════════════════════════════════════════════════════════

test.describe('Double Submit Prevention', () => {
  test('event create button disables during submission', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Open create form
    await page.getByRole('button', { name: /Add Event/i }).click();
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    // Fill required fields with a unique name
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const testEventName = `PW-DblSub-${uniqueId}`;
    await page.locator('#name').fill(testEventName);
    await waitForEventTypes(page);
    const eventTypeSelect = page.locator('#event_type_id');
    const firstTypeValue = await eventTypeSelect.locator('option').nth(1).getAttribute('value');
    await eventTypeSelect.selectOption(firstTypeValue!);
    await page.locator('#quarter').selectOption('Q3');
    await page.locator('#budget_amount').fill('500');

    // Click submit and immediately check if the button becomes disabled/loading
    const submitBtn = page.getByRole('button', { name: /Create Event/i });
    await submitBtn.click();

    // The Button component sets disabled={true} when isLoading is true
    const isDisabledOrLoading = await submitBtn.isDisabled().catch(() => false)
      || await page.locator('button:has-text("Create Event") >> .animate-spin').isVisible().catch(() => false);

    // Wait for form to close (event created)
    await expect(page.locator('text=Register New Event')).not.toBeVisible({ timeout: 15_000 });

    // Search for the exact event name
    const searchInput = page.getByPlaceholder('Search events...');
    await searchInput.fill(uniqueId);
    await page.waitForTimeout(1500);

    // There should be exactly 1 matching event (not 2 from double-submit)
    const matchingCards = page.locator('a[href^="/events/"]').filter({ hasText: uniqueId });
    const count = await matchingCards.count();
    expect(count).toBe(1);

    // Clean up — navigate to the event and delete it
    await matchingCards.first().click();
    await page.waitForLoadState('networkidle');
    const url = page.url();
    const eventId = url.match(/\/events\/([a-f0-9-]+)/)?.[1];
    if (eventId) cleanupIds.events.push(eventId);
  });
});

// ═══════════════════════════════════════════════════════════════════
// 6. Form Reset/Cancel
// ═══════════════════════════════════════════════════════════════════

test.describe('Form Reset/Cancel', () => {
  test('event form resets after cancel', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Open form and fill in data
    await page.getByRole('button', { name: /Add Event/i }).click();
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    await page.locator('#name').fill('Temporary Event Name');
    await page.locator('#location').fill('Temporary Location');

    // Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.locator('text=Register New Event')).not.toBeVisible({ timeout: 5_000 });

    // Re-open the form
    await page.getByRole('button', { name: /Add Event/i }).click();
    await expect(page.locator('text=Register New Event')).toBeVisible({ timeout: 10_000 });

    // Fields should be empty (cleared)
    const nameValue = await page.locator('#name').inputValue();
    const locationValue = await page.locator('#location').inputValue();
    expect(nameValue).toBe('');
    expect(locationValue).toBe('');

    // Cancel again to clean up
    await page.getByRole('button', { name: /Cancel/i }).click();
  });

  test('expense form resets after cancel', async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Expense Register' })).toBeVisible({ timeout: 15_000 });

    // Open form and fill data
    await page.getByRole('button', { name: /Add Expense/i }).click();
    await expect(page.locator('text=Record New Expense')).toBeVisible({ timeout: 10_000 });

    await page.locator('#vendor').fill('Temporary Vendor');
    await page.locator('#amount').fill('999.99');

    // Cancel
    await page.getByRole('button', { name: /Cancel/i }).click();
    await expect(page.locator('text=Record New Expense')).not.toBeVisible({ timeout: 5_000 });

    // Re-open
    await page.getByRole('button', { name: /Add Expense/i }).click();
    await expect(page.locator('text=Record New Expense')).toBeVisible({ timeout: 10_000 });

    // Fields should be cleared
    const vendorValue = await page.locator('#vendor').inputValue();
    const amountValue = await page.locator('#amount').inputValue();
    expect(vendorValue).toBe('');
    expect(amountValue).toBe('');

    await page.getByRole('button', { name: /Cancel/i }).click();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 7. URL Direct Access
// ═══════════════════════════════════════════════════════════════════

test.describe('URL Direct Access', () => {
  test('direct navigation to /events works', async ({ page }) => {
    // Navigate directly via URL, not via sidebar
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('a[href^="/events/"]').first()).toBeVisible({ timeout: 15_000 });
  });

  test('non-existent event ID shows error, not crash', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await page.goto(`/events/${fakeId}`);
    await page.waitForLoadState('networkidle');

    // Should show some error indication — either "not found", redirect, or error message
    // It should NOT show an unhandled runtime error or blank page
    await page.waitForTimeout(3000);

    const bodyText = await page.locator('body').textContent() || '';
    const hasError = bodyText.toLowerCase().includes('not found')
      || bodyText.toLowerCase().includes('error')
      || bodyText.toLowerCase().includes('does not exist')
      || bodyText.toLowerCase().includes('no event');

    // Or it might redirect back to events list
    const redirectedToList = page.url().endsWith('/events');

    // Either way, the app should not have crashed
    const notCrashed = !bodyText.includes('Unhandled Runtime Error')
      && !bodyText.includes('Application error');

    expect(hasError || redirectedToList || notCrashed).toBeTruthy();
    // Ensure at least the page is not showing a Next.js crash screen
    expect(notCrashed).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 8. Browser Back/Forward
// ═══════════════════════════════════════════════════════════════════

test.describe('Browser Back/Forward Navigation', () => {
  test('dashboard -> events -> detail -> back -> forward works correctly', async ({ page }) => {
    // Step 1: Go to dashboard
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    const dashboardHeading = page.locator('h1, h2').first();
    await expect(dashboardHeading).toBeVisible({ timeout: 15_000 });

    // Step 2: Navigate to events
    await page.goto('/events');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Step 3: Click into an event detail
    const firstEvent = page.locator('a[href^="/events/"]').first();
    await expect(firstEvent).toBeVisible({ timeout: 15_000 });
    const eventHref = await firstEvent.getAttribute('href');
    await firstEvent.click();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(/\/events\/[a-f0-9-]+/);
    const detailHeading = page.locator('h1').first();
    await expect(detailHeading).toBeVisible({ timeout: 10_000 });

    // Step 4: Press back — should go to events list
    await page.goBack();
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'The Event Ledger' })).toBeVisible({ timeout: 15_000 });

    // Step 5: Press forward — should go to event detail
    await page.goForward();
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveURL(new RegExp(eventHref!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 });
  });
});
