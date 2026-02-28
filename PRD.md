# Ghostly — PRD

> *"The AI agent is invisible. The events aren't."*

## Overview
AI-powered event financial management for B2B event marketing teams. Track target budgets vs actuals by event and category. Import expenses from Brex CSV and PDF invoices. AI-assisted categorization.

**Theme:** Ghostly — clean, modern dark UI with spectral accent colors. The AI works invisibly behind the scenes.

## User
- Single user: Treynor
- Simple login (username/password in Railway env vars: `AUTH_USERNAME`, `AUTH_PASSWORD`)
- Session-based auth (cookie or JWT)

## Core Entities

### Event Types
- Executive
- National
- State
- Regional
- Customer

### Events
- Name, type, quarter (Q1-Q4/TBD), fiscal year
- Date range, location
- Budget amount (target)
- Opportunity goal
- Notes (approach, marketing, sales)

### Budget Categories (Non-Event)
- Spare Funds
- Exhibit Properties (booth, lightbox, displays)
- Swag
- Marketing Expenses (shipping, printing, supplies)

### Expenses
- Amount, date, vendor, memo/description
- Linked to: Event OR Category (or both?)
- Source: Brex CSV / PDF Invoice / Manual
- Status: Pending / Approved
- Duplicate flag

## Core Features (v1)

### Dashboard
- [ ] Total budget vs actual (all)
- [ ] Budget vs actual by event type (Executive, National, etc.)
- [ ] Budget vs actual by quarter
- [ ] Red/yellow/green indicators
- [ ] Progress bars

### Events Management
- [ ] List all events with budget/actual/remaining
- [ ] CRUD: Add, edit, delete events
- [ ] Filter by type, quarter, fiscal year
- [ ] Expand event to see linked expenses

### Expenses Management
- [ ] List all expenses
- [ ] CRUD: Add, edit, delete expenses
- [ ] Filter by event, category, date range, vendor
- [ ] Search

### Budget Categories (Non-Event)
- [ ] List categories with budget/actual
- [ ] CRUD: Add, edit, delete categories
- [ ] Expand to see linked expenses

### Brex CSV Import
- [ ] Upload CSV file
- [ ] AI auto-suggests event/category for each transaction
- [ ] User confirms or changes assignment
- [ ] Duplicate detection (same amount + date + vendor)
- [ ] Batch approve

### PDF Invoice Import
- [ ] Upload PDF
- [ ] Extract text (vendor, amount, date) via pdftotext
- [ ] Display extracted info
- [ ] User selects event/category
- [ ] Save expense

### Export
- [ ] Export to CSV
- [ ] Export to Excel (.xlsx)

### Fiscal Year
- [ ] Fiscal year selector (default: current)
- [ ] View data by fiscal year

## Tech Stack
- **Frontend:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Simple login (Railway env vars)
- **AI:** OpenRouter (for Brex categorization)
- **Styling:** Tailwind CSS
- **Deployment:** Railway

## Environment Variables (Railway)
```bash
# Auth
AUTH_USERNAME=treynor
AUTH_PASSWORD=<secure-password>
JWT_SECRET=<random-32-char-string>

# Supabase (server-side only, no client-side exposure)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxx

# OpenRouter (for AI categorization)
OPENROUTER_API_KEY=xxx
```

## Theme: Ghostly
Clean, modern dark UI with spectral highlights. The AI agent is invisible — the events aren't.

### Color Palette
```css
--wood-dark: #3d2314;      /* Dark mahogany - headers, nav */
--wood-medium: #5c3d2e;    /* Medium wood - borders, accents */
--wood-light: #8b6914;     /* Light wood - highlights */
--parchment: #f5f0e1;      /* Aged paper - main background */
--parchment-dark: #ebe3d1; /* Darker parchment - cards */
--ink-black: #2c2416;      /* Aged ink - primary text */
--ink-green: #1a472a;      /* Ledger green - positive/under budget */
--ink-red: #8b2500;        /* Ledger red - negative/over budget */
--ink-gold: #b8860b;       /* Gold ink - accents, totals */
--sepia: #704214;          /* Sepia - secondary text */
```

### Typography
- **Headers:** Serif (Playfair Display, Libre Baskerville, or similar)
- **Body/Data:** Clean sans-serif (Inter, system-ui)
- **Numbers:** Tabular figures for alignment

### Visual Elements
- Subtle paper texture on backgrounds
- Thin wood-tone borders on cards
- Drop shadows suggesting depth (like ledger pages)
- Quill pen or ledger book icons where appropriate
- Green check marks, red X marks for status

