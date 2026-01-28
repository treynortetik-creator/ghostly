-- The Counting House - Initial Database Schema
-- A Victorian-themed budget tracking app for senior living industry events

-- ENUMs
CREATE TYPE event_type AS ENUM ('executive', 'national', 'state', 'regional', 'customer');
CREATE TYPE quarter_type AS ENUM ('Q1', 'Q2', 'Q3', 'Q4', 'TBD');
CREATE TYPE expense_source AS ENUM ('brex', 'pdf', 'manual');

-- Fiscal years (simplified)
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings (for OpenRouter model selection, etc.)
CREATE TABLE app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  event_type event_type NOT NULL,
  quarter quarter_type DEFAULT 'TBD',
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  date_start DATE,
  date_end DATE,
  location TEXT,
  budget_amount DECIMAL(12,2) DEFAULT 0,
  expansion_goal INTEGER DEFAULT 0,
  net_new_goal INTEGER DEFAULT 0,
  approach_notes TEXT,
  marketing_notes TEXT,
  sales_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Budget categories (non-event)
CREATE TABLE budget_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  budget_amount DECIMAL(12,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
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
  source_type expense_source NOT NULL DEFAULT 'manual',
  source_reference TEXT,
  is_duplicate BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- XOR constraint: exactly one must be set
  CONSTRAINT expense_has_exactly_one_target CHECK (
    (event_id IS NOT NULL AND category_id IS NULL) OR
    (event_id IS NULL AND category_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_expenses_event ON expenses(event_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_category ON expenses(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_vendor ON expenses(vendor);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_fiscal_year ON events(fiscal_year_id);
