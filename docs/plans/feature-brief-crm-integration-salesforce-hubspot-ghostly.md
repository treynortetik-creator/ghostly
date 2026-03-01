# Feature Brief: CRM Integration (Salesforce / HubSpot)

**App:** Ghostly  
**Tier:** 2 (High-Value Differentiator)  
**Estimated Effort:** XL

---

## The Problem

The five ROI fields on the `events` table — `leads_generated`, `revenue_closed`, `pipeline_generated`, `meetings_booked`, `opportunities_created` — are all manually entered integers and decimals. In practice, nobody updates them. The rep who ran the event forgets. The data sits at zero. Meanwhile, in Salesforce, the actual deals that came from that event are closing over the next 6-12 months — and Ghostly never hears about it. Every event marketer gets asked "what's the ROI on this?" and they either make up a number or spend two hours building a Salesforce report. The holy grail metric is automated.

---

## The Vision

You link a Ghostly event to a Salesforce Campaign. From that point, Ghostly polls Salesforce on a schedule and syncs back the metrics that matter: leads (Campaign Members), pipeline (Opportunities created from Campaign Members), and revenue (Opportunities marked Closed Won). The ROI dashboard in Ghostly shows live numbers that update automatically as deals close — even 6 months after the show. No manual entry. No "we'll fill that in later."

The agent gains a superpower: it can now answer *"Which of our Q1 events generated the best pipeline?"* or *"How much revenue has the HLTH conference generated across the past 3 years?"* — and the numbers are real.

---

## Key Design Decisions

- **Polling over webhooks for V1** — Salesforce outbound messaging and webhooks are complex to set up and require org admin access. A nightly or hourly poll via SFDC REST API is faster to ship, covers 95% of use cases, and doesn't require Salesforce org configuration. Webhooks are a V2 upgrade path.
- **Campaign is the primary link** — the canonical Salesforce object for event marketing is the Campaign. A Ghostly event links to exactly one SF Campaign ID. Campaign Members → leads. Opportunities associated with Campaign Members → pipeline and revenue. This is standard SF event ROI methodology.
- **Credentials are org-scoped and encrypted** — Salesforce OAuth tokens are stored encrypted in Supabase per organization. No shared credentials. Each org connects their own Salesforce instance via OAuth 2.0 Connected App.
- **HubSpot is secondary** — architecture supports multiple CRM types via a `crm_type` field, but V1 only implements Salesforce. HubSpot maps similarly (Contact Lists → leads, Deals → pipeline/revenue) and can be added in V2 without schema changes.
- **Sync is additive, not destructive** — if a user manually enters a value for `leads_generated`, the sync overwrites it with Salesforce data once a CRM link is established. This is acceptable because the Salesforce data is the source of truth once connected. Clear UX warning when linking.

---

## Data Model

```sql
-- CRM connection credentials per org
CREATE TABLE crm_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  crm_type TEXT NOT NULL CHECK (crm_type IN ('salesforce', 'hubspot')),
  instance_url TEXT NOT NULL,          -- e.g. https://mycompany.salesforce.com
  access_token_encrypted TEXT,         -- OAuth access token (encrypted at rest)
  refresh_token_encrypted TEXT,        -- OAuth refresh token (encrypted at rest)
  token_expires_at TIMESTAMPTZ,
  connected_by TEXT,                   -- user email who connected it
  last_synced_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, crm_type)    -- one connection per CRM type per org
);

-- Event → CRM campaign link
CREATE TABLE event_crm_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  crm_connection_id UUID NOT NULL REFERENCES crm_connections(id) ON DELETE CASCADE,
  crm_campaign_id TEXT NOT NULL,       -- Salesforce Campaign ID (18-char SFID)
  crm_campaign_name TEXT,             -- cached for display without extra SF call
  sync_status TEXT DEFAULT 'pending'
    CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_sync_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, crm_connection_id) -- one CRM campaign per event per connection
);

-- Sync history log (for debugging + audit trail)
CREATE TABLE crm_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_crm_link_id UUID NOT NULL REFERENCES event_crm_links(id) ON DELETE CASCADE,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  leads_generated INTEGER,
  pipeline_generated DECIMAL(12,2),
  revenue_closed DECIMAL(12,2),
  meetings_booked INTEGER,
  opportunities_created INTEGER,
  raw_response JSONB,                  -- store SF API response for debugging
  error TEXT
);

-- Indexes
CREATE INDEX idx_crm_connections_org ON crm_connections(organization_id);
CREATE INDEX idx_event_crm_links_event ON event_crm_links(event_id);
CREATE INDEX idx_crm_sync_log_link ON crm_sync_log(event_crm_link_id);
```

