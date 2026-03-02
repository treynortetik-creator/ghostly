/**
 * Ghostly Agent - Tool Definitions
 *
 * Each tool has a name, description, JSON-schema parameters, and an execute
 * function that calls the internal Ghostly API routes with org context.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToolPermissionMode = 'never' | 'ask' | 'always';

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface AgentTool {
  name: string;
  description: string;
  default_permission?: ToolPermissionMode;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
  execute: (
    args: Record<string, unknown>,
    context: ToolExecutionContext
  ) => Promise<string>;
}

export interface ToolExecutionContext {
  /** Organization ID to pass to internal API calls */
  orgId: string;
  /** Base URL for internal API calls (e.g. http://localhost:3000) */
  baseUrl: string;
  /** Auth cookie string to forward to internal API calls */
  cookieHeader: string;
}

// ─── Internal Fetch Helper ───────────────────────────────────────────────────

async function internalFetch(
  ctx: ToolExecutionContext,
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${ctx.baseUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Cookie': ctx.cookieHeader,
      'x-organization-id': ctx.orgId,
      'x-auth-type': 'cookie',
    },
  };

  if (body !== undefined && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  if (!response.ok) {
    const err = data as { error?: string; message?: string };
    throw new Error(
      err?.error || err?.message || `HTTP ${response.status}: ${response.statusText}`
    );
  }

  return data;
}

