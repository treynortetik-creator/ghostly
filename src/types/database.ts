/**
 * The Counting House - Database TypeScript Types
 * Victorian-themed budget tracking app for senior living industry events
 */

// ============================================
// ENUM TYPES
// ============================================

/**
 * @deprecated Use EventTypeRecord from event_types table instead.
 * Kept for backward compatibility during migration.
 */
export type EventType = 'executive' | 'national' | 'state' | 'regional' | 'customer';

export type QuarterType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'TBD';

export type ExpenseSource = 'brex' | 'pdf' | 'manual';

export type ChecklistPhase = 'pre_event' | 'day_of' | 'post_event';

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
 * Event type record - configurable event categories with budgets
 */
export interface EventTypeRecord {
  id: string;
  name: string;
  description: string | null;
  fiscal_year_id: string | null;
  budget_amount: number;
  is_archived: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Event type with computed totals for display
 */
export interface EventTypeWithTotals extends EventTypeRecord {
  actual_spent: number;
  event_count: number;
  remaining: number;
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
  /** @deprecated Use event_type_id instead */
  event_type: EventType;
  event_type_id: string | null;
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

/**
 * Team member record
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  default_role: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Event team assignment (join table)
 */
export interface EventTeamAssignment {
  id: string;
  event_id: string;
  team_member_id: string;
  event_role: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Checklist template (reusable across events)
 */
export interface ChecklistTemplate {
  id: string;
  name: string;
  event_type: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Checklist template item
 */
export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  title: string;
  description: string | null;
  phase: ChecklistPhase;
  default_assignee_role: string | null;
  days_offset: number | null;
  sort_order: number;
  created_at: string;
}

/**
 * Event checklist item (instance from template)
 */
export interface EventChecklistItem {
  id: string;
  event_id: string;
  template_item_id: string | null;
  title: string;
  description: string | null;
  phase: ChecklistPhase;
  assignee_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// ============================================
// INSERT/UPDATE TYPES (without auto-generated fields)
// ============================================

export type FiscalYearInsert = Omit<FiscalYear, 'id' | 'created_at'>;

export type EventTypeRecordInsert = Omit<EventTypeRecord, 'id' | 'created_at' | 'updated_at'>;
export type EventTypeRecordUpdate = Partial<Omit<EventTypeRecord, 'id' | 'created_at'>>;

export type AppSettingInsert = Omit<AppSetting, 'id' | 'updated_at'>;
export type AppSettingUpdate = Partial<Omit<AppSetting, 'id'>>;

export type EventInsert = Omit<Event, 'id' | 'created_at' | 'updated_at'>;
export type EventUpdate = Partial<Omit<Event, 'id' | 'created_at'>>;

export type BudgetCategoryInsert = Omit<BudgetCategory, 'id' | 'created_at' | 'updated_at'>;
export type BudgetCategoryUpdate = Partial<Omit<BudgetCategory, 'id' | 'created_at'>>;

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at' | 'updated_at'>;
export type ExpenseUpdate = Partial<Omit<Expense, 'id' | 'created_at'>>;

export type TeamMemberInsert = Omit<TeamMember, 'id' | 'created_at' | 'updated_at'>;
export type TeamMemberUpdate = Partial<Omit<TeamMember, 'id' | 'created_at'>>;

export type EventTeamAssignmentInsert = Omit<EventTeamAssignment, 'id' | 'created_at' | 'updated_at'>;
export type EventTeamAssignmentUpdate = Partial<Omit<EventTeamAssignment, 'id' | 'created_at'>>;

export type ChecklistTemplateInsert = Omit<ChecklistTemplate, 'id' | 'created_at' | 'updated_at'>;
export type ChecklistTemplateUpdate = Partial<Omit<ChecklistTemplate, 'id' | 'created_at'>>;

export type ChecklistTemplateItemInsert = Omit<ChecklistTemplateItem, 'id' | 'created_at'>;

export type EventChecklistItemInsert = Omit<EventChecklistItem, 'id' | 'created_at' | 'updated_at'>;
export type EventChecklistItemUpdate = Partial<Omit<EventChecklistItem, 'id' | 'created_at'>>;

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
 * Event with its event type populated
 */
export interface EventWithEventType extends Event {
  event_type_record: EventTypeRecord | null;
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

/**
 * Event team assignment with member details
 */
export interface EventTeamAssignmentWithMember extends EventTeamAssignment {
  team_member: TeamMember;
}

/**
 * Event checklist item with assignee details
 */
export interface EventChecklistItemWithAssignee extends EventChecklistItem {
  assignee: TeamMember | null;
}

/**
 * Checklist template with items
 */
export interface ChecklistTemplateWithItems extends ChecklistTemplate {
  items: ChecklistTemplateItem[];
  item_count: number;
}

// ============================================
// COMPUTED TYPES (with aggregated totals)
// ============================================

/**
 * Event with calculated budget totals and event type record
 */
export interface EventWithTotals extends Event {
  event_type_record: EventTypeRecord | null;
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

/**
 * @deprecated Use EventTypeRecord.name from event_types table instead.
 * Kept for backward compatibility during migration.
 */
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

export const checklistPhaseLabels: Record<ChecklistPhase, string> = {
  pre_event: 'Before the Affair',
  day_of: 'The Day Itself',
  post_event: 'After the Affair',
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
      event_types: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          fiscal_year_id: string | null;
          budget_amount: number;
          is_archived: boolean;
          display_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          fiscal_year_id?: string | null;
          budget_amount?: number;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          fiscal_year_id?: string | null;
          budget_amount?: number;
          is_archived?: boolean;
          display_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_types_fiscal_year_id_fkey';
            columns: ['fiscal_year_id'];
            referencedRelation: 'fiscal_years';
            referencedColumns: ['id'];
          }
        ];
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
          /** @deprecated Use event_type_id instead */
          event_type: EventType;
          event_type_id: string | null;
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
          /** @deprecated Use event_type_id instead */
          event_type: EventType;
          event_type_id?: string | null;
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
          /** @deprecated Use event_type_id instead */
          event_type?: EventType;
          event_type_id?: string | null;
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
      team_members: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          default_role: string | null;
          is_active: boolean;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          phone?: string | null;
          default_role?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          phone?: string | null;
          default_role?: string | null;
          is_active?: boolean;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      event_team_assignments: {
        Row: {
          id: string;
          event_id: string;
          team_member_id: string;
          event_role: string | null;
          notes: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          team_member_id: string;
          event_role?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          team_member_id?: string;
          event_role?: string | null;
          notes?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      checklist_templates: {
        Row: {
          id: string;
          name: string;
          event_type: string | null;
          is_default: boolean;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          event_type?: string | null;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          event_type?: string | null;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      checklist_template_items: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          description: string | null;
          phase: ChecklistPhase;
          default_assignee_role: string | null;
          days_offset: number | null;
          sort_order: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          title: string;
          description?: string | null;
          phase: ChecklistPhase;
          default_assignee_role?: string | null;
          days_offset?: number | null;
          sort_order?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          description?: string | null;
          phase?: ChecklistPhase;
          default_assignee_role?: string | null;
          days_offset?: number | null;
          sort_order?: number;
          created_at?: string | null;
        };
        Relationships: [];
      };
      event_checklist_items: {
        Row: {
          id: string;
          event_id: string;
          template_item_id: string | null;
          title: string;
          description: string | null;
          phase: ChecklistPhase;
          assignee_id: string | null;
          due_date: string | null;
          completed_at: string | null;
          completed_by: string | null;
          sort_order: number;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          template_item_id?: string | null;
          title: string;
          description?: string | null;
          phase: ChecklistPhase;
          assignee_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          sort_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          template_item_id?: string | null;
          title?: string;
          description?: string | null;
          phase?: ChecklistPhase;
          assignee_id?: string | null;
          due_date?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          sort_order?: number;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      idempotency_keys: {
        Row: {
          id: string;
          key: string;
          method: string;
          path: string;
          status_code: number | null;
          response_body: Json | null;
          created_at: string | null;
          expires_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          method: string;
          path: string;
          status_code?: number | null;
          response_body?: Json | null;
          created_at?: string | null;
          expires_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          method?: string;
          path?: string;
          status_code?: number | null;
          response_body?: Json | null;
          created_at?: string | null;
          expires_at?: string;
        };
        Relationships: [];
      };
      api_keys: {
        Row: {
          id: string;
          key_hash: string;
          agent_name: string;
          label: string | null;
          permissions: string[];
          is_active: boolean;
          last_used_at: string | null;
          expires_at: string | null;
          created_at: string | null;
          updated_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          key_hash: string;
          agent_name: string;
          label?: string | null;
          permissions?: string[];
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          key_hash?: string;
          agent_name?: string;
          label?: string | null;
          permissions?: string[];
          is_active?: boolean;
          last_used_at?: string | null;
          expires_at?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
          revoked_at?: string | null;
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
      checklist_phase: ChecklistPhase;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