**Existing events table fields (already exist, no changes needed):**
```
pipeline_generated DECIMAL(12,2)  -- maps from: Opp.Amount WHERE Stage != 'Closed Won'
revenue_closed DECIMAL(12,2)      -- maps from: Opp.Amount WHERE StageName = 'Closed Won'
leads_generated INTEGER           -- maps from: COUNT(CampaignMembers)
meetings_booked INTEGER           -- maps from: COUNT(Activities/Tasks) or manual (V1 = manual)
opportunities_created INTEGER     -- maps from: COUNT(Opportunities) on Campaign
roi_notes TEXT                    -- not synced; stays manual
```

---

## Salesforce Object Mapping

| Ghostly Field | Salesforce Object | Field/Filter |
|---|---|---|
| `leads_generated` | CampaignMember | COUNT(*) WHERE CampaignId = ? |
| `opportunities_created` | Opportunity | COUNT(*) WHERE CampaignId = ? |
| `pipeline_generated` | Opportunity | SUM(Amount) WHERE CampaignId = ? AND IsClosed = false |
| `revenue_closed` | Opportunity | SUM(Amount) WHERE CampaignId = ? AND StageName = 'Closed Won' |
| `meetings_booked` | — | V1: not synced (manual). V2: Activities WHERE Type = 'Meeting' |

**SOQL queries for sync:**
```sql
-- Leads
SELECT COUNT(Id) FROM CampaignMember WHERE CampaignId = '[campaignId]'

-- Opportunities
SELECT COUNT(Id), SUM(Amount) FROM Opportunity WHERE CampaignId = '[campaignId]'

-- Revenue (Closed Won only)
SELECT SUM(Amount) FROM Opportunity 
WHERE CampaignId = '[campaignId]' AND StageName = 'Closed Won'

-- Pipeline (open opps)
SELECT SUM(Amount) FROM Opportunity 
WHERE CampaignId = '[campaignId]' AND IsClosed = false
```

---

## Agent Integration

**New tool calls unlocked once CRM is connected:**

```json
{
  "name": "sync_crm_data",
  "description": "Trigger a Salesforce sync for an event. Fetches latest leads, pipeline, and revenue from the linked SF Campaign and updates the event ROI fields. Returns the updated metrics.",
  "parameters": {
    "event_id": "UUID"
  }
}
```

```json
{
  "name": "get_roi_comparison",
  "description": "Compare ROI metrics across multiple events. Returns leads, pipeline, revenue, and ROI ratio (revenue / budget) per event. Best used for quarterly or annual review questions.",
  "parameters": {
    "quarter": "Q1|Q2|Q3|Q4 (optional)",
    "fiscal_year_id": "UUID (optional)",
    "event_type": "executive|national|state|regional|customer (optional)"
  }
}
```

```json
{
  "name": "get_crm_sync_status",
  "description": "Check the sync status and last-synced values for an event's CRM connection. Returns sync timestamp, any errors, and current ROI field values.",
  "parameters": {
    "event_id": "UUID"
  }
}
```

**Agent intelligence upgrades:**
- `get_event_detail` can now include CRM sync status and note when data is stale
- `get_over_budget_events` can be paired with ROI data to show budget-exceeded events that also underperformed on pipeline
- Agent can answer: "Which events have the highest pipeline-to-spend ratio?" using real Salesforce data
- Post-event heartbeat: "The HLTH 2026 event synced this morning — pipeline is now $340K, up $85K since last week as 3 more opps were created."

---

## Technical Approach

### Phase 1: OAuth + Connection Setup
1. Create Salesforce Connected App (client_id + client_secret in env vars)
2. Build OAuth 2.0 flow: `GET /api/crm/salesforce/connect` → redirect to SF → callback at `GET /api/crm/salesforce/callback` → store tokens encrypted in `crm_connections`
3. Build token refresh logic (SF access tokens expire in 2 hours; use refresh token to get new ones)
4. Settings page: `/settings/integrations` — "Connect Salesforce" button with OAuth flow