function splitHumanName(value: string): { first_name: string; last_name: string } {
  const cleaned = value.trim();
  if (!cleaned) {
    return { first_name: 'Vendor', last_name: 'Contact' };
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: 'Contact' };
  }

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(' '),
  };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const agentTools: AgentTool[] = [
  // 1. get_events
  {
    name: 'get_events',
    description:
      'List events with optional filters. Returns event name, quarter, budget, actual spend, and remaining budget for each event.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        search: {
          type: 'string',
          description: 'Filter by event name (partial match)',
        },
        quarter: {
          type: 'string',
          description: 'Filter by quarter',
          enum: ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'],
        },
        per_page: {
          type: 'number',
          description: 'Number of events to return (default 20, max 50)',
        },
      },
    },
    execute: async (args, ctx) => {
      const params = new URLSearchParams();
      if (args.search) params.set('search', String(args.search));
      if (args.quarter) params.set('quarter', String(args.quarter));
      params.set('per_page', String(args.per_page ?? 20));

      const result = await internalFetch(ctx, 'GET', `/api/events?${params.toString()}`);
      const data = result as { events?: unknown[]; pagination?: unknown };
      const events = (data.events ?? []).map((e: unknown) => {
        const ev = e as Record<string, unknown>;
        return {
          id: ev.id,
          name: ev.name,
          quarter: ev.quarter,
          event_type: (ev.event_type_record as Record<string, unknown> | null)?.name ?? null,
          budget_amount: ev.budget_amount,
          actual_spent: ev.actual_spent,
          remaining: ev.remaining,
          date_start: ev.date_start,
          date_end: ev.date_end,
          location: ev.location,
          stage: ev.stage,
        };
      });

      return JSON.stringify(
        {
          events,
          total: (data.pagination as Record<string, unknown>)?.total ?? events.length,
        },
        null,
        2
      );
    },
  },

  // 2. get_event_detail
  {
    name: 'get_event_detail',
    description:
      'Get full details of a specific event including budget, expenses, ROI metrics, checklist progress, and team assignments.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID',
        },
      },
      required: ['event_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'GET', `/api/events/${args.event_id}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 3. create_event
  {
    name: 'create_event',
    description:
      'Create a new event with its required planning fields such as name, event type, quarter, and budget.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Event name',
        },
        event_type_id: {
          type: 'string',
          description: 'Event type UUID',
        },
        quarter: {
          type: 'string',
          description: 'Quarter for this event',
          enum: ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'],
        },
        budget_amount: {
          type: 'number',
          description: 'Budget amount in dollars',
        },
        fiscal_year_id: {
          type: 'string',
          description: 'Optional fiscal year UUID',
        },
        date_start: {
          type: 'string',
          description: 'Optional start date (YYYY-MM-DD)',
        },
        date_end: {
          type: 'string',
          description: 'Optional end date (YYYY-MM-DD)',
        },
        location: {
          type: 'string',
          description: 'Optional event location',
        },
        expansion_goal: {
          type: 'number',
          description: 'Optional expansion goal count',
        },
        net_new_goal: {
          type: 'number',
          description: 'Optional net-new goal count',
        },
        approach_notes: {
          type: 'string',
          description: 'Optional strategic notes',
        },
        marketing_notes: {
          type: 'string',
          description: 'Optional marketing notes',
        },
        sales_notes: {
          type: 'string',
          description: 'Optional sales notes',
        },
      },
      required: ['name', 'event_type_id', 'quarter', 'budget_amount'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/events', {
        name: args.name,
        event_type_id: args.event_type_id,
        quarter: args.quarter,
        budget_amount: args.budget_amount,
        fiscal_year_id: args.fiscal_year_id ?? null,
        date_start: args.date_start ?? null,
        date_end: args.date_end ?? null,
        location: args.location ?? null,
        expansion_goal: args.expansion_goal ?? 0,
        net_new_goal: args.net_new_goal ?? 0,
        approach_notes: args.approach_notes ?? null,
        marketing_notes: args.marketing_notes ?? null,
        sales_notes: args.sales_notes ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 4. update_event
  {
    name: 'update_event',
    description:
      'Update event fields. Only include fields you want to change, including schedule, stage, budget, and ROI metrics.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID to update',
        },
        name: {
          type: 'string',
          description: 'New event name',
        },
        quarter: {
          type: 'string',
          description: 'New quarter',
          enum: ['Q1', 'Q2', 'Q3', 'Q4', 'TBD'],
        },
        budget_amount: {
          type: 'number',
          description: 'New budget amount in dollars',
        },
        location: {
          type: 'string',
          description: 'New location',
        },
        date_start: {
          type: 'string',
          description: 'New start date (YYYY-MM-DD)',
        },
        date_end: {
          type: 'string',
          description: 'New end date (YYYY-MM-DD)',
        },
        stage: {
          type: 'string',
          description: 'Event stage',
          enum: ['confirmed', 'in_progress', 'ready', 'active', 'debrief', 'archived'],
        },
        approach_notes: {
          type: 'string',
          description: 'Event approach or strategy notes',
        },
        marketing_notes: {
          type: 'string',
          description: 'Marketing notes',
        },
        sales_notes: {
          type: 'string',
          description: 'Sales notes',
        },
        pipeline_generated: {
          type: 'number',
          description: 'ROI pipeline generated amount in dollars',
        },
        revenue_closed: {
          type: 'number',
          description: 'ROI revenue closed amount in dollars',
        },
        leads_generated: {
          type: 'number',
          description: 'ROI leads generated count',
        },
        meetings_booked: {
          type: 'number',
          description: 'ROI meetings booked count',
        },
        opportunities_created: {
          type: 'number',
          description: 'ROI opportunities created count',
        },
        roi_notes: {
          type: 'string',
          description: 'ROI context notes',
        },
      },
      required: ['event_id'],
    },
    execute: async (args, ctx) => {
      const { event_id, ...updates } = args;
      const result = await internalFetch(ctx, 'PUT', `/api/events/${event_id}`, updates);
      return JSON.stringify(result, null, 2);
    },
  },

  // 5. update_event_roi
  {
    name: 'update_event_roi',
    description:
      'Set event ROI numbers directly (pipeline, revenue, leads, meetings, opportunities, and ROI notes).',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID to update',
        },
        pipeline_generated: {
          type: 'number',
          description: 'Pipeline generated amount in dollars',
        },
        revenue_closed: {
          type: 'number',
          description: 'Revenue closed amount in dollars',
        },
        leads_generated: {
          type: 'number',
          description: 'Leads generated count',
        },
        meetings_booked: {
          type: 'number',
          description: 'Meetings booked count',
        },
        opportunities_created: {
          type: 'number',
          description: 'Opportunities created count',
        },
        roi_notes: {
          type: 'string',
          description: 'ROI context notes',
        },
      },
      required: ['event_id'],
    },
    execute: async (args, ctx) => {
      const { event_id, ...updates } = args;
      const result = await internalFetch(ctx, 'PUT', `/api/events/${event_id}`, updates);
      return JSON.stringify(result, null, 2);
    },
  },

  // 6. get_expenses
  {
    name: 'get_expenses',
    description:
      'List expenses with optional filters. Can filter by event, vendor, date range, or source type.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Filter by event UUID',
        },
        vendor: {
          type: 'string',
          description: 'Filter by vendor name',
        },
        date_start: {
          type: 'string',
          description: 'Filter expenses on or after this date (YYYY-MM-DD)',
        },
        date_end: {
          type: 'string',
          description: 'Filter expenses on or before this date (YYYY-MM-DD)',
        },
        per_page: {
          type: 'number',
          description: 'Number of expenses to return (default 20, max 50)',
        },
      },
    },
    execute: async (args, ctx) => {
      const params = new URLSearchParams();
      if (args.event_id) params.set('event_id', String(args.event_id));
      if (args.vendor) params.set('vendor', String(args.vendor));
      if (args.date_start) params.set('date_start', String(args.date_start));
      if (args.date_end) params.set('date_end', String(args.date_end));
      params.set('per_page', String(args.per_page ?? 20));

      const result = await internalFetch(ctx, 'GET', `/api/expenses?${params.toString()}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 7. create_expense
  {
    name: 'create_expense',
    description:
      'Create a new expense line item for an event or category. Amount is in dollars and expense_date must be YYYY-MM-DD.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID for this expense (use event_id OR category_id)',
        },
        category_id: {
          type: 'string',
          description: 'Category UUID for this expense (use category_id OR event_id)',
        },
        amount: {
          type: 'number',
          description: 'Expense amount in dollars',
        },
        expense_date: {
          type: 'string',
          description: 'Date of the expense (YYYY-MM-DD)',
        },
        vendor: {
          type: 'string',
          description: 'Vendor or payee name',
        },
        memo: {
          type: 'string',
          description: 'Description or memo for this expense',
        },
      },
      required: ['amount', 'expense_date'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/expenses', {
        event_id: args.event_id ?? null,
        category_id: args.category_id ?? null,
        amount: args.amount,
        expense_date: args.expense_date,
        vendor: args.vendor ?? null,
        memo: args.memo ?? null,
        source_type: 'manual',
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 8. get_overdue_tasks
  {
    name: 'get_overdue_tasks',
    description:
      'Find checklist items that are past their due date and not yet completed. Returns task title, event name, due date, and assignee.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Optional: limit to a specific event UUID',
        },
      },
    },
    execute: async (args, ctx) => {
      const params = new URLSearchParams();
      if (args.event_id) params.set('event_id', String(args.event_id));
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/overdue-tasks?${params.toString()}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 9. get_over_budget_events
  {
    name: 'get_over_budget_events',
    description:
      'Find events where actual spending exceeds budget. Returns event name, budget, actual spent, and amount over budget.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const result = await internalFetch(ctx, 'GET', '/api/agent/tools/over-budget');
      return JSON.stringify(result, null, 2);
    },
  },

  // 10. create_checklist_item
  {
    name: 'create_checklist_item',
    description:
      'Add a checklist item to an event with optional phase, due date, and description.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID',
        },
        title: {
          type: 'string',
          description: 'Checklist item title',
        },
        phase: {
          type: 'string',
          description: 'Event phase',
          enum: ['pre_event', 'day_of', 'post_event'],
        },
        due_date: {
          type: 'string',
          description: 'Due date (YYYY-MM-DD)',
        },
        description: {
          type: 'string',
          description: 'Optional item details',
        },
      },
      required: ['event_id', 'title'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/agent/tools/checklist-item', {
        event_id: args.event_id,
        title: args.title,
        phase: args.phase ?? 'pre_event',
        due_date: args.due_date ?? null,
        description: args.description ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 11. get_team_members
  {
    name: 'get_team_members',
    description:
      'List all active team members with name, email, role, and metadata needed for assignment decisions.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const result = await internalFetch(ctx, 'GET', '/api/team');
      return JSON.stringify(result, null, 2);
    },
  },

  // 12. create_team_member
  {
    name: 'create_team_member',
    description:
      'Create a new team member record that can be assigned to events and tasks.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Team member full name',
        },
        email: {
          type: 'string',
          description: 'Optional email address',
        },
        phone: {
          type: 'string',
          description: 'Optional phone number',
        },
        default_role: {
          type: 'string',
          description: 'Optional default role/title',
        },
        notes: {
          type: 'string',
          description: 'Optional notes',
        },
      },
      required: ['name'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/team', {
        name: args.name,
        email: args.email ?? null,
        phone: args.phone ?? null,
        default_role: args.default_role ?? null,
        notes: args.notes ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 13. assign_team_member_to_event
  {
    name: 'assign_team_member_to_event',
    description:
      'Assign an existing team member to an event with an optional event-specific role and notes.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID',
        },
        team_member_id: {
          type: 'string',
          description: 'Team member UUID',
        },
        event_role: {
          type: 'string',
          description: 'Optional event-specific role',
        },
        notes: {
          type: 'string',
          description: 'Optional assignment notes',
        },
      },
      required: ['event_id', 'team_member_id'],
    },
    execute: async (args, ctx) => {
      const eventId = String(args.event_id);
      const result = await internalFetch(ctx, 'POST', `/api/events/${eventId}/team`, {
        team_member_id: args.team_member_id,
        event_role: args.event_role ?? null,
        notes: args.notes ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 14. get_session_history
  {
    name: 'get_session_history',
    description:
      'Search chat message history across sessions with optional session and keyword filters.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Optional: limit to a specific session UUID',
        },
        search: {
          type: 'string',
          description: 'Optional keyword to search in message content',
        },
        limit: {
          type: 'number',
          description: 'Number of messages to return (default 20, max 50)',
        },
      },
    },
    execute: async (args, ctx) => {
      const params = new URLSearchParams();
      if (args.session_id) params.set('session_id', String(args.session_id));
      if (args.search) params.set('search', String(args.search));
      if (args.limit) params.set('limit', String(args.limit));

      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/session-history?${params.toString()}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 15. get_event_documents
  {
    name: 'get_event_documents',
    description:
      'List documents attached to an event with summaries and tags. Use read_document for full text.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID to list documents for',
        },
      },
      required: ['event_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(
        ctx,
        'GET',
        `/api/agent/tools/event-documents?event_id=${encodeURIComponent(String(args.event_id))}`
      );
      return JSON.stringify(result, null, 2);
    },
  },

  // 16. read_document
  {
    name: 'read_document',
    description:
      'Read full extracted text for a document by document ID.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document UUID to read',
        },
      },
      required: ['document_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(
        ctx,
        'GET',
        `/api/agent/tools/read-document?document_id=${encodeURIComponent(String(args.document_id))}`
      );
      return JSON.stringify(result, null, 2);
    },
  },

  // 17. attach_document
  {
    name: 'attach_document',
    description:
      'Attach an existing document record to an event.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        document_id: {
          type: 'string',
          description: 'Document UUID to attach',
        },
        event_id: {
          type: 'string',
          description: 'Event UUID to attach the document to',
        },
      },
      required: ['document_id', 'event_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/agent/tools/attach-document', {
        document_id: args.document_id,
        event_id: args.event_id,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 18. search
  {
    name: 'search',
    description:
      'Search across events and expenses and return matching records from both datasets.',
    default_permission: 'always',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
        },
      },
      required: ['query'],
    },
    execute: async (args, ctx) => {
      const query = String(args.query);
      const [eventsResult, expensesResult] = await Promise.all([
        internalFetch(ctx, 'GET', `/api/events?search=${encodeURIComponent(query)}&per_page=10`),
        internalFetch(ctx, 'GET', `/api/expenses?vendor=${encodeURIComponent(query)}&per_page=10`),
      ]);

      const events = ((eventsResult as Record<string, unknown>).events as unknown[]) ?? [];
      const expenses = ((expensesResult as Record<string, unknown>).expenses as unknown[]) ?? [];

      return JSON.stringify(
        {
          events: events.map((e: unknown) => {
            const ev = e as Record<string, unknown>;
            return {
              id: ev.id,
              name: ev.name,
              quarter: ev.quarter,
              budget_amount: ev.budget_amount,
              actual_spent: ev.actual_spent,
            };
          }),
          expenses: expenses.map((e: unknown) => {
            const ex = e as Record<string, unknown>;
            return {
              id: ex.id,
              vendor: ex.vendor,
              amount: ex.amount,
              expense_date: ex.expense_date,
              memo: ex.memo,
              event_id: ex.event_id,
            };
          }),
          total_results: events.length + expenses.length,
        },
        null,
        2
      );
    },
  },

  // 19. create_vendor
  {
    name: 'create_vendor',
    description:
      'Create a vendor contact record (master data) that can be reused across expenses and event planning.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        vendor_name: {
          type: 'string',
          description: 'Vendor name or primary contact name',
        },
        company: {
          type: 'string',
          description: 'Optional company/legal entity name',
        },
        title: {
          type: 'string',
          description: 'Optional title/role',
        },
        email: {
          type: 'string',
          description: 'Optional vendor email',
        },
        phone: {
          type: 'string',
          description: 'Optional vendor phone',
        },
        notes: {
          type: 'string',
          description: 'Optional notes about this vendor',
        },
      },
      required: ['vendor_name'],
    },
    execute: async (args, ctx) => {
      const parsed = splitHumanName(String(args.vendor_name ?? ''));
      const result = await internalFetch(ctx, 'POST', '/api/contacts', {
        first_name: parsed.first_name,
        last_name: parsed.last_name,
        company: args.company ?? String(args.vendor_name),
        title: args.title ?? null,
        email: args.email ?? null,
        phone: args.phone ?? null,
        contact_type: 'vendor',
        notes: args.notes ?? null,
        source: 'agent',
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 20. create_category
  {
    name: 'create_category',
    description:
      'Create a budget category (master data) with an optional fiscal year and starting budget.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Category name',
        },
        budget_amount: {
          type: 'number',
          description: 'Category budget amount in dollars',
        },
        fiscal_year_id: {
          type: 'string',
          description: 'Optional fiscal year UUID',
        },
        description: {
          type: 'string',
          description: 'Optional category description',
        },
      },
      required: ['name', 'budget_amount'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/categories', {
        name: args.name,
        budget_amount: args.budget_amount,
        fiscal_year_id: args.fiscal_year_id ?? null,
        description: args.description ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 21. create_event_type
  {
    name: 'create_event_type',
    description:
      'Create an event type (master data) for a fiscal year, including optional default budget and description.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Event type name',
        },
        fiscal_year_id: {
          type: 'string',
          description: 'Fiscal year UUID this event type belongs to',
        },
        budget_amount: {
          type: 'number',
          description: 'Optional default budget amount in dollars',
        },
        description: {
          type: 'string',
          description: 'Optional event type description',
        },
      },
      required: ['name', 'fiscal_year_id'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/event-types', {
        name: args.name,
        fiscal_year_id: args.fiscal_year_id,
        budget_amount: args.budget_amount ?? 0,
        description: args.description ?? null,
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 22. generate_document
  {
    name: 'generate_document',
    description:
      'Generate a document from a template for a specific event and save it to the event documents.',
    default_permission: 'ask',
    parameters: {
      type: 'object',
      properties: {
        template_name: {
          type: 'string',
          description: 'Template name to use (e.g., Run of Show)',
        },
        event_id: {
          type: 'string',
          description: 'Event UUID for generation',
        },
      },
      required: ['template_name', 'event_id'],
    },
    execute: async (args, ctx) => {
      const templatesResult = await internalFetch(ctx, 'GET', '/api/templates');
      const templates = ((templatesResult as Record<string, unknown>).templates as Record<string, unknown>[]) ?? [];
      const template = templates.find(
        (t) => String(t.name).toLowerCase() === String(args.template_name).toLowerCase()
      );

      if (!template) {
        const available = templates.map((t) => t.name).join(', ');
        return JSON.stringify({
          error: `Template "${args.template_name}" not found. Available templates: ${available || 'none'}`,
        });
      }

      const result = await internalFetch(ctx, 'POST', '/api/documents/generate', {
        template_id: template.id,
        event_id: args.event_id,
      });

      const data = result as Record<string, unknown>;
      const doc = data.document as Record<string, unknown>;

      return JSON.stringify(
        {
          success: true,
          document_id: doc?.id,
          filename: doc?.filename,
          template_name: data.template_name,
          event_name: data.event_name,
          message: `Generated "${data.template_name}" for ${data.event_name}.`,
        },
        null,
        2
      );
    },
  },
];

export function getToolDefaultPermission(tool: AgentTool): ToolPermissionMode {
  return tool.default_permission ?? 'always';
}

export function getAllTools(extraTools?: AgentTool[]): AgentTool[] {
  return extraTools ? [...agentTools, ...extraTools] : agentTools;
}

export function getToolPermissionMode(
  toolName: string,
  permissionMap: Record<string, unknown> | null | undefined,
  extraTools?: AgentTool[]
): ToolPermissionMode {
  const explicit = permissionMap?.[toolName];
  if (explicit === 'never' || explicit === 'ask' || explicit === 'always') {
    return explicit;
  }

  const tool = findTool(toolName, extraTools);
  if (!tool) return 'always';
  return getToolDefaultPermission(tool);
}

/**
 * Convert agent tools to the OpenRouter function-calling format.
 */
export function toolsToOpenRouterFormat(extraTools?: AgentTool[]): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AgentTool['parameters'];
  };
}> {
  return getAllTools(extraTools).map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

/**
 * Find a tool by name.
 */
export function findTool(name: string, extraTools?: AgentTool[]): AgentTool | undefined {
  const found = agentTools.find((t) => t.name === name);
  if (found) return found;
  if (extraTools) return extraTools.find((t) => t.name === name);
  return undefined;
}
