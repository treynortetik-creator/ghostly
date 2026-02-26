#!/usr/bin/env node
/**
 * Ghostly MCP Server
 *
 * Exposes Ghostly event management functionality as MCP tools
 * for use with Claude Desktop, Cursor, and other MCP-compatible AI clients.
 *
 * Required env vars:
 *   COUNTING_HOUSE_URL      - Base URL of your Ghostly instance
 *   COUNTING_HOUSE_API_KEY  - API key from Ghostly Settings → API Keys
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// ─── Configuration ────────────────────────────────────────────────────────────

const COUNTING_HOUSE_URL = process.env.COUNTING_HOUSE_URL;
const COUNTING_HOUSE_API_KEY = process.env.COUNTING_HOUSE_API_KEY;

if (!COUNTING_HOUSE_URL) {
  console.error(
    "Error: COUNTING_HOUSE_URL environment variable is required.\n" +
    "Set it to the base URL of your Counting House instance.\n" +
    "Example: COUNTING_HOUSE_URL=https://counting-house.railway.app"
  );
  process.exit(1);
}

if (!COUNTING_HOUSE_API_KEY) {
  console.error(
    "Error: COUNTING_HOUSE_API_KEY environment variable is required.\n" +
    "Create an API key in Counting House: Settings → API Keys → Create.\n" +
    "Example: COUNTING_HOUSE_API_KEY=ch_live_xxxxxxxxxxxx"
  );
  process.exit(1);
}

// ─── HTTP Helper ──────────────────────────────────────────────────────────────

async function countingHouseRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const url = `${COUNTING_HOUSE_URL}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "x-api-key": COUNTING_HOUSE_API_KEY!,
      "Content-Type": "application/json",
    },
  };

  if (body !== undefined && method !== "GET") {
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

// ─── MCP Server ───────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "ghostly-mcp",
  version: "0.1.0",
});

// ─── Tool: list_event_types ───────────────────────────────────────────────────

server.tool(
  "list_event_types",
  "List all available event types (e.g. Executive, National, State, Regional, Customer). " +
  "Returns id and name for each type. Call this before create_event to get a valid event_type_id.",
  {},
  async () => {
    try {
      const result = await countingHouseRequest("GET", "/api/event-types");
      const types = (result as { event_types?: unknown[] })?.event_types ?? result;
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(types, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Tool: list_events ────────────────────────────────────────────────────────

server.tool(
  "list_events",
  "List events with optional filters. Returns id, name, quarter, budget_amount, actual_spent, and remaining for each event.",
  {
    search: z.string().optional().describe("Filter by event name (partial match)"),
    quarter: z
      .enum(["Q1", "Q2", "Q3", "Q4", "TBD"])
      .optional()
      .describe("Filter by quarter"),
    per_page: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(20)
      .describe("Number of events to return (max 50)"),
  },
  async (input) => {
    try {
      const params = new URLSearchParams();
      if (input.search) params.set("search", input.search);
      if (input.quarter) params.set("quarter", input.quarter);
      params.set("per_page", String(input.per_page ?? 20));

      const path = `/api/events?${params.toString()}`;
      const result = await countingHouseRequest("GET", path);

      const summary = ((result as { events?: unknown[] })?.events ?? []).map(
        (e: unknown) => {
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
        }
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(summary, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Tool: create_event ───────────────────────────────────────────────────────

server.tool(
  "create_event",
  "Create a new event in Shindig. Use list_event_types first to get a valid event_type_id. " +
  "Quarter must be Q1, Q2, Q3, Q4, or TBD. budget_amount is in dollars.",
  {
    name: z.string().max(200).describe("Event name (max 200 chars)"),
    event_type_id: z
      .string()
      .uuid()
      .describe("Event type UUID — get this from list_event_types"),
    quarter: z
      .enum(["Q1", "Q2", "Q3", "Q4", "TBD"])
      .describe("Fiscal quarter the event falls in"),
    budget_amount: z
      .number()
      .nonnegative()
      .describe("Total budget for the event in dollars"),
    date_start: z
      .string()
      .optional()
      .describe("Event start date (YYYY-MM-DD format)"),
    date_end: z
      .string()
      .optional()
      .describe("Event end date (YYYY-MM-DD format)"),
    location: z.string().optional().describe("City, venue, or location description"),
    fiscal_year_id: z
      .string()
      .uuid()
      .optional()
      .describe("Fiscal year UUID (optional, links event to a fiscal year)"),
    approach_notes: z
      .string()
      .optional()
      .describe("Notes on event approach, goals, or strategy"),
    expansion_goal: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Expansion sales goal (number of opportunities)"),
    net_new_goal: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe("Net new pipeline goal (number of opportunities)"),
  },
  async (input) => {
    try {
      const result = await countingHouseRequest("POST", "/api/events", {
        name: input.name,
        event_type_id: input.event_type_id,
        quarter: input.quarter,
        budget_amount: input.budget_amount,
        date_start: input.date_start ?? null,
        date_end: input.date_end ?? null,
        location: input.location ?? null,
        fiscal_year_id: input.fiscal_year_id ?? null,
        approach_notes: input.approach_notes ?? null,
        expansion_goal: input.expansion_goal ?? 0,
        net_new_goal: input.net_new_goal ?? 0,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Tool: get_event_summary ──────────────────────────────────────────────────

server.tool(
  "get_event_summary",
  "Get a full summary for an event: budget vs actual spend, remaining budget, ROI metrics " +
  "(pipeline generated, revenue closed, leads, meetings, opportunities), checklist progress, " +
  "and team count. Use this to check event health or generate status reports.",
  {
    event_id: z
      .string()
      .uuid()
      .describe("Event UUID — get this from list_events or create_event"),
  },
  async (input) => {
    try {
      const result = await countingHouseRequest(
        "GET",
        `/api/events/${input.event_id}/summary`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Tool: add_budget_line ────────────────────────────────────────────────────

server.tool(
  "add_budget_line",
  "Add a budget line (expense record) to an event. Use this to record actual expenditures " +
  "against an event budget. Amount is in dollars. expense_date must be YYYY-MM-DD format.",
  {
    event_id: z
      .string()
      .uuid()
      .describe("Event UUID to attach this expense to"),
    amount: z
      .number()
      .nonnegative()
      .describe("Expense amount in dollars"),
    expense_date: z
      .string()
      .describe("Date of the expense (YYYY-MM-DD format)"),
    vendor: z
      .string()
      .optional()
      .describe("Vendor or payee name"),
    memo: z
      .string()
      .optional()
      .describe("Description or memo for this expense"),
  },
  async (input) => {
    try {
      const result = await countingHouseRequest("POST", "/api/expenses", {
        event_id: input.event_id,
        amount: input.amount,
        expense_date: input.expense_date,
        vendor: input.vendor ?? null,
        memo: input.memo ?? null,
        source_type: "manual",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Tool: assign_vendor ──────────────────────────────────────────────────────

server.tool(
  "assign_vendor",
  "Assign a vendor to an event for planning and tracking. Creates a budget placeholder so the " +
  "vendor appears in event reports and budget projections. Set estimated_amount=0 if the cost " +
  "is not yet confirmed. Use add_budget_line when you have an actual invoice amount.",
  {
    event_id: z
      .string()
      .uuid()
      .describe("Event UUID to assign this vendor to"),
    vendor_name: z
      .string()
      .describe("Vendor company or person name (e.g. 'Marriott', 'AV Solutions Inc')"),
    estimated_amount: z
      .number()
      .nonnegative()
      .optional()
      .default(0)
      .describe("Estimated cost for this vendor in dollars (use 0 if unknown)"),
    notes: z
      .string()
      .optional()
      .describe("Any notes about this vendor assignment (e.g. 'venue deposit', 'catering estimate')"),
  },
  async (input) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const memo = `Vendor assignment${input.notes ? `: ${input.notes}` : ""}`;

      const result = await countingHouseRequest("POST", "/api/expenses", {
        event_id: input.event_id,
        vendor: input.vendor_name,
        amount: input.estimated_amount ?? 0,
        expense_date: today,
        memo,
        source_type: "manual",
      });

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
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
  }
);

// ─── Start Server ─────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Ghostly MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
