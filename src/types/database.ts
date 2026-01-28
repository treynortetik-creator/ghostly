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
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  roi_notes: string | null;
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
 * Expense with computed display fields
 */
export interface ExpenseWithRelations extends Expense {
  event_name: string | null;
  category_name: string | null;
  target_type: 'event' | 'category';
  target_name: string;
}

// ============================================
// COMPUTED TYPES (with aggregated totals)
// ============================================

/**
 * Event with calculated budget totals
 */
export interface EventWithTotals extends Event {
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

/**
 * Category with calculated budget totals
 */
export interface CategoryWithTotals extends BudgetCategory {
  actual_spent: number;
  remaining: number;
  expense_count: number;
}

/**
 * Computed ROI metrics for an event
 */
export interface EventROIMetrics {
  pipeline_generated: number;
  revenue_closed: number;
  leads_generated: number;
  meetings_booked: number;
  opportunities_created: number;
  roi_notes: string | null;
  actual_spent: number;
  roi_ratio: number | null;
  cost_per_lead: number | null;
  cost_per_meeting: number | null;
  pipeline_to_spend_ratio: number | null;
}

// ============================================
// DISPLAY LABELS
// ============================================

export const eventTypeLabels: Record<EventType, string> = {
  executive: 'Executive',
  national: 'National',
  state: 'State',
  regional: 'Regional',
  customer: 'Customer',
};

export const quarterLabels: Record<QuarterType, string> = {
  Q1: 'Q1 (Jan-Mar)',
  Q2: 'Q2 (Apr-Jun)',
  Q3: 'Q3 (Jul-Sep)',
  Q4: 'Q4 (Oct-Dec)',
  TBD: 'TBD',
};

export const sourceTypeLabels: Record<ExpenseSource, string> = {
  manual: 'Manual Entry',
  brex: 'Brex Import',
  pdf: 'PDF Upload',
};

// ============================================
// JSON TYPE FOR SUPABASE
// ============================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ============================================
// SUPABASE DATABASE TYPE HELPER
// ============================================

/**
 * Database schema type for Supabase client
 */
export interface Database {
  // Internal Supabase type for proper client typing
  __InternalSupabase: {
    PostgrestVersion: '14.1';
  };
  public: {
    Tables: {
      fiscal_years: {
        Row: {
          id: string;
          year: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          year: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          year?: number;
          created_at?: string | null;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          id: string;
          key: string;
          value: Json;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          key: string;
          value: Json;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          key?: string;
          value?: Json;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          name: string;
          event_type: EventType;
          quarter: QuarterType | null;
          fiscal_year_id: string | null;
          date_start: string | null;
          date_end: string | null;
          location: string | null;
          budget_amount: number | null;
          expansion_goal: number | null;
          net_new_goal: number | null;
          approach_notes: string | null;
          marketing_notes: string | null;
          sales_notes: string | null;
          pipeline_generated: number | null;
          revenue_closed: number | null;
          leads_generated: number | null;
          meetings_booked: number | null;
          opportunities_created: number | null;
          roi_notes: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          event_type: EventType;
          quarter?: QuarterType | null;
          fiscal_year_id?: string | null;
          date_start?: string | null;
          date_end?: string | null;
          location?: string | null;
          budget_amount?: number | null;
          expansion_goal?: number | null;
          net_new_goal?: number | null;
          approach_notes?: string | null;
          marketing_notes?: string | null;
          sales_notes?: string | null;
          pipeline_generated?: number | null;
          revenue_closed?: number | null;
          leads_generated?: number | null;
          meetings_booked?: number | null;
          opportunities_created?: number | null;
          roi_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          event_type?: EventType;
          quarter?: QuarterType | null;
          fiscal_year_id?: string | null;
          date_start?: string | null;
          date_end?: string | null;
          location?: string | null;
          budget_amount?: number | null;
          expansion_goal?: number | null;
          net_new_goal?: number | null;
          approach_notes?: string | null;
          marketing_notes?: string | null;
          sales_notes?: string | null;
          pipeline_generated?: number | null;
          revenue_closed?: number | null;
          leads_generated?: number | null;
          meetings_booked?: number | null;
          opportunities_created?: number | null;
          roi_notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      budget_categories: {
        Row: {
          id: string;
          name: string;
          fiscal_year_id: string | null;
          budget_amount: number | null;
          description: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          fiscal_year_id?: string | null;
          budget_amount?: number | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          fiscal_year_id?: string | null;
          budget_amount?: number | null;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          event_id: string | null;
          category_id: string | null;
          amount: number;
          expense_date: string;
          vendor: string | null;
          memo: string | null;
          source_type: ExpenseSource;
          source_reference: string | null;
          is_duplicate: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          event_id?: string | null;
          category_id?: string | null;
          amount: number;
          expense_date: string;
          vendor?: string | null;
          memo?: string | null;
          source_type?: ExpenseSource;
          source_reference?: string | null;
          is_duplicate?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string | null;
          category_id?: string | null;
          amount?: number;
          expense_date?: string;
          vendor?: string | null;
          memo?: string | null;
          source_type?: ExpenseSource;
          source_reference?: string | null;
          is_duplicate?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      error_logs: {
        Row: {
          id: string;
          level: string;
          message: string;
          stack: string | null;
          context: Json | null;
          source: string;
          user_id: string | null;
          url: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          level?: string;
          message: string;
          stack?: string | null;
          context?: Json | null;
          source?: string;
          user_id?: string | null;
          url?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          level?: string;
          message?: string;
          stack?: string | null;
          context?: Json | null;
          source?: string;
          user_id?: string | null;
          url?: string | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      event_type: EventType;
      quarter_type: QuarterType;
      expense_source: ExpenseSource;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