### Component Examples
```jsx
// Card style
<div className="bg-parchment-dark border border-wood-medium rounded-lg shadow-md p-4">

// Header style  
<h1 className="font-serif text-wood-dark text-2xl">

// Budget progress bar (under budget)
<div className="bg-ink-green/20 rounded">
  <div className="bg-ink-green h-2 rounded" style={{width: '65%'}} />
</div>

// Over budget indicator
<span className="text-ink-red font-semibold">Over by $2,500</span>
```

## Database Schema

```sql
-- Event types enum
CREATE TYPE event_type AS ENUM ('executive', 'national', 'state', 'regional', 'customer');

-- Fiscal years
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type event_type NOT NULL,
  quarter TEXT, -- Q1, Q2, Q3, Q4, TBD
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  date_start DATE,
  date_end DATE,
  location TEXT,
  budget_amount DECIMAL(12,2) DEFAULT 0,
  opportunity_goal INTEGER,
  approach_notes TEXT,
  marketing_notes TEXT,
  sales_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget categories (non-event buckets)
CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  budget_amount DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  category_id UUID REFERENCES budget_categories(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATE NOT NULL,
  vendor TEXT,
  memo TEXT,
  source_type TEXT NOT NULL, -- 'brex', 'pdf', 'manual'
  source_reference TEXT, -- filename or transaction ID
  status TEXT DEFAULT 'pending', -- 'pending', 'approved'
  is_duplicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- At least one must be set
  CONSTRAINT expense_has_target CHECK (event_id IS NOT NULL OR category_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_expenses_event ON expenses(event_id);
CREATE INDEX idx_expenses_category ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_fiscal_year ON events(fiscal_year_id);
```

## API Routes

```
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/events
POST   /api/events
GET    /api/events/:id
PUT    /api/events/:id
DELETE /api/events/:id

GET    /api/categories
POST   /api/categories
GET    /api/categories/:id
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/expenses
POST   /api/expenses
GET    /api/expenses/:id
PUT    /api/expenses/:id
DELETE /api/expenses/:id

POST   /api/import/brex          -- Upload Brex CSV
POST   /api/import/pdf           -- Upload PDF invoice
POST   /api/import/brex/confirm  -- Confirm AI suggestions

GET    /api/export/csv
GET    /api/export/excel

GET    /api/dashboard/summary    -- Totals, by type, by quarter
```

## Pages

```
/                     -- Dashboard
/login                -- Login
/events               -- Events list
/events/[id]          -- Event detail + expenses
/events/new           -- Add event
/categories           -- Budget categories
/categories/[id]      -- Category detail + expenses
/expenses             -- All expenses
/import               -- Import hub (Brex CSV, PDF)
/import/brex          -- Brex CSV upload + review
/import/pdf           -- PDF upload
/export               -- Export options
/settings             -- Fiscal year, etc.
```

## Fiscal Year
- Calendar year (January 1 - December 31)
- Default view: Current fiscal year (2026)
- User can switch fiscal years in settings or via selector

## Seed Data
Pre-populate from existing budget CSV. Source file: `/Users/treynortetik/.clawdbot/media/inbound/a9b3038f-b924-4592-9753-809d4cdca105.csv`

