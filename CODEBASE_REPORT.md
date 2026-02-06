# Counting House Codebase Report

> **Generated for:** Scrooge API Design  
> **Date:** Auto-generated  
> **Purpose:** Comprehensive documentation for designing an AI agent integration API

---

## 1. Architecture Overview

### Tech Stack

| Component | Version/Details |
|-----------|-----------------|
| **Framework** | Next.js 16.1.6 (App Router) |
| **React** | 19.2.3 |
| **Database** | Supabase (PostgreSQL) |
| **ORM/Client** | @supabase/supabase-js 2.93.2, @supabase/ssr 0.8.0 |
| **Authentication** | Custom JWT (jose 6.1.3) + HTTP-only cookies |
| **Styling** | Tailwind CSS 4 |
| **Testing** | Vitest 4.0.18 |
| **Language** | TypeScript 5.9.3 |

### Key Dependencies

```json
{
  "date-fns": "^4.1.0",         // Date manipulation
  "pdf-parse": "^1.1.1",        // PDF extraction for expense imports
  "xlsx": "^0.18.5",            // Excel export generation
  "lucide-react": "^0.563.0",   // Icons
  "clsx": "^2.1.1",             // Conditional classnames
  "tailwind-merge": "^3.4.0"    // Tailwind class merging
}
```

### Directory Structure

```
counting_house/
├── src/
│   ├── app/
│   │   ├── api/                 # API routes (documented below)
│   │   ├── admin/               # Admin UI pages
│   │   ├── expenses/            # Expense management UI
│   │   ├── roi/                 # ROI dashboard UI
│   │   ├── settings/            # Settings UI
│   │   └── team/                # Team management UI
│   ├── lib/
│   │   ├── auth.ts              # JWT authentication helpers
│   │   ├── error-logger.ts      # Error logging utility
│   │   ├── openrouter.ts        # OpenRouter AI integration
│   │   └── supabase/
│   │       └── server.ts        # Supabase client factory
│   └── types/
│       └── database.ts          # TypeScript types & interfaces
├── supabase/
│   └── migrations/              # Database migrations
├── docs/
│   └── plans/                   # Implementation plans
└── public/                      # Static assets
```

---

## 2. Database Schema

### Tables Overview

| Table | Description |
|-------|-------------|
| `fiscal_years` | Fiscal year definitions (e.g., 2025, 2026) |
| `event_types` | Configurable event categories with per-FY budgets |
| `events` | Conferences, meetings, galas with budget & ROI tracking |
| `budget_categories` | Non-event expense categories (e.g., "Marketing Materials") |
| `expenses` | Individual expense line items |
| `team_members` | People who can be assigned to events |
| `event_team_assignments` | Join table: team members ↔ events |
| `checklist_templates` | Reusable checklist definitions |
| `checklist_template_items` | Items within a template |
| `event_checklist_items` | Checklist items instantiated for an event |
| `app_settings` | Key-value config store (fiscal year, AI model, prompts) |
| `error_logs` | Application error tracking |

### Key Relationships

```
fiscal_years
    ↓ 1:N
event_types (budget_amount per type per year)
    ↓ 1:N
events (event_type_id → event_types.id)
    ↓ 1:N
expenses (event_id → events.id)
    
budget_categories
    ↓ 1:N
expenses (category_id → budget_categories.id)

team_members
    ↓ N:M (via event_team_assignments)
events

checklist_templates
    ↓ 1:N
checklist_template_items
    ↓ (cloned to)
event_checklist_items (linked to events)
```

### Important Constraints

- **Expense XOR constraint:** Each expense must have EITHER `event_id` OR `category_id` set, but not both and not neither
- **Soft deletes:** Most tables use `deleted_at` for soft deletion
- **Event types unique per fiscal year:** `event_types.name` is unique per `fiscal_year_id` (non-archived)

### Core Entity Fields

#### Events
```typescript
{
  id: UUID,
  name: string,
  event_type_id: UUID,           // FK to event_types
  quarter: 'Q1'|'Q2'|'Q3'|'Q4'|'TBD',
  fiscal_year_id: UUID,
  date_start: DATE,
  date_end: DATE,
  location: string,
  budget_amount: DECIMAL(12,2),
  // Goals
  expansion_goal: number,
  net_new_goal: number,
  // Notes
  approach_notes: text,
  marketing_notes: text,
  sales_notes: text,
  // ROI Metrics
  pipeline_generated: DECIMAL(12,2),
  revenue_closed: DECIMAL(12,2),
  leads_generated: integer,
  meetings_booked: integer,
  opportunities_created: integer,
  roi_notes: text,
  // Timestamps
  created_at, updated_at, deleted_at
}
```