### Phase 2: Event Linking
1. On event detail page, add "CRM Integration" section — shows linked Campaign or "Link to Salesforce Campaign" button
2. `POST /api/events/:id/crm-link` — accepts `crm_campaign_id`, validates against SF API, creates `event_crm_links` record
3. Campaign search: `GET /api/crm/salesforce/campaigns?search=HLTH` — calls SF API to search Campaigns by name, returns list for user to pick from

### Phase 3: Sync Engine
1. `POST /api/crm/sync/:event_crm_link_id` — runs the 3 SOQL queries, updates `events` table ROI fields, logs to `crm_sync_log`
2. Scheduled sync: nightly cron (via existing Ghostly cron infrastructure) calls sync for all active `event_crm_links` with `sync_enabled = true`
3. Manual sync: button in event detail UI → calls `POST /api/crm/sync/:id` → shows updated numbers

### Phase 4: Agent Tools
- Add 3 new tools to `src/lib/agent/tools.ts`
- Update system prompt to mention CRM connectivity

**Files to create/modify:**
- `supabase/migrations/031_crm_integration.sql` (new)
- `src/app/api/crm/salesforce/connect/route.ts` (new)
- `src/app/api/crm/salesforce/callback/route.ts` (new)
- `src/app/api/crm/salesforce/campaigns/route.ts` (new)
- `src/app/api/crm/sync/[id]/route.ts` (new)
- `src/app/api/events/[id]/crm-link/route.ts` (new)
- `src/app/settings/integrations/page.tsx` (new)
- `src/lib/salesforce-client.ts` (new — SOQL query wrapper)
- `src/lib/agent/tools.ts` (3 new tools)

---

## Dependencies & Risks

**Dependencies:**
- Salesforce instance must have Campaigns enabled (standard) and the user connecting must have API access (requires Professional edition or higher)
- OAuth 2.0 Connected App must be configured in the SF org — this is a one-time admin step per org
- Existing ROI fields on `events` table already exist (added in `004_event_roi.sql`) — no schema changes to that table needed

**Risks:**
- **Salesforce API permissions are complex** — not all SF orgs have the same field visibility or Campaign access. The "Standard User" profile may not have API access. Mitigation: clear setup guide, descriptive error messages when queries fail.
- **Token storage security** — OAuth tokens in the DB are extremely sensitive. Must encrypt at rest using a Supabase vault or AES-256 via a server-side key. Never log tokens. This is a hard requirement, not optional.
- **Campaign ↔ Event mapping is manual** — there's no automatic way to know which SF Campaign corresponds to which Ghostly event. User must link them. If the org doesn't use SF Campaigns for events, the whole feature is useless. Mitigation: document the assumption clearly; this feature is for orgs that already run SF Campaigns for events (common in enterprise).
- **Attribution complexity** — some opps came partially from the event; others barely interacted. SOQL-based Campaign attribution is the standard SF methodology but isn't perfect. Ghostly should surface these as "attributed" metrics with a clear note on methodology.
- **Scope is XL** — OAuth, token refresh, SOQL queries, sync engine, cron, UI for linking = real engineering. Don't underestimate. Estimate: 3-4 sprints for a solid V1.
- **HubSpot divergence** — if HubSpot customers are real, their object model differs (Contact Lists, Deals, not Campaigns). Don't over-abstract V1; build SF cleanly and refactor when HubSpot is real.

---

## Success Criteria

- Org admin can connect Salesforce via OAuth in <5 minutes from the Settings → Integrations page
- Event planner can search for and link a SF Campaign to a Ghostly event
- Nightly sync runs automatically and updates `leads_generated`, `pipeline_generated`, `revenue_closed`, `opportunities_created` on linked events
- Agent can answer "What's the ROI on HLTH 2026?" with live Salesforce data (not manually entered numbers)
- Agent can compare pipeline-to-spend ratio across events in a quarter using synced data
- Sync errors are surfaced clearly in UI (not silently failing)
- OAuth tokens are encrypted at rest; no tokens appear in logs or API responses
- A live demo shows: event linked to SF Campaign → nightly sync → agent reports real pipeline number
