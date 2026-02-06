# Scrooge Agent — Counting House API Specification

> *"Every farthing accounted for, every ledger balanced, every penny traced back to its origin."*

**Version:** 1.0.0  
**Status:** Draft  
**Author:** Virgil (Clawdbot) for Treynor Tetik  
**Date:** June 2025  
**Target System:** The Counting House (Next.js 16 / Supabase)  
**Consumer:** Scrooge AI Agent

---

## Table of Contents

1. [Overview](#1-overview)
2. [Authentication](#2-authentication)
3. [Common Conventions](#3-common-conventions)
4. [New Endpoints](#4-new-endpoints)
5. [Enhancements to Existing Endpoints](#5-enhancements-to-existing-endpoints)
6. [Existing Endpoints Reference](#6-existing-endpoints-reference)
7. [Webhook System](#7-webhook-system)
8. [Audit Log](#8-audit-log)
9. [Scrooge-Specific Operations](#9-scrooge-specific-operations)
10. [Rate Limiting & Error Handling](#10-rate-limiting--error-handling)
11. [Database Migrations](#11-database-migrations)
12. [Implementation Priority](#12-implementation-priority)

---

## 1. Overview

### What is Scrooge?

Scrooge is an AI agent that acts as the autonomous financial operations layer for The Counting House. It:

- **Syncs** expense data from external systems (Brex, Monday.com)
- **Monitors** budgets and alerts on overages or approaching limits
- **Reminds** about upcoming events and overdue checklist items
- **Reports** via Slack with summaries, warnings, and generated documents
- **Audits** all changes with full traceability (user vs. agent)

### Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Idempotent** | All write operations accept `Idempotency-Key` header |
| **Auditable** | Every mutation is logged with actor identity |
| **Sync-friendly** | All list endpoints support `modified_after` for incremental sync |
| **Batch-first** | Bulk endpoints for common agent operations |
| **Fail-safe** | Structured error responses, rate limiting, circuit breakers |

### Base URL

```
Production: https://example.invalid
Local:      http://localhost:3000
```

---

## 2. Authentication

### Current: Cookie-based JWT

The existing auth system uses `POST /api/auth/login` to obtain an HTTP-only JWT cookie (`counting-house-token`). This remains the primary auth method for the browser UI.

### New: API Key Authentication

Scrooge authenticates via `x-api-key` header. This runs **alongside** cookie auth — either method is accepted.

#### How It Works

```
┌─────────────────┐     x-api-key: sk_scrooge_xxx     ┌──────────────────┐
│   Scrooge Agent  │ ──────────────────────────────────▶│  Counting House  │
└─────────────────┘                                     │  API Middleware   │
                                                        │                  │
                                                        │ 1. Check cookie  │
                                                        │ 2. Check x-api-key│
                                                        │ 3. Set actor ctx │
                                                        └──────────────────┘
```

#### Request Example

```http
GET /api/events?fiscal_year_id=abc-123 HTTP/1.1
Host: example.invalid
x-api-key: sk_scrooge_live_a1b2c3d4e5f6
Accept: application/json
```

#### API Key Format

```
sk_{agent_name}_{environment}_{random_32_chars}

Examples:
  sk_scrooge_live_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
  sk_scrooge_test_x9y8z7w6v5u4t3s2r1q0p9o8n7m6l5k4
```

#### API Key Storage

Keys are stored in a new `api_keys` table:

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,       -- SHA-256 hash (never store plaintext)
  agent_name TEXT NOT NULL,            -- 'scrooge', etc.
  label TEXT,                          -- 'production', 'staging'
  permissions TEXT[] DEFAULT '{read,write}', -- scope array
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ               -- soft revoke
);
```

#### Permission Scopes

| Scope | Allows |
|-------|--------|
| `read` | All GET endpoints |
| `write` | POST, PUT, DELETE on expenses, events, checklists |
| `admin` | Settings, API key management, audit log |
| `webhooks` | Register and manage webhooks |

#### Error Responses

```json
// 401 — Missing or invalid key
{
  "error": "Invalid or missing API key",
  "code": "AUTH_INVALID_KEY"
}

// 403 — Key valid but insufficient permissions
{
  "error": "API key lacks required permission: admin",
  "code": "AUTH_INSUFFICIENT_PERMISSIONS"
}

// 401 — Expired key
{
  "error": "API key has expired",
  "code": "AUTH_KEY_EXPIRED"
}
```

---

## 3. Common Conventions

### 3.1 Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| `x-api-key` | Yes (for agent) | API key for authentication |
| `Content-Type` | Yes (for POST/PUT) | Always `application/json` |
| `Accept` | Optional | `application/json` (default) |
| `Idempotency-Key` | Recommended | UUID for safe retries on POST/PUT |
| `X-Request-Id` | Optional | Trace ID for debugging |

### 3.2 Idempotency

All POST and PUT endpoints support the `Idempotency-Key` header. When provided:

1. First request with a given key is processed normally
2. Subsequent requests with the same key return the **cached response** from the first request
3. Keys expire after **24 hours**
4. Keys are scoped per API key (different agents can use the same idempotency key)

```http
POST /api/expenses HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: 7f1c8a2e-3b4d-5e6f-7a8b-9c0d1e2f3a4b
Content-Type: application/json

{"event_id": "...", "amount": 150, "vendor": "Delta"}
```

**Response includes header:**
```http
HTTP/1.1 201 Created
Idempotency-Status: new          // or "cached" on replay
Idempotency-Key: 7f1c8a2e-...
```

Storage:

```sql
CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (key, api_key_id)
);
```

### 3.3 Pagination

All list endpoints use the existing pagination convention:

| Param | Default | Max | Description |
|-------|---------|-----|-------------|
| `page` | 1 | — | Page number (1-indexed) |
| `per_page` | 50 | 200 | Items per page |

Response:
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

### 3.4 Filtering — New Universal Parameters

These parameters are added to **all list endpoints**:

| Param | Type | Description |
|-------|------|-------------|
| `modified_after` | ISO 8601 datetime | Only return records updated after this timestamp |
| `ids` | Comma-separated UUIDs | Fetch specific records by ID |

```http
GET /api/expenses?modified_after=2025-06-01T00:00:00Z&per_page=200
GET /api/events?ids=uuid1,uuid2,uuid3
```

### 3.5 Standard Success Responses

```json
// Single entity
{
  "expense": { ... }
}

// List
{
  "expenses": [ ... ],
  "meta": { "total": 42, ... },
  "pagination": { ... }
}

// Mutation success
{
  "expense": { ... },
  "audit_id": "uuid"        // Reference to audit log entry
}
```

### 3.6 Standard Error Responses

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE",
  "details": {              // Optional: field-level errors
    "amount": "Must be positive",
    "event_id": "Event not found"
  },
  "request_id": "uuid"     // Echoed from X-Request-Id if provided
}
```

| HTTP Status | Code Prefix | When |
|-------------|-------------|------|
| `400` | `VALIDATION_*` | Bad request body or params |
| `401` | `AUTH_*` | Authentication failed |
| `403` | `AUTH_INSUFFICIENT_*` | Permission denied |
| `404` | `NOT_FOUND` | Entity doesn't exist |
| `409` | `CONFLICT_*` | Duplicate, version conflict |
| `422` | `UNPROCESSABLE_*` | Valid syntax but semantic error |
| `429` | `RATE_LIMITED` | Too many requests |
| `500` | `INTERNAL_ERROR` | Server error |

---

## 4. New Endpoints

### 4.1 `GET /api/health` — System Health Check

Returns system status for monitoring.

**Auth:** None required (public endpoint)

**Request:**
```http
GET /api/health HTTP/1.1
```

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "version": "1.2.0",
  "timestamp": "2025-06-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "latency_ms": 12
    },
    "openrouter": {
      "status": "healthy",
      "latency_ms": 245
    }
  },
  "uptime_seconds": 86400
}
```

**Response `503 Service Unavailable` (degraded):**
```json
{
  "status": "degraded",
  "version": "1.2.0",
  "timestamp": "2025-06-15T10:30:00Z",
  "checks": {
    "database": {
      "status": "unhealthy",
      "error": "Connection timeout",
      "latency_ms": 5000
    },
    "openrouter": {
      "status": "healthy",
      "latency_ms": 180
    }
  }
}
```

---

### 4.2 `GET /api/stats` — Global Statistics

Aggregated metrics across the active fiscal year. Designed for Scrooge's periodic sync and Slack reporting.

**Auth:** `read` scope

**Request:**
```http
GET /api/stats HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `fiscal_year_id` | UUID | Active FY | Scope to a fiscal year |

**Response `200 OK`:**
```json
{
  "fiscal_year": {
    "id": "uuid",
    "year": 2026
  },
  "budget": {
    "total": 500000.00,
    "allocated": 450000.00,
    "actual_spent": 187500.00,
    "remaining": 312500.00,
    "utilization_pct": 37.5
  },
  "events": {
    "total": 45,
    "by_quarter": {
      "Q1": 12,
      "Q2": 15,
      "Q3": 10,
      "Q4": 8,
      "TBD": 0
    },
    "over_budget": 2,
    "near_budget": 5,
    "upcoming_30_days": 3
  },
  "expenses": {
    "total_count": 342,
    "total_amount": 187500.00,
    "by_source": {
      "manual": 120,
      "brex": 210,
      "pdf": 12
    },
    "pending_imports": 8
  },
  "roi": {
    "total_pipeline": 2500000.00,
    "total_revenue_closed": 750000.00,
    "total_leads": 450,
    "total_meetings": 180,
    "avg_roi_ratio": 4.0
  },
  "checklists": {
    "total_items": 540,
    "completed": 320,
    "overdue": 15,
    "completion_pct": 59.3
  },
  "computed_at": "2025-06-15T10:30:00Z"
}
```

---

### 4.3 `POST /api/expenses/bulk` — Batch Create Expenses

Create multiple expenses in a single request. Essential for Brex sync and import workflows.

**Auth:** `write` scope

**Request:**
```http
POST /api/expenses/bulk HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: bulk-brex-import-2025-06-15
Content-Type: application/json
```

**Request Body:**
```json
{
  "expenses": [
    {
      "event_id": "uuid-event-1",
      "amount": 1250.00,
      "expense_date": "2025-06-10",
      "vendor": "Delta Airlines",
      "memo": "Team travel — AHCA Conference",
      "source_type": "brex",
      "source_reference": "brex-txn-12345"
    },
    {
      "category_id": "uuid-cat-swag",
      "amount": 450.00,
      "expense_date": "2025-06-11",
      "vendor": "Custom Ink",
      "memo": "Conference t-shirts",
      "source_type": "brex",
      "source_reference": "brex-txn-12346"
    },
    {
      "event_id": "uuid-event-2",
      "amount": 3200.00,
      "expense_date": "2025-06-12",
      "vendor": "Marriott",
      "memo": "Hotel block — NIC Spring",
      "source_type": "manual"
    }
  ]
}
```

**Validation Rules:**
- Max 100 expenses per request
- Each expense must have either `event_id` OR `category_id` (XOR constraint)
- `amount` must be positive
- `expense_date` must be a valid date
- `vendor` is required, non-empty
- `source_type` must be `manual`, `brex`, or `pdf`

**Response `201 Created`:**
```json
{
  "created": [
    {
      "id": "uuid-new-1",
      "index": 0,
      "source_reference": "brex-txn-12345",
      "amount": 1250.00,
      "vendor": "Delta Airlines"
    },
    {
      "id": "uuid-new-2",
      "index": 1,
      "source_reference": "brex-txn-12346",
      "amount": 450.00,
      "vendor": "Custom Ink"
    },
    {
      "id": "uuid-new-3",
      "index": 2,
      "source_reference": null,
      "amount": 3200.00,
      "vendor": "Marriott"
    }
  ],
  "errors": [],
  "meta": {
    "total_submitted": 3,
    "total_created": 3,
    "total_errors": 0,
    "total_amount": 4900.00
  },
  "audit_id": "uuid-audit-batch"
}
```

**Response with Partial Failure `207 Multi-Status`:**
```json
{
  "created": [
    {
      "id": "uuid-new-1",
      "index": 0,
      "source_reference": "brex-txn-12345",
      "amount": 1250.00,
      "vendor": "Delta Airlines"
    }
  ],
  "errors": [
    {
      "index": 1,
      "error": "Event not found",
      "code": "NOT_FOUND",
      "input": {
        "event_id": "uuid-nonexistent",
        "amount": 450.00,
        "vendor": "Custom Ink"
      }
    },
    {
      "index": 2,
      "error": "Amount must be positive",
      "code": "VALIDATION_AMOUNT",
      "input": {
        "event_id": "uuid-event-2",
        "amount": -100,
        "vendor": "Marriott"
      }
    }
  ],
  "meta": {
    "total_submitted": 3,
    "total_created": 1,
    "total_errors": 2,
    "total_amount": 1250.00
  }
}
```

**Note:** Bulk create is **atomic per item** — successful items are created even if others fail. If you need all-or-nothing, add `"atomic": true` to the request body (all fail if any fail).

---

### 4.4 `PUT /api/expenses/bulk` — Batch Update Expenses

Update multiple existing expenses. Common use case: reassigning expenses to different events after an import review.

**Auth:** `write` scope

**Request:**
```http
PUT /api/expenses/bulk HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: bulk-reassign-2025-06-15
Content-Type: application/json
```

**Request Body:**
```json
{
  "updates": [
    {
      "id": "uuid-expense-1",
      "event_id": "uuid-new-event",
      "category_id": null,
      "memo": "Reassigned from Marketing to AHCA Conference"
    },
    {
      "id": "uuid-expense-2",
      "amount": 1500.00,
      "memo": "Amount corrected from $1200 to $1500"
    },
    {
      "id": "uuid-expense-3",
      "is_duplicate": true,
      "memo": "Marked as duplicate of brex-txn-12340"
    }
  ]
}
```

**Validation Rules:**
- Max 100 updates per request
- Each update must include `id`
- Only provided fields are updated (partial update / PATCH semantics)
- XOR constraint applies: if setting `event_id`, must null `category_id` and vice versa

**Response `200 OK`:**
```json
{
  "updated": [
    {
      "id": "uuid-expense-1",
      "index": 0,
      "changes": {
        "event_id": { "old": "uuid-old-event", "new": "uuid-new-event" },
        "category_id": { "old": "uuid-old-cat", "new": null },
        "memo": { "old": "Original memo", "new": "Reassigned from Marketing to AHCA Conference" }
      }
    },
    {
      "id": "uuid-expense-2",
      "index": 1,
      "changes": {
        "amount": { "old": 1200.00, "new": 1500.00 },
        "memo": { "old": null, "new": "Amount corrected from $1200 to $1500" }
      }
    },
    {
      "id": "uuid-expense-3",
      "index": 2,
      "changes": {
        "is_duplicate": { "old": false, "new": true },
        "memo": { "old": null, "new": "Marked as duplicate of brex-txn-12340" }
      }
    }
  ],
  "errors": [],
  "meta": {
    "total_submitted": 3,
    "total_updated": 3,
    "total_errors": 0
  },
  "audit_id": "uuid-audit-batch-update"
}
```

---

### 4.5 `GET /api/events/upcoming` — Events Within N Days

Returns events starting within the next N days. Designed for Scrooge's reminder system.

**Auth:** `read` scope

**Request:**
```http
GET /api/events/upcoming?days=30&fiscal_year_id=uuid HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Query Params:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `days` | integer | 30 | Look-ahead window (1–365) |
| `fiscal_year_id` | UUID | Active FY | Scope to fiscal year |
| `include_checklist_summary` | boolean | false | Include checklist completion stats |

**Response `200 OK`:**
```json
{
  "events": [
    {
      "id": "uuid-event-1",
      "name": "AHCA National Conference",
      "event_type_name": "National",
      "quarter": "Q3",
      "date_start": "2025-07-10",
      "date_end": "2025-07-12",
      "location": "Orlando, FL",
      "days_until": 25,
      "budget_amount": 15000.00,
      "actual_spent": 8500.00,
      "remaining": 6500.00,
      "budget_utilization_pct": 56.7,
      "checklist_summary": {
        "total": 18,
        "completed": 12,
        "overdue": 2,
        "completion_pct": 66.7
      },
      "team_count": 4,
      "warnings": [
        {
          "type": "checklist_overdue",
          "message": "2 checklist items are overdue",
          "items": ["Book travel & hotel", "Order booth materials"]
        }
      ]
    },
    {
      "id": "uuid-event-2",
      "name": "AHLA Leadership Summit",
      "event_type_name": "Executive",
      "quarter": "Q3",
      "date_start": "2025-07-05",
      "date_end": "2025-07-06",
      "location": "Washington, DC",
      "days_until": 20,
      "budget_amount": 8000.00,
      "actual_spent": 7800.00,
      "remaining": 200.00,
      "budget_utilization_pct": 97.5,
      "checklist_summary": {
        "total": 15,
        "completed": 15,
        "overdue": 0,
        "completion_pct": 100.0
      },
      "team_count": 2,
      "warnings": [
        {
          "type": "budget_warning",
          "message": "Budget is 97.5% utilized ($200.00 remaining)",
          "threshold_pct": 80
        }
      ]
    }
  ],
  "meta": {
    "total": 2,
    "days_window": 30,
    "fiscal_year": { "id": "uuid", "year": 2026 }
  }
}
```

---

### 4.6 `GET /api/events/[id]/summary` — Event Quick Summary

Lightweight event stats without the full expense list. Perfect for dashboards and Slack notifications.

**Auth:** `read` scope

**Request:**
```http
GET /api/events/abc-123/summary HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Response `200 OK`:**
```json
{
  "event": {
    "id": "abc-123",
    "name": "AHCA National Conference",
    "event_type": {
      "id": "uuid",
      "name": "National"
    },
    "quarter": "Q3",
    "fiscal_year": {
      "id": "uuid",
      "year": 2026
    },
    "date_start": "2025-07-10",
    "date_end": "2025-07-12",
    "location": "Orlando, FL",
    "days_until": 25,
    "budget": {
      "amount": 15000.00,
      "actual_spent": 8500.00,
      "remaining": 6500.00,
      "utilization_pct": 56.7,
      "status": "on_track"
    },
    "expenses": {
      "count": 12,
      "by_source": { "manual": 3, "brex": 8, "pdf": 1 },
      "top_vendors": [
        { "vendor": "Delta Airlines", "total": 3200.00 },
        { "vendor": "Marriott", "total": 2800.00 },
        { "vendor": "Freeman", "total": 1500.00 }
      ]
    },
    "team": {
      "count": 4,
      "members": [
        { "name": "Treynor Tetik", "role": "Event Lead" },
        { "name": "Redacted Name", "role": "Logistics" }
      ]
    },
    "checklist": {
      "total": 18,
      "completed": 12,
      "overdue": 2,
      "completion_pct": 66.7,
      "next_due": {
        "title": "Ship booth materials",
        "due_date": "2025-06-26",
        "assignee": "Redacted Name"
      }
    },
    "roi": {
      "pipeline_generated": 150000.00,
      "revenue_closed": 45000.00,
      "leads_generated": 50,
      "meetings_booked": 25,
      "roi_ratio": 5.29
    }
  }
}
```

**Budget Status Values:**

| Status | Condition |
|--------|-----------|
| `on_track` | ≤ 70% utilized |
| `watch` | 70–80% utilized |
| `warning` | 80–95% utilized |
| `critical` | 95–100% utilized |
| `over_budget` | > 100% utilized |

---

### 4.7 `POST /api/webhooks` — Register Webhook

Register a URL to receive event notifications.

**Auth:** `webhooks` scope

**Request:**
```http
POST /api/webhooks HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: webhook-reg-001
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://scrooge-agent.example.com/webhooks/counting-house",
  "events": [
    "expense.created",
    "expense.updated",
    "event.budget_exceeded",
    "event.budget_warning",
    "event.upcoming",
    "checklist.item_overdue",
    "import.pending"
  ],
  "secret": "whsec_a1b2c3d4e5f6g7h8",
  "description": "Scrooge production webhook"
}
```

**Response `201 Created`:**
```json
{
  "webhook": {
    "id": "uuid-webhook-1",
    "url": "https://scrooge-agent.example.com/webhooks/counting-house",
    "events": [
      "expense.created",
      "expense.updated",
      "event.budget_exceeded",
      "event.budget_warning",
      "event.upcoming",
      "checklist.item_overdue",
      "import.pending"
    ],
    "secret_last_four": "g7h8",
    "is_active": true,
    "created_at": "2025-06-15T10:30:00Z"
  }
}
```

#### Additional Webhook Management Endpoints

```http
GET    /api/webhooks                 — List all registered webhooks
GET    /api/webhooks/:id             — Get webhook details
PUT    /api/webhooks/:id             — Update webhook (URL, events, active status)
DELETE /api/webhooks/:id             — Delete webhook
POST   /api/webhooks/:id/test        — Send a test payload
GET    /api/webhooks/:id/deliveries  — View delivery history
```

**List Webhooks Response:**
```json
{
  "webhooks": [
    {
      "id": "uuid-webhook-1",
      "url": "https://scrooge-agent.example.com/webhooks/counting-house",
      "events": ["expense.created", "event.budget_exceeded"],
      "is_active": true,
      "last_delivery_at": "2025-06-15T09:00:00Z",
      "last_delivery_status": 200,
      "failure_count": 0,
      "created_at": "2025-06-01T00:00:00Z"
    }
  ],
  "meta": { "total": 1 }
}
```

**Test Webhook Response:**
```json
{
  "delivery": {
    "id": "uuid-delivery-test",
    "webhook_id": "uuid-webhook-1",
    "event_type": "webhook.test",
    "status_code": 200,
    "response_time_ms": 150,
    "delivered_at": "2025-06-15T10:31:00Z"
  }
}
```

---

### 4.8 `GET /api/audit-log` — Query Audit Trail

Query the audit log for change history. Essential for compliance and debugging.

**Auth:** `admin` scope

**Request:**
```http
GET /api/audit-log?entity_type=expense&action=create&actor=agent:scrooge&per_page=50 HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Query Params:**

| Param | Type | Description |
|-------|------|-------------|
| `entity_type` | string | `expense`, `event`, `checklist_item`, `team_member`, etc. |
| `entity_id` | UUID | Filter to a specific entity |
| `action` | string | `create`, `update`, `delete`, `bulk_create`, `bulk_update` |
| `actor` | string | `user:treynor`, `agent:scrooge`, or prefix like `agent:` |
| `date_start` | ISO 8601 | Start of date range |
| `date_end` | ISO 8601 | End of date range |
| `page`, `per_page` | integer | Pagination |

**Response `200 OK`:**
```json
{
  "entries": [
    {
      "id": "uuid-audit-1",
      "entity_type": "expense",
      "entity_id": "uuid-expense-1",
      "action": "create",
      "actor": "agent:scrooge",
      "actor_type": "agent",
      "changes": {
        "event_id": { "old": null, "new": "uuid-event-1" },
        "amount": { "old": null, "new": 1250.00 },
        "vendor": { "old": null, "new": "Delta Airlines" },
        "source_type": { "old": null, "new": "brex" }
      },
      "metadata": {
        "idempotency_key": "bulk-brex-import-2025-06-15",
        "batch_id": "uuid-batch-1",
        "source": "brex_sync"
      },
      "created_at": "2025-06-15T10:30:00Z"
    },
    {
      "id": "uuid-audit-2",
      "entity_type": "expense",
      "entity_id": "uuid-expense-2",
      "action": "update",
      "actor": "user:treynor",
      "actor_type": "user",
      "changes": {
        "amount": { "old": 1200.00, "new": 1500.00 },
        "memo": { "old": null, "new": "Corrected amount" }
      },
      "metadata": {},
      "created_at": "2025-06-15T11:00:00Z"
    }
  ],
  "meta": {
    "total": 342,
    "filters_applied": {
      "entity_type": "expense",
      "action": "create",
      "actor": "agent:scrooge"
    }
  },
  "pagination": {
    "page": 1,
    "per_page": 50,
    "total": 342,
    "total_pages": 7
  }
}
```

---

## 5. Enhancements to Existing Endpoints

### 5.1 Universal Additions (All List Endpoints)

The following parameters are added to every existing `GET` list endpoint:

#### `modified_after` — Incremental Sync

Returns only records where `updated_at > modified_after`. Critical for efficient agent sync.

```http
GET /api/expenses?modified_after=2025-06-14T00:00:00Z HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Affected endpoints:**
- `GET /api/events`
- `GET /api/expenses`
- `GET /api/categories`
- `GET /api/event-types`
- `GET /api/team`
- `GET /api/fiscal-years`
- `GET /api/checklist-templates`

**Response includes sync metadata:**
```json
{
  "expenses": [...],
  "meta": {
    "total": 15,
    "modified_after": "2025-06-14T00:00:00Z",
    "server_time": "2025-06-15T10:30:00Z"
  }
}
```

The `server_time` field should be stored and used as `modified_after` for the next sync call.

#### `ids` — Batch Read

Fetch multiple specific records by ID. Useful when Scrooge knows exactly which records it needs.

```http
GET /api/events?ids=uuid1,uuid2,uuid3 HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

- Max 100 IDs per request
- Order is not guaranteed; use `sort_by` if needed
- IDs that don't exist are silently omitted (no error)
- Pagination is ignored when `ids` is provided

### 5.2 Enhanced Expense Listing

**New query params for `GET /api/expenses`:**

| Param | Type | Description |
|-------|------|-------------|
| `modified_after` | ISO 8601 | Incremental sync |
| `ids` | CSV UUIDs | Batch read |
| `min_amount` | decimal | Filter expenses ≥ this amount |
| `max_amount` | decimal | Filter expenses ≤ this amount |
| `is_duplicate` | boolean | Filter by duplicate status |
| `source_reference` | string | Exact match on source ref (e.g., Brex txn ID) |

```http
GET /api/expenses?source_type=brex&modified_after=2025-06-01T00:00:00Z&is_duplicate=false HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

### 5.3 Enhanced Event Listing

**New query params for `GET /api/events`:**

| Param | Type | Description |
|-------|------|-------------|
| `modified_after` | ISO 8601 | Incremental sync |
| `ids` | CSV UUIDs | Batch read |
| `date_start_after` | date | Events starting after this date |
| `date_start_before` | date | Events starting before this date |
| `budget_status` | string | `on_track`, `watch`, `warning`, `critical`, `over_budget` |
| `search` | string | Full-text search across name, location |

```http
GET /api/events?date_start_after=2025-07-01&date_start_before=2025-09-30&budget_status=warning HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

### 5.4 Enhanced Checklist Listing

**New query params for `GET /api/events/[id]/checklist`:**

| Param | Type | Description |
|-------|------|-------------|
| `modified_after` | ISO 8601 | Incremental sync |
| `status` | string | `pending`, `completed`, `overdue` |
| `phase` | string | `pre_event`, `day_of`, `post_event` |
| `assignee_id` | UUID | Filter by assigned team member |

```http
GET /api/events/abc-123/checklist?status=overdue HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

### 5.5 Idempotency on Existing Write Endpoints

All existing POST and PUT endpoints now accept the `Idempotency-Key` header:

| Endpoint | Method | Idempotency Support |
|----------|--------|-------------------|
| `POST /api/events` | POST | ✅ Added |
| `PUT /api/events/[id]` | PUT | ✅ Added |
| `POST /api/expenses` | POST | ✅ Added |
| `PUT /api/expenses/[id]` | PUT | ✅ Added |
| `POST /api/categories` | POST | ✅ Added |
| `PUT /api/categories/[id]` | PUT | ✅ Added |
| `POST /api/events/[id]/team` | POST | ✅ Added |
| `POST /api/events/[id]/checklist` | POST | ✅ Added |
| `POST /api/import/brex` | POST | ✅ Added |
| `POST /api/import/brex/confirm` | POST | ✅ Added |
| `POST /api/import/pdf` | POST | ✅ Added |

---

## 6. Existing Endpoints Reference

All existing endpoints continue to work as documented. Below is the complete inventory with their auth requirements under the new system.

### Auth & System

| Method | Endpoint | Auth | Scope | Description |
|--------|----------|------|-------|-------------|
| `POST` | `/api/auth/login` | None | — | Login (cookie auth only) |
| `POST` | `/api/auth/logout` | Cookie | — | Logout (cookie auth only) |
| `GET` | `/api/auth/me` | Cookie or Key | `read` | Current session info |

### Fiscal Years

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/fiscal-years` | `read` | List fiscal years |
| `POST` | `/api/fiscal-years` | `write` | Create fiscal year |

### Event Types

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/event-types?fiscal_year_id=...` | `read` | List event types |
| `POST` | `/api/event-types` | `write` | Create event type |
| `GET` | `/api/event-types/[id]` | `read` | Get event type |
| `PUT` | `/api/event-types/[id]` | `write` | Update event type |
| `DELETE` | `/api/event-types/[id]` | `write` | Archive event type |

### Events

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/events` | `read` | List events (paginated) |
| `POST` | `/api/events` | `write` | Create event |
| `GET` | `/api/events/[id]` | `read` | Get event with expenses |
| `PUT` | `/api/events/[id]` | `write` | Update event |
| `DELETE` | `/api/events/[id]` | `write` | Soft delete event |
| `GET` | `/api/events/[id]/roi` | `read` | Get ROI metrics |
| `PUT` | `/api/events/[id]/roi` | `write` | Update ROI metrics |
| `GET` | `/api/events/[id]/team` | `read` | Get event team |
| `POST` | `/api/events/[id]/team` | `write` | Assign team member |
| `PUT` | `/api/events/[id]/team/[aid]` | `write` | Update assignment |
| `DELETE` | `/api/events/[id]/team/[aid]` | `write` | Remove assignment |
| `GET` | `/api/events/[id]/checklist` | `read` | Get checklist items |
| `POST` | `/api/events/[id]/checklist` | `write` | Add checklist item |
| `PUT` | `/api/events/[id]/checklist/[iid]` | `write` | Update checklist item |
| `DELETE` | `/api/events/[id]/checklist/[iid]` | `write` | Delete checklist item |
| `POST` | `/api/events/[id]/checklist/apply-template` | `write` | Apply template |

### Budget Categories

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/categories` | `read` | List categories |
| `POST` | `/api/categories` | `write` | Create category |
| `GET` | `/api/categories/[id]` | `read` | Get category |
| `PUT` | `/api/categories/[id]` | `write` | Update category |
| `DELETE` | `/api/categories/[id]` | `write` | Soft delete |

### Expenses

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/expenses` | `read` | List expenses (paginated) |
| `POST` | `/api/expenses` | `write` | Create expense |
| `GET` | `/api/expenses/[id]` | `read` | Get expense |
| `PUT` | `/api/expenses/[id]` | `write` | Update expense |
| `DELETE` | `/api/expenses/[id]` | `write` | Soft delete |

### Team Members

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/team` | `read` | List team members |
| `POST` | `/api/team` | `write` | Create team member |
| `GET` | `/api/team/[id]` | `read` | Get team member |
| `PUT` | `/api/team/[id]` | `write` | Update team member |
| `DELETE` | `/api/team/[id]` | `write` | Soft delete |

### Checklist Templates

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/checklist-templates` | `read` | List templates |
| `POST` | `/api/checklist-templates` | `write` | Create template |
| `GET` | `/api/checklist-templates/[id]` | `read` | Get template + items |
| `PUT` | `/api/checklist-templates/[id]` | `write` | Update template |
| `DELETE` | `/api/checklist-templates/[id]` | `write` | Soft delete |

### Dashboard

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/dashboard/summary` | `read` | Budget vs actual summary |
| `GET` | `/api/dashboard/roi` | `read` | Aggregate ROI |

### Import / Export

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `POST` | `/api/import/brex` | `write` | Upload Brex CSV |
| `POST` | `/api/import/brex/confirm` | `write` | Confirm import |
| `POST` | `/api/import/pdf` | `write` | Upload PDF receipt |
| `GET` | `/api/export/preview` | `read` | Preview export |
| `GET` | `/api/export/csv` | `read` | Download CSV |
| `GET` | `/api/export/excel` | `read` | Download Excel |

### Settings & Admin

| Method | Endpoint | Scope | Description |
|--------|----------|-------|-------------|
| `GET` | `/api/settings` | `admin` | Get all settings |
| `PUT` | `/api/settings` | `admin` | Update settings |
| `DELETE` | `/api/settings?prompt_key=...` | `admin` | Reset AI prompt |
| `GET` | `/api/admin/errors` | `admin` | List error logs |
| `GET` | `/api/openrouter/models` | `admin` | List AI models |

---

## 7. Webhook System

### 7.1 Event Types

| Event Type | Trigger | Payload Context |
|------------|---------|-----------------|
| `expense.created` | New expense created (single or bulk) | Expense details + event/category |
| `expense.updated` | Expense modified | Changed fields + old/new values |
| `expense.deleted` | Expense soft-deleted | Expense ID + last known state |
| `event.budget_exceeded` | Spending > 100% of budget | Event summary + overage amount |
| `event.budget_warning` | Spending > 80% of budget | Event summary + utilization % |
| `event.upcoming` | Event within configured N days | Event summary + days until |
| `checklist.item_overdue` | Checklist item past due date | Item details + event + assignee |
| `checklist.item_completed` | Checklist item marked complete | Item details + completed_by |
| `import.pending` | New Brex CSV uploaded, awaiting review | Import summary + transaction count |
| `webhook.test` | Manual test via API | Test payload |

### 7.2 Webhook Payload Format

All webhook payloads follow the same envelope:

```json
{
  "id": "uuid-delivery-id",
  "event_type": "expense.created",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    // Event-specific payload (see below)
  }
}
```

### 7.3 Payload Examples

#### `expense.created`
```json
{
  "id": "uuid-delivery-1",
  "event_type": "expense.created",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "expense": {
      "id": "uuid-expense-1",
      "event_id": "uuid-event-1",
      "event_name": "AHCA Conference",
      "category_id": null,
      "amount": 1250.00,
      "expense_date": "2025-06-10",
      "vendor": "Delta Airlines",
      "memo": "Team travel",
      "source_type": "brex",
      "source_reference": "brex-txn-12345"
    },
    "actor": "agent:scrooge",
    "batch_id": "uuid-batch-1"
  }
}
```

#### `event.budget_warning`
```json
{
  "id": "uuid-delivery-2",
  "event_type": "event.budget_warning",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "event": {
      "id": "uuid-event-1",
      "name": "AHCA Conference",
      "budget_amount": 15000.00,
      "actual_spent": 12500.00,
      "remaining": 2500.00,
      "utilization_pct": 83.3
    },
    "threshold_pct": 80,
    "triggered_by": {
      "expense_id": "uuid-expense-latest",
      "amount": 1250.00,
      "vendor": "Delta Airlines"
    }
  }
}
```

#### `event.budget_exceeded`
```json
{
  "id": "uuid-delivery-3",
  "event_type": "event.budget_exceeded",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "event": {
      "id": "uuid-event-1",
      "name": "AHCA Conference",
      "budget_amount": 15000.00,
      "actual_spent": 15500.00,
      "overage": 500.00,
      "utilization_pct": 103.3
    },
    "triggered_by": {
      "expense_id": "uuid-expense-latest",
      "amount": 800.00,
      "vendor": "Freeman Exhibits"
    }
  }
}
```

#### `event.upcoming`
```json
{
  "id": "uuid-delivery-4",
  "event_type": "event.upcoming",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "event": {
      "id": "uuid-event-1",
      "name": "AHCA Conference",
      "date_start": "2025-07-10",
      "date_end": "2025-07-12",
      "location": "Orlando, FL",
      "days_until": 25
    },
    "checklist_summary": {
      "total": 18,
      "completed": 12,
      "overdue": 2
    },
    "budget_summary": {
      "budget_amount": 15000.00,
      "actual_spent": 8500.00,
      "remaining": 6500.00
    },
    "reminder_config": {
      "days_before": [30, 14, 7, 3, 1]
    }
  }
}
```

#### `checklist.item_overdue`
```json
{
  "id": "uuid-delivery-5",
  "event_type": "checklist.item_overdue",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "item": {
      "id": "uuid-item-1",
      "title": "Book travel & hotel",
      "phase": "pre_event",
      "due_date": "2025-06-10",
      "days_overdue": 5,
      "assignee": {
        "id": "uuid-member-1",
        "name": "Redacted Name",
        "email": "redacted@example.invalid"
      }
    },
    "event": {
      "id": "uuid-event-1",
      "name": "AHCA Conference",
      "date_start": "2025-07-10"
    }
  }
}
```

#### `import.pending`
```json
{
  "id": "uuid-delivery-6",
  "event_type": "import.pending",
  "created_at": "2025-06-15T10:30:00Z",
  "api_version": "2025-06-01",
  "data": {
    "import": {
      "source": "brex",
      "total_transactions": 25,
      "duplicates": 2,
      "with_suggestions": 23,
      "total_amount": 45000.00,
      "date_range": {
        "earliest": "2025-05-15",
        "latest": "2025-06-14"
      }
    },
    "actor": "user:treynor"
  }
}
```

### 7.4 Webhook Security

Payloads are signed using HMAC-SHA256 with the webhook secret:

```http
POST /your/webhook/url HTTP/1.1
Content-Type: application/json
X-Webhook-Signature: sha256=a1b2c3d4e5f6...
X-Webhook-Id: uuid-delivery-id
X-Webhook-Timestamp: 1718450000
```

**Verification (Node.js):**
```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret, timestamp) {
  // Reject if timestamp is older than 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > 300) return false;

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}
```

### 7.5 Retry Policy

| Attempt | Delay | Total Elapsed |
|---------|-------|---------------|
| 1 (initial) | Immediate | 0s |
| 2 | 30 seconds | 30s |
| 3 | 2 minutes | 2m 30s |
| 4 | 15 minutes | 17m 30s |
| 5 | 1 hour | 1h 17m 30s |
| 6 (final) | 4 hours | 5h 17m 30s |

After 6 failed attempts, the delivery is marked as `failed`. If a webhook accumulates 50 consecutive failures, it is automatically deactivated (`is_active = false`).

### 7.6 Database Tables

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret_hash TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE status_code IS NULL OR status_code >= 400;
```

---

## 8. Audit Log

### 8.1 Schema

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,          -- 'expense', 'event', 'checklist_item', etc.
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,               -- 'create', 'update', 'delete', 'bulk_create', 'bulk_update'
  actor TEXT NOT NULL,                -- 'user:treynor' or 'agent:scrooge'
  actor_type TEXT NOT NULL,           -- 'user' or 'agent'
  changes JSONB NOT NULL DEFAULT '{}', -- { field: { old: x, new: y } }
  metadata JSONB DEFAULT '{}',        -- Extra context (idempotency key, batch ID, source)
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_type_created ON audit_log(entity_type, created_at);
```

### 8.2 Actor Identity Resolution

| Auth Method | Actor Value | Actor Type |
|-------------|-------------|------------|
| Cookie JWT (Treynor) | `user:treynor` | `user` |
| API Key (Scrooge) | `agent:scrooge` | `agent` |
| API Key (future agent) | `agent:{agent_name}` | `agent` |
| System (cron, webhook retry) | `system:counting-house` | `system` |

### 8.3 What Gets Logged

| Entity Type | Actions Logged |
|-------------|---------------|
| `expense` | create, update, delete, bulk_create, bulk_update |
| `event` | create, update, delete |
| `event_type` | create, update, archive |
| `budget_category` | create, update, delete |
| `team_member` | create, update, delete |
| `event_team_assignment` | create, update, delete |
| `checklist_item` | create, update, delete, complete |
| `checklist_template` | create, update, delete |
| `setting` | update |
| `webhook` | create, update, delete |
| `api_key` | create, revoke |
| `import` | brex_upload, brex_confirm, pdf_upload |

### 8.4 Changes Format

For **creates**, all non-null fields are recorded as `{ old: null, new: value }`:
```json
{
  "event_id": { "old": null, "new": "uuid-event-1" },
  "amount": { "old": null, "new": 1250.00 },
  "vendor": { "old": null, "new": "Delta Airlines" }
}
```

For **updates**, only changed fields are recorded:
```json
{
  "amount": { "old": 1200.00, "new": 1500.00 },
  "memo": { "old": null, "new": "Corrected amount" }
}
```

For **deletes**, the `deleted_at` field is recorded:
```json
{
  "deleted_at": { "old": null, "new": "2025-06-15T10:30:00Z" }
}
```

---

## 9. Scrooge-Specific Operations

### 9.1 Monday.com Sync

Scrooge acts as middleware between Monday.com boards and Counting House. These endpoints let Scrooge push/pull data.

#### `POST /api/integrations/monday/sync`

Trigger a sync of event data from Monday.com.

**Auth:** `write` scope

**Request:**
```http
POST /api/integrations/monday/sync HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: monday-sync-2025-06-15
Content-Type: application/json
```

**Request Body:**
```json
{
  "board_id": "monday-board-12345",
  "items": [
    {
      "monday_item_id": "monday-item-001",
      "event_id": "uuid-event-1",
      "sync_fields": {
        "name": "AHCA National Conference",
        "date_start": "2025-07-10",
        "date_end": "2025-07-12",
        "location": "Orlando, FL",
        "budget_amount": 15000.00,
        "status": "Confirmed"
      }
    },
    {
      "monday_item_id": "monday-item-002",
      "event_id": null,
      "sync_fields": {
        "name": "New Event from Monday",
        "event_type_name": "Regional",
        "quarter": "Q4",
        "date_start": "2025-11-05",
        "budget_amount": 8000.00
      }
    }
  ],
  "sync_direction": "monday_to_counting_house",
  "conflict_resolution": "monday_wins"
}
```

**Response `200 OK`:**
```json
{
  "results": [
    {
      "monday_item_id": "monday-item-001",
      "event_id": "uuid-event-1",
      "action": "updated",
      "changes": {
        "location": { "old": "TBD", "new": "Orlando, FL" }
      }
    },
    {
      "monday_item_id": "monday-item-002",
      "event_id": "uuid-new-event",
      "action": "created",
      "changes": {}
    }
  ],
  "meta": {
    "total_items": 2,
    "created": 1,
    "updated": 1,
    "skipped": 0,
    "errors": 0
  },
  "audit_id": "uuid-audit-monday-sync"
}
```

#### `GET /api/integrations/monday/mapping`

Get the current mapping between Monday.com items and Counting House events.

**Response `200 OK`:**
```json
{
  "mappings": [
    {
      "monday_item_id": "monday-item-001",
      "monday_board_id": "monday-board-12345",
      "event_id": "uuid-event-1",
      "event_name": "AHCA National Conference",
      "last_synced_at": "2025-06-15T10:30:00Z",
      "sync_status": "synced"
    }
  ],
  "meta": { "total": 45 }
}
```

#### `PUT /api/integrations/monday/mapping`

Create or update a mapping between a Monday.com item and a Counting House event.

**Request Body:**
```json
{
  "monday_item_id": "monday-item-003",
  "monday_board_id": "monday-board-12345",
  "event_id": "uuid-event-3"
}
```

**Database Table:**
```sql
CREATE TABLE monday_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monday_item_id TEXT NOT NULL UNIQUE,
  monday_board_id TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending', -- 'synced', 'pending', 'conflict', 'error'
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 9.2 Slack Notification Triggers

Scrooge sends Slack notifications via its own Slack integration, but these endpoints let Counting House request that Scrooge send specific notifications.

#### `POST /api/notifications/slack`

Queue a Slack notification to be sent by Scrooge.

**Auth:** `write` scope

**Request:**
```http
POST /api/notifications/slack HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Idempotency-Key: slack-budget-alert-uuid-event-1
Content-Type: application/json
```

**Request Body:**
```json
{
  "channel": "#event-marketing",
  "notification_type": "budget_warning",
  "priority": "high",
  "data": {
    "event_id": "uuid-event-1",
    "event_name": "AHCA Conference",
    "budget_amount": 15000.00,
    "actual_spent": 12500.00,
    "utilization_pct": 83.3,
    "message": "⚠️ AHCA Conference is at 83.3% budget utilization ($2,500 remaining)"
  }
}
```

**Response `202 Accepted`:**
```json
{
  "notification": {
    "id": "uuid-notification-1",
    "status": "queued",
    "channel": "#event-marketing",
    "notification_type": "budget_warning",
    "queued_at": "2025-06-15T10:30:00Z"
  }
}
```

**Notification Types:**

| Type | Description | Default Channel |
|------|-------------|-----------------|
| `budget_warning` | Event approaching budget limit | `#event-marketing` |
| `budget_exceeded` | Event over budget | `#event-marketing` |
| `event_reminder` | Upcoming event reminder | `#event-marketing` |
| `checklist_overdue` | Overdue tasks summary | `#event-marketing` |
| `weekly_summary` | Weekly budget/event summary | `#event-marketing` |
| `import_ready` | Brex import ready for review | `#event-marketing` |
| `custom` | Custom message from Scrooge | Specified in request |

**Database Table:**
```sql
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',    -- 'low', 'normal', 'high', 'urgent'
  data JSONB NOT NULL,
  status TEXT DEFAULT 'queued',      -- 'queued', 'sent', 'failed'
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### 9.3 Document Generation Triggers

Request that Counting House generate specific documents.

#### `POST /api/events/[id]/guide/generate`

Generate an event guide (from the PRD expansion — The Firm Phase 3).

**Auth:** `write` scope

**Request:**
```http
POST /api/events/abc-123/guide/generate HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Content-Type: application/json
```

**Request Body:**
```json
{
  "format": "markdown",
  "include_sections": [
    "overview",
    "budget",
    "team",
    "checklist",
    "logistics",
    "objectives"
  ],
  "ai_enhance": true
}
```

**Response `202 Accepted`:**
```json
{
  "guide": {
    "id": "uuid-guide-1",
    "event_id": "abc-123",
    "status": "generating",
    "version": 3,
    "estimated_time_seconds": 15
  }
}
```

**Poll for completion:**
```http
GET /api/events/abc-123/guide HTTP/1.1
x-api-key: sk_scrooge_live_xxx
```

**Response `200 OK`:**
```json
{
  "guide": {
    "id": "uuid-guide-1",
    "event_id": "abc-123",
    "status": "complete",
    "version": 3,
    "content_markdown": "# AHCA National Conference — Event Guide\n\n...",
    "generated_at": "2025-06-15T10:30:15Z",
    "generation_time_ms": 12500,
    "ai_model": "anthropic/claude-sonnet-4-20250514"
  }
}
```

#### `POST /api/export/report`

Generate a custom budget report.

**Auth:** `read` scope

**Request:**
```http
POST /api/export/report HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Content-Type: application/json
```

**Request Body:**
```json
{
  "report_type": "quarterly_summary",
  "fiscal_year_id": "uuid-fy-2026",
  "quarter": "Q2",
  "format": "pdf",
  "include": [
    "budget_summary",
    "expense_breakdown",
    "roi_summary",
    "event_list",
    "variance_analysis"
  ]
}
```

**Response `202 Accepted`:**
```json
{
  "report": {
    "id": "uuid-report-1",
    "status": "generating",
    "estimated_time_seconds": 30
  }
}
```

---

### 9.4 Event Reminder Scheduling

Configure automated reminder schedules for events.

#### `GET /api/reminders/config`

Get the current reminder configuration.

**Auth:** `admin` scope

**Response `200 OK`:**
```json
{
  "config": {
    "enabled": true,
    "reminder_days": [30, 14, 7, 3, 1],
    "channels": ["webhook", "slack"],
    "quiet_hours": {
      "start": "22:00",
      "end": "08:00",
      "timezone": "America/Phoenix"
    },
    "checklist_overdue_check_interval_hours": 24,
    "budget_warning_threshold_pct": 80,
    "budget_critical_threshold_pct": 95
  }
}
```

#### `PUT /api/reminders/config`

Update reminder configuration.

**Auth:** `admin` scope

**Request Body:**
```json
{
  "enabled": true,
  "reminder_days": [30, 14, 7, 3, 1],
  "channels": ["webhook", "slack"],
  "budget_warning_threshold_pct": 75,
  "budget_critical_threshold_pct": 90
}
```

**Response `200 OK`:**
```json
{
  "config": { ... },
  "audit_id": "uuid-audit-config-update"
}
```

#### `POST /api/reminders/check`

Manually trigger a reminder check (Scrooge can call this on a schedule).

**Auth:** `write` scope

**Request:**
```http
POST /api/reminders/check HTTP/1.1
x-api-key: sk_scrooge_live_xxx
Content-Type: application/json
```

**Request Body:**
```json
{
  "check_types": ["upcoming_events", "overdue_checklists", "budget_warnings"]
}
```

**Response `200 OK`:**
```json
{
  "results": {
    "upcoming_events": {
      "found": 3,
      "notifications_sent": 2,
      "already_notified": 1,
      "events": [
        { "id": "uuid-1", "name": "AHCA Conference", "days_until": 25, "notified": true },
        { "id": "uuid-2", "name": "AHLA Summit", "days_until": 7, "notified": true },
        { "id": "uuid-3", "name": "LeadingAge", "days_until": 14, "notified": false, "reason": "already_sent_today" }
      ]
    },
    "overdue_checklists": {
      "found": 5,
      "notifications_sent": 5,
      "items": [
        { "id": "uuid-item-1", "title": "Book travel", "event_name": "AHCA Conference", "days_overdue": 3 }
      ]
    },
    "budget_warnings": {
      "found": 2,
      "notifications_sent": 2,
      "events": [
        { "id": "uuid-1", "name": "AHLA Summit", "utilization_pct": 97.5, "status": "critical" }
      ]
    }
  },
  "checked_at": "2025-06-15T10:30:00Z"
}
```

---

## 10. Rate Limiting & Error Handling

### 10.1 Rate Limits

| Auth Type | Limit | Window | Scope |
|-----------|-------|--------|-------|
| Cookie (browser) | 100 requests | per minute | per IP |
| API Key (agent) | 300 requests | per minute | per API key |
| Unauthenticated | 10 requests | per minute | per IP |
| Login endpoint | 5 attempts | per minute | per IP |
| Bulk endpoints | 10 requests | per minute | per API key |
| Import endpoints | 5 requests | per minute | per API key |

**Rate limit headers (included in every response):**
```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1718450060
X-RateLimit-Scope: api_key
```

**Rate limited response `429 Too Many Requests`:**
```json
{
  "error": "Rate limit exceeded. Try again in 23 seconds.",
  "code": "RATE_LIMITED",
  "retry_after_seconds": 23
}
```

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 23
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1718450060
```

### 10.2 Error Response Catalog

#### Validation Errors (400)

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_FAILED",
  "details": {
    "amount": "Must be a positive number",
    "event_id": "Invalid UUID format",
    "expense_date": "Date cannot be in the future"
  }
}
```

#### Authentication Errors (401)

```json
// Missing auth
{
  "error": "Authentication required. Provide x-api-key header or login via /api/auth/login.",
  "code": "AUTH_REQUIRED"
}

// Invalid key
{
  "error": "Invalid API key",
  "code": "AUTH_INVALID_KEY"
}

// Expired key
{
  "error": "API key has expired. Contact admin to renew.",
  "code": "AUTH_KEY_EXPIRED"
}
```

#### Permission Errors (403)

```json
{
  "error": "API key does not have 'admin' permission",
  "code": "AUTH_INSUFFICIENT_PERMISSIONS",
  "required_scope": "admin",
  "current_scopes": ["read", "write"]
}
```

#### Not Found (404)

```json
{
  "error": "Event not found",
  "code": "NOT_FOUND",
  "entity_type": "event",
  "entity_id": "uuid-that-doesnt-exist"
}
```

#### Conflict (409)

```json
// Duplicate source reference
{
  "error": "Expense with source_reference 'brex-txn-12345' already exists",
  "code": "CONFLICT_DUPLICATE",
  "existing_id": "uuid-existing-expense"
}

// Idempotency key conflict (different request body with same key)
{
  "error": "Idempotency key already used with different request parameters",
  "code": "CONFLICT_IDEMPOTENCY"
}
```

#### Unprocessable Entity (422)

```json
// Business logic error
{
  "error": "Cannot assign expense to both an event and a category",
  "code": "UNPROCESSABLE_XOR_CONSTRAINT"
}

// Archived entity
{
  "error": "Cannot add expense to archived event type",
  "code": "UNPROCESSABLE_ARCHIVED_ENTITY",
  "entity_type": "event_type",
  "entity_id": "uuid-archived"
}
```

#### Server Error (500)

```json
{
  "error": "Internal server error",
  "code": "INTERNAL_ERROR",
  "request_id": "uuid-request-id",
  "message": "An unexpected error occurred. This has been logged."
}
```

### 10.3 Circuit Breaker (Agent Best Practice)

Scrooge should implement client-side circuit breaking:

| State | Condition | Behavior |
|-------|-----------|----------|
| **Closed** (normal) | < 5 failures in 60s | Requests flow normally |
| **Open** (tripped) | ≥ 5 failures in 60s | All requests fail-fast for 30s |
| **Half-Open** (probe) | After 30s cooldown | 1 probe request allowed; success → Closed, failure → Open |

**Failures counted:** `5xx` responses, timeouts (> 10s), connection errors.  
**Not counted:** `4xx` responses (client errors).

---

## 11. Database Migrations

### Migration: Add API Key Support

```sql
-- 001_add_api_keys.sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,
  agent_name TEXT NOT NULL,
  label TEXT,
  permissions TEXT[] DEFAULT '{read,write}',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_agent ON api_keys(agent_name);
```

### Migration: Add Audit Log

```sql
-- 002_add_audit_log.sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_actor ON audit_log(actor);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_created ON audit_log(created_at);
CREATE INDEX idx_audit_type_created ON audit_log(entity_type, created_at);
```

### Migration: Add Idempotency Keys

```sql
-- 003_add_idempotency_keys.sql
CREATE TABLE idempotency_keys (
  key TEXT NOT NULL,
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  PRIMARY KEY (key, api_key_id)
);

-- Auto-cleanup expired keys
CREATE INDEX idx_idempotency_expires ON idempotency_keys(expires_at);
```

### Migration: Add Webhooks

```sql
-- 004_add_webhooks.sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES api_keys(id),
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,
  secret_hash TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  failure_count INTEGER DEFAULT 0,
  last_delivery_at TIMESTAMPTZ,
  last_delivery_status INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt INTEGER DEFAULT 1,
  delivered_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at)
  WHERE status_code IS NULL OR status_code >= 400;
```

### Migration: Add Monday.com Mappings

```sql
-- 005_add_monday_mappings.sql
CREATE TABLE monday_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monday_item_id TEXT NOT NULL UNIQUE,
  monday_board_id TEXT NOT NULL,
  event_id UUID NOT NULL REFERENCES events(id),
  last_synced_at TIMESTAMPTZ,
  sync_status TEXT DEFAULT 'pending',
  sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monday_event ON monday_mappings(event_id);
CREATE INDEX idx_monday_board ON monday_mappings(monday_board_id);
```

### Migration: Add Notification Queue

```sql
-- 006_add_notification_queue.sql
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  data JSONB NOT NULL,
  status TEXT DEFAULT 'queued',
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_status ON notification_queue(status) WHERE status = 'queued';
CREATE INDEX idx_notifications_type ON notification_queue(notification_type);
```

### Migration: Add Reminder Config

```sql
-- 007_add_reminder_config.sql
-- Uses existing app_settings table with keys:
--   reminders.enabled (boolean)
--   reminders.days (JSON array)
--   reminders.channels (JSON array)
--   reminders.quiet_hours_start (time)
--   reminders.quiet_hours_end (time)
--   reminders.timezone (string)
--   reminders.budget_warning_pct (number)
--   reminders.budget_critical_pct (number)
--   reminders.checklist_check_hours (number)

-- Reminder tracking (prevent duplicate notifications)
CREATE TABLE reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id),
  reminder_type TEXT NOT NULL,     -- 'upcoming', 'checklist_overdue', 'budget_warning'
  reminder_key TEXT NOT NULL,      -- Unique: e.g., 'upcoming:uuid:30days' or 'budget:uuid:80pct'
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reminder_key)
);
```

---

## 12. Implementation Priority

### Phase 1 — Foundation (Must-Have) 🔴

**Goal:** Enable Scrooge to authenticate, read data, and create expenses safely.

| # | Feature | Endpoints | Effort | Dependencies |
|---|---------|-----------|--------|-------------|
| 1.1 | API Key Authentication | Middleware update | 4h | `api_keys` table |
| 1.2 | Health Check | `GET /api/health` | 1h | None |
| 1.3 | Idempotency Keys | All POST/PUT endpoints | 4h | `idempotency_keys` table |
| 1.4 | Bulk Expense Create | `POST /api/expenses/bulk` | 3h | 1.1, 1.3 |
| 1.5 | Audit Logging | Middleware + `GET /api/audit-log` | 6h | `audit_log` table |
| 1.6 | `modified_after` param | All GET list endpoints | 3h | None |

**Total Phase 1:** ~21 hours (3 dev days)

**Acceptance Criteria:**
- [ ] Scrooge can authenticate with API key
- [ ] Scrooge can create expenses in bulk with safe retries
- [ ] All mutations are audit-logged with actor identity
- [ ] Incremental sync is possible via `modified_after`
- [ ] Health check returns system status

---

### Phase 2 — Intelligence (High Value) 🟡

**Goal:** Enable proactive monitoring, alerts, and external integrations.

| # | Feature | Endpoints | Effort | Dependencies |
|---|---------|-----------|--------|-------------|
| 2.1 | Webhook System | `POST/GET/PUT/DELETE /api/webhooks` | 8h | `webhooks` + `webhook_deliveries` tables |
| 2.2 | Budget Alert Webhooks | Auto-fire on expense create/update | 4h | 2.1 |
| 2.3 | Upcoming Events | `GET /api/events/upcoming` | 3h | None |
| 2.4 | Event Summary | `GET /api/events/[id]/summary` | 3h | None |
| 2.5 | Global Stats | `GET /api/stats` | 3h | None |
| 2.6 | Bulk Expense Update | `PUT /api/expenses/bulk` | 3h | 1.3, 1.5 |
| 2.7 | Batch Read (`ids`) | All GET list endpoints | 2h | None |
| 2.8 | Reminder System | `GET/PUT /api/reminders/config`, `POST /api/reminders/check` | 6h | `reminder_log` table |

**Total Phase 2:** ~32 hours (4 dev days)

**Acceptance Criteria:**
- [ ] Webhooks fire on expense creation and budget threshold crossing
- [ ] Scrooge can query upcoming events with checklist status
- [ ] Event summaries available for Slack reporting
- [ ] Reminder system prevents duplicate notifications

---

### Phase 3 — Integration & Polish (Nice to Have) 🟢

**Goal:** Full external system integration and document generation.

| # | Feature | Endpoints | Effort | Dependencies |
|---|---------|-----------|--------|-------------|
| 3.1 | Monday.com Sync | `POST /api/integrations/monday/sync`, mapping endpoints | 8h | `monday_mappings` table |
| 3.2 | Slack Notifications | `POST /api/notifications/slack` | 4h | `notification_queue` table |
| 3.3 | Document Generation | `POST /api/events/[id]/guide/generate` | 8h | Firm Phase 3 |
| 3.4 | Report Generation | `POST /api/export/report` | 6h | None |
| 3.5 | Enhanced Search | Full-text search across entities | 4h | PostgreSQL FTS |
| 3.6 | Enhanced Filters | `budget_status`, `date_start_after/before` on events | 2h | None |
| 3.7 | Checklist Overdue Webhooks | Auto-fire on daily check | 3h | 2.1, 2.8 |

**Total Phase 3:** ~35 hours (5 dev days)

**Acceptance Criteria:**
- [ ] Monday.com board syncs bidirectionally through Scrooge
- [ ] Scrooge can trigger Slack notifications with rich formatting
- [ ] Event guides generate automatically before events
- [ ] Quarterly reports available on demand

---

### Implementation Timeline

```
Week 1: Phase 1 (Foundation)
  ├── Day 1: API keys + health check + idempotency migration
  ├── Day 2: Bulk expense create + audit logging
  └── Day 3: modified_after + testing + deployment

Week 2-3: Phase 2 (Intelligence)
  ├── Day 1-2: Webhook system (registration + delivery)
  ├── Day 3: Budget alert webhooks + event summary
  ├── Day 4: Upcoming events + global stats + batch reads
  └── Day 5: Reminder system + bulk update

Week 4-5: Phase 3 (Integration)
  ├── Day 1-2: Monday.com sync
  ├── Day 3: Slack notifications
  ├── Day 4-5: Document + report generation
  └── Day 6: Search + filter enhancements
```

---

## Appendix A: Scrooge Quick Start

### 1. Authenticate

```bash
curl -s https://example.invalid/api/health
# Verify system is healthy

curl -s https://example.invalid/api/auth/me \
  -H "x-api-key: sk_scrooge_live_xxx"
# Verify API key works
```

### 2. Initial Data Sync

```bash
# Get all events
curl -s "https://example.invalid/api/events?per_page=200" \
  -H "x-api-key: sk_scrooge_live_xxx"

# Get all expenses
curl -s "https://example.invalid/api/expenses?per_page=200" \
  -H "x-api-key: sk_scrooge_live_xxx"

# Get dashboard summary
curl -s "https://example.invalid/api/dashboard/summary" \
  -H "x-api-key: sk_scrooge_live_xxx"
```

### 3. Register Webhook

```bash
curl -s -X POST "https://example.invalid/api/webhooks" \
  -H "x-api-key: sk_scrooge_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://scrooge.example.com/webhook",
    "events": ["expense.created", "event.budget_exceeded", "event.budget_warning"],
    "secret": "whsec_your_secret_here",
    "description": "Scrooge production"
  }'
```

### 4. Incremental Sync (run periodically)

```bash
# Use server_time from last sync as modified_after
curl -s "https://example.invalid/api/expenses?modified_after=2025-06-14T10:30:00Z" \
  -H "x-api-key: sk_scrooge_live_xxx"
```

### 5. Bulk Create Expenses

```bash
curl -s -X POST "https://example.invalid/api/expenses/bulk" \
  -H "x-api-key: sk_scrooge_live_xxx" \
  -H "Idempotency-Key: brex-import-2025-06-15-batch-1" \
  -H "Content-Type: application/json" \
  -d '{
    "expenses": [
      {
        "event_id": "uuid-event-1",
        "amount": 1250.00,
        "expense_date": "2025-06-10",
        "vendor": "Delta Airlines",
        "source_type": "brex",
        "source_reference": "brex-txn-12345"
      }
    ]
  }'
```

---

## Appendix B: OpenAPI Spec Location

A machine-readable OpenAPI 3.1 spec will be generated from this document and placed at:

```
GET /api/openapi.json
```

This allows Scrooge to self-discover available endpoints and validate requests at runtime.

---

*"Are there no prisons? Are there no workhouses? Then the Counting House's API must serve them all."*  
— Scrooge API Spec v1.0.0