#### Expenses
```typescript
{
  id: UUID,
  event_id: UUID | null,         // XOR with category_id
  category_id: UUID | null,
  amount: DECIMAL(12,2),
  expense_date: DATE,
  vendor: string,
  memo: string,
  source_type: 'manual'|'brex'|'pdf',
  source_reference: string,      // e.g., Brex transaction ID
  is_duplicate: boolean,
  created_at, updated_at, deleted_at
}
```

---

## 3. Existing API Routes

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/auth/login` | Login with username/password → sets JWT cookie |
| `POST` | `/api/auth/logout` | Clears auth cookie |
| `GET` | `/api/auth/me` | Returns current session (username) |

**Auth Mechanism:**
- Credentials verified against `AUTH_USERNAME` / `AUTH_PASSWORD` env vars
- JWT signed with `JWT_SECRET`, stored in HTTP-only cookie `counting-house-token`
- Token expires in 24 hours
- Rate limited: 5 attempts per minute per IP

---

### Fiscal Years

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/fiscal-years` | List all fiscal years |
| `POST` | `/api/fiscal-years` | Create fiscal year |

**GET Response:**
```json
{
  "fiscal_years": [{ "id": "uuid", "year": 2026, "created_at": "..." }],
  "meta": { "total": 1 }
}
```

**POST Body:**
```json
{ "year": 2027 }
```

---

### Event Types

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/event-types?fiscal_year_id=...` | List event types for fiscal year |
| `POST` | `/api/event-types` | Create event type |
| `GET` | `/api/event-types/[id]` | Get single event type |
| `PUT` | `/api/event-types/[id]` | Update event type |
| `DELETE` | `/api/event-types/[id]` | Archive event type |

**GET Response includes computed totals:**
```json
{
  "event_types": [{
    "id": "uuid",
    "name": "Executive",
    "description": "C-suite conferences",
    "fiscal_year_id": "uuid",
    "budget_amount": 50000,
    "is_archived": false,
    "display_order": 1,
    "actual_spent": 12500,    // computed
    "event_count": 3,         // computed
    "remaining": 37500        // computed
  }]
}
```

---

### Events

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/events` | List events (paginated, filterable) |
| `POST` | `/api/events` | Create event |
| `GET` | `/api/events/[id]` | Get event with expenses |
| `PUT` | `/api/events/[id]` | Update event |
| `DELETE` | `/api/events/[id]` | Soft delete event |

**GET Query Params:**
- `event_type_id` - Filter by event type
- `quarter` - Filter by Q1/Q2/Q3/Q4/TBD
- `fiscal_year_id` - Filter by fiscal year
- `page`, `per_page` - Pagination (default: 1, 50; max: 200)

**GET Response:**
```json
{
  "events": [{
    "id": "uuid",
    "name": "AHCA National Conference",
    "event_type_id": "uuid",
    "event_type_record": { "id": "...", "name": "National", ... },
    "quarter": "Q2",
    "date_start": "2026-04-15",
    "budget_amount": 15000,
    "actual_spent": 8500,     // computed
    "remaining": 6500,        // computed
    "expense_count": 12,      // computed
    // ROI fields...
  }],
  "meta": { "total": 24, "filters_applied": {} },
  "pagination": { "page": 1, "per_page": 50, "total": 24, "total_pages": 1 }
}
```

**POST Body (required fields):**
```json
{
  "name": "Event Name",
  "event_type_id": "uuid",
  "quarter": "Q2",
  "budget_amount": 15000
}
```

---

### Event ROI

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/events/[id]/roi` | Get ROI metrics for event |
| `PUT` | `/api/events/[id]/roi` | Update ROI metrics |

**PUT Body:**
```json
{
  "pipeline_generated": 150000,
  "revenue_closed": 45000,
  "leads_generated": 50,
  "meetings_booked": 25,
  "opportunities_created": 12,
  "roi_notes": "Strong performance..."
}
```

---

### Event Team Assignments

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/events/[id]/team` | Get team assignments for event |
| `POST` | `/api/events/[id]/team` | Assign team member to event |
| `PUT` | `/api/events/[id]/team/[assignmentId]` | Update assignment |
| `DELETE` | `/api/events/[id]/team/[assignmentId]` | Remove assignment |

