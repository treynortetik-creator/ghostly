# Landing Page & Waitlist Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a public landing page at `/` with waitlist signup, feature highlights, and auth-based routing so authenticated users go to the dashboard.

**Architecture:** Server-rendered landing page at root route. Dashboard moves to `/dashboard`. Middleware handles auth redirect. Waitlist data stored in Supabase `waitlist` table. Single public API endpoint for signups.

**Tech Stack:** Next.js 16, React 19, Supabase PostgreSQL, Tailwind CSS 4, Lucide icons

---

### Task 1: Database Migration — `waitlist` table

**Files:**
- Supabase migration via MCP

**Step 1: Apply migration**

Use the Supabase MCP `apply_migration` tool:

```sql
-- Waitlist signups for pre-launch
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text not null,
  company text,
  role text,
  source text,
  created_at timestamptz not null default now()
);

-- Prevent duplicate signups
create unique index if not exists waitlist_email_unique on public.waitlist (lower(email));

-- RLS: no public read/write (API uses service role or bypasses RLS)
alter table public.waitlist enable row level security;
```

Migration name: `add_waitlist_table`

**Step 2: Verify**

Use Supabase MCP `list_tables` to confirm `waitlist` appears in the `public` schema.

---

### Task 2: Waitlist API Route

**Files:**
- Create: `src/app/api/waitlist/route.ts`

**Step 1: Create the API route**

```typescript
/**
 * POST /api/waitlist — Public waitlist signup
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, role, source } = body;

    // Validate required fields
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Valid email is required' },
        { status: 400 }
      );
    }

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase.from('waitlist').upsert(
      {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        company: company?.trim() || null,
        role: role?.trim() || null,
        source: source?.trim() || null,
      },
      { onConflict: 'email' }
    );

    if (error) {
      console.error('Waitlist insert error:', error);
      // Don't leak whether email exists — always return success
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Something went wrong' },
      { status: 500 }
    );
  }
}
```

Note: Uses `upsert` with `onConflict: 'email'` so duplicate signups don't error — they silently update. No information leak about whether an email is already registered.

---

### Task 3: Move Dashboard & Update Routing

**Files:**
- Move: `src/app/page.tsx` → `src/app/dashboard/page.tsx`
- Modify: `src/components/layout/AppShell.tsx` (line 44)
- Modify: `src/app/login/page.tsx` (line 197)
- Modify: `src/app/auth/callback/route.ts` (line 80)
- Modify: `src/middleware.ts` (lines 47, 213-226)

**Step 1: Move dashboard**

Copy `src/app/page.tsx` to `src/app/dashboard/page.tsx` (exact same content, no changes needed).

Delete `src/app/page.tsx` (it will be replaced by the landing page in Task 4).

**Step 2: Update AppShell nav link**

In `src/components/layout/AppShell.tsx`, change line 44:

```typescript
// Before:
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
// After:
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
```

**Step 3: Update login redirect**

In `src/app/login/page.tsx`, change line 197:

```typescript
// Before:
      router.push('/');
// After:
      router.push('/dashboard');
```

**Step 4: Update auth callback redirect**

In `src/app/auth/callback/route.ts`, change line 80:

```typescript
// Before:
  return NextResponse.redirect(new URL('/', request.url))
// After:
  return NextResponse.redirect(new URL('/dashboard', request.url))
```

**Step 5: Update middleware**

In `src/middleware.ts`:

a) Add `/api/waitlist` to `PUBLIC_API_ROUTES` array (after line 56):
```typescript
  '/api/integrations/slack/commands',
  '/api/waitlist',
```

b) Update the public route handling. In the `isPublicRoute` function block (around line 213-226), update the `/login` redirect logic. When an authenticated user hits `/`, redirect them to `/dashboard`:

Replace the existing block at line 213:
```typescript
  if (isPublicRoute(pathname)) {
    if (pathname === '/login') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        const isValid = await verifyTokenFromCookie(token);
        if (isValid) {
          return withRequestId(NextResponse.redirect(new URL('/', request.url)), requestId);
        }
      }
    }
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId
    );
  }
```

With:
```typescript
  if (isPublicRoute(pathname)) {
    // Authenticated users on public pages get redirected to dashboard
    if (pathname === '/login' || pathname === '/') {
      const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
      if (token) {
        const isValid = await verifyTokenFromCookie(token);
        if (isValid) {
          return withRequestId(NextResponse.redirect(new URL('/dashboard', request.url)), requestId);
        }
      }
    }
    return withRequestId(
      NextResponse.next({ request: { headers: requestHeaders } }),
      requestId
    );
  }
```

Also add `/` to `PUBLIC_ROUTES`:
```typescript
const PUBLIC_ROUTES = ['/login', '/'];
```