### Events to Import (2026)
| Name | Type | Quarter | Budget |
|------|------|---------|--------|
| ASHA Annual Meeting | Executive | Q1 | $16,500 |
| Healthtac East | Executive | Q1 | $30,500 |
| NIC Spring Conference | Executive | Q1 | $65,000 |
| Senior Living 100 Conference | Executive | Q1 | $40,000 |
| NIC Growth Conference | Executive | Q2 | $8,700 |
| Alzheimer's Association - Vision Gala | Executive | Q2 | $5,000 |
| SLIF Spring | Executive | Q2 | $35,000 |
| ASHA Mid-Year Meeting | Executive | Q2 | $8,000 |
| NIC Fall Conference | Executive | Q3 | $50,000 |
| Marsh Risk Summit | Executive | Q4 | $7,500 |
| SLIF Fall | Executive | Q4 | $35,000 |
| Argentum Leadership Summit | Executive | Q4 | $38,000 |
| AgeTech | National | TBD | $25,000 |
| AgeTech Workshops | National | TBD | $48,000 |
| Interface West | National | Q1 | $1,700 |
| SHN Sales & Marketing Conference | National | Q1 | $2,200 |
| Argentum PPI | National | Q1 | $2,500 |
| Future Care | National | Q1 | $800 |
| LeadingAge Leadership Summit | National | Q2 | $12,500 |
| LALS LifeLoop+SY Dinner | National | Q2 | $1,500 |
| Argentum Executive Conference | National | Q2 | $80,000 |
| Interface Midwest | National | Q2 | $1,500 |
| NARA Licensing Seminar | National | Q3 | $1,000 |
| WIL Forum | National | Q3 | $5,000 |
| Value Based Care Workshop | National | Q3 | $5,000 |
| SMASH | National | Q4 | $5,000 |
| AHCA/NCAL Convention | National | Q4 | $18,000 |
| LeadingAge Annual Meeting | National | Q4 | $30,000 |
| SHN BUILD/BRAIN Conference | National | Q4 | $15,000 |
| Interface Northeast | National | Q4 | $1,200 |
| OnAging | National | Q2 | $10,000 |
| LeadingAge CA RISE | State | Q1 | $1,200 |
| TALA Annual Conference | State | Q2 | $4,000 |
| LeadingAge CA Annual | State | Q2 | $1,300 |
| CALA Spring Conference | State | Q2 | $11,000 |
| GSLA Gala | State | Q2 | $300 |
| LifeSpan | State | Q3 | $4,000 |
| LeadingAge Southeast | State | Q3 | $4,600 |
| FSLA Conference | State | Q3 | $8,000 |
| Interface SE | State | Q3 | $1,200 |
| GSLA Conference | State | Q4 | $10,000 |
| FSLA Advocacy Days | State | Q4 | $500 |
| CALA Fall Conference | State | Q4 | $10,000 |
| Regional/State Bucket | State | TBD | $60,000 |
| Customer Events (General) | Customer | TBD | $150,000 |

### Budget Categories (Non-Event) to Import
| Name | Budget | Description |
|------|--------|-------------|
| Spare Funds | $30,000 | Pop-up events, sponsorships, activations |
| Exhibit Properties | $15,000 | Booth, retractables, lightbox, displays |
| Swag | $14,000 | Pens, chapstick, notebooks, custom giveaways |
| Marketing Expenses | $5,000 | Shipping, printing, supplies |
| Conference Cost Increase | $50,000 | Anticipated 10% increase buffer |

## Brex CSV Format
Source sample: `/Users/treynortetik/.clawdbot/media/inbound/6dd90917-9161-41a9-9a02-a4df173d077f.csv`

```csv
Transaction date,Amount,Original amount,Original currency,Merchant,Memo,Expense status,Payment status
01/27/2026,120,120,USD,In Transaction - American Seniors Housing Association,,Submitted,Completed
01/18/2026,100,100,USD,Claude,Claude AI subscription for content and AI App generation,Approved,Completed
```

**Fields to extract:**
- `Transaction date` → expense_date
- `Amount` → amount
- `Merchant` → vendor
- `Memo` → memo (AI uses this + vendor to suggest event/category)

## AI Categorization (OpenRouter)
When importing Brex CSV:
1. Parse all transactions
2. For each transaction, send to AI with:
   - Vendor name
   - Memo text
   - List of available events (name + type)
   - List of available categories
3. AI returns suggested event_id or category_id with confidence
4. Display suggestions to user in review table
5. User can accept, change, or skip each
6. Batch confirm to create expenses

**OpenRouter config:**
- Model: `anthropic/claude-3-haiku` (fast, cheap)
- Env var: `OPENROUTER_API_KEY`

## Timeline
- **Target:** Working app by 12:30 PM MST
- **Start:** 3:00 AM
- **Available:** ~9 hours

## Build Order (suggested)
1. `npx create-next-app` with App Router + Tailwind
2. Supabase project + schema
3. Auth middleware (simple login)
4. Dashboard page (totals by type, progress bars)
5. Events CRUD pages
6. Expenses CRUD pages
7. Budget Categories CRUD
8. Brex CSV import + AI review flow
9. PDF import (simpler - just extract + manual assign)
10. Export (CSV/Excel)
11. Theme polish

## Key UX Patterns

### Event Dropdown with Expenses
Each event row can expand to show:
- Budget amount
- Total expenses (actual)
- Remaining
- List of linked expenses
- Add expense button

### Budget Category Same Pattern
Same expand/collapse with linked expenses

### Progress Bars
- Green: Under 80% of budget
- Yellow: 80-100% of budget  
- Red: Over budget
- Show: Actual / Budget (e.g., "$12,500 / $16,500")

### Everything Editable
- Inline edit where possible
- Modal for complex edits
- Delete with confirmation

## Duplicate Detection
When importing Brex:
- Check for existing expense with same: amount + date + vendor
- Flag as potential duplicate
- User decides: skip, import anyway, or merge