---

### Event Checklists

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/events/[id]/checklist` | Get checklist items (grouped by phase) |
| `POST` | `/api/events/[id]/checklist` | Add checklist item |
| `PUT` | `/api/events/[id]/checklist/[itemId]` | Update item (mark complete, etc.) |
| `DELETE` | `/api/events/[id]/checklist/[itemId]` | Delete item |
| `POST` | `/api/events/[id]/checklist/apply-template` | Apply template to event |

**Checklist Phases:** `pre_event`, `day_of`, `post_event`

---

### Budget Categories

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/categories` | List categories (paginated) |
| `POST` | `/api/categories` | Create category |
| `GET` | `/api/categories/[id]` | Get single category |
| `PUT` | `/api/categories/[id]` | Update category |
| `DELETE` | `/api/categories/[id]` | Soft delete category |

---

### Expenses

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/expenses` | List expenses (paginated, filterable) |
| `POST` | `/api/expenses` | Create expense |
| `GET` | `/api/expenses/[id]` | Get single expense |
| `PUT` | `/api/expenses/[id]` | Update expense |
| `DELETE` | `/api/expenses/[id]` | Soft delete expense |

**GET Query Params:**
- `event_id` - Filter by event
- `category_id` - Filter by category
- `fiscal_year_id` - Filter by fiscal year
- `date_start`, `date_end` - Date range filter
- `vendor` - Vendor name search (partial match)
- `source_type` - Filter by manual/brex/pdf
- `sort_by` - date|amount|vendor
- `sort_order` - asc|desc
- `page`, `per_page` - Pagination

**GET Response:**
```json
{
  "expenses": [{
    "id": "uuid",
    "event_id": "uuid",
    "category_id": null,
    "amount": 1250.00,
    "expense_date": "2026-03-15",
    "vendor": "Delta Airlines",
    "memo": "Team travel",
    "source_type": "brex",
    "event_name": "AHCA Conference",      // computed
    "category_name": null,                 // computed
    "target_type": "event",                // computed
    "target_name": "AHCA Conference"       // computed
  }],
  "meta": { "total": 150, "total_amount": 45000, "filters_applied": {}, "sort": { "by": "date", "order": "desc" } },
  "pagination": { ... }
}
```

---

### Team Members

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/team` | List all active team members |
| `POST` | `/api/team` | Create team member |
| `GET` | `/api/team/[id]` | Get single team member |
| `PUT` | `/api/team/[id]` | Update team member |
| `DELETE` | `/api/team/[id]` | Soft delete team member |

---

### Checklist Templates

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/checklist-templates` | List all templates |
| `POST` | `/api/checklist-templates` | Create template |
| `GET` | `/api/checklist-templates/[id]` | Get template with items |
| `PUT` | `/api/checklist-templates/[id]` | Update template |
| `DELETE` | `/api/checklist-templates/[id]` | Soft delete template |
| `POST` | `/api/checklist-templates/[id]/items` | Add item to template |
| `PUT` | `/api/checklist-templates/[id]/items/[itemId]` | Update template item |
| `DELETE` | `/api/checklist-templates/[id]/items/[itemId]` | Delete template item |

---

### Dashboard

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/dashboard/summary` | Budget vs actual summary |
| `GET` | `/api/dashboard/roi` | Aggregate ROI across events |

**Summary Response:**
```json
{
  "total": {
    "budget": 500000,
    "allocated": 450000,
    "actual": 125000,
    "remaining": 375000
  },
  "byEventType": [{ "id": "...", "type": "Executive", "budget": 50000, "actual": 12000 }],
  "byQuarter": [{ "quarter": "Q1", "budget": 100000, "actual": 35000 }],
  "byCategory": [{ "name": "Travel", "budget": 25000, "actual": 8000 }],
  "fiscalYear": { "id": "...", "year": 2026 }
}
```

---

### Import

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/import/brex` | Upload Brex CSV, get AI categorization suggestions |
| `POST` | `/api/import/brex/confirm` | Confirm and create expenses from import |
| `POST` | `/api/import/pdf` | Upload PDF receipt, extract expenses via AI |

**Brex Import Response:**
```json
{
  "transactions": [{
    "id": "brex-123",
    "date": "2026-03-15",
    "amount": 1250.00,
    "vendor": "Delta Airlines",
    "suggestedAssignment": { "id": "event-uuid", "name": "AHCA Conference", "type": "event" },
    "aiConfidence": 0.95,
    "isDuplicate": false
  }],
  "meta": { "total": 25, "duplicates": 2, "withSuggestions": 23 },
  "assignmentOptions": [...]
}
```

---

### Export

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/export/preview` | Preview export data as JSON |
| `GET` | `/api/export/csv` | Download CSV export |
| `GET` | `/api/export/excel` | Download Excel workbook |

