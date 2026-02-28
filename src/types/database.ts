/**
 * Ghostly - Database TypeScript Types
 * Victorian-themed budget tracking app for senior living industry events
 */

// ============================================
// ENUM TYPES
// ============================================

/**
 * Legacy event type enum - still actively used in DB column and forms.
 * Will be removed once event_type_id migration is fully complete.
 */
export type EventType = 'executive' | 'national' | 'state' | 'regional' | 'customer';

export type QuarterType = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'TBD';

export type ExpenseSource = 'brex' | 'pdf' | 'manual';

export type DocumentSource = 'upload' | 'api';

export type ChecklistPhase = 'pre_event' | 'day_of' | 'post_event';

export type EventStage = 'confirmed' | 'in_progress' | 'ready' | 'active' | 'debrief' | 'archived';
export type EventTier = 'executive' | 'national_t1' | 'national_t2' | 'state_t1' | 'state_t2' | 'customer_partner';
export type ShippingHandler = string; // Free text — configurable per org (was hardcoded 'handler_a' | 'handler_b')

export type OrgRole = 'owner' | 'admin' | 'member';

// ============================================
// TABLE INTERFACES
// ============================================

/**
 * Organization (tenant)
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan_tier: string;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Organization membership
 */
export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string | null;
  email: string | null;
  role: OrgRole;
  legacy_username: string | null;
  invited_at: string;
  accepted_at: string | null;
}

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
  stage: EventStage;
  tier: EventTier | null;
  shipping_handler: ShippingHandler;
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
  category: string | null;
  tier_executive: boolean;
  tier_national_t1: boolean;
  tier_national_t2: boolean;
  tier_state_t1: boolean;
  tier_state_t2: boolean;
  tier_customer: boolean;
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
  category: string | null;
  created_at: string;
  updated_at: string;
}

// 'agent' - displayed as 'AI Agent' in the UI
export type NotifyChannel = 'agent' | 'in_app' | 'both';

export type ReminderStatus = 'pending' | 'sent' | 'dismissed' | 'snoozed';

/**
 * Cadence template — reusable reminder schedule tied to an event type
 */
