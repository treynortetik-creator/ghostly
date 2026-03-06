/**
 * Ghostly - API Endpoint E2E Tests
 *
 * Tests backend API responses directly using Playwright's request context
 * (which inherits auth cookies from storageState).
 */

import { test, expect } from '@playwright/test';

const TEST_PREFIX = 'PW-API-';

// ============================================
// 1. Health API (no auth needed, but works with auth too)
// ============================================

test.describe('Health API', () => {
  test('GET /api/health returns 200 with status fields', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.db_status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(typeof data.uptime_seconds).toBe('number');
  });
});

// ============================================
// 2. Auth API
// ============================================

test.describe('Auth API', () => {
  test('GET /api/auth/me returns current user', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.user).toBeDefined();
    expect(data.user.username).toBeDefined();
  });
});

// ============================================
// 3. Dashboard API
// ============================================

test.describe('Dashboard API', () => {
  test('GET /api/dashboard/summary returns budget data', async ({ request }) => {
    const res = await request.get('/api/dashboard/summary');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.total).toBeDefined();
    expect(data.total.budget).toBeGreaterThanOrEqual(0);
    expect(data.total.allocated).toBeGreaterThanOrEqual(0);
    expect(data.total.actual).toBeGreaterThanOrEqual(0);
    expect(data.total.remaining).toBeDefined();
    expect(data.byEventType).toBeInstanceOf(Array);
    expect(data.byQuarter).toBeInstanceOf(Array);
    expect(data.byCategory).toBeInstanceOf(Array);
  });

  test('GET /api/dashboard/roi returns ROI data', async ({ request }) => {
    const res = await request.get('/api/dashboard/roi');
    expect(res.status()).toBe(200);
    const data = await res.json();
    // ROI endpoint returns aggregate data
    expect(data).toBeDefined();
  });
});

// ============================================
// 4. Settings & Fiscal Years API
// ============================================

test.describe('Settings API', () => {
  test('GET /api/settings returns settings object', async ({ request }) => {
    const res = await request.get('/api/settings');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });

  test('GET /api/fiscal-years returns array', async ({ request }) => {
    const res = await request.get('/api/fiscal-years');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toBeDefined();
  });
});

// ============================================
// 5. Event Types API
// ============================================

test.describe('Event Types API', () => {
  test('GET /api/event-types returns array of event types', async ({ request }) => {
    const res = await request.get('/api/event-types');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.event_types).toBeInstanceOf(Array);
  });
});

// ============================================
// 6. Search API
// ============================================

test.describe('Search API', () => {
  test('GET /api/search?q=test returns search results structure', async ({ request }) => {
    const res = await request.get('/api/search?q=test');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.results).toBeDefined();
    expect(data.results.events).toBeInstanceOf(Array);
    expect(data.results.expenses).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(data.meta.query).toBe('test');
    expect(typeof data.meta.total).toBe('number');
  });

  test('GET /api/search?q=x returns empty results for short query', async ({ request }) => {
    const res = await request.get('/api/search?q=x');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.meta.total).toBe(0);
  });
});

// ============================================
// 7. Audit Log API
// ============================================

test.describe('Audit Log API', () => {
  test('GET /api/audit-log returns paginated entries', async ({ request }) => {
    const res = await request.get('/api/audit-log');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.entries).toBeDefined();
    expect(data.pagination).toBeDefined();
  });
});

// ============================================
// 8. Events CRUD API (serial)
// ============================================