**Query Params:**
- `scope` - year|quarter|month|custom
- `fiscal_year` - Year number
- `quarter` - Q1|Q2|Q3|Q4
- `month` - 1-12
- `date_start`, `date_end` - For custom scope

---

### Settings

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/settings` | Get all app settings |
| `PUT` | `/api/settings` | Update settings |
| `DELETE` | `/api/settings?prompt_key=...` | Reset AI prompt to default |

**Settings Include:**
- `fiscal_year_id` - Active fiscal year
- `openrouter_model` - AI model for categorization
- `total_budget` - Overall budget amount
- `prompts.csv_categorization` - Custom AI prompt for CSV import
- `prompts.pdf_extraction` - Custom AI prompt for PDF extraction

---

### Admin

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/admin/errors` | List error logs |

---

### OpenRouter

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/openrouter/models` | List available AI models |

---

## 4. Core Features Summary

### What the App Does

**The Counting House** is a Victorian-themed budget tracking application for managing event marketing spend in the senior living industry. It enables:

1. **Event Budget Planning** - Create events with budgets, assign to fiscal years & quarters
2. **Expense Tracking** - Manual entry, Brex CSV import, PDF receipt scanning
3. **ROI Tracking** - Track pipeline, revenue, leads, meetings, opportunities per event
4. **Team Management** - Assign team members to events with roles
5. **Checklist Management** - Reusable templates for event preparation tasks
6. **Reporting** - Dashboard summaries, Excel/CSV exports

### CRUD Matrix

| Entity | Create | Read | Update | Delete |
|--------|--------|------|--------|--------|
| Fiscal Years | ✅ | ✅ | ❌ | ❌ |
| Event Types | ✅ | ✅ | ✅ | ✅ (archive) |
| Events | ✅ | ✅ | ✅ | ✅ (soft) |
| Budget Categories | ✅ | ✅ | ✅ | ✅ (soft) |
| Expenses | ✅ | ✅ | ✅ | ✅ (soft) |
| Team Members | ✅ | ✅ | ✅ | ✅ (soft) |
| Event Team Assignments | ✅ | ✅ | ✅ | ✅ |
| Checklist Templates | ✅ | ✅ | ✅ | ✅ (soft) |
| Template Items | ✅ | ✅ | ✅ | ✅ |
| Event Checklist Items | ✅ | ✅ | ✅ | ✅ |
| Settings | ✅ (upsert) | ✅ | ✅ | ✅ (prompts only) |

---

## 5. Gaps for Scrooge Integration

### Missing Capabilities

#### 5.1 Bulk Operations

Currently, all operations are single-entity. An AI agent would benefit from:

| Gap | Description | Priority |
|-----|-------------|----------|
| **Bulk expense creation** | Create multiple expenses in one request | High |
| **Bulk expense updates** | Update multiple expenses (e.g., reassign to different event) | Medium |
| **Bulk import confirmation** | Confirm multiple Brex transactions at once | High (partial exists) |
| **Bulk checklist completion** | Mark multiple items complete | Low |

**Recommended API:**
```
POST /api/expenses/bulk
{
  "expenses": [{ "event_id": "...", "amount": 100, ... }, ...]
}
```

#### 5.2 Webhook/Event Triggers

No event system exists. For proactive AI integration:

| Trigger | Use Case |
|---------|----------|
| `expense.created` | AI could verify/categorize new expenses |
| `event.budget_exceeded` | Alert when spending exceeds budget |
| `event.upcoming` | Notify agent of events within N days |
| `checklist.overdue` | Items past due date |
| `import.pending` | New Brex data ready for review |

**Recommended:** Add optional webhook URLs to settings, fire on entity changes.

#### 5.3 Audit Logging

The `error_logs` table exists but no **audit trail** for:
- Who created/modified/deleted entities
- What changed (old vs new values)
- Timestamps of all actions

**Recommended:** Add `audit_log` table:
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  entity_type TEXT,      -- 'expense', 'event', etc.
  entity_id UUID,
  action TEXT,           -- 'create', 'update', 'delete'
  changes JSONB,         -- { field: { old: x, new: y } }
  actor TEXT,            -- 'user:treynor' or 'agent:scrooge'
  created_at TIMESTAMPTZ
);
```