export interface CadenceTemplate {
  id: string;
  name: string;
  event_type_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Cadence milestone — individual reminder offset within a template
 */
export interface CadenceMilestone {
  id: string;
  template_id: string;
  offset_days: number;
  title: string;
  description: string | null;
  notify_channel: NotifyChannel;
  display_order: number;
  created_at: string;
}

/**
 * Event reminder — concrete reminder instance for a specific event
 */
export interface EventReminder {
  id: string;
  event_id: string;
  milestone_id: string | null;
  reminder_date: string;
  title: string;
  description: string | null;
  status: ReminderStatus;
  sent_at: string | null;
  created_at: string;
}

/**
 * Event shipment - tracking shipments related to events
 */
export interface EventShipment {
  id: string;
  event_id: string;
  description: string;
  carrier: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  ship_date: string | null;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  shipped_from: string | null;
  shipped_to: string | null;
  weight_lbs: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Document record - files attached to events or expenses
 */
export interface Document {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size_bytes: number;
  storage_path: string;
  source: DocumentSource;
  event_id: string | null;
  expense_id: string | null;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

/**
 * Document with joined event/expense name for display
 */
export interface DocumentWithRelations extends Document {
  event_name: string | null;
  expense_vendor: string | null;
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

export type CadenceTemplateInsert = Omit<CadenceTemplate, 'id' | 'created_at' | 'updated_at'>;
export type CadenceTemplateUpdate = Partial<Omit<CadenceTemplate, 'id' | 'created_at'>>;

export type CadenceMilestoneInsert = Omit<CadenceMilestone, 'id' | 'created_at'>;

export type EventReminderInsert = Omit<EventReminder, 'id' | 'created_at'>;
export type EventReminderUpdate = Partial<Omit<EventReminder, 'id' | 'created_at'>>;

export type EventShipmentInsert = Omit<EventShipment, 'id' | 'created_at' | 'updated_at'>;
export type EventShipmentUpdate = Partial<Omit<EventShipment, 'id' | 'created_at'>>;

export type DocumentInsert = Omit<Document, 'id' | 'created_at' | 'updated_at'>;
export type DocumentUpdate = Partial<Omit<Document, 'id' | 'created_at'>>;

// ============================================
// EXTENDED TYPES (with relations)
// ============================================

/**
 * Expense row with joined event and category data from Supabase.
 * Used when selecting expenses with `.select('*, events(name, event_type_id, event_types(name)), budget_categories(name)')`.
 */
export interface ExpenseWithJoins {
  id: string;
  event_id: string | null;
  category_id: string | null;
  amount: number;
  expense_date: string;
  vendor: string | null;
  memo: string | null;
  source_type: string;
  source_reference: string | null;
  is_duplicate: boolean | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  events: { id: string; name: string; event_type_id: string | null; event_types?: { name: string } | null } | null;
  budget_categories: { id: string; name: string } | null;
}

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

/**
 * Cadence template with milestones and optional event type name
 */
export interface CadenceTemplateWithMilestones extends CadenceTemplate {
  milestones: CadenceMilestone[];
  milestone_count: number;
  event_type_name?: string | null;
}

/**
 * Event reminder with event name for display
 */
export interface EventReminderWithEvent extends EventReminder {
  event_name: string;
  event_date_start: string | null;
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
 * Legacy event type display labels - still actively used.
 * Will be removed once event_type_id migration is fully complete.
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

export const eventStageLabels: Record<EventStage, string> = {
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready: 'Ready',
  active: 'Active',
  debrief: 'Debrief',
  archived: 'Archived',
};

export const eventTierLabels: Record<EventTier, string> = {
  executive: 'Executive',
  national_t1: 'National T1',
  national_t2: 'National T2',
  state_t1: 'State T1',
  state_t2: 'State T2',
  customer_partner: 'Customer/Partner',
};

export const tierColors: Record<EventTier, { bg: string; text: string; border: string }> = {
  executive: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', border: 'border-red-300 dark:border-red-800' },
  national_t1: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-300', border: 'border-orange-300 dark:border-orange-800' },
  national_t2: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-300', border: 'border-yellow-300 dark:border-yellow-800' },
  state_t1: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', border: 'border-blue-300 dark:border-blue-800' },
  state_t2: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-800 dark:text-sky-300', border: 'border-sky-300 dark:border-sky-800' },
  customer_partner: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', border: 'border-green-300 dark:border-green-800' },
};

export const tierBarColors: Record<EventTier, string> = {
  executive: 'bg-red-500 dark:bg-red-600',
  national_t1: 'bg-orange-500 dark:bg-orange-600',
  national_t2: 'bg-yellow-500 dark:bg-yellow-500',
  state_t1: 'bg-blue-500 dark:bg-blue-600',
  state_t2: 'bg-sky-400 dark:bg-sky-500',
  customer_partner: 'bg-green-500 dark:bg-green-600',
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
// AGENT TABLES
// ============================================

/**
 * Agent chat session
 */
export interface ChatSession {
  id: string;
  organization_id: string;
  user_id: string | null;
  title: string | null;
  event_id: string | null;
  context_tokens_used: number;
  context_summary: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Agent chat message
 */
export interface ChatMessage {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls: Record<string, unknown>[] | null;
  tool_results: Record<string, unknown>[] | null;
  created_at: string | null;
}

/**
 * Agent settings per organization
 */
export interface AgentSettings {
  organization_id: string;
  agent_name: string | null;
  agent_focus: string | null;
  heartbeat_enabled: boolean | null;
  heartbeat_interval: number;
  heartbeat_prompt: string;
  notification_channel: string | null;
  connected_integrations: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

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
          stage: string;
          tier: string | null;
          shipping_handler: string;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
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
          stage?: string;
          tier?: string | null;
          shipping_handler?: string;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
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
          stage?: string;
          tier?: string | null;
          shipping_handler?: string;
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
          category: string | null;
          tier_executive: boolean;
          tier_national_t1: boolean;
          tier_national_t2: boolean;
          tier_state_t1: boolean;
          tier_state_t2: boolean;
          tier_customer: boolean;
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
          category?: string | null;
          tier_executive?: boolean;
          tier_national_t1?: boolean;
          tier_national_t2?: boolean;
          tier_state_t1?: boolean;
          tier_state_t2?: boolean;
          tier_customer?: boolean;
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
          category?: string | null;
          tier_executive?: boolean;
          tier_national_t1?: boolean;
          tier_national_t2?: boolean;
          tier_state_t1?: boolean;
          tier_state_t2?: boolean;
          tier_customer?: boolean;
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
          category: string | null;
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
          category?: string | null;
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
          category?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      event_notes: {
        Row: {
          id: string;
          event_id: string;
          author: string;
          note_type: string | null;
          title: string | null;
          content: string;
          metadata: Json | null;
          pinned: boolean | null;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          author: string;
          note_type?: string | null;
          title?: string | null;
          content: string;
          metadata?: Json | null;
          pinned?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          author?: string;
          note_type?: string | null;
          title?: string | null;
          content?: string;
          metadata?: Json | null;
          pinned?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_notes_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      event_shipments: {
        Row: {
          id: string;
          event_id: string;
          description: string;
          carrier: string | null;
          tracking_number: string | null;
          tracking_url: string | null;
          status: string;
          ship_date: string | null;
          estimated_delivery: string | null;
          actual_delivery: string | null;
          shipped_from: string | null;
          shipped_to: string | null;
          weight_lbs: number | null;
          notes: string | null;
          created_by: string;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          description: string;
          carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          status?: string;
          ship_date?: string | null;
          estimated_delivery?: string | null;
          actual_delivery?: string | null;
          shipped_from?: string | null;
          shipped_to?: string | null;
          weight_lbs?: number | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          description?: string;
          carrier?: string | null;
          tracking_number?: string | null;
          tracking_url?: string | null;
          status?: string;
          ship_date?: string | null;
          estimated_delivery?: string | null;
          actual_delivery?: string | null;
          shipped_from?: string | null;
          shipped_to?: string | null;
          weight_lbs?: number | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_shipments_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
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
      audit_log: {
        Row: {
          id: string;
          entity_type: string;
          entity_id: string;
          action: string;
          changes: Json | null;
          actor: string;
          actor_type: string;
          metadata: Json | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          entity_type: string;
          entity_id: string;
          action: string;
          changes?: Json | null;
          actor: string;
          actor_type?: string;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          entity_type?: string;
          entity_id?: string;
          action?: string;
          changes?: Json | null;
          actor?: string;
          actor_type?: string;
          metadata?: Json | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      reminder_config: {
        Row: {
          id: string;
          reminder_type: string;
          enabled: boolean;
          days_before: number;
          channel: string;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          reminder_type: string;
          enabled?: boolean;
          days_before?: number;
          channel?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          reminder_type?: string;
          enabled?: boolean;
          days_before?: number;
          channel?: string;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      reminder_log: {
        Row: {
          id: string;
          reminder_type: string;
          entity_type: string;
          entity_id: string;
          sent_at: string | null;
          channel: string;
        };
        Insert: {
          id?: string;
          reminder_type: string;
          entity_type: string;
          entity_id: string;
          sent_at?: string | null;
          channel: string;
        };
        Update: {
          id?: string;
          reminder_type?: string;
          entity_type?: string;
          entity_id?: string;
          sent_at?: string | null;
          channel?: string;
        };
        Relationships: [];
      };
      webhooks: {
        Row: {
          id: string;
          url: string;
          event_types: Json;
          secret: string | null;
          is_active: boolean;
          description: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          url: string;
          event_types: Json;
          secret?: string | null;
          is_active?: boolean;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          url?: string;
          event_types?: Json;
          secret?: string | null;
          is_active?: boolean;
          description?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      cadence_templates: {
        Row: {
          id: string;
          name: string;
          event_type_id: string | null;
          is_default: boolean;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          event_type_id?: string | null;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          event_type_id?: string | null;
          is_default?: boolean;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cadence_templates_event_type_id_fkey';
            columns: ['event_type_id'];
            referencedRelation: 'event_types';
            referencedColumns: ['id'];
          }
        ];
      };
      cadence_milestones: {
        Row: {
          id: string;
          template_id: string;
          offset_days: number;
          title: string;
          description: string | null;
          notify_channel: string;
          display_order: number;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          offset_days: number;
          title: string;
          description?: string | null;
          notify_channel?: string;
          display_order?: number;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          template_id?: string;
          offset_days?: number;
          title?: string;
          description?: string | null;
          notify_channel?: string;
          display_order?: number;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'cadence_milestones_template_id_fkey';
            columns: ['template_id'];
            referencedRelation: 'cadence_templates';
            referencedColumns: ['id'];
          }
        ];
      };
      event_reminders: {
        Row: {
          id: string;
          event_id: string;
          milestone_id: string | null;
          reminder_date: string;
          title: string;
          description: string | null;
          status: string;
          sent_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          event_id: string;
          milestone_id?: string | null;
          reminder_date: string;
          title: string;
          description?: string | null;
          status?: string;
          sent_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          event_id?: string;
          milestone_id?: string | null;
          reminder_date?: string;
          title?: string;
          description?: string | null;
          status?: string;
          sent_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'event_reminders_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_reminders_milestone_id_fkey';
            columns: ['milestone_id'];
            referencedRelation: 'cadence_milestones';
            referencedColumns: ['id'];
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          filename: string;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          storage_path: string;
          source: DocumentSource;
          event_id: string | null;
          expense_id: string | null;
          uploaded_by: string;
          created_at: string | null;
          updated_at: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          filename: string;
          original_filename: string;
          mime_type: string;
          file_size_bytes: number;
          storage_path: string;
          source?: DocumentSource;
          event_id?: string | null;
          expense_id?: string | null;
          uploaded_by?: string;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          filename?: string;
          original_filename?: string;
          mime_type?: string;
          file_size_bytes?: number;
          storage_path?: string;
          source?: DocumentSource;
          event_id?: string | null;
          expense_id?: string | null;
          uploaded_by?: string;
          created_at?: string | null;
          updated_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'documents_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'documents_expense_id_fkey';
            columns: ['expense_id'];
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          }
        ];
      };
      webhook_deliveries: {
        Row: {
          id: string;
          webhook_id: string;
          event_type: string;
          payload: Json;
          status: string;
          response_status: number | null;
          response_body: string | null;
          attempts: number;
          next_retry_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          webhook_id: string;
          event_type: string;
          payload: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          next_retry_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          webhook_id?: string;
          event_type?: string;
          payload?: Json;
          status?: string;
          response_status?: number | null;
          response_body?: string | null;
          attempts?: number;
          next_retry_at?: string | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'webhook_deliveries_webhook_id_fkey';
            columns: ['webhook_id'];
            referencedRelation: 'webhooks';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_sessions: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string | null;
          title: string | null;
          event_id: string | null;
          context_tokens_used: number;
          context_summary: string | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id?: string | null;
          title?: string | null;
          event_id?: string | null;
          context_tokens_used?: number;
          context_summary?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string | null;
          title?: string | null;
          event_id?: string | null;
          context_tokens_used?: number;
          context_summary?: string | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_sessions_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'chat_sessions_event_id_fkey';
            columns: ['event_id'];
            referencedRelation: 'events';
            referencedColumns: ['id'];
          }
        ];
      };
      chat_messages: {
        Row: {
          id: string;
          session_id: string;
          role: string;
          content: string | null;
          tool_calls: Record<string, unknown>[] | null;
          tool_results: Record<string, unknown>[] | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          role: string;
          content?: string | null;
          tool_calls?: Record<string, unknown>[] | null;
          tool_results?: Record<string, unknown>[] | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          role?: string;
          content?: string | null;
          tool_calls?: Record<string, unknown>[] | null;
          tool_results?: Record<string, unknown>[] | null;
          created_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'chat_messages_session_id_fkey';
            columns: ['session_id'];
            referencedRelation: 'chat_sessions';
            referencedColumns: ['id'];
          }
        ];
      };
      agent_settings: {
        Row: {
          organization_id: string;
          agent_name: string | null;
          agent_focus: string | null;
          heartbeat_enabled: boolean | null;
          heartbeat_interval: number;
          heartbeat_prompt: string;
          notification_channel: string | null;
          connected_integrations: Record<string, unknown> | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          organization_id: string;
          agent_name?: string | null;
          agent_focus?: string | null;
          heartbeat_enabled?: boolean | null;
          heartbeat_interval?: number;
          heartbeat_prompt?: string;
          notification_channel?: string | null;
          connected_integrations?: Record<string, unknown> | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          organization_id?: string;
          agent_name?: string | null;
          agent_focus?: string | null;
          heartbeat_enabled?: boolean | null;
          heartbeat_interval?: number;
          heartbeat_prompt?: string;
          notification_channel?: string | null;
          connected_integrations?: Record<string, unknown> | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_settings_organization_id_fkey';
            columns: ['organization_id'];
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      agent_cron_jobs: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          schedule_preset: string;
          cron_expression: string;
          agent_prompt: string;
          enabled: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          schedule_preset?: string;
          cron_expression: string;
          agent_prompt: string;
          enabled?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          schedule_preset?: string;
          cron_expression?: string;
          agent_prompt?: string;
          enabled?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'agent_cron_jobs_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          organization_id: string;
          type: 'agent_message' | 'budget_alert' | 'task_reminder' | 'custom_reminder';
          title: string;
          message: string;
          metadata: Record<string, unknown>;
          is_read: boolean;
          dismissed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          type: 'agent_message' | 'budget_alert' | 'task_reminder' | 'custom_reminder';
          title: string;
          message: string;
          metadata?: Record<string, unknown>;
          is_read?: boolean;
          dismissed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          type?: 'agent_message' | 'budget_alert' | 'task_reminder' | 'custom_reminder';
          title?: string;
          message?: string;
          metadata?: Record<string, unknown>;
          is_read?: boolean;
          dismissed_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'notifications_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          }
        ];
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
      document_source: DocumentSource;
      event_stage: EventStage;
      event_tier: EventTier;
      shipping_handler: ShippingHandler;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
