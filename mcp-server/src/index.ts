#!/usr/bin/env node
/**
 * Ghostly MCP Server
 *
 * Exposes Ghostly event operations as MCP tools for Claude Desktop,
 * Cursor, and any MCP-compatible AI client.
 *
 * Required env vars:
 *   GHOSTLY_URL      - Base URL of your Ghostly instance
 *   GHOSTLY_API_KEY  - API key from Ghostly Settings -> API Keys
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { AsyncLocalStorage } from "node:async_hooks";
import { z } from "zod";

const GHOSTLY_URL = process.env.GHOSTLY_URL?.replace(/\/$/, "");
const GHOSTLY_API_KEY = process.env.GHOSTLY_API_KEY;
const GHOSTLY_DEFAULT_FISCAL_YEAR_ID = process.env.GHOSTLY_DEFAULT_FISCAL_YEAR_ID;
const MCP_TRANSPORT = (process.env.MCP_TRANSPORT || (process.env.PORT ? "http" : "stdio")).toLowerCase();
const MCP_PORT = Number(process.env.PORT || process.env.MCP_PORT || 3000);
const MCP_HOST = process.env.MCP_HOST || "0.0.0.0";

if (!GHOSTLY_URL) {
  console.error(
    "Error: GHOSTLY_URL environment variable is required.\n" +
      "Set it to your Ghostly base URL.\n" +
      "Example: GHOSTLY_URL=https://ghostly.railway.app"
  );
  process.exit(1);
}

if (MCP_TRANSPORT !== "stdio" && MCP_TRANSPORT !== "http") {
  console.error("Error: MCP_TRANSPORT must be either 'stdio' or 'http'.");
  process.exit(1);
}

const apiKeyContext = new AsyncLocalStorage<string | undefined>();

function resolveRequestApiKey(extra?: { authInfo?: { token?: string } }): string | undefined {
  return extra?.authInfo?.token || GHOSTLY_API_KEY;
}

async function ghostlyRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const requestApiKey = apiKeyContext.getStore() || GHOSTLY_API_KEY;
  if (!requestApiKey) {
    throw new Error(
      "Missing Ghostly API key for request. Provide Authorization: Bearer <ghostly_api_key> " +
      "or configure GHOSTLY_API_KEY fallback."
    );
  }

  const url = `${GHOSTLY_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "x-api-key": requestApiKey,
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  let data: unknown = null;
  const text = await response.text();
  if (text.trim().length > 0) {
    try {
      data = JSON.parse(text);
    } catch {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      data = { raw: text };
    }
  }

  if (!response.ok) {
    const err = data as { error?: string; message?: string } | null;
    throw new Error(err?.error || err?.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  return data;
}

function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") {
      continue;
    }

    if (Array.isArray(value)) {
      if (value.length > 0) {
        sp.set(key, value.join(","));
      }
      continue;
    }

    sp.set(key, String(value));
  }

  const query = sp.toString();
  return query ? `?${query}` : "";
}

function toolOk(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function toolError(err: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
    isError: true,
  };
}

async function runTool(handler: () => Promise<unknown>) {
  try {
    const payload = await handler();
    return toolOk(payload);
  } catch (err) {
    return toolError(err);
  }
}

type ToolShape = Record<string, z.ZodTypeAny>;

function registerTool(
  server: McpServer,
  name: string,
  description: string,
  schema: ToolShape,
  handler: (input: any, extra?: { authInfo?: { token?: string } }) => Promise<unknown>
): void {
  server.tool(
    name,
    description,
    schema,
    async (
      input: Record<string, unknown>,
      extra: { authInfo?: { token?: string } } | undefined
    ) =>
      apiKeyContext.run(resolveRequestApiKey(extra), () =>
        runTool(() => handler(input, extra))
      )
  );
}

function splitHumanName(value: string): { first_name: string; last_name: string } {
  const cleaned = value.trim();
  if (!cleaned) return { first_name: "Vendor", last_name: "Contact" };

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first_name: parts[0], last_name: "Contact" };

  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}

async function resolveFiscalYearId(fiscalYearId?: string): Promise<string> {
  if (fiscalYearId) return fiscalYearId;
  if (GHOSTLY_DEFAULT_FISCAL_YEAR_ID) return GHOSTLY_DEFAULT_FISCAL_YEAR_ID;

  const result = (await ghostlyRequest("GET", "/api/fiscal-years")) as {
    fiscal_years?: Array<{ id?: string }>;
  };

  const fallback = result.fiscal_years?.[0]?.id;
  if (!fallback) {
    throw new Error(
      "No fiscal year found. Pass fiscal_year_id or set GHOSTLY_DEFAULT_FISCAL_YEAR_ID."
    );
  }

  return fallback;
}

async function getEvents(input: {
  search?: string;
  quarter?: string;
  event_type_id?: string;
  fiscal_year_id?: string;
  per_page?: number;
  page?: number;
}) {
  const query = toQuery({
    search: input.search,
    quarter: input.quarter,
    event_type_id: input.event_type_id,
    fiscal_year_id: input.fiscal_year_id,
    per_page: input.per_page ?? 20,
    page: input.page,
  });

  return ghostlyRequest("GET", `/api/events${query}`);
}

async function createExpense(input: {
  event_id?: string;
  category_id?: string;
  budget_bucket?: string;
  travel_logistics_entry_id?: string;
  travel_cost_type?: string;
  amount: number;
  expense_date: string;
  vendor?: string;
  memo?: string;
}) {
  if (!input.event_id && !input.category_id) {
    throw new Error("create_expense requires either event_id or category_id");
  }

  return ghostlyRequest("POST", "/api/expenses", {
    event_id: input.event_id ?? null,
    category_id: input.category_id ?? null,
    budget_bucket: input.budget_bucket ?? undefined,
    travel_logistics_entry_id: input.travel_logistics_entry_id ?? undefined,
    travel_cost_type: input.travel_cost_type ?? undefined,
    amount: input.amount,
    expense_date: input.expense_date,
    vendor: input.vendor ?? null,
    memo: input.memo ?? null,
    source_type: "manual",
  });
}

const quarterEnum = z.enum(["Q1", "Q2", "Q3", "Q4", "TBD"]);
const stageEnum = z.enum(["confirmed", "in_progress", "ready", "active", "debrief", "archived"]);
const groundTransportModeEnum = z.enum([
  "rental_car",
  "shuttle",
  "rideshare",
  "taxi",
  "public_transit",
  "other",
]);
const travelCostTypeEnum = z.enum(["lodging", "airfare", "ground_transport", "meals", "misc"]);
const budgetBucketEnum = z.enum(["event", "travel", "category"]);
const debriefModeEnum = z.enum(["replace", "append"]);

// In stateless HTTP mode, the SDK requires a fresh server+transport per request.
// registerAllTools() configures an McpServer instance with every Ghostly tool.
function registerAllTools(server: McpServer): void {

// 1. get_events
registerTool(
  server,
  "get_events",
  "List events with optional filters. Returns event details including budget and spend.",
  {
    search: z.string().optional().describe("Filter by event name (partial match)"),
    quarter: quarterEnum.optional().describe("Filter by quarter"),
    event_type_id: z.string().uuid().optional().describe("Filter by event type UUID"),
    fiscal_year_id: z.string().uuid().optional().describe("Filter by fiscal year UUID"),
    per_page: z.number().int().min(1).max(50).optional().describe("Results per page (default 20)"),
    page: z.number().int().min(1).optional().describe("Page number"),
  },
  async (input) => getEvents(input)
);

// 2. get_event_detail
registerTool(
  server,
  "get_event_detail",
  "Get full details of a specific event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
  },
  async (input) => ghostlyRequest("GET", `/api/events/${input.event_id}`)
);

// 3. create_event
registerTool(
  server,
  "create_event",
  "Create a new event.",
  {
    name: z.string().max(200).describe("Event name"),
    event_type_id: z.string().uuid().describe("Event type UUID"),
    quarter: quarterEnum.describe("Fiscal quarter"),
    budget_amount: z.number().nonnegative().describe("Budget amount in dollars"),
    fiscal_year_id: z.string().uuid().optional().describe("Optional fiscal year UUID"),
    date_start: z.string().optional().describe("Optional start date (YYYY-MM-DD)"),
    date_end: z.string().optional().describe("Optional end date (YYYY-MM-DD)"),
    location: z.string().optional().describe("Optional location"),
    expansion_goal: z.number().int().nonnegative().optional().describe("Optional expansion goal"),
    net_new_goal: z.number().int().nonnegative().optional().describe("Optional net-new goal"),
    approach_notes: z.string().optional().describe("Optional approach notes"),
    marketing_notes: z.string().optional().describe("Optional marketing notes"),
    sales_notes: z.string().optional().describe("Optional sales notes"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/events", {
      name: input.name,
      event_type_id: input.event_type_id,
      quarter: input.quarter,
      budget_amount: input.budget_amount,
      fiscal_year_id: input.fiscal_year_id ?? null,
      date_start: input.date_start ?? null,
      date_end: input.date_end ?? null,
      location: input.location ?? null,
      expansion_goal: input.expansion_goal ?? 0,
      net_new_goal: input.net_new_goal ?? 0,
      approach_notes: input.approach_notes ?? null,
      marketing_notes: input.marketing_notes ?? null,
      sales_notes: input.sales_notes ?? null,
    });
  }
);

// 4. update_event
registerTool(
  server,
  "update_event",
  "Update fields on an existing event. Include only fields you want to change.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    name: z.string().max(200).optional().describe("New event name"),
    event_type_id: z.string().uuid().optional().describe("New event type UUID"),
    quarter: quarterEnum.optional().describe("New quarter"),
    fiscal_year_id: z.string().uuid().optional().describe("New fiscal year UUID"),
    budget_amount: z.number().nonnegative().optional().describe("New budget amount"),
    location: z.string().optional().describe("New location"),
    date_start: z.string().optional().describe("New start date (YYYY-MM-DD)"),
    date_end: z.string().optional().describe("New end date (YYYY-MM-DD)"),
    stage: stageEnum.optional().describe("Event stage"),
    approach_notes: z.string().optional().describe("Approach notes"),
    marketing_notes: z.string().optional().describe("Marketing notes"),
    sales_notes: z.string().optional().describe("Sales notes"),
    pipeline_generated: z.number().optional().describe("ROI pipeline generated"),
    revenue_closed: z.number().optional().describe("ROI revenue closed"),
    leads_generated: z.number().int().optional().describe("ROI leads generated"),
    meetings_booked: z.number().int().optional().describe("ROI meetings booked"),
    opportunities_created: z.number().int().optional().describe("ROI opportunities created"),
    roi_notes: z.string().optional().describe("ROI notes"),
  },
  async (input) => {
    const { event_id, ...updates } = input;
    const payload = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    );

    return ghostlyRequest("PUT", `/api/events/${event_id}`, payload);
  }
);

// 5. update_event_roi
registerTool(
  server,
  "update_event_roi",
  "Update only ROI metrics for an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    pipeline_generated: z.number().optional().describe("Pipeline generated"),
    revenue_closed: z.number().optional().describe("Revenue closed"),
    leads_generated: z.number().int().optional().describe("Leads generated"),
    meetings_booked: z.number().int().optional().describe("Meetings booked"),
    opportunities_created: z.number().int().optional().describe("Opportunities created"),
    roi_notes: z.string().optional().describe("ROI notes"),
  },
  async (input) => {
    const { event_id, ...roiUpdates } = input;
    const payload = Object.fromEntries(
      Object.entries(roiUpdates).filter(([, value]) => value !== undefined)
    );

    return ghostlyRequest("PUT", `/api/events/${event_id}`, payload);
  }
);

// 6. get_expenses
registerTool(
  server,
  "get_expenses",
  "List expenses with optional filters.",
  {
    event_id: z.string().uuid().optional().describe("Filter by event UUID"),
    category_id: z.string().uuid().optional().describe("Filter by category UUID"),
    vendor: z.string().optional().describe("Filter by vendor name"),
    budget_bucket: budgetBucketEnum.optional().describe("Filter by budget bucket"),
    travel_logistics_entry_id: z.string().uuid().optional().describe("Filter by travel entry UUID"),
    travel_cost_type: travelCostTypeEnum.optional().describe("Filter by travel cost type"),
    source_type: z.enum(["manual", "brex", "pdf"]).optional().describe("Filter by source type"),
    date_start: z.string().optional().describe("Filter from date (YYYY-MM-DD)"),
    date_end: z.string().optional().describe("Filter to date (YYYY-MM-DD)"),
    per_page: z.number().int().min(1).max(50).optional().describe("Results per page (default 20)"),
    page: z.number().int().min(1).optional().describe("Page number"),
  },
  async (input) => {
    const query = toQuery({
      event_id: input.event_id,
      category_id: input.category_id,
      vendor: input.vendor,
      budget_bucket: input.budget_bucket,
      travel_logistics_entry_id: input.travel_logistics_entry_id,
      travel_cost_type: input.travel_cost_type,
      source_type: input.source_type,
      date_start: input.date_start,
      date_end: input.date_end,
      per_page: input.per_page ?? 20,
      page: input.page,
    });

    return ghostlyRequest("GET", `/api/expenses${query}`);
  }
);

// 7. create_expense
registerTool(
  server,
  "create_expense",
  "Create a new expense. Supports event, category, and travel bucket expenses.",
  {
    event_id: z.string().uuid().optional().describe("Event UUID (required unless category_id provided)"),
    category_id: z.string().uuid().optional().describe("Category UUID (required unless event_id provided)"),
    budget_bucket: budgetBucketEnum.optional().describe("Budget bucket: event, travel, or category"),
    travel_logistics_entry_id: z.string().uuid().optional().describe("Travel entry UUID for travel expenses"),
    travel_cost_type: travelCostTypeEnum.optional().describe("Travel cost category"),
    amount: z.number().positive().describe("Expense amount in dollars"),
    expense_date: z.string().describe("Expense date (YYYY-MM-DD)"),
    vendor: z.string().optional().describe("Optional vendor"),
    memo: z.string().optional().describe("Optional memo"),
  },
  async (input) => createExpense(input)
);

// 8. get_overdue_tasks
registerTool(
  server,
  "get_overdue_tasks",
  "List checklist tasks that are overdue.",
  {
    event_id: z.string().uuid().optional().describe("Optional event UUID filter"),
  },
  async (input) => {
    const query = toQuery({ event_id: input.event_id });
    return ghostlyRequest("GET", `/api/agent/tools/overdue-tasks${query}`);
  }
);

// 9. get_over_budget_events
registerTool(
  server,
  "get_over_budget_events",
  "List events where actual spend exceeds budget.",
  {},
  async () => ghostlyRequest("GET", "/api/agent/tools/over-budget")
);

// 10. create_checklist_item
registerTool(
  server,
  "create_checklist_item",
  "Create a checklist item for an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    title: z.string().describe("Checklist item title"),
    phase: z.enum(["pre_event", "day_of", "post_event"]).optional().describe("Checklist phase"),
    due_date: z.string().optional().describe("Optional due date (YYYY-MM-DD)"),
    description: z.string().optional().describe("Optional description"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/agent/tools/checklist-item", {
      event_id: input.event_id,
      title: input.title,
      phase: input.phase ?? "pre_event",
      due_date: input.due_date ?? null,
      description: input.description ?? null,
    });
  }
);

// 11. get_team_members
registerTool(
  server,
  "get_team_members",
  "List active team members.",
  {},
  async () => ghostlyRequest("GET", "/api/team")
);

// 12. create_team_member
registerTool(
  server,
  "create_team_member",
  "Create a team member record.",
  {
    name: z.string().describe("Team member full name"),
    email: z.string().email().optional().describe("Optional email"),
    phone: z.string().optional().describe("Optional phone"),
    default_role: z.string().optional().describe("Optional default role"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/team", {
      name: input.name,
      email: input.email ?? null,
      phone: input.phone ?? null,
      default_role: input.default_role ?? null,
      notes: input.notes ?? null,
    });
  }
);

// 13. assign_team_member_to_event
registerTool(
  server,
  "assign_team_member_to_event",
  "Assign a team member to an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    team_member_id: z.string().uuid().describe("Team member UUID"),
    event_role: z.string().optional().describe("Optional event-specific role"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async (input) => {
    return ghostlyRequest("POST", `/api/events/${input.event_id}/team`, {
      team_member_id: input.team_member_id,
      event_role: input.event_role ?? null,
      notes: input.notes ?? null,
    });
  }
);

// 14. get_session_history
registerTool(
  server,
  "get_session_history",
  "Search agent session history.",
  {
    session_id: z.string().uuid().optional().describe("Optional session UUID"),
    search: z.string().optional().describe("Optional search query"),
    limit: z.number().int().min(1).max(50).optional().describe("Max messages (default 20)"),
  },
  async (input) => {
    const query = toQuery({
      session_id: input.session_id,
      search: input.search,
      limit: input.limit ?? 20,
    });
    return ghostlyRequest("GET", `/api/agent/tools/session-history${query}`);
  }
);

// 15. get_event_documents
registerTool(
  server,
  "get_event_documents",
  "List documents attached to an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
  },
  async (input) => {
    const query = toQuery({ event_id: input.event_id });
    return ghostlyRequest("GET", `/api/agent/tools/event-documents${query}`);
  }
);

// 16. read_document
registerTool(
  server,
  "read_document",
  "Read extracted text and metadata for a document.",
  {
    document_id: z.string().uuid().describe("Document UUID"),
  },
  async (input) => {
    const query = toQuery({ document_id: input.document_id });
    return ghostlyRequest("GET", `/api/agent/tools/read-document${query}`);
  }
);

// 17. attach_document
registerTool(
  server,
  "attach_document",
  "Attach an existing document to an event.",
  {
    document_id: z.string().uuid().describe("Document UUID"),
    event_id: z.string().uuid().describe("Event UUID"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/agent/tools/attach-document", {
      document_id: input.document_id,
      event_id: input.event_id,
    });
  }
);

// 18. search
registerTool(
  server,
  "search",
  "Search across events and expenses.",
  {
    query: z.string().min(2).describe("Search query"),
    types: z.array(z.enum(["events", "expenses"])).optional().describe("Optional types to search"),
    limit: z.number().int().min(1).max(50).optional().describe("Max results per type"),
  },
  async (input) => {
    const query = toQuery({
      q: input.query,
      types: input.types ?? ["events", "expenses"],
      limit: input.limit ?? 20,
    });

    return ghostlyRequest("GET", `/api/search${query}`);
  }
);

// 19. create_vendor
registerTool(
  server,
  "create_vendor",
  "Create a vendor contact record.",
  {
    vendor_name: z.string().describe("Vendor name or contact name"),
    company: z.string().optional().describe("Optional company name"),
    title: z.string().optional().describe("Optional title"),
    email: z.string().email().optional().describe("Optional email"),
    phone: z.string().optional().describe("Optional phone"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async (input) => {
    const parsed = splitHumanName(input.vendor_name);

    return ghostlyRequest("POST", "/api/contacts", {
      first_name: parsed.first_name,
      last_name: parsed.last_name,
      company: input.company ?? input.vendor_name,
      title: input.title ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      contact_type: "vendor",
      notes: input.notes ?? null,
      source: "agent",
    });
  }
);

// 20. create_category
registerTool(
  server,
  "create_category",
  "Create a budget category.",
  {
    name: z.string().describe("Category name"),
    budget_amount: z.number().nonnegative().describe("Budget amount in dollars"),
    fiscal_year_id: z.string().uuid().optional().describe("Optional fiscal year UUID"),
    description: z.string().optional().describe("Optional description"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/categories", {
      name: input.name,
      budget_amount: input.budget_amount,
      fiscal_year_id: input.fiscal_year_id ?? null,
      description: input.description ?? null,
    });
  }
);

// 21. create_event_type
registerTool(
  server,
  "create_event_type",
  "Create an event type for a fiscal year.",
  {
    name: z.string().describe("Event type name"),
    fiscal_year_id: z.string().uuid().describe("Fiscal year UUID"),
    budget_amount: z.number().nonnegative().optional().describe("Optional default budget"),
    description: z.string().optional().describe("Optional description"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/event-types", {
      name: input.name,
      fiscal_year_id: input.fiscal_year_id,
      budget_amount: input.budget_amount ?? 0,
      description: input.description ?? null,
    });
  }
);

// 22. generate_document
registerTool(
  server,
  "generate_document",
  "Generate a document from a template for an event.",
  {
    template_name: z.string().describe("Template name"),
    event_id: z.string().uuid().describe("Event UUID"),
  },
  async (input) => {
    const templatesResult = (await ghostlyRequest("GET", "/api/templates")) as {
      templates?: Array<Record<string, unknown>>;
    };

    const templates = templatesResult.templates ?? [];
    const template = templates.find(
      (t) => String(t.name).toLowerCase() === input.template_name.toLowerCase()
    );

    if (!template) {
      const available = templates.map((t) => t.name).filter(Boolean).join(", ");
      return {
        error: `Template \"${input.template_name}\" not found`,
        available_templates: available || null,
      };
    }

    const result = (await ghostlyRequest("POST", "/api/documents/generate", {
      template_id: template.id,
      event_id: input.event_id,
    })) as Record<string, unknown>;

    const document = (result.document as Record<string, unknown> | undefined) ?? {};

    return {
      success: true,
      document_id: document.id ?? null,
      filename: document.filename ?? null,
      template_name: result.template_name ?? null,
      event_name: result.event_name ?? null,
      message:
        typeof result.template_name === "string" && typeof result.event_name === "string"
          ? `Generated \"${result.template_name}\" for ${result.event_name}`
          : "Document generated",
    };
  }
);

// 23. get_travel_logistics
registerTool(
  server,
  "get_travel_logistics",
  "Get travel and logistics entries for an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    include_brief: z.boolean().optional().describe("Include compiled logistics brief"),
  },
  async (input) => {
    const eventId = encodeURIComponent(input.event_id);
    const result = (await ghostlyRequest("GET", `/api/events/${eventId}/travel-logistics`)) as Record<
      string,
      unknown
    >;

    let brief: string | null = null;
    if (input.include_brief) {
      const briefResult = (await ghostlyRequest(
        "GET",
        `/api/events/${eventId}/travel-logistics/brief`
      )) as Record<string, unknown>;
      brief = typeof briefResult.brief === "string" ? briefResult.brief : null;
    }

    return {
      entries: result.entries ?? [],
      totals: result.totals ?? null,
      team_members: result.team_members ?? [],
      brief,
    };
  }
);

// 24. create_travel_logistics_entry
registerTool(
  server,
  "create_travel_logistics_entry",
  "Create a travel and logistics entry for an event attendee.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    team_member_id: z.string().uuid().optional().describe("Optional team member UUID"),
    traveler_name: z.string().describe("Traveler full name"),
    traveler_email: z.string().email().optional().describe("Optional traveler email"),
    traveler_role: z.string().optional().describe("Optional traveler role"),
    hotel_name: z.string().optional().describe("Optional hotel name"),
    hotel_address: z.string().optional().describe("Optional hotel address"),
    hotel_check_in: z.string().optional().describe("Optional check-in date"),
    hotel_check_out: z.string().optional().describe("Optional check-out date"),
    hotel_confirmation_number: z.string().optional().describe("Optional hotel confirmation number"),
    flight_airline: z.string().optional().describe("Optional airline"),
    flight_number: z.string().optional().describe("Optional flight number"),
    flight_departure_airport: z.string().optional().describe("Optional departure airport"),
    flight_arrival_airport: z.string().optional().describe("Optional arrival airport"),
    flight_departure_at: z.string().optional().describe("Optional departure datetime (ISO)"),
    flight_arrival_at: z.string().optional().describe("Optional arrival datetime (ISO)"),
    flight_confirmation_number: z.string().optional().describe("Optional flight confirmation number"),
    ground_transport_mode: groundTransportModeEnum.optional().describe("Optional ground transport mode"),
    ground_transport_details: z.string().optional().describe("Optional ground transport details"),
    lodging_budget: z.number().nonnegative().optional().describe("Optional lodging budget"),
    airfare_budget: z.number().nonnegative().optional().describe("Optional airfare budget"),
    ground_transport_budget: z.number().nonnegative().optional().describe("Optional ground transport budget"),
    meals_budget: z.number().nonnegative().optional().describe("Optional meals budget"),
    misc_travel_budget: z.number().nonnegative().optional().describe("Optional misc budget"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async (input) => {
    const { event_id, ...payload } = input;
    return ghostlyRequest("POST", `/api/events/${encodeURIComponent(event_id)}/travel-logistics`, payload);
  }
);

// 25. update_travel_logistics_entry
registerTool(
  server,
  "update_travel_logistics_entry",
  "Update an existing travel and logistics entry.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    entry_id: z.string().uuid().describe("Travel entry UUID"),
    team_member_id: z.string().uuid().optional().describe("Optional team member UUID"),
    traveler_name: z.string().optional().describe("Updated traveler name"),
    traveler_email: z.string().email().optional().describe("Updated traveler email"),
    traveler_role: z.string().optional().describe("Updated traveler role"),
    hotel_name: z.string().optional().describe("Updated hotel name"),
    hotel_address: z.string().optional().describe("Updated hotel address"),
    hotel_check_in: z.string().optional().describe("Updated check-in date"),
    hotel_check_out: z.string().optional().describe("Updated check-out date"),
    hotel_confirmation_number: z.string().optional().describe("Updated hotel confirmation number"),
    flight_airline: z.string().optional().describe("Updated airline"),
    flight_number: z.string().optional().describe("Updated flight number"),
    flight_departure_airport: z.string().optional().describe("Updated departure airport"),
    flight_arrival_airport: z.string().optional().describe("Updated arrival airport"),
    flight_departure_at: z.string().optional().describe("Updated departure datetime (ISO)"),
    flight_arrival_at: z.string().optional().describe("Updated arrival datetime (ISO)"),
    flight_confirmation_number: z.string().optional().describe("Updated flight confirmation number"),
    ground_transport_mode: groundTransportModeEnum.optional().describe("Updated ground transport mode"),
    ground_transport_details: z.string().optional().describe("Updated ground transport details"),
    lodging_budget: z.number().nonnegative().optional().describe("Updated lodging budget"),
    airfare_budget: z.number().nonnegative().optional().describe("Updated airfare budget"),
    ground_transport_budget: z.number().nonnegative().optional().describe("Updated ground transport budget"),
    meals_budget: z.number().nonnegative().optional().describe("Updated meals budget"),
    misc_travel_budget: z.number().nonnegative().optional().describe("Updated misc budget"),
    notes: z.string().optional().describe("Updated notes"),
  },
  async (input) => {
    const { event_id, entry_id, ...payload } = input;
    return ghostlyRequest(
      "PUT",
      `/api/events/${encodeURIComponent(event_id)}/travel-logistics/${encodeURIComponent(entry_id)}`,
      payload
    );
  }
);

// 26. delete_travel_logistics_entry
registerTool(
  server,
  "delete_travel_logistics_entry",
  "Delete a travel and logistics entry.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    entry_id: z.string().uuid().describe("Travel entry UUID"),
  },
  async (input) => {
    return ghostlyRequest(
      "DELETE",
      `/api/events/${encodeURIComponent(input.event_id)}/travel-logistics/${encodeURIComponent(input.entry_id)}`
    );
  }
);

// 27. generate_post_event_debrief
registerTool(
  server,
  "generate_post_event_debrief",
  "Generate and save post-event debrief sections from transcript or survey text.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    source_text: z.string().min(1).describe("Transcript or survey text"),
    source_label: z.string().optional().describe("Optional source label"),
    mode: debriefModeEnum.optional().describe("replace or append"),
  },
  async (input) => {
    const eventId = encodeURIComponent(input.event_id);
    return ghostlyRequest("POST", `/api/events/${eventId}/post-event/generate`, {
      source_text: input.source_text,
      source_label: input.source_label ?? null,
      mode: input.mode ?? "replace",
    });
  }
);

// 28. run_background_task
registerTool(
  server,
  "run_background_task",
  "Queue a background task for asynchronous execution.",
  {
    name: z.string().min(1).max(120).describe("Task name"),
    prompt: z.string().min(1).max(4000).describe("Task prompt"),
    run_after: z.string().optional().describe("Optional run timestamp (ISO)"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/agent/background-tasks", {
      name: input.name,
      prompt: input.prompt,
      run_after: input.run_after ?? null,
      metadata: input.metadata ?? {},
    });
  }
);

// 29. save_learning
registerTool(
  server,
  "save_learning",
  "Save a correction or preference into agent learnings.",
  {
    correction: z.string().min(1).max(8000).describe("Correction or preference text"),
    topic: z.string().optional().describe("Optional topic"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/agent/learnings", {
      correction: input.correction,
      topic: input.topic ?? null,
      metadata: input.metadata ?? {},
    });
  }
);

// 30. get_learnings
registerTool(
  server,
  "get_learnings",
  "Get recent saved learnings.",
  {
    limit: z.number().int().min(1).max(200).optional().describe("Max learnings (default 20)"),
  },
  async (input) => {
    const query = toQuery({ limit: input.limit ?? 20 });
    return ghostlyRequest("GET", `/api/agent/learnings${query}`);
  }
);

// 31. recall_memory
registerTool(
  server,
  "recall_memory",
  "Run semantic recall against long-term agent memory.",
  {
    query: z.string().min(1).describe("Semantic memory query"),
    limit: z.number().int().min(1).max(20).optional().describe("Max memories (default 5)"),
  },
  async (input) => {
    const query = toQuery({ query: input.query, limit: input.limit ?? 5 });
    return ghostlyRequest("GET", `/api/agent/memories${query}`);
  }
);

// 32. save_memory
registerTool(
  server,
  "save_memory",
  "Store an explicit long-term memory entry with optional TTL.",
  {
    content: z.string().min(1).max(8000).describe("Memory content"),
    source_type: z.string().optional().describe("Optional source type"),
    source_id: z.string().optional().describe("Optional source ID"),
    ttl_days: z.number().int().min(1).max(3650).optional().describe("Retention in days"),
    metadata: z.record(z.string(), z.unknown()).optional().describe("Optional metadata"),
  },
  async (input) => {
    return ghostlyRequest("POST", "/api/agent/memories", {
      content: input.content,
      source_type: input.source_type ?? "manual",
      source_id: input.source_id ?? null,
      ttl_days: input.ttl_days ?? 180,
      metadata: input.metadata ?? {},
    });
  }
);

// 33. get_agent_runs
registerTool(
  server,
  "get_agent_runs",
  "List recent agent execution runs for observability.",
  {
    source: z.string().optional().describe("Optional run source filter"),
    status: z.string().optional().describe("Optional run status filter"),
    limit: z.number().int().min(1).max(200).optional().describe("Max runs (default 20)"),
  },
  async (input) => {
    const query = toQuery({
      source: input.source,
      status: input.status,
      limit: input.limit ?? 20,
    });

    return ghostlyRequest("GET", `/api/agent/runs${query}`);
  }
);

// Optional but useful for background-task monitoring
registerTool(
  server,
  "get_background_tasks",
  "List background tasks and their statuses.",
  {
    status: z.string().optional().describe("Optional status filter"),
    limit: z.number().int().min(1).max(100).optional().describe("Max tasks (default 50)"),
  },
  async (input) => {
    const query = toQuery({ status: input.status, limit: input.limit ?? 50 });
    return ghostlyRequest("GET", `/api/agent/background-tasks${query}`);
  }
);

// Compatibility aliases from v0.1.0
registerTool(
  server,
  "list_fiscal_years",
  "List fiscal years configured in Ghostly.",
  {},
  async () => ghostlyRequest("GET", "/api/fiscal-years")
);

registerTool(
  server,
  "list_event_types",
  "List event types for a fiscal year. If fiscal_year_id is omitted, default fiscal year is used.",
  {
    fiscal_year_id: z.string().uuid().optional().describe("Fiscal year UUID"),
    include_archived: z.boolean().optional().describe("Include archived event types"),
  },
  async (input) => {
    const fiscalYearId = await resolveFiscalYearId(input.fiscal_year_id);
    const query = toQuery({
      fiscal_year_id: fiscalYearId,
      include_archived: input.include_archived ?? false,
    });

    return ghostlyRequest("GET", `/api/event-types${query}`);
  }
);

registerTool(
  server,
  "list_events",
  "Alias for get_events.",
  {
    search: z.string().optional().describe("Filter by event name"),
    quarter: quarterEnum.optional().describe("Filter by quarter"),
    event_type_id: z.string().uuid().optional().describe("Filter by event type UUID"),
    fiscal_year_id: z.string().uuid().optional().describe("Filter by fiscal year UUID"),
    per_page: z.number().int().min(1).max(50).optional().describe("Results per page"),
    page: z.number().int().min(1).optional().describe("Page number"),
  },
  async (input) => getEvents(input)
);

registerTool(
  server,
  "get_event_summary",
  "Get summary metrics for an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
  },
  async (input) => ghostlyRequest("GET", `/api/events/${input.event_id}/summary`)
);

registerTool(
  server,
  "add_budget_line",
  "Alias for create_expense, targeted at event budget lines.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    amount: z.number().positive().describe("Expense amount in dollars"),
    expense_date: z.string().describe("Expense date (YYYY-MM-DD)"),
    vendor: z.string().optional().describe("Optional vendor"),
    memo: z.string().optional().describe("Optional memo"),
  },
  async (input) => createExpense(input)
);

registerTool(
  server,
  "assign_vendor",
  "Create a vendor placeholder expense line for an event.",
  {
    event_id: z.string().uuid().describe("Event UUID"),
    vendor_name: z.string().describe("Vendor name"),
    estimated_amount: z.number().nonnegative().optional().describe("Estimated amount"),
    notes: z.string().optional().describe("Optional notes"),
  },
  async (input) => {
    const today = new Date().toISOString().slice(0, 10);
    const memo = `Vendor assignment${input.notes ? `: ${input.notes}` : ""}`;

    return createExpense({
      event_id: input.event_id,
      amount: input.estimated_amount ?? 0,
      expense_date: today,
      vendor: input.vendor_name,
      memo,
    });
  }
);
}

function createConfiguredServer(): McpServer {
  const server = new McpServer({ name: "ghostly-mcp", version: "0.2.0" });
  registerAllTools(server);
  return server;
}

function extractApiKeyFromRequest(req: any): string | undefined {
  const authHeader = req.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  const keyHeader = req.headers?.["x-api-key"];
  if (typeof keyHeader === "string" && keyHeader.trim()) {
    return keyHeader.trim();
  }
  if (Array.isArray(keyHeader) && keyHeader.length > 0) {
    return String(keyHeader[0] || "").trim() || undefined;
  }

  return undefined;
}

function authMiddleware(req: any, res: any, next: any) {
  const apiKey = extractApiKeyFromRequest(req) || GHOSTLY_API_KEY;
  if (!apiKey) {
    res.status(401).json({
      error: "Missing Ghostly API key. Send Authorization: Bearer <ghostly_api_key>.",
    });
    return;
  }

  req.auth = {
    token: apiKey,
    clientId: "ghostly-mcp-client",
    scopes: [],
  };
  next();
}

async function main() {
  if (MCP_TRANSPORT === "stdio") {
    if (!GHOSTLY_API_KEY) {
      console.error(
        "Error: GHOSTLY_API_KEY environment variable is required in stdio mode.\n" +
          "Create one in Ghostly: Settings -> API Keys.\n" +
          "Example: GHOSTLY_API_KEY=gh_live_xxxxxxxxxxxx"
      );
      process.exit(1);
    }

    const server = createConfiguredServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Ghostly MCP Server running on stdio");
    return;
  }

  const app = createMcpExpressApp({ host: MCP_HOST });

  app.get("/healthz", (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      name: "ghostly-mcp",
      transport: "http",
      mode: "stateless",
      node: process.version,
    });
  });

  app.get("/", (_req: any, res: any) => {
    res.status(200).json({
      name: "ghostly-mcp",
      endpoint: "/mcp",
      health: "/healthz",
    });
  });

  // Stateless mode: create a fresh server+transport per request (SDK requirement).
  app.post("/mcp", authMiddleware, async (req: any, res: any) => {
    try {
      const server = createConfiguredServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err: any) {
      console.error("[MCP POST] Error:", err?.message, err?.stack);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: String(err?.message || "Internal server error") },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", (_req: any, res: any) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed for stateless server" },
      id: null,
    });
  });

  app.delete("/mcp", (_req: any, res: any) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed for stateless server" },
      id: null,
    });
  });

  const httpServer = app.listen(MCP_PORT, MCP_HOST, () => {
    console.error(`Ghostly MCP Server running on http://${MCP_HOST}:${MCP_PORT}/mcp`);
  });

  const shutdown = async () => {
    console.error("Shutting down Ghostly MCP server...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