#### 5.4 Agent-Specific Authentication

Current auth is single-user (env var credentials). For agent integration:

| Gap | Recommendation |
|-----|----------------|
| API key auth | Add bearer token support alongside cookie auth |
| Agent identity | Track which agent made changes |
| Scoped permissions | Allow read-only vs read-write access |

**Recommended:** Add `x-api-key` header support with agent identifiers.

#### 5.5 Search & Filtering Enhancements

| Gap | Description |
|-----|-------------|
| Full-text search | Search across event names, vendor names, memos |
| Date range for events | Filter events by date_start range |
| Aggregate queries | "Total spent in Q2" without fetching all data |
| Changed-since filtering | `?modified_after=2024-01-01` for sync |

#### 5.6 Idempotency

No idempotency keys for POST operations. Agent retry logic could create duplicates.

**Recommended:** Add optional `Idempotency-Key` header support.

#### 5.7 Batch Reads

No way to fetch multiple specific entities by ID in one request.

**Recommended:**
```
GET /api/events?ids=uuid1,uuid2,uuid3
```

#### 5.8 Missing Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/events/[id]/summary` | Quick stats without full expense list |
| `GET /api/fiscal-years/[id]` | Get single fiscal year |
| `PUT /api/fiscal-years/[id]` | Update fiscal year (if needed) |
| `GET /api/health` | Health check for monitoring |
| `GET /api/stats` | Global statistics |

---

## 6. Recommended Scrooge API Enhancements

### Phase 1: Foundation (Required)

1. **API Key Authentication**
   - Add `x-api-key` header support
   - Store keys in `app_settings` or dedicated table
   - Track agent identity in requests

2. **Bulk Expense Creation**
   - `POST /api/expenses/bulk` accepting array
   - Return created IDs and any errors

3. **Health Check**
   - `GET /api/health` returning system status

4. **Idempotency Keys**
   - Optional header for safe retries

### Phase 2: Intelligence (High Value)

5. **Audit Logging**
   - Track all changes with actor identity
   - `GET /api/audit-log` for review

6. **Changed-Since Filtering**
   - Add `modified_after` param to all list endpoints
   - Enables efficient sync

7. **Event Webhooks**
   - Configure callback URLs in settings
   - Fire on key events

### Phase 3: Convenience (Nice to Have)

8. **Full-Text Search**
   - Global search endpoint
   - Cross-entity results

9. **Batch Reads**
   - Fetch multiple entities by ID

10. **Statistics Endpoint**
    - Aggregate metrics without full data fetch

---

## 7. Environment Variables

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `JWT_SECRET` | Secret for signing JWTs |
| `AUTH_USERNAME` | Login username |
| `AUTH_PASSWORD` | Login password |
| `OPENROUTER_API_KEY` | AI API key for categorization |

---

## 8. API Response Conventions

### Success Responses

- `200 OK` - Read/update success
- `201 Created` - Create success
- Single entities returned directly or nested in `{ event: {...} }`
- Lists returned as `{ events: [...], meta: {...}, pagination: {...} }`

### Error Responses

```json
{
  "error": "Human-readable error message"
}
```

Status codes: `400` (validation), `401` (auth), `404` (not found), `409` (conflict), `429` (rate limit), `500` (server error)

---

## 9. Pagination Convention

All list endpoints support:

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `page` | 1 | - | Page number (1-indexed) |
| `per_page` | 50 | 200 | Items per page |

Response includes:
```json
{
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 150,
    "total_pages": 3
  }
}
```

---

## 10. Quick Start for Scrooge

### Authentication Flow

```bash
# Option 1: Cookie-based (current)
curl -X POST /api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"...","password":"..."}' \
  -c cookies.txt

curl /api/events -b cookies.txt

# Option 2: API Key (recommended addition)
curl /api/events -H "x-api-key: scrooge-secret-key"
```

### Common Operations

```bash
# List events for fiscal year
GET /api/events?fiscal_year_id=uuid&per_page=100

# Create expense
POST /api/expenses
{"event_id":"uuid","amount":150,"expense_date":"2026-03-15","vendor":"Delta","source_type":"manual"}

# Update ROI metrics
PUT /api/events/{id}/roi
{"pipeline_generated":50000,"leads_generated":25}

# Get dashboard
GET /api/dashboard/summary
```

---

*End of Report*