test.describe.serial('Events CRUD API', () => {
  let createdEventId: string;
  let eventTypeId: string;

  test('GET /api/events returns paginated events', async ({ request }) => {
    const res = await request.get('/api/events');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.events).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(typeof data.meta.total).toBe('number');
    expect(data.pagination).toBeDefined();
  });

  test('setup: get event type ID for create', async ({ request }) => {
    const res = await request.get('/api/event-types');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.event_types.length).toBeGreaterThan(0);
    eventTypeId = data.event_types[0].id;
  });

  test('POST /api/events creates a new event', async ({ request }) => {
    const uniqueName = `${TEST_PREFIX}Event-${Date.now()}`;
    const res = await request.post('/api/events', {
      data: {
        name: uniqueName,
        event_type_id: eventTypeId,
        quarter: 'Q3',
        budget_amount: 5000,
        location: 'API Test City',
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe(uniqueName);
    expect(data.quarter).toBe('Q3');
    expect(data.budget_amount).toBe(5000);
    expect(data.location).toBe('API Test City');
    expect(data.actual_spent).toBe(0);
    expect(data.remaining).toBe(5000);
    expect(data.expense_count).toBe(0);
    createdEventId = data.id;
  });

  test('GET /api/events/[id] returns the created event', async ({ request }) => {
    const res = await request.get(`/api/events/${createdEventId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.event).toBeDefined();
    expect(data.event.id).toBe(createdEventId);
    expect(data.expenses).toBeInstanceOf(Array);
  });

  test('PUT /api/events/[id] updates event name and location', async ({ request }) => {
    const res = await request.put(`/api/events/${createdEventId}`, {
      data: {
        name: `${TEST_PREFIX}Event-Updated`,
        location: 'Updated City',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.name).toBe(`${TEST_PREFIX}Event-Updated`);
    expect(data.location).toBe('Updated City');
  });

  test('DELETE /api/events/[id] soft-deletes the event', async ({ request }) => {
    const res = await request.delete(`/api/events/${createdEventId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Event deleted successfully');
    expect(data.id).toBe(createdEventId);
  });

  test('GET /api/events/[id] returns 404 after deletion', async ({ request }) => {
    const res = await request.get(`/api/events/${createdEventId}`);
    expect(res.status()).toBe(404);
  });
});

// ============================================
// 9. Expenses CRUD API (serial)
// ============================================

test.describe.serial('Expenses CRUD API', () => {
  let eventTypeId: string;
  let helperEventId: string;
  let createdExpenseId: string;

  test('setup: create helper event for expenses', async ({ request }) => {
    // Get event type
    const typesRes = await request.get('/api/event-types');
    const typesData = await typesRes.json();
    eventTypeId = typesData.event_types[0].id;

    // Create helper event
    const res = await request.post('/api/events', {
      data: {
        name: `${TEST_PREFIX}ExpenseHelper-${Date.now()}`,
        event_type_id: eventTypeId,
        quarter: 'Q1',
        budget_amount: 10000,
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    helperEventId = data.id;
  });

  test('GET /api/expenses returns paginated expenses', async ({ request }) => {
    const res = await request.get('/api/expenses');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.expenses).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(typeof data.meta.total).toBe('number');
    expect(typeof data.meta.total_amount).toBe('number');
    expect(data.pagination).toBeDefined();
  });

  test('POST /api/expenses creates expense linked to event', async ({ request }) => {
    const res = await request.post('/api/expenses', {
      data: {
        event_id: helperEventId,
        amount: 250.50,
        expense_date: '2026-03-01',
        vendor: `${TEST_PREFIX}Vendor`,
        memo: 'API test expense',
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.amount).toBe(250.5);
    expect(data.vendor).toBe(`${TEST_PREFIX}Vendor`);
    expect(data.event_id).toBe(helperEventId);
    expect(data.event_name).toBeDefined();
    expect(data.target_type).toBe('event');
    createdExpenseId = data.id;
  });

  test('PUT /api/expenses/[id] updates amount', async ({ request }) => {
    const res = await request.put(`/api/expenses/${createdExpenseId}`, {
      data: {
        amount: 500.00,
        memo: 'Updated memo',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.expense).toBeDefined();
    expect(data.expense.amount).toBe(500);
    expect(data.expense.memo).toBe('Updated memo');
  });

  test('DELETE /api/expenses/[id] soft-deletes the expense', async ({ request }) => {
    const res = await request.delete(`/api/expenses/${createdExpenseId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Expense deleted successfully');
  });

  test('cleanup: delete helper event', async ({ request }) => {
    const res = await request.delete(`/api/events/${helperEventId}`);
    expect(res.status()).toBe(200);
  });
});

// ============================================
// 10. Categories API (serial)
// ============================================

test.describe.serial('Categories CRUD API', () => {
  let createdCategoryId: string;

  test('GET /api/categories returns paginated categories', async ({ request }) => {
    const res = await request.get('/api/categories');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.categories).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(typeof data.meta.total).toBe('number');
    expect(data.pagination).toBeDefined();
  });

  test('POST /api/categories creates a new category', async ({ request }) => {
    const uniqueName = `${TEST_PREFIX}Category-${Date.now()}`;
    const res = await request.post('/api/categories', {
      data: {
        name: uniqueName,
        budget_amount: 3000,
        description: 'API test category',
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toBe(uniqueName);
    expect(data.budget_amount).toBe(3000);
    expect(data.actual_spent).toBe(0);
    expect(data.remaining).toBe(3000);
    expect(data.expense_count).toBe(0);
    createdCategoryId = data.id;
  });

  test('cleanup: verify category appears in list then note for manual cleanup', async ({ request }) => {
    // Categories don't have a DELETE endpoint, so verify it exists in the list
    const res = await request.get('/api/categories');
    expect(res.status()).toBe(200);
    const data = await res.json();
    const found = data.categories.find((c: { id: string }) => c.id === createdCategoryId);
    expect(found).toBeDefined();
    // Note: No DELETE /api/categories/[id] endpoint exists - soft delete via DB only
  });
});

// ============================================
// 11. Contacts CRUD API (serial)
// ============================================

test.describe.serial('Contacts CRUD API', () => {
  let createdContactId: string;

  test('GET /api/contacts returns contacts list', async ({ request }) => {
    const res = await request.get('/api/contacts');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.contacts).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(typeof data.meta.total).toBe('number');
  });

  test('POST /api/contacts creates a new contact', async ({ request }) => {
    const suffix = Date.now();
    const res = await request.post('/api/contacts', {
      data: {
        first_name: `${TEST_PREFIX}First-${suffix}`,
        last_name: `${TEST_PREFIX}Last-${suffix}`,
        company: 'Test Corp',
        title: 'Engineer',
        email: `pw-api-${suffix}@test.com`,
        phone: '555-0199',
        contact_type: 'vendor',
        notes: 'Created by API test',
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.first_name).toContain(TEST_PREFIX);
    expect(data.last_name).toContain(TEST_PREFIX);
    expect(data.company).toBe('Test Corp');
    expect(data.contact_type).toBe('vendor');
    createdContactId = data.id;
  });

  test('GET /api/contacts/[id] returns the created contact', async ({ request }) => {
    const res = await request.get(`/api/contacts/${createdContactId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.id).toBe(createdContactId);
    expect(data.company).toBe('Test Corp');
  });

  test('PUT /api/contacts/[id] updates contact company', async ({ request }) => {
    const res = await request.put(`/api/contacts/${createdContactId}`, {
      data: {
        company: 'Updated Corp',
        title: 'Senior Engineer',
      },
    });
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.company).toBe('Updated Corp');
    expect(data.title).toBe('Senior Engineer');
  });

  test('DELETE /api/contacts/[id] soft-deletes the contact', async ({ request }) => {
    const res = await request.delete(`/api/contacts/${createdContactId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Contact deleted');
  });

  test('GET /api/contacts/[id] returns 404 after deletion', async ({ request }) => {
    const res = await request.get(`/api/contacts/${createdContactId}`);
    expect(res.status()).toBe(404);
  });
});

// ============================================
// 12. Team API (serial)
// ============================================

test.describe.serial('Team CRUD API', () => {
  let createdMemberId: string;

  test('GET /api/team returns team members list', async ({ request }) => {
    const res = await request.get('/api/team');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.team_members).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
    expect(typeof data.meta.total).toBe('number');
  });

  test('POST /api/team creates a new team member', async ({ request }) => {
    const suffix = Date.now();
    const res = await request.post('/api/team', {
      data: {
        name: `${TEST_PREFIX}TeamMember-${suffix}`,
        email: `pw-api-team-${suffix}@test.com`,
        default_role: 'Coordinator',
        notes: 'API test team member',
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.name).toContain(TEST_PREFIX);
    expect(data.email).toContain('pw-api-team');
    expect(data.default_role).toBe('Coordinator');
    createdMemberId = data.id;
  });

  test('DELETE /api/team/[id] soft-deletes the team member', async ({ request }) => {
    const res = await request.delete(`/api/team/${createdMemberId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.message).toBe('Team member deleted');
  });
});

// ============================================
// 13. Webhooks CRUD API (serial)
// ============================================

test.describe.serial('Webhooks CRUD API', () => {
  let createdWebhookId: string;

  test('GET /api/webhooks returns webhooks list', async ({ request }) => {
    const res = await request.get('/api/webhooks');
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.webhooks).toBeInstanceOf(Array);
    expect(data.meta).toBeDefined();
  });

  test('POST /api/webhooks creates a new webhook', async ({ request }) => {
    const res = await request.post('/api/webhooks', {
      data: {
        url: `https://example.com/webhook/${Date.now()}`,
        event_types: ['expense.created', 'event.created'],
        description: `${TEST_PREFIX}webhook`,
      },
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
    expect(data.url).toContain('example.com/webhook');
    expect(data.event_types).toEqual(['expense.created', 'event.created']);
    expect(data.is_active).toBe(true);
    createdWebhookId = data.id;
  });

  test('DELETE /api/webhooks/[id] deletes the webhook', async ({ request }) => {
    const res = await request.delete(`/api/webhooks/${createdWebhookId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ============================================
// 14. Error Handling
// ============================================

test.describe('Error Handling', () => {
  test('POST /api/events with empty body returns 400', async ({ request }) => {
    const res = await request.post('/api/events', {
      data: {},
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test('GET /api/events/invalid-uuid returns 404', async ({ request }) => {
    const res = await request.get('/api/events/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Event not found');
  });

  test('PUT /api/events/nonexistent-uuid with valid body returns 404', async ({ request }) => {
    const res = await request.put('/api/events/00000000-0000-0000-0000-000000000000', {
      data: { name: 'Should not work' },
    });
    expect(res.status()).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Event not found');
  });

  test('DELETE /api/events/nonexistent-uuid returns 404', async ({ request }) => {
    const res = await request.delete('/api/events/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('POST /api/expenses with missing required fields returns 400', async ({ request }) => {
    const res = await request.post('/api/expenses', {
      data: { vendor: 'test' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test('POST /api/contacts with missing first_name returns 400', async ({ request }) => {
    const res = await request.post('/api/contacts', {
      data: { last_name: 'Only' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test('POST /api/team with empty name returns 400', async ({ request }) => {
    const res = await request.post('/api/team', {
      data: { name: '' },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toBeDefined();
  });

  test('POST /api/webhooks with invalid event_types returns 400', async ({ request }) => {
    const res = await request.post('/api/webhooks', {
      data: {
        url: 'https://example.com/hook',
        event_types: ['invalid.type'],
      },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Invalid event_types');
  });

  test('POST /api/events with invalid quarter returns 400', async ({ request }) => {
    const typesRes = await request.get('/api/event-types');
    const typesData = await typesRes.json();
    const eventTypeId = typesData.event_types[0].id;

    const res = await request.post('/api/events', {
      data: {
        name: `${TEST_PREFIX}InvalidQuarter`,
        event_type_id: eventTypeId,
        quarter: 'Q5',
        budget_amount: 1000,
      },
    });
    expect(res.status()).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('quarter');
  });
});
