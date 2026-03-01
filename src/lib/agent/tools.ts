/**
 * Ghostly Agent - Tool Definitions
 *
 * Each tool has a name, description, JSON-schema parameters, and an execute
 * function that calls the internal Ghostly API routes with org context.
 *
 * Ported from the MCP server tool definitions at mcp-server/src/index.ts
 * and expanded for the full agent feature set.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
}

export interface AgentTool {
  name: string;
  description: string;
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

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const agentTools: AgentTool[] = [
  // 1. get_events
  {
    name: 'get_events',
    description:
      'List events with optional filters. Returns event name, quarter, budget, actual spend, and remaining budget for each event.',
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
        };
      });
      return JSON.stringify({ events, total: (data.pagination as Record<string, unknown>)?.total ?? events.length }, null, 2);
    },
  },

  // 2. get_event_detail
  {
    name: 'get_event_detail',
    description:
      'Get full details of a specific event including budget, expenses, ROI metrics, checklist progress, and team assignments.',
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

  // 3. update_event
  {
    name: 'update_event',
    description:
      'Update an event\'s fields. Only send the fields you want to change. Common fields: name, quarter, budget_amount, location, date_start, date_end, approach_notes, marketing_notes, sales_notes.',
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
        approach_notes: {
          type: 'string',
          description: 'Event approach/strategy notes',
        },
        marketing_notes: {
          type: 'string',
          description: 'Marketing notes',
        },
        sales_notes: {
          type: 'string',
          description: 'Sales notes',
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

  // 4. get_expenses
  {
    name: 'get_expenses',
    description:
      'List expenses with optional filters. Can filter by event, vendor, date range, or source type.',
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

  // 5. create_expense
  {
    name: 'create_expense',
    description:
      'Create a new expense (budget line item) for an event. Amount is in dollars. expense_date must be YYYY-MM-DD.',
    parameters: {
      type: 'object',
      properties: {
        event_id: {
          type: 'string',
          description: 'Event UUID to attach this expense to',
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
      required: ['event_id', 'amount', 'expense_date'],
    },
    execute: async (args, ctx) => {
      const result = await internalFetch(ctx, 'POST', '/api/expenses', {
        event_id: args.event_id,
        amount: args.amount,
        expense_date: args.expense_date,
        vendor: args.vendor ?? null,
        memo: args.memo ?? null,
        source_type: 'manual',
      });
      return JSON.stringify(result, null, 2);
    },
  },

  // 6. get_overdue_tasks
  {
    name: 'get_overdue_tasks',
    description:
      'Find checklist items that are past their due date and not yet completed. Returns the task title, event name, due date, and assignee.',
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
      // This tool queries the DB directly via a custom endpoint
      const params = new URLSearchParams();
      if (args.event_id) params.set('event_id', String(args.event_id));
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/overdue-tasks?${params.toString()}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 7. get_over_budget_events
  {
    name: 'get_over_budget_events',
    description:
      'Find events where actual spending exceeds the budget. Returns event name, budget, actual spent, and how much over budget.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const result = await internalFetch(ctx, 'GET', '/api/agent/tools/over-budget');
      return JSON.stringify(result, null, 2);
    },
  },

  // 8. create_checklist_item
  {
    name: 'create_checklist_item',
    description:
      'Add a checklist item to an event. Specify the event, title, phase (pre_event/day_of/post_event), and optional due date.',
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
          description: 'Optional description or details',
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

  // 9. get_team_members
  {
    name: 'get_team_members',
    description:
      'List all active team members. Returns name, email, role, and which events they are assigned to.',
    parameters: {
      type: 'object',
      properties: {},
    },
    execute: async (_args, ctx) => {
      const result = await internalFetch(ctx, 'GET', '/api/team');
      return JSON.stringify(result, null, 2);
    },
  },

  // 10. get_session_history
  {
    name: 'get_session_history',
    description:
      'Search chat message history across sessions. Can filter by session ID and keyword. Returns matching messages with session titles. Useful for recalling previous conversations or finding information discussed earlier.',
    parameters: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'Optional: limit to a specific session UUID',
        },
        search: {
          type: 'string',
          description: 'Optional: keyword to search for in message content',
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

  // 11. get_event_documents
  {
    name: 'get_event_documents',
    description:
      'List documents attached to an event. Returns filenames, AI summaries, and tags — not full content. Use read_document for full content.',
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
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/event-documents?event_id=${encodeURIComponent(String(args.event_id))}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 12. read_document
  {
    name: 'read_document',
    description:
      'Get the full extracted text of a specific document. Use get_event_documents first to find the document ID.',
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
      const result = await internalFetch(ctx, 'GET', `/api/agent/tools/read-document?document_id=${encodeURIComponent(String(args.document_id))}`);
      return JSON.stringify(result, null, 2);
    },
  },

  // 13. attach_document
  {
    name: 'attach_document',
    description:
      'Link a document to an event. IMPORTANT: Always ask the user to confirm the event before calling this.',
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

  // 14. search
  {
    name: 'search',
    description:
      'Full-text search across events and expenses. Returns matching events and expenses with their details.',
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
      // Search events and expenses in parallel
      const [eventsResult, expensesResult] = await Promise.all([
        internalFetch(ctx, 'GET', `/api/events?search=${encodeURIComponent(query)}&per_page=10`),
        internalFetch(ctx, 'GET', `/api/expenses?vendor=${encodeURIComponent(query)}&per_page=10`),
      ]);

      const events = ((eventsResult as Record<string, unknown>).events as unknown[]) ?? [];
      const expenses = ((expensesResult as Record<string, unknown>).expenses as unknown[]) ?? [];

      return JSON.stringify({
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
      }, null, 2);
    },
  },

  // 15. generate_document
  {
    name: 'generate_document',
    description:
      'Generate a document from a template for a specific event. The AI fills each template section with event data (team, contacts, checklist, etc) and saves it as a markdown file. Use get_events to find the event_id first. Available templates: "Run of Show" (operational playbook) and "Event Guide" (attendee reference). Users may also have custom templates.',
    parameters: {
      type: 'object',
      properties: {
        template_name: {
          type: 'string',
          description: 'Name of the template to use (e.g., "Run of Show", "Event Guide")',
        },
        event_id: {
          type: 'string',
          description: 'Event UUID to generate the document for',
        },
      },
      required: ['template_name', 'event_id'],
    },
    execute: async (args, ctx) => {
      // First, look up template by name
      const templatesResult = await internalFetch(ctx, 'GET', '/api/templates');
      const templates = ((templatesResult as Record<string, unknown>).templates as Record<string, unknown>[]) ?? [];
      const template = templates.find(
        (t) => String(t.name).toLowerCase() === String(args.template_name).toLowerCase()
      );

      if (!template) {
        const available = templates.map((t) => t.name).join(', ');
        return JSON.stringify({
          error: `Template "${args.template_name}" not found. Available templates: ${available || 'none — ask the user to create one first'}`,
        });
      }

      // Generate the document
      const result = await internalFetch(ctx, 'POST', '/api/documents/generate', {
        template_id: template.id,
        event_id: args.event_id,
      });

      const data = result as Record<string, unknown>;
      const doc = data.document as Record<string, unknown>;

      return JSON.stringify({
        success: true,
        document_id: doc?.id,
        filename: doc?.filename,
        template_name: data.template_name,
        event_name: data.event_name,
        message: `Generated "${data.template_name}" for ${data.event_name}. Document saved and attached to the event.`,
      }, null, 2);
    },
  },
];

/**
 * Convert agent tools to the OpenRouter function-calling format.
 */
export function toolsToOpenRouterFormat(): Array<{
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: AgentTool['parameters'];
  };
}> {
  return agentTools.map((tool) => ({
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
export function findTool(name: string): AgentTool | undefined {
  return agentTools.find((t) => t.name === name);
}