And update the unauthenticated redirect (around line 288-291) to point to `/login` still (no change needed there — it already redirects to `/login`).

---

### Task 4: Landing Page

**Files:**
- Create: `src/app/page.tsx`

**Step 1: Create the landing page**

Use the `frontend-design` skill to create a polished landing page. The page must be a `"use client"` component (it has form state).

Key requirements for the design:
- Match the existing Ghostly dark aesthetic: `ghost-dark`, `spectral`, `glass`, `glass-shadow`, `glass-glow` utility classes from `globals.css`
- Background: same style as login page — gradient with blur orbs (`bg-spectral/5 rounded-full blur-3xl`)
- Lucide icons only (Bot, Zap, DollarSign, MessageSquare, Link2, ChevronDown, ChevronUp, CheckCircle, AlertCircle)
- Logo: `<Image src="/images/ghostly-logo.jpg" alt="Ghostly" width={96} height={96} className="rounded-2xl" />`

**Layout sections:**

**A) Minimal Nav Bar**
- Logo + "Ghostly" on left
- "Sign In" link on right → `/login`
- Fixed/sticky at top, glass background

**B) Hero Section** (full viewport height)
- Large logo
- Headline: "The Invisible AI Agent Running Your Events"
- Subtext: pitch the AI agent as core product (2 lines max)
- Inline waitlist form:
  - Row 1: Name input + Email input
  - Row 2: Company input (optional placeholder) + Role input (optional placeholder)
  - Row 3: Submit button (full width or prominent)
- Success state: green confirmation message with CheckCircle
- Error state: red error with AlertCircle
- Form submits to `POST /api/waitlist`

**C) Feature Section** — 5 expandable cards
Each card: glass styling, Lucide icon, title, one-line teaser. Click expands to 2-3 sentence description.

Cards (in order):
1. **AI-Powered Event Agent** — `Bot` icon — spectral glow border (hero feature)
   - Teaser: "Your always-on event manager that thinks, plans, and executes."
   - Expanded: "Ask questions in natural language, automate repetitive tasks, and get context-aware suggestions across your entire event portfolio. Ghostly's AI agent understands your events, budgets, contacts, and timelines — so you can focus on strategy, not spreadsheets."

2. **Automated Workflows** — `Zap` icon
   - Teaser: "Notifications, reminders, and digests that run themselves."
   - Expanded: "Set up daily and weekly digests, automatic task reminders, and budget alerts. Ghostly proactively keeps your team informed without anyone having to check the dashboard."

3. **Budget & Expense Intelligence** — `DollarSign` icon
   - Teaser: "Real-time tracking with categorization and ROI analysis."
   - Expanded: "Track expenses across events, categories, and quarters. Get automatic budget alerts before you overspend, and measure ROI across your entire event portfolio."

4. **Slack & Integrations** — `MessageSquare` icon
   - Teaser: "Meet your team where they already work."
   - Expanded: "Connect Slack for instant notifications, slash commands, and direct bot conversations. Route different notification types to different channels, and link events to dedicated Slack channels."

5. **MCP Compatible** — `Link2` icon
   - Teaser: "Connect your own AI agent via Model Context Protocol."
   - Expanded: "Ghostly exposes a full MCP server, so you can plug it into Claude Desktop, Cursor, or any MCP-compatible AI agent. Use your own tools to query events, manage budgets, and automate workflows."

**D) Footer CTA**
- Second waitlist form (same component, reused)
- "Join the waitlist" heading
- Below: `ghostly.ai` tagline + copyright line

**E) Animations**
- `animate-fade-in` on sections as they enter
- Smooth expand/collapse on feature cards (CSS transition on max-height or use state + conditional render)

---

### Task 5: Verification & Commit

**Step 1: Run TypeScript check**
```bash
npx tsc --noEmit
```
Expected: Exit code 0

**Step 2: Run build**
```bash
npm run build
```
Expected: Successful build, `/` renders as static page, `/dashboard` still works

**Step 3: Commit**
```bash
git add src/app/page.tsx src/app/dashboard/page.tsx src/app/api/waitlist/route.ts \
  src/components/layout/AppShell.tsx src/app/login/page.tsx \
  src/app/auth/callback/route.ts src/middleware.ts \
  docs/plans/2026-03-01-landing-page-design.md \
  docs/plans/2026-03-01-landing-page-plan.md

git commit -m "feat: public landing page with waitlist signup

- Landing page at / with hero, feature highlights, waitlist form
- Dashboard moved to /dashboard
- Waitlist table + public API endpoint
- Auth-based routing: logged-in users redirect to dashboard
- Expandable feature cards with AI agent as hero feature
- MCP compatibility highlighted for power users"
```

**Step 4: Push**
```bash
git push origin main
```
