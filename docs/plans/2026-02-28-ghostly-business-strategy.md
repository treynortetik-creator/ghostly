# Ghostly — Business Strategy & Product Roadmap

**Date:** 2026-02-28
**Status:** Draft
**Author:** Treynor + Claude (market research & analysis)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Analysis](#2-market-analysis)
3. [Competitive Landscape](#3-competitive-landscape)
4. [Target Audience & Positioning](#4-target-audience--positioning)
5. [Feature Audit & Roadmap](#5-feature-audit--roadmap)
6. [Pricing Strategy](#6-pricing-strategy)
7. [Agent Guardrails Architecture](#7-agent-guardrails-architecture)
8. [MCP Strategy](#8-mcp-strategy)
9. [Go-to-Market Strategy](#9-go-to-market-strategy)
10. [Cost Optimization & Unit Economics](#10-cost-optimization--unit-economics)
11. [Revenue Projections](#11-revenue-projections)
12. [Key Questions & Decisions](#12-key-questions--decisions)

---

## 1. Executive Summary

Ghostly is an AI-native event operations platform for B2B companies that exhibit at trade shows and conferences. It combines budget/expense tracking, team logistics, and checklist management with an autonomous AI agent that monitors Slack and email, auto-completes tasks, builds event guides, sends scheduled reminders, messages team members, and automates 60-80% of event marketing operational work.

**The core thesis:** No competitor has an autonomous agent layer. Cvent and Bizzabo have copilot-style AI (content generation, suggestions). ExhibitDay has no AI at all. Ghostly's agent doesn't assist — it *runs* your event operations. Additionally, Ghostly's MCP server enables integration into multi-agent enterprise workflows, positioning it as both a standalone product and a composable platform node.

**Market opportunity:**
- ~1.28 million companies exhibit at B2B trade shows annually in the US
- ~200,000-400,000 companies exhibit at 3+ shows/year with dedicated event staff (serviceable market)
- US B2B trade show market: $15.78 billion (2024)
- Event management software market: $12-15 billion (2025), growing at 17% CAGR
- No existing player has an autonomous agent for exhibitors

---

## 2. Market Analysis

### 2.1 Industry Size

| Metric | Value | Source |
|--------|-------|--------|
| US B2B trade shows annually | ~13,000 | CEIR/IAEE |
| Companies exhibiting at B2B trade shows (US) | ~1.28 million | CEIR 2017 baseline, recovered to 2019 levels |
| Trade show & event planning businesses (US) | 52,624 | Industry report, 5.3% YoY growth |
| US B2B trade show market size (2024) | $15.78 billion | Statista |
| Projected market size (2028) | $17.3 billion | Statista |
| Event management software market (2025) | $12-15 billion | Multiple analysts |
| Software market CAGR | 17.4% | MarketsandMarkets |
| Event marketing jobs (US, Glassdoor) | ~106,000 | Glassdoor |

### 2.2 Exhibitor Behavior

- Average cost to exhibit at a trade show: **$10,000-$30,000 per show**
- Exhibitors spend **31.6-40% of total marketing budgets** on trade shows
- 42% of US event marketers maintained exhibit budgets in 2024; 34% increased spending
- 64% of exhibitors plan to increase trade show participation annually
- US marketers planned to exhibit at an average of **42.4 regional trade shows** in 2024
- Average total in-person events with exhibits: **60 per year** (2024)

### 2.3 Market Segmentation

**Total Addressable Market (TAM):** ~1.28M exhibiting companies in the US

**Serviceable Addressable Market (SAM):** ~200,000-400,000 companies that exhibit at 3+ shows/year with dedicated event staff and real budgets. These are the ones who feel the pain of tracking budgets across multiple events.

**Serviceable Obtainable Market (SOM):** 200-2,000 companies in years 1-3, growing as the product matures and awareness builds.

### 2.4 AI & MCP Market Trends

- MCP has 97M+ monthly SDK downloads, adopted by OpenAI, Google, Microsoft, Anthropic
- 17,000+ MCP servers catalogued; donated to Linux Foundation as vendor-neutral standard
- 2026 is the "production year" for enterprise MCP adoption
- Gartner: by 2028, 1/3 of enterprise apps will embed agentic AI, 15% of routine decisions made autonomously
- Agentic AI market projected from $7.8B (2025) to $52B+ (2030)
- Multi-agent orchestration (MCP for tool access, A2A for agent-to-agent) is the emerging enterprise pattern

---

## 3. Competitive Landscape

### 3.1 Direct Competitors (Exhibitor-Side Tools)

#### ExhibitDay
- **Focus:** Trade show planning & project management for exhibitors
- **Pricing:** Free (Lite) / $99/mo (Pro) / $199/mo (Premium) / Enterprise (custom)
- **Strengths:** Free tier drives adoption; clean task management; asset tracking
- **Weaknesses:** Zero AI capabilities; no agent; basic budget tracking; no expense import automation
- **Threat level:** Low. They'd need 12-18 months to build any AI layer.

#### ExhibitForce
- **Focus:** Enterprise exhibit management & ROI
- **Pricing:** Custom (expensive, enterprise sales only)
- **Strengths:** Deep enterprise features; established in large corporate accounts
- **Weaknesses:** Legacy architecture; no AI; expensive; slow to innovate
- **Threat level:** Very low. Different market segment (large enterprise only).

### 3.2 Adjacent Competitors (Event Organizer Tools)

#### Cvent — "CventIQ"
- **Focus:** Event organizers and venues (not exhibitors)
- **AI:** CventIQ is a copilot, not an agent. Generates content (email copy, speaker bios, social posts), summarizes attendee feedback, recommends venues. Every action requires human initiation. Does NOT: monitor Slack/email, auto-complete tasks, message team, build documents proactively, or run background scheduled tasks.
- **Pricing:** Custom enterprise pricing (annual license + per-registration fees)
- **Threat level:** Low for exhibitor market. They serve organizers, not exhibitors. AI is content generation only.

#### Bizzabo
- **Focus:** B2B event organizers
- **AI:** Markets "AI agents" but they're template-based content generators (event brief builder, survey synthesizer, follow-up email composer). Their own guide states: "AI can automate tasks, but it can't replicate human creativity, empathy, or strategic thinking." Recommends "starting small by automating one recurring process." No autonomous background agents.
- **Pricing:** Starting $7,500-$17,999/year
- **Threat level:** Low. Different market (organizers), AI is copilot-only.

### 3.3 The Real Competitor: Spreadsheets

70%+ of the target market manages trade show budgets in Google Sheets or Excel. The biggest conversion challenge isn't beating ExhibitDay — it's convincing event marketers to stop using the spreadsheet they've maintained for 5 years.

### 3.4 Competitive Positioning Matrix

| Capability | Ghostly | CventIQ | Bizzabo | ExhibitDay |
|-----------|---------|---------|---------|------------|
| Budget/expense tracking | Yes | Yes | No | Yes |
| AI content generation | Yes | Yes | Yes | No |
| **Autonomous background agent** | **Yes** | No | No | No |
| **Slack/email monitoring** | **Building** | No | No | No |
| **Auto-complete tasks** | **Yes** | No | No | No |
| **Scheduled proactive alerts** | **Yes** | No | No | No |
| **Build event guides/Run of Show** | **Yes** | No | No | No |
| **Message team autonomously** | **Building** | No | No | No |
| **MCP server (external AI access)** | **Yes** | No | No | No |
| Brex/PDF import with AI categorization | **Yes** | No | No | No |
| Built for exhibitors (not organizers) | **Yes** | No | No | Yes |
| Vendor management | Building | No | No | No |
| Travel logistics | Building | No | No | No |
| CRM integration | Building | Partial | Partial | No |

**Bottom line:** Ghostly is building in a category that doesn't exist yet. The competitors are either organizer-focused (Cvent, Bizzabo) with weak AI copilots, or exhibitor-focused (ExhibitDay) with zero AI.

---

## 4. Target Audience & Positioning

### 4.1 Primary Buyer Persona: The Event Marketing Manager

**Title:** Event Marketing Manager, Field Marketing Manager, Trade Show Coordinator, Marketing Operations Manager

**Company profile:** Mid-market B2B company ($10M-$500M revenue), 1-5 person event team, attends 5-50+ trade shows and conferences per year. Any industry — tech, healthcare, senior living, manufacturing, financial services, etc.

**Daily pain:**
- Tracking budgets across 10-30 concurrent events in spreadsheets
- Reconciling corporate card (Brex/Amex) statements against event expenses
- Coordinating pre-show logistics across email, Slack, and project management tools
- Building checklists and run-of-shows for each event from scratch
- Reporting ROI to leadership with manually compiled data
- Managing vendor relationships and shipment tracking across carriers
- Booking travel and accommodations for 3-15 team members per event

**What they care about:** Time saved, budget accuracy, not forgetting critical pre-show tasks, being able to prove ROI to leadership.

**How they buy:** Sees a demo or hears about it from a peer. Wants to try it. Needs to see the agent in action to believe it. Low-friction trial. Pays with a corporate card. Doesn't need IT approval under $300/mo.

### 4.2 Secondary Buyer Persona: The Ops/IT Buyer

**Title:** Marketing Operations Director, RevOps, IT

**Company profile:** Larger company ($500M+) building an AI agent stack. Looking for composable tools that integrate via MCP into their orchestration layer.

**What they care about:** API access, MCP compatibility, multi-tenancy, audit logs, compliance (SOC 2, GDPR), SSO, approval workflows.

**How they buy:** Discovers Ghostly MCP server in an MCP directory or through their agent framework. Evaluates the API. Enterprise sales cycle (weeks to months). Needs security review and compliance documentation.

**Timeline:** This persona emerges as the MCP ecosystem matures (6-18 months out). Don't optimize for them now, but build the infrastructure they'll need.

### 4.3 Positioning Statement

**For** B2B companies that exhibit at trade shows and conferences,
**Ghostly is** an AI-powered event operations platform
**that** automates 60-80% of event marketing work — budget tracking, expense management, team coordination, logistics, and ROI reporting —
**unlike** Cvent, Bizzabo, or ExhibitDay
**which** either serve event organizers (not exhibitors), lack AI entirely, or offer only basic content generation copilots.

**Ghostly's agent doesn't assist. It runs your events.**

---

## 5. Feature Audit & Roadmap

### 5.1 Current Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Event management (CRUD, types, tiers) | Complete | Multi-type, configurable |
| Budget tracking (budget vs actual) | Complete | Per-event, per-type, per-quarter |
| Expense management | Complete | With source tracking |
| Brex CSV import + AI categorization | Complete | Agent-assisted review |
| PDF invoice import + parsing | Complete | AI extraction |
| Checklist system (pre/day-of/post) | Complete | Templates, assignments, due dates |
| Team management & event assignments | Complete | Roles, assignments |
| AI agent chat | Complete | Streaming, tool calling, Claude Sonnet |
| Scheduled agent tasks (cron) | Complete | Configurable heartbeat |
| Context window management | Complete | Auto-compaction for long conversations |
| Document storage & management | Complete | Linked to events/expenses |
| ROI tracking & dashboard | Complete | Pipeline, revenue, cost-per-lead |
| Pipeline view (Kanban + Calendar) | Complete | Drag-and-drop |
| Export (CSV, Excel) | Complete | With filters |
| MCP server | Complete | 6 tools, standalone architecture |
| API key system | Complete | Read/write/admin permissions |
| Webhooks | Partial | Table exists, not fully exposed |
| Multi-tenancy | Complete | Org-scoped, all tables |
| Audit logging | Partial | Events/expenses only |
| Notifications | In Progress | UI built, delivery channels pending |
| Shipment tracking | Partial | Status/carrier tracking, no freight costs |
| Mobile responsive | Basic | Works but not optimized |

### 5.2 Feature Gaps — Prioritized Roadmap

#### Phase 1: Launch-Critical (Weeks 1-4)

**1. Slack Integration**
- Slack OAuth app setup
- Agent notifications to Slack channels
- Agent can post daily/weekly digests
- Bot responds to slash commands for quick queries
- Why first: The agent's value is 10x when it meets users where they already are

**2. Email Integration**
- Email transport (SendGrid/Resend/SES)
- Digest templates (daily/weekly summaries)
- Agent-triggered email notifications
- Why critical: Not everyone uses Slack; email is universal

**3. Calendar Sync**
- Google Calendar bidirectional sync
- Outlook/Microsoft Calendar sync
- iCal export (minimum viable)
- Why critical: Event dates not syncing to personal calendars = double-entry = low adoption

**4. Agent-Driven Historical Data Import**
- User drops files (spreadsheets, PDFs, CSVs, whatever they have)
- Agent parses, identifies events and expenses, categorizes
- Conversational confirmation: agent presents what it found, user confirms/corrects
- Extends existing Brex CSV and PDF import capabilities
- No templates, no forms — just drop files and talk to the agent
- Why critical: Day-one value; seeds the data moat; demonstrates agent capability during onboarding

#### Phase 2: High-Value Differentiators (Weeks 5-8)

**5. Run of Show / Event Guide Builder**
- Agent generates structured timeline from event details
- Sections: setup schedule, booth shifts, demo rotations, meeting schedule, teardown
- Printable/exportable format (PDF)
- Templates by event type (customizable)
- Real-time updates pushed to team via Slack/email
- Why high-value: Nobody has AI-generated run of shows; this is a demo-closer feature

**6. Vendor Management**
- Vendor database with contact info, categories, payment terms
- Vendor spend history and analytics
- Link vendors to expenses (replace free-text field)
- Agent-powered insights: "You've spent $47K with Freeman this year, up 23%"
- Vendor performance tracking over time
- Why high-value: Event marketers work with the same 5-15 vendors repeatedly; this is sticky data

**7. Travel & Logistics Tracking**
- Hotel bookings per team member per event
- Flight information with confirmation numbers
- Ground transport (rental car, shuttle, rideshare budget)
- Travel expense categorization separate from event expenses
- Agent can compile full logistics brief: "Here's your team's travel rundown for CES"
- Why high-value: Currently lives in email threads and spreadsheets; massive time waste

**8. Guardrails System (v1)**
- Action classification (read/low/medium/high/critical tiers)
- Confirmation prompts for high-risk actions
- Confidence scoring on AI categorization
- Spend caps on agent-created expenses
- Undo/rollback for agent actions
- Detailed implementation in Section 7

#### Phase 3: Growth & Expansion (Weeks 9-16)

**9. CRM Integration (Salesforce/HubSpot)**
- Bidirectional sync for leads, opportunities, revenue
- Auto-populate ROI metrics from CRM deal data
- Event attribution: which events sourced which deals
- Closes the ROI reporting loop — the #1 question from leadership

**10. Approval Workflows**
- Expense approval routing (submit → review → approve/reject)
- Budget overrun approvals
- Configurable approval chains by amount threshold
- Agent notifies approvers, tracks status

**11. Booth/Asset Inventory**
- Asset database (booth components, banners, displays, monitors, A/V)
- Assignment to events (which assets go where)
- Condition tracking and maintenance notes
- Multi-event reuse tracking
- Agent alerts: "Your 10x10 booth kit is assigned to two overlapping events"

**12. Advanced Analytics**
- Year-over-year trend analysis
- Cross-event performance comparison
- Vendor spend breakdown
- Cost forecasting based on historical patterns
- Custom report builder
- Agent-generated insights: "Your Q3 events averaged 22% over budget — here's why"

**13. Sub-Agent Architecture**
- Auditor sub-agent for reviewing primary agent work
- Defined skills/instructions per sub-agent role
- Sub-agent task specialization (categorization agent, logistics agent, reporting agent)
- Detailed architecture in Section 7

#### Phase 4: Enterprise & Scale (Months 5-8)

**14. PWA / Mobile Optimization**
- PWA manifest and service worker
- Offline checklist access and sync
- Mobile-optimized forms and touch targets
- Push notifications

**15. Multi-Currency Support**
- Currency code on expenses/budgets
- Exchange rate tracking
- Reporting in home currency with conversion

**16. Compliance & Security**
- SOC 2 Type II preparation
- GDPR compliance documentation
- SSO (SAML/OIDC) for enterprise
- Enhanced audit logging across all endpoints
- Data retention policies

**17. MCP Server Expansion**
- Full parity with embedded agent capabilities
- npm package distribution
- Docker image
- MCP directory listings
- Developer documentation
- Detailed strategy in Section 8

---

## 6. Pricing Strategy

### 6.1 Model: 7-14 Day Free Trial + Paid Tiers

No permanent free tier. The agent has real API costs per user, and B2B niche SaaS doesn't benefit from viral free-tier adoption the way consumer products do. A 7-14 day trial of the full Pro experience lets prospects see the agent in action, which is the conversion moment.

### 6.2 Tier Structure

| | **Starter** | **Pro** | **Team** | **Enterprise** |
|--|-------------|---------|----------|----------------|
| **Price** | $79/mo | $179/mo | $349/mo | Custom |
| **Annual** | $63/mo (billed yearly) | $143/mo (billed yearly) | $279/mo (billed yearly) | Custom |
| **Users** | 1 | 3 | 10 | Unlimited |
| **Active events** | 10 | 30 | Unlimited | Unlimited |
| | | | | |
| **Core Features** | | | | |
| Budget & expense tracking | Yes | Yes | Yes | Yes |
| Checklists & team management | Yes | Yes | Yes | Yes |
| CSV/PDF import | Manual | AI-categorized | AI-categorized | AI-categorized |
| Historical data import (agent) | Basic (5 files) | Full | Full | Full + white-glove |
| ROI dashboard | Basic | Full | Full + trends | Custom reports |
| Export (CSV/Excel) | Yes | Yes | Yes | Yes |
| | | | | |
| **Agent Features** | | | | |
| Agent chat | Yes | Yes | Yes | Yes |
| Scheduled agent tasks | 3 tasks | 10 tasks | Unlimited | Unlimited |
| Run of Show builder | No | Yes | Yes | Yes |
| Confidence scoring & review | No | Yes | Yes | Yes |
| | | | | |
| **Integrations** | | | | |
| Slack integration | No | Yes | Yes | Yes |
| Email notifications | Basic | Full | Full | Full |
| Calendar sync | No | Yes | Yes | Yes |
| CRM integration | No | No | Yes | Yes |
| MCP server access | No | No | Yes | Yes |
| API access | No | Read-only | Full | Full |
| Webhooks | No | No | Yes | Yes |
| | | | | |
| **Admin & Security** | | | | |
| Approval workflows | No | No | Yes | Yes |
| Audit log retention | 7 days | 30 days | 1 year | Unlimited |
| SSO (SAML/OIDC) | No | No | No | Yes |
| Dedicated support | No | No | No | Yes |
| | | | | |
| **Support** | Community/email | Email | Priority email | Dedicated CSM |

### 6.3 BYOK (Bring Your Own Key) Discount

For cost-conscious users who want to use their own OpenAI/Anthropic/Google API key:

- **BYOK discount: 30% off any tier**
- User provides their own API key in settings
- All agent calls route through their key instead of Ghostly's OpenRouter account
- Ghostly has zero LLM API costs for these users
- User gets lower price; Ghostly gets higher margin

| Tier | Standard | BYOK Price |
|------|----------|------------|
| Starter | $79/mo | $55/mo |
| Pro | $179/mo | $125/mo |
| Team | $349/mo | $245/mo |

This is attractive to technical users and larger companies that already have API agreements with model providers.

### 6.4 MCP-Only Access

For the platform buyer persona — companies that just want to plug Ghostly data into their existing agent stack via MCP, without using the web UI or embedded agent:

- **MCP Access Plan: $99/mo**
- Full API + MCP server access
- No embedded agent (they're using their own)
- Budget/expense/event data storage and tracking
- Ghostly as a data node, not a full application

This captures value from the platform use case without cannibalizing the product tiers.

### 6.5 Pricing Rationale

- **Starter at $79/mo:** Below ExhibitDay Pro ($99/mo) but with AI agent included. Attractive entry point. Companies spending $10K-$30K per trade show won't hesitate at $79/mo.
- **Pro at $179/mo:** The sweet spot. Full agent, integrations, everything a solo or small team needs. Between ExhibitDay Pro and Premium pricing.
- **Team at $349/mo:** Multi-user, CRM, MCP, approval workflows. For companies attending 30+ shows/year, this is a rounding error on their event budget. Positions as "virtual team member" — cheaper than a part-time coordinator.
- **Enterprise at custom:** White-glove. SOC 2, SSO, dedicated support. $500-1,500/mo range depending on scale.

---

## 7. Agent Guardrails Architecture

### 7.1 Action Classification System

Every agent action is classified into risk tiers with corresponding behavior:

| Tier | Risk | Examples | Agent Behavior |
|------|------|----------|----------------|
| **Read** | None | Query budgets, list events, check tasks, view documents | Execute freely, no confirmation |
| **Low** | Minimal | Mark checklist item complete, add event note, categorize expense | Execute immediately, notify user after |
| **Medium** | Reversible | Create expense, assign team member, send reminder, update event details | Execute with 30-second undo window |
| **High** | Significant | Delete event, modify budget total, message external team, bulk operations, create vendor | **Require explicit user confirmation before executing** |
| **Critical** | Irreversible | Export sensitive data, API key operations, webhook config, bulk delete | **Require confirmation + stated reason** |

**User-configurable thresholds:** Users can adjust which actions require confirmation. Power users may want Medium-tier actions to auto-execute. New users may want confirmation on everything. Expose this as a "Trust Level" slider in agent settings (Conservative → Balanced → Autonomous).

### 7.2 Sub-Agent Architecture

Sub-agents are specialized, well-defined agents with specific skills and instructions:

#### Auditor Sub-Agent
- **Model:** Haiku-class (cheap, fast)
- **Trigger:** Runs asynchronously after primary agent completes batch actions
- **Skills:**
  - Expense categorization review: "Does this expense match the vendor and description pattern?"
  - Budget compliance check: "Is this allocation within historical norms for this event type?"
  - Run of Show completeness: "Does this document have all required sections?"
  - Data integrity: "Are there duplicate expenses, missing fields, or inconsistencies?"
- **Output:** Flags anomalies for human review; does NOT auto-correct
- **Notification:** Summarizes findings in agent chat or Slack: "I reviewed 14 expenses the agent categorized today. 12 look correct, 2 flagged for your review."

#### Categorization Sub-Agent
- **Model:** Haiku-class
- **Skills:**
  - Brex/CSV transaction categorization
  - PDF invoice field extraction
  - Vendor identification from transaction descriptions
  - Event matching based on dates, amounts, and vendor patterns
- **Instructions:** Always output confidence score. Above 90% = auto-assign. 70-90% = assign with review flag. Below 70% = ask user.

#### Logistics Sub-Agent
- **Model:** Haiku-class
- **Skills:**
  - Travel itinerary compilation
  - Shipment status checking
  - Checklist deadline monitoring
  - Team coordination messaging
- **Instructions:** Proactive monitoring. Alert when deadlines approach. Compile daily logistics briefs.

#### Reporting Sub-Agent
- **Model:** Sonnet-class (needs reasoning for analysis)
- **Skills:**
  - Cross-event trend analysis
  - ROI calculation and narrative generation
  - Budget forecasting based on historical patterns
  - Executive summary generation
- **Instructions:** Runs on schedule (weekly/monthly). Generates reports and delivers via preferred channel.

### 7.3 Undo & Rollback System

- **Action snapshots:** Every agent action writes `before_state` and `after_state` to the audit log
- **Chat undo button:** "Undo last action" button appears in chat interface after every write action
- **Batch undo:** "Undo everything the agent did in this session" one-click revert
- **Time-boxed review:** For batch imports (10+ records), if user doesn't confirm within 24 hours, flag for review and pause further processing
- **Session sandbox view:** "Show me everything the agent did in this session" with per-action revert

### 7.4 Additional Guardrails

#### Rate Limiting on Agent Actions
- Max 10 create/update operations per minute
- Max 50 per hour
- If limit hit: agent pauses and asks "I've created 10 expenses in the last minute. Should I continue with the remaining 23?"
- Configurable per tier (Enterprise gets higher limits)

#### Confidence Scoring
- Every AI decision outputs a confidence score (0-100)
- Thresholds (user-configurable):
  - **90-100%:** Auto-execute, log for audit
  - **70-89%:** Execute with review flag, surface in daily digest
  - **Below 70%:** Do not execute, ask user for confirmation
- Displayed in UI: color-coded badge on agent-categorized items

#### Drift Detection
- Track agent behavior patterns over rolling 30-day windows
- Alert if categorization patterns shift significantly (>20% change in category distribution)
- Alert if agent action volume spikes unusually
- Helps catch: prompt injection, model regression, corrupted context, data quality issues

#### Spend Caps
- Configurable maximum for agent-created expenses (default: $5,000)
- "Don't create any single expense over $X without asking me"
- Budget overrun threshold: alert when an event crosses 80%, 90%, 100% of budget
- Agent cannot approve its own expense creations above the cap

#### Dry Run Mode
- For any batch operation (import, bulk categorize, generate documents):
  - Show preview of what the agent *would* do
  - User reviews and approves/modifies/rejects
  - Then agent executes confirmed actions
- Extends existing Brex import review pattern to all batch actions

#### Context Integrity
- Session context is isolated — one session's context doesn't bleed into another
- System prompts are protected from user-injected overrides
- Tool calls are validated against allowed schemas before execution
- Agent cannot modify its own configuration or guardrail settings

---

## 8. MCP Strategy

### 8.1 Current State

The MCP server exists at `/mcp-server/`, is architecturally standalone, and communicates with Ghostly's REST API over HTTP with API key authentication. It currently exposes 6 tools:

1. `list_event_types` — Get event type library
2. `list_events` — Query events with filters
3. `create_event` — Create new event
4. `get_event_summary` — Full event metrics + ROI
5. `add_budget_line` — Record expense
6. `assign_vendor` — Create vendor placeholder

### 8.2 Architecture

```
External AI Client (Claude Desktop / Cursor / Custom Agent)
           |
           | stdio (MCP protocol)
           v
   ghostly-mcp server (Node.js, standalone)
           |
           | HTTP + x-api-key header
           v
   Ghostly REST API (Next.js)
           |
           v
   Supabase PostgreSQL
```

### 8.3 Expansion Plan

**Goal:** Full parity between MCP server capabilities and the embedded agent's tool set.

#### Phase 1: Core Parity (with Feature Roadmap Phase 2)

Add tools for everything the embedded agent can do:

- `list_expenses` / `get_expense` / `create_expense` / `update_expense`
- `list_checklist_items` / `complete_checklist_item` / `create_checklist_item`
- `list_team_members` / `assign_team_member`
- `get_budget_summary` — Total budget vs actual, by event/type/quarter
- `get_overdue_tasks` — Pending checklist items past due
- `get_over_budget_events` — Events exceeding budget
- `search_events` — Full-text search across events
- `list_documents` / `get_document` — Access event documents

#### Phase 2: Advanced Tools (with Feature Roadmap Phase 3)

- `get_vendor_summary` — Vendor spend history and analytics
- `get_travel_logistics` — Team travel info for an event
- `generate_run_of_show` — Create event guide
- `get_roi_report` — Cross-event ROI analysis
- `get_analytics` — Trend analysis, forecasting

#### Phase 3: Platform Tools (with Feature Roadmap Phase 4)

- `create_webhook` — Register webhook for event notifications
- `subscribe_to_updates` — Real-time event change notifications
- `batch_import` — Bulk data operations

### 8.4 Distribution Strategy

**npm package:** `npx ghostly-mcp --api-key=xxx` — zero-install usage for developers

**Docker image:** `docker run ghostly/mcp-server` — for enterprise deployment

**MCP directory listings:** Submit to:
- mcp.so
- Smithery
- Official MCP registry (once available)
- GitHub awesome-mcp-servers lists

**Developer documentation:** Dedicated docs page with:
- Quick start guide
- Tool reference with examples
- Authentication setup
- Use case examples (Claude Desktop, Cursor, custom agents)

### 8.5 MCP as a Go-to-Market Channel

The MCP server creates a secondary acquisition funnel:

1. Developer discovers `ghostly-mcp` in an MCP directory
2. Connects it to Claude Desktop, starts querying event data
3. Realizes there's a full web app with an embedded agent
4. Converts to paid plan for the full experience

This is product-led growth through the developer/ops persona, complementing the demo-driven sales to event marketers.

### 8.6 MCP-Only Pricing

See Section 6.4. $99/mo for API + MCP access without the embedded agent. Captures the platform buyer without cannibalizing product tiers.

---

## 9. Go-to-Market Strategy

### 9.1 Phase 1: Community-Driven Sales (Months 1-3)

**Primary channel: Live demos to marketing communities**

The product sells itself when people see the agent work. The presentation to the marketing group already generated inbound interest. This is the playbook:

- **Marketing groups and communities:** Present at 2-4 marketing group meetings per month
- **Trade show associations:** IAEE, CEIR, EXHIBITOR magazine community events
- **LinkedIn content:** Short posts with 30-second screen recordings showing the agent doing something impressive (categorizing a Brex dump, building a run of show, flagging overdue tasks)
- **Record every demo:** Turn into 3-minute highlight reels for the website and social

**Goal:** 10-30 paying customers from direct outreach and community presence.

### 9.2 Phase 2: Content & SEO (Months 3-6)

**Capture the spreadsheet crowd:**

Event marketers aren't searching for "AI agent event management." They're searching for:
- "trade show budget template"
- "event ROI calculator"
- "how to track trade show expenses"
- "pre-event checklist template"
- "run of show template"

Create content that answers these queries and introduces Ghostly as the evolution beyond templates:
- Blog posts with free downloadable templates (lead magnets)
- YouTube videos: "How I automated 80% of my trade show prep"
- Comparison pages: "Ghostly vs ExhibitDay vs spreadsheets"

### 9.3 Phase 3: Ecosystem & Platform (Months 6-12)

**MCP directory presence:** Get listed in MCP directories for organic developer discovery
**Integration partnerships:** Brex, Ramp, corporate card providers — potential co-marketing
**Trade show presence:** Exhibit at trade shows about trade shows (meta, but effective) — EXHIBITOR Live, Event Tech Live

### 9.4 Conversion Funnel

```
Awareness (demo/content/MCP discovery)
    |
    v
7-14 day free trial (full Pro experience)
    |
    v
Onboarding: Drop your files, agent sets everything up
    |
    v
"Aha moment": Agent categorizes first Brex import or builds first run of show
    |
    v
Paid conversion
    |
    v
Expansion: Add team members → upgrade to Team tier
```

**Target conversion rates:**
- Demo/presentation attendee → trial signup: 15-25%
- Trial → paid: 20-35% (high because agent demo is the trial itself)
- Inbound lead (warm referral) → customer: 25-40%
- Monthly logo churn target: 3-5%

---

## 10. Cost Optimization & Unit Economics

### 10.1 Cost Structure Per Customer

| Cost Component | Estimated Monthly | Notes |
|----------------|------------------|-------|
| Supabase (database/auth) | $0.50-2.00 | Scales with storage and API calls |
| LLM API (OpenRouter → Claude Sonnet) | $15-60 | Depends on agent usage volume |
| LLM API (Haiku for categorization/audit) | $2-8 | Cheap model for routine tasks |
| Hosting (Railway/Vercel) | $1-3 | Shared infrastructure |
| Email delivery (SendGrid/Resend) | $0.10-0.50 | Transactional + digest emails |
| **Total COGS per customer** | **$19-74** | |

### 10.2 Margin Analysis

| Tier | Revenue | COGS (avg) | Gross Margin | Margin % |
|------|---------|------------|-------------|----------|
| Starter ($79) | $79 | $25 | $54 | 68% |
| Pro ($179) | $179 | $45 | $134 | 75% |
| Team ($349) | $349 | $60 | $289 | 83% |
| BYOK Starter ($55) | $55 | $5 | $50 | 91% |
| BYOK Pro ($125) | $125 | $8 | $117 | 94% |
| MCP-Only ($99) | $99 | $3 | $96 | 97% |

**BYOK and MCP-Only are the highest-margin plans.** BYOK eliminates 70-80% of COGS (LLM API costs). MCP-Only has near-zero marginal cost since the user's external agent handles all LLM inference.

### 10.3 Cost Optimization Strategies

**Model routing by task complexity:**
- Haiku-class ($0.25/MTok input, $1.25/MTok output) for: categorization, checklist updates, notifications, routine queries
- Sonnet-class for: run of show generation, complex analysis, multi-step reasoning, report building
- This alone can reduce LLM costs by 50-70% vs. routing everything through Sonnet

**Caching:**
- Cache frequently accessed data (event lists, budget summaries, team info) to reduce redundant tool calls
- Cache agent system prompts and context (static between sessions)

**Context window management:**
- Already implemented: auto-compaction for long conversations
- Extend with: summarize older messages instead of carrying full history

**Batch processing:**
- Aggregate scheduled agent tasks where possible (run all cron jobs in a single context window)
- Batch Brex import categorizations instead of one-at-a-time

### 10.4 Break-Even Analysis

**Fixed monthly costs (estimated):**
- Supabase Pro plan: $25/mo
- Railway hosting: $20-50/mo
- Domain/DNS/misc: $20/mo
- OpenRouter minimum: $0 (pay-per-use)
- **Total fixed: ~$70-95/mo**

**Break-even:** 2-3 customers on any paid tier covers fixed infrastructure costs.

**Ramen profitability (covers $5K/mo personal expenses + infra):**
- 30 Starter customers, OR
- 15 Pro customers, OR
- 10 Team customers, OR
- Mix of ~20 customers across tiers

---

## 11. Revenue Projections

### 11.1 Conservative Scenario

Assumes moderate marketing effort, community-driven sales only, no paid acquisition.

| Timeline | Customers | Avg Revenue/Customer | MRR | ARR |
|----------|-----------|---------------------|-----|-----|
| Month 3 | 10 | $150 | $1,500 | $18,000 |
| Month 6 | 35 | $160 | $5,600 | $67,200 |
| Month 9 | 75 | $170 | $12,750 | $153,000 |
| Month 12 | 120 | $180 | $21,600 | $259,200 |
| Month 18 | 250 | $190 | $47,500 | $570,000 |
| Month 24 | 500 | $200 | $100,000 | $1,200,000 |

### 11.2 Aggressive Scenario

Assumes active content marketing, multiple community presentations per month, MCP ecosystem traction, and warm referral network.

| Timeline | Customers | Avg Revenue/Customer | MRR | ARR |
|----------|-----------|---------------------|-----|-----|
| Month 3 | 25 | $150 | $3,750 | $45,000 |
| Month 6 | 80 | $170 | $13,600 | $163,200 |
| Month 9 | 200 | $185 | $37,000 | $444,000 |
| Month 12 | 400 | $200 | $80,000 | $960,000 |
| Month 18 | 800 | $210 | $168,000 | $2,016,000 |
| Month 24 | 1,500 | $220 | $330,000 | $3,960,000 |

### 11.3 Long-Term Ceiling

At maturity (3-5 years), targeting 1,000-5,000 customers:

| Customers | Avg Revenue | MRR | ARR |
|-----------|-------------|-----|-----|
| 1,000 | $200 | $200,000 | $2,400,000 |
| 2,500 | $220 | $550,000 | $6,600,000 |
| 5,000 | $250 | $1,250,000 | $15,000,000 |

---

## 12. Key Questions & Decisions

### 12.1 Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Free tier vs. trial | 7-14 day free trial | Agent has real API costs; B2B niche doesn't benefit from viral free adoption |
| Vertical vs. horizontal | Horizontal | Broader demographic, larger market; use vertical onboarding templates |
| Model provider | OpenRouter (now), direct API (later) | Flexibility to test models; switch to direct once optimal model identified |
| MCP architecture | Standalone, expand to full parity | Distribution via npm/Docker/directories; trojan horse acquisition channel |
| Historical import UX | Agent-driven, conversational | No templates or forms; drop files, talk to agent, confirm |
| Compliance timeline | After first paying customers | Validate product viability first; SOC 2 before enterprise push |
| Product vs. platform | Both, sequenced | Product first (months 1-6), platform expansion (months 6-12) |

### 12.2 Open Questions

1. **Trial length:** 7 days or 14 days? Shorter creates urgency. Longer lets them see a full event cycle. Recommendation: 14 days with option to extend for qualified prospects.

2. **Onboarding flow:** How guided should the first-run experience be? Agent-driven conversational setup vs. structured wizard vs. self-serve exploration?

3. **Multi-model strategy:** Which models for which tasks? Needs benchmarking across Haiku/Sonnet/GPT-4o-mini/Gemini Flash for cost vs. quality on event-specific tasks.

4. **Team messaging:** Should the agent be able to directly message team members via Slack/email, or should it always message through the primary user? Direct is more powerful but raises trust/permission concerns.

5. **White-label / resale:** Is there a market for agencies or consultants who manage events for multiple clients? Would they want a white-labeled version?

6. **International expansion:** When to add multi-currency, multi-language? Depends on where early customers come from.

7. **Data portability:** What's the export/migration story? Can customers export everything if they leave? Good practice and builds trust, but also removes a switching cost.

---

## Appendix A: Research Sources

- [IAEE - US B2B Trade Show Industry](https://www.iaee.com/news/iaee-releases-comprehensive-update-of-u-s-b2b-trade-show-industry/)
- [Trade Show Labs - 150+ Statistics](https://www.tradeshowlabs.com/blog/trade-show-stats)
- [Wave Connect - Trade Show Statistics 2025](https://wavecnct.com/blogs/news/tradeshow-statistics)
- [Giant Printing - 2025 Trade Show Statistics](https://giantprinting.com/trade-show-statistics/)
- [Glassdoor - Event Marketing Jobs](https://www.glassdoor.com/Job/united-states-event-marketing-jobs-SRCH_IL.0,13_KO14,29.htm)
- [CEIR Q4 2024 Index Results](https://ceir.iaee.com/news/ceir-releases-q4-2024-index-results/)
- [Statista - US B2B Trade Show Market Size](https://www.statista.com/statistics/865283/b2b-trade-show-market-value/)
- [CventIQ Platform](https://www.cvent.com/en/cventiq)
- [Cvent AI Launch Press Release](https://www.cvent.com/en/press-release/cvent-brings-intelligence-and-ai-life-across-its-platform-launch-cventiqtm)
- [Forrester - Cvent CONNECT 2025](https://www.forrester.com/blogs/ai-assistants-and-analytics-what-stood-out-at-cvent-connect-2025/)
- [Bizzabo - AI for Events Guide](https://www.bizzabo.com/blog/ai-for-events-guide)
- [Bizzabo - Event Industry Trends 2026](https://www.bizzabo.com/blog/event-industry-trends-2026)
- [ExhibitDay Plans & Pricing](https://www.exhibitday.com/Plans)
- [Eventtia - Cvent vs Bizzabo Comparison](https://www.eventtia.com/en/cvent-vs-bizzabo-which-event-management-software-is-best/)
- [CData - 2026 Enterprise MCP Adoption](https://www.cdata.com/blog/2026-year-enterprise-ready-mcp-adoption)
- [Pento - A Year of MCP](https://www.pento.ai/blog/a-year-of-mcp-2025-review)
- [OneReach - MCP & Multi-Agent AI](https://onereach.ai/blog/mcp-multi-agent-ai-collaborative-intelligence/)
- [Codebridge - Multi-Agent Orchestration 2026](https://www.codebridge.tech/articles/mastering-multi-agent-orchestration-coordination-is-the-new-scale-frontier)

---

## Appendix B: Vertical Onboarding Templates

When a user signs up and selects their industry, pre-populate with relevant defaults:

### Technology / SaaS
- **Event types:** Conference, Trade Show, User Group, Roadshow, Hackathon
- **Budget categories:** Booth Space, Sponsorship Package, Swag/Merch, After-Party/Dinner, Travel, Signage/Graphics, Lead Capture, Demo Equipment
- **Checklist templates:** Standard tech conference exhibitor flow

### Healthcare / Senior Living
- **Event types:** Conference, Symposium, CME Event, Regional Meeting, Customer Advisory Board
- **Budget categories:** Booth Space, Sponsorship, Clinical Materials, Compliance Review, Speaker Fees, Travel, Branded Scrubs/Items
- **Checklist templates:** Compliance-aware pre-show flow (legal review, claims approval)

### Manufacturing / Industrial
- **Event types:** Trade Show, Industry Expo, Distributor Meeting, Product Launch
- **Budget categories:** Booth Space, Freight/Shipping, Equipment Transport, Demo Setup, Safety Materials, Travel, Samples
- **Checklist templates:** Heavy logistics flow (freight scheduling, equipment setup, safety check)

### Financial Services
- **Event types:** Conference, Summit, Client Event, Roadshow, Investor Day
- **Budget categories:** Sponsorship, Hospitality Suite, Speaking Slot, Compliance Review, Travel, Branded Materials
- **Checklist templates:** Compliance-heavy flow (legal review, disclosure requirements)

### General / Other
- **Event types:** Conference, Trade Show, Networking Event, Customer Event
- **Budget categories:** Booth Space, Sponsorship, Swag, Travel, Signage, Catering
- **Checklist templates:** Standard exhibitor flow
