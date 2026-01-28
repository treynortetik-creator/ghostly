/**
 * The Counting House - Database TypeScript Types
 * Victorian-themed budget tracking app for senior living industry events
 */

// ============================================
// ENUM TYPES
// ============================================

export type EventType = 'executive' | 'national' | 'state' | 'regional' | 'customer';

export type QuarterType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'TBD';

export type ExpenseSource = 'brex' | 'pdf' | 'manual';

// ============================================
// TABLE INTERFACES
// ============================================

/**
 * Fiscal year record
 */
export interface FiscalYear {
  id: string;
  year: number;
  created_at: string;
}

/**
 * App settings for configuration (e.g., OpenRouter model selection)
 */
export interface AppSetting {
  id: string;
  key: string;
  value: Record<string, unknown>;
  updated_at: string;
}

/**
 * Event record - conferences, meetings, galas, etc.
 */
export interface Event {
  id: string;
  name: string;
  event_type: EventType;
  quarter: QuarterType;
  fiscal_year_id: string | null;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  budget_amount: number;
  expansion_goal: number;
  net_new_goal: number;
  approach_notes: string | null;
  marketing_notes: string | null;
  sales_notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Budget category for non-event expenses
 */
export interface BudgetCategory {
  id: string;
  name: string;
  fiscal_year_id: string | null;
  budget_amount: number;
  description: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Expense record - individual line items
 * Note: Exactly one of event_id or category_id must be set (XOR constraint)
 */
export interface Expense {
  id: string;
  event_id: string | null;
  category_id: string | null;
  amount: number;
  expense_date: string;
  vendor: string | null;
  memo: string | null;
  source_type: ExpenseSource;
  source_reference: string | null;
  is_duplicate: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ============================================
// INSERT/UPDATE TYPES (without auto-generated fields)
// ============================================

export type FiscalYearInsert = Omit<FiscalYear, 'id' | 'created_at'>;

export type AppSettingInsert = Omit<AppSetting, 'id' | 'updated_at'>;
export type AppSettingUpdate = Partial<Omit<AppSetting, 'id'>>;

export type EventInsert = Omit<Event, 'id' | 'created_at' | 'updated_at'>;
export type EventUpdate = Partial<Omit<Event, 'id' | 'created_at'>>;

export type BudgetCategoryInsert = Omit<BudgetCategory, 'id' | 'created_at' | 'updated_at'>;
export type BudgetCategoryUpdate = Partial<Omit<BudgetCategory, 'id' | 'created_at'>>;

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
export type ExpenseUpdate = Partial<Omit<Expense, 'id' | 'created_at'>>;

// ============================================
// EXTENDED TYPES (with relations)
// ============================================

/**
 * Event with its fiscal year populated
 */
export interface EventWithFiscalYear extends Event {
  fiscal_year: FiscalYear | null;
}

/**
 * Budget category with its fiscal year populated
 */
export interface BudgetCategoryWithFiscalYear extends BudgetCategory {
  fiscal_year: FiscalYear | null;
}

/**
 * Expense with its related event or category populated
 */
export interface ExpenseWithRelations extends Expense {
  event: Event | null;
  category: BudgetCategory | null;
}

// ============================================
// SUPABASE DATABASE TYPE HELPER
// ============================================

/**
 * Database schema type for Supabase client
 */
export interface Database {
  public: {
    Tables: {
      fiscal_years: {
        Row: FiscalYear;
        Insert: FiscalYearInsert;
        Update: Partial<FiscalYearInsert>;
      };
      app_settings: {
        Row: AppSetting;
        Insert: AppSettingInsert;
        Update: AppSettingUpdate;
      };
      events: {
        Row: Event;
        Insert: EventInsert;
        Update: EventUpdate;
      };
      budget_categories: {
        Row: BudgetCategory;
        Insert: BudgetCategoryInsert;
        Update: BudgetCategoryUpdate;
      };
      expenses: {
        Row: Expense;
        Insert: ExpenseInsert;
        Update: ExpenseUpdate;
      };
    };
    Enums: {
      event_type: EventType;
      quarter_type: QuarterType;
      expense_source: ExpenseSource;
    };
  };
}
