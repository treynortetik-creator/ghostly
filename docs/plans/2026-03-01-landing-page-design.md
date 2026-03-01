# Landing Page & Waitlist Design

**Date:** 2026-03-01
**Status:** Approved

## Overview

Public landing page at `/` for pre-launch waitlist signups. Unauthenticated visitors see the pitch + waitlist form. Authenticated users get redirected to `/dashboard`.

## Decisions

- **Route:** Landing page at `/` (root). Dashboard moves from `/` to `/dashboard`.
- **Form fields:** email (required), name (required), company (optional), role (optional)
- **Structure:** Hero with CTA → 5 expandable feature sections → footer CTA
- **Icons:** Lucide icons throughout (matching app sidebar style)
- **Style:** Dark ethereal theme matching existing login page (spectral gradients, blur orbs, glass effects)
- **No auth required:** Landing page and waitlist API are fully public

## Page Layout

### Nav
- Logo on the left, "Sign In" link on the right
- Minimal, no clutter

### Hero (above the fold)
- Large Ghostly logo
- Headline: "The Invisible AI Agent Running Your Events"
- 2-line subtext pitching the AI agent as the core product
- Inline waitlist form: name, email, company (optional), role (optional), submit button
- Success/error state feedback inline

### Feature Sections (expandable cards)
Five feature cards, single column, each with:
- Lucide icon + title + one-line teaser (always visible)
- Click to expand: 2-3 sentence deeper description
- First card (AI Agent) is visually prominent — spectral glow border

1. **AI-Powered Event Agent** (Bot icon) — Core feature, most prominent
   - Always-on agent for natural language queries, task automation, context-aware suggestions
2. **Automated Workflows** (Zap icon)
   - Notifications, reminders, daily/weekly digests that run themselves
3. **Budget & Expense Intelligence** (DollarSign icon)
   - Real-time tracking, categorization, ROI analysis, budget alerts
4. **Slack & Integrations** (MessageSquare icon)
   - Meet your team where they work, slash commands, bot DMs
5. **MCP Compatible** (Link2 icon)
   - Connect your own AI agent via Model Context Protocol

### Footer CTA
- Second instance of waitlist form (for scrollers)
- Ghostly tagline + copyright

## Database

### `waitlist` table
| Column | Type | Constraints |
|--------|------|-------------|
| id | uuid | PK, default gen_random_uuid() |
| email | text | NOT NULL, UNIQUE |
| name | text | NOT NULL |
| company | text | nullable |
| role | text | nullable |
| source | text | nullable (UTM tracking) |
| created_at | timestamptz | default now() |

## API

### `POST /api/waitlist` (public, no auth)
- Validates email format and required fields
- Checks for duplicate email (returns success anyway — no info leak)
- Inserts row into `waitlist` table
- Returns `{ success: true }`

## Routing Changes

1. Move `src/app/page.tsx` (dashboard) → `src/app/dashboard/page.tsx`
2. New landing page → `src/app/page.tsx`
3. Update AppShell nav: Dashboard href changes from `/` to `/dashboard`
4. Middleware:
   - Add `/` to public routes
   - Add `/api/waitlist` to public API routes
   - Authenticated users hitting `/` → redirect to `/dashboard`
5. Login page redirect: after login, redirect to `/dashboard` instead of `/`

## Files to Create/Modify

**Create:**
- `src/app/page.tsx` — Landing page component
- `src/app/api/waitlist/route.ts` — Waitlist API endpoint
- `src/app/dashboard/page.tsx` — Moved dashboard

**Modify:**
- `src/middleware.ts` — Public routes + auth redirect logic
- `src/components/layout/AppShell.tsx` — Dashboard href → `/dashboard`
- `src/app/login/page.tsx` — Post-login redirect → `/dashboard`
