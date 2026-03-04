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

export type DocumentSource = 'upload' | 'api' | 'generated';

export type SectionContentType = 'text' | 'table' | 'list' | 'custom';

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
  is_archived: boolean | null;
  display_order: number | null;
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
  budget_bucket: 'event' | 'travel' | 'category';
  travel_logistics_entry_id: string | null;
  travel_cost_type: 'lodging' | 'airfare' | 'ground_transport' | 'meals' | 'misc' | null;
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
 * Contact type enum
 */
export type ContactType = 'vendor' | 'lead' | 'organizer' | 'partner' | 'other';

export type IntegrationType = 'slack';
export type IntegrationStatus = 'active' | 'disconnected';
export type DigestType = 'daily' | 'weekly';

/**
 * Contact record
 */
export interface Contact {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  contact_type: ContactType;
  notes: string | null;
  last_contacted: string | null;
  source: string | null;
  created_by: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type ContactInsert = Omit<Contact, 'id' | 'created_at' | 'updated_at'>;
export type ContactUpdate = Partial<Omit<Contact, 'id' | 'created_at'>>;

/**
 * Event-Contact association (join table)
 */
export interface EventContact {
  id: string;
  event_id: string;
  contact_id: string;
  contact_role: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventContactWithContact extends EventContact {
  contact: Contact;
}

/**
 * Document template - reusable structure for generating documents
 */
export interface DocumentTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type DocumentTemplateInsert = Omit<DocumentTemplate, 'id' | 'created_at' | 'updated_at'>;
export type DocumentTemplateUpdate = Partial<Omit<DocumentTemplate, 'id' | 'created_at'>>;

/**
 * Template section - ordered content block within a template
 */
export interface TemplateSection {
  id: string;
  template_id: string;
  title: string;
  content_type: SectionContentType;
  ai_instructions: string | null;
  default_content: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type TemplateSectionInsert = Omit<TemplateSection, 'id' | 'created_at' | 'updated_at'>;
export type TemplateSectionUpdate = Partial<Omit<TemplateSection, 'id' | 'created_at'>>;

/**
 * Template with its sections included
 */
export interface DocumentTemplateWithSections extends DocumentTemplate {
  sections: TemplateSection[];
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
 * Event travel/logistics entry - one travel plan per attendee for an event
 */
export interface EventTravelLogistics {
  id: string;
  event_id: string;
  team_member_id: string | null;
  traveler_name: string;
  traveler_email: string | null;
  traveler_role: string | null;
  hotel_name: string | null;
  hotel_address: string | null;
  hotel_check_in: string | null;
  hotel_check_out: string | null;
  hotel_confirmation_number: string | null;
  flight_airline: string | null;
  flight_number: string | null;
  flight_departure_airport: string | null;
  flight_arrival_airport: string | null;
  flight_departure_at: string | null;
  flight_arrival_at: string | null;
  flight_confirmation_number: string | null;
  ground_transport_mode: string | null;
  ground_transport_details: string | null;
  lodging_budget: number | null;
  airfare_budget: number | null;
  ground_transport_budget: number | null;
  meals_budget: number | null;
  misc_travel_budget: number | null;
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
  ai_summary: string | null;
  ai_tags: string[];
  chat_session_id: string | null;
  template_id: string | null;
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

export type EventTravelLogisticsInsert = Omit<EventTravelLogistics, 'id' | 'created_at' | 'updated_at'>;
export type EventTravelLogisticsUpdate = Partial<Omit<EventTravelLogistics, 'id' | 'created_at'>>;

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
  budget_bucket: 'event' | 'travel' | 'category';
  travel_logistics_entry_id: string | null;
  travel_cost_type: 'lodging' | 'airfare' | 'ground_transport' | 'meals' | 'misc' | null;
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
  attachments: Record<string, unknown>[];
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

// ─── Integration Types ──────────────────────────────────────────────────────

export interface Integration {
  id: string;
  organization_id: string;
  type: IntegrationType;
  status: IntegrationStatus;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  installed_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationNotificationRoute {
  id: string;
  organization_id: string;
  integration_id: string;
  notification_type: string;
  destination: string;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface IntegrationEventChannel {
  id: string;
  organization_id: string;
  integration_id: string;
  event_id: string;
  slack_channel_id: string;
  slack_channel_name: string;
  created_at: string;
}

export interface IntegrationDigestConfig {
  id: string;
  organization_id: string;
  integration_id: string;
  digest_type: DigestType;
  is_enabled: boolean;
  send_time: string;
  day_of_week: number;
  recipient_type: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// NOTIFICATION TYPE (used in hand-maintained Database type below)
// ============================================

export type NotificationTypeEnum = 'agent_message' | 'budget_alert' | 'task_reminder' | 'custom_reminder';

// ============================================
// SUPABASE DATABASE TYPE HELPER (auto-generated)
// ============================================

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agent_background_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          error: string | null
          id: string
          metadata: Json
          name: string
          organization_id: string
          prompt: string
          result: Json | null
          run_after: string
          session_id: string | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          name: string
          organization_id?: string
          prompt: string
          result?: Json | null
          run_after?: string
          session_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error?: string | null
          id?: string
          metadata?: Json
          name?: string
          organization_id?: string
          prompt?: string
          result?: Json | null
          run_after?: string
          session_id?: string | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_background_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_background_tasks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_cron_jobs: {
        Row: {
          agent_prompt: string
          created_at: string
          cron_expression: string
          enabled: boolean
          id: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          organization_id: string
          schedule_preset: string
          updated_at: string
        }
        Insert: {
          agent_prompt: string
          created_at?: string
          cron_expression: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          organization_id?: string
          schedule_preset?: string
          updated_at?: string
        }
        Update: {
          agent_prompt?: string
          created_at?: string
          cron_expression?: string
          enabled?: boolean
          id?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          organization_id?: string
          schedule_preset?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_cron_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_learnings: {
        Row: {
          correction: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          organization_id: string
          topic: string | null
        }
        Insert: {
          correction: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          topic?: string | null
        }
        Update: {
          correction?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_learnings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_memories: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          expires_at: string | null
          id: string
          metadata: Json
          organization_id: string
          source_id: string | null
          source_type: string
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          source_id?: string | null
          source_type: string
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          expires_at?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          source_id?: string | null
          source_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_memories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          metadata: Json
          model: string | null
          organization_id: string
          prompt: string | null
          prompt_tokens: number
          response: string | null
          session_id: string | null
          source: string
          started_at: string
          status: string
          tool_calls: number
          tool_rounds: number
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          organization_id?: string
          prompt?: string | null
          prompt_tokens?: number
          response?: string | null
          session_id?: string | null
          source: string
          started_at?: string
          status?: string
          tool_calls?: number
          tool_rounds?: number
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json
          model?: string | null
          organization_id?: string
          prompt?: string | null
          prompt_tokens?: number
          response?: string | null
          session_id?: string | null
          source?: string
          started_at?: string
          status?: string
          tool_calls?: number
          tool_rounds?: number
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_runs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_settings: {
        Row: {
          agent_focus: string | null
          agent_name: string | null
          autonomy_mode: string
          connected_integrations: Json | null
          created_at: string | null
          default_model: string | null
          heartbeat_enabled: boolean | null
          heartbeat_interval: number
          heartbeat_prompt: string
          model_routing: Json
          notification_channel: string | null
          organization_id: string
          system_prompt_template: string | null
          tool_permissions: Json
          updated_at: string | null
        }
        Insert: {
          agent_focus?: string | null
          agent_name?: string | null
          autonomy_mode?: string
          connected_integrations?: Json | null
          created_at?: string | null
          default_model?: string | null
          heartbeat_enabled?: boolean | null
          heartbeat_interval?: number
          heartbeat_prompt?: string
          model_routing?: Json
          notification_channel?: string | null
          organization_id?: string
          system_prompt_template?: string | null
          tool_permissions?: Json
          updated_at?: string | null
        }
        Update: {
          agent_focus?: string | null
          agent_name?: string | null
          autonomy_mode?: string
          connected_integrations?: Json | null
          created_at?: string | null
          default_model?: string | null
          heartbeat_enabled?: boolean | null
          heartbeat_interval?: number
          heartbeat_prompt?: string
          model_routing?: Json
          notification_channel?: string | null
          organization_id?: string
          system_prompt_template?: string | null
          tool_permissions?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_trigger_notifications: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          trigger_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string
          trigger_key: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          trigger_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_trigger_notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          agent_name: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          key_hash: string
          label: string | null
          last_used_at: string | null
          organization_id: string
          permissions: string[] | null
          revoked_at: string | null
          updated_at: string | null
        }
        Insert: {
          agent_name: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash: string
          label?: string | null
          last_used_at?: string | null
          organization_id?: string
          permissions?: string[] | null
          revoked_at?: string | null
          updated_at?: string | null
        }
        Update: {
          agent_name?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          key_hash?: string
          label?: string | null
          last_used_at?: string | null
          organization_id?: string
          permissions?: string[] | null
          revoked_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          id: string
          key: string
          organization_id: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          organization_id?: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          organization_id?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "app_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string
          actor_type: string
          changes: Json | null
          created_at: string | null
          entity_id: string
          entity_type: string
          id: string
          metadata: Json | null
          organization_id: string
        }
        Insert: {
          action: string
          actor: string
          actor_type?: string
          changes?: Json | null
          created_at?: string | null
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Update: {
          action?: string
          actor?: string
          actor_type?: string
          changes?: Json | null
          created_at?: string | null
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json | null
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_categories: {
        Row: {
          budget_amount: number | null
          created_at: string | null
          deleted_at: string | null
          description: string | null
          fiscal_year_id: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          budget_amount?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          name: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          budget_amount?: number | null
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          fiscal_year_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_milestones: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          notify_channel: string | null
          offset_days: number
          organization_id: string
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          notify_channel?: string | null
          offset_days: number
          organization_id?: string
          template_id: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          notify_channel?: string | null
          offset_days?: number
          organization_id?: string
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "cadence_milestones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cadence_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cadence_milestones_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      cadence_templates: {
        Row: {
          created_at: string | null
          event_type_id: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_type_id?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_type_id?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cadence_templates_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cadence_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json
          content: string | null
          created_at: string | null
          id: string
          organization_id: string
          role: string
          session_id: string
          tool_calls: Json | null
          tool_results: Json | null
        }
        Insert: {
          attachments?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          role: string
          session_id: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Update: {
          attachments?: Json
          content?: string | null
          created_at?: string | null
          id?: string
          organization_id?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
          tool_results?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_chat_messages_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_summary: string | null
          context_tokens_used: number
          created_at: string | null
          event_id: string | null
          id: string
          organization_id: string
          title: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          context_summary?: string | null
          context_tokens_used?: number
          created_at?: string | null
          event_id?: string | null
          id?: string
          organization_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          context_summary?: string | null
          context_tokens_used?: number
          created_at?: string | null
          event_id?: string | null
          id?: string
          organization_id?: string
          title?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_template_items: {
        Row: {
          category: string | null
          created_at: string | null
          days_offset: number | null
          default_assignee_role: string | null
          description: string | null
          id: string
          organization_id: string
          phase: Database["public"]["Enums"]["checklist_phase"]
          sort_order: number
          template_id: string
          tier_customer: boolean | null
          tier_executive: boolean | null
          tier_national_t1: boolean | null
          tier_national_t2: boolean | null
          tier_state_t1: boolean | null
          tier_state_t2: boolean | null
          title: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          days_offset?: number | null
          default_assignee_role?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          phase?: Database["public"]["Enums"]["checklist_phase"]
          sort_order?: number
          template_id: string
          tier_customer?: boolean | null
          tier_executive?: boolean | null
          tier_national_t1?: boolean | null
          tier_national_t2?: boolean | null
          tier_state_t1?: boolean | null
          tier_state_t2?: boolean | null
          title: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          days_offset?: number | null
          default_assignee_role?: string | null
          description?: string | null
          id?: string
          organization_id?: string
          phase?: Database["public"]["Enums"]["checklist_phase"]
          sort_order?: number
          template_id?: string
          tier_customer?: boolean | null
          tier_executive?: boolean | null
          tier_national_t1?: boolean | null
          tier_national_t2?: boolean | null
          tier_state_t1?: boolean | null
          tier_state_t2?: boolean | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_checklist_template_items_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string | null
          deleted_at: string | null
          event_type: string | null
          id: string
          is_default: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deleted_at?: string | null
          event_type?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deleted_at?: string | null
          event_type?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          company: string | null
          contact_type: Database["public"]["Enums"]["contact_type"]
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          email: string | null
          first_name: string
          id: string
          last_contacted: string | null
          last_name: string
          metadata: Json | null
          notes: string | null
          organization_id: string
          phone: string | null
          source: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_contacted?: string | null
          last_name: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          company?: string | null
          contact_type?: Database["public"]["Enums"]["contact_type"]
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_contacted?: string | null
          last_name?: string
          metadata?: Json | null
          notes?: string | null
          organization_id?: string
          phone?: string | null
          source?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_summary: string | null
          ai_tags: string[]
          chat_session_id: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          expense_id: string | null
          file_size_bytes: number
          filename: string
          id: string
          mime_type: string
          organization_id: string
          original_filename: string
          source: Database["public"]["Enums"]["document_source"]
          storage_path: string
          template_id: string | null
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          ai_summary?: string | null
          ai_tags?: string[]
          chat_session_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          expense_id?: string | null
          file_size_bytes: number
          filename: string
          id?: string
          mime_type: string
          organization_id?: string
          original_filename: string
          source?: Database["public"]["Enums"]["document_source"]
          storage_path: string
          template_id?: string | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Update: {
          ai_summary?: string | null
          ai_tags?: string[]
          chat_session_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          expense_id?: string | null
          file_size_bytes?: number
          filename?: string
          id?: string
          mime_type?: string
          organization_id?: string
          original_filename?: string
          source?: Database["public"]["Enums"]["document_source"]
          storage_path?: string
          template_id?: string | null
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_chat_session_id_fkey"
            columns: ["chat_session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      error_logs: {
        Row: {
          context: Json | null
          created_at: string | null
          id: string
          level: string
          message: string
          source: string
          stack: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          context?: Json | null
          created_at?: string | null
          id?: string
          level?: string
          message: string
          source?: string
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          context?: Json | null
          created_at?: string | null
          id?: string
          level?: string
          message?: string
          source?: string
          stack?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      event_checklist_items: {
        Row: {
          assignee_id: string | null
          category: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          event_id: string
          id: string
          organization_id: string
          phase: Database["public"]["Enums"]["checklist_phase"]
          sort_order: number
          template_item_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assignee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          event_id: string
          id?: string
          organization_id?: string
          phase?: Database["public"]["Enums"]["checklist_phase"]
          sort_order?: number
          template_item_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assignee_id?: string | null
          category?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          event_id?: string
          id?: string
          organization_id?: string
          phase?: Database["public"]["Enums"]["checklist_phase"]
          sort_order?: number
          template_item_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checklist_items_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checklist_items_template_item_id_fkey"
            columns: ["template_item_id"]
            isOneToOne: false
            referencedRelation: "checklist_template_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_checklist_items_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_contacts: {
        Row: {
          contact_id: string
          contact_role: string | null
          created_at: string | null
          event_id: string
          id: string
          notes: string | null
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          contact_id: string
          contact_role?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          contact_id?: string
          contact_role?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_contacts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_contacts_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notes: {
        Row: {
          author: string
          content: string
          created_at: string | null
          deleted_at: string | null
          event_id: string
          id: string
          metadata: Json | null
          note_type: string | null
          organization_id: string
          pinned: boolean | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          author: string
          content: string
          created_at?: string | null
          deleted_at?: string | null
          event_id: string
          id?: string
          metadata?: Json | null
          note_type?: string | null
          organization_id?: string
          pinned?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          author?: string
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string
          id?: string
          metadata?: Json | null
          note_type?: string | null
          organization_id?: string
          pinned?: boolean | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_notes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_notes_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reminders: {
        Row: {
          created_at: string | null
          description: string | null
          event_id: string
          id: string
          milestone_id: string | null
          organization_id: string
          reminder_date: string
          sent_at: string | null
          status: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_id: string
          id?: string
          milestone_id?: string | null
          organization_id?: string
          reminder_date: string
          sent_at?: string | null
          status?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_id?: string
          id?: string
          milestone_id?: string | null
          organization_id?: string
          reminder_date?: string
          sent_at?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_reminders_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "cadence_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_reminders_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_shipments: {
        Row: {
          actual_delivery: string | null
          carrier: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          description: string
          estimated_delivery: string | null
          event_id: string
          id: string
          notes: string | null
          organization_id: string
          ship_date: string | null
          shipped_from: string | null
          shipped_to: string | null
          status: string | null
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string | null
          weight_lbs: number | null
        }
        Insert: {
          actual_delivery?: string | null
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description: string
          estimated_delivery?: string | null
          event_id: string
          id?: string
          notes?: string | null
          organization_id?: string
          ship_date?: string | null
          shipped_from?: string | null
          shipped_to?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          weight_lbs?: number | null
        }
        Update: {
          actual_delivery?: string | null
          carrier?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          estimated_delivery?: string | null
          event_id?: string
          id?: string
          notes?: string | null
          organization_id?: string
          ship_date?: string | null
          shipped_from?: string | null
          shipped_to?: string | null
          status?: string | null
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string | null
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "event_shipments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_shipments_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_team_assignments: {
        Row: {
          created_at: string | null
          event_id: string
          event_role: string | null
          id: string
          notes: string | null
          organization_id: string
          team_member_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          event_id: string
          event_role?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          team_member_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          event_id?: string
          event_role?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          team_member_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_team_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_team_assignments_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_team_assignments_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_travel_logistics: {
        Row: {
          airfare_budget: number | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          event_id: string
          flight_airline: string | null
          flight_arrival_airport: string | null
          flight_arrival_at: string | null
          flight_confirmation_number: string | null
          flight_departure_airport: string | null
          flight_departure_at: string | null
          flight_number: string | null
          ground_transport_budget: number | null
          ground_transport_details: string | null
          ground_transport_mode: string | null
          hotel_address: string | null
          hotel_check_in: string | null
          hotel_check_out: string | null
          hotel_confirmation_number: string | null
          hotel_name: string | null
          id: string
          lodging_budget: number | null
          meals_budget: number | null
          misc_travel_budget: number | null
          notes: string | null
          organization_id: string
          team_member_id: string | null
          traveler_email: string | null
          traveler_name: string
          traveler_role: string | null
          updated_at: string | null
        }
        Insert: {
          airfare_budget?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          event_id: string
          flight_airline?: string | null
          flight_arrival_airport?: string | null
          flight_arrival_at?: string | null
          flight_confirmation_number?: string | null
          flight_departure_airport?: string | null
          flight_departure_at?: string | null
          flight_number?: string | null
          ground_transport_budget?: number | null
          ground_transport_details?: string | null
          ground_transport_mode?: string | null
          hotel_address?: string | null
          hotel_check_in?: string | null
          hotel_check_out?: string | null
          hotel_confirmation_number?: string | null
          hotel_name?: string | null
          id?: string
          lodging_budget?: number | null
          meals_budget?: number | null
          misc_travel_budget?: number | null
          notes?: string | null
          organization_id?: string
          team_member_id?: string | null
          traveler_email?: string | null
          traveler_name: string
          traveler_role?: string | null
          updated_at?: string | null
        }
        Update: {
          airfare_budget?: number | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          event_id?: string
          flight_airline?: string | null
          flight_arrival_airport?: string | null
          flight_arrival_at?: string | null
          flight_confirmation_number?: string | null
          flight_departure_airport?: string | null
          flight_departure_at?: string | null
          flight_number?: string | null
          ground_transport_budget?: number | null
          ground_transport_details?: string | null
          ground_transport_mode?: string | null
          hotel_address?: string | null
          hotel_check_in?: string | null
          hotel_check_out?: string | null
          hotel_confirmation_number?: string | null
          hotel_name?: string | null
          id?: string
          lodging_budget?: number | null
          meals_budget?: number | null
          misc_travel_budget?: number | null
          notes?: string | null
          organization_id?: string
          team_member_id?: string | null
          traveler_email?: string | null
          traveler_name?: string
          traveler_role?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_travel_logistics_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_travel_logistics_team_member_id_fkey"
            columns: ["team_member_id"]
            isOneToOne: false
            referencedRelation: "team_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_event_travel_logistics_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      event_types: {
        Row: {
          budget_amount: number | null
          created_at: string | null
          description: string | null
          display_order: number | null
          fiscal_year_id: string | null
          id: string
          is_archived: boolean | null
          name: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          budget_amount?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          fiscal_year_id?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          budget_amount?: number | null
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          fiscal_year_id?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_types_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          approach_notes: string | null
          budget_amount: number | null
          created_at: string | null
          date_end: string | null
          date_start: string | null
          deleted_at: string | null
          event_type_id: string | null
          expansion_goal: number | null
          fiscal_year_id: string | null
          id: string
          leads_generated: number | null
          location: string | null
          marketing_notes: string | null
          meetings_booked: number | null
          name: string
          net_new_goal: number | null
          opportunities_created: number | null
          organization_id: string
          pipeline_generated: number | null
          quarter: Database["public"]["Enums"]["quarter_type"] | null
          revenue_closed: number | null
          roi_notes: string | null
          sales_notes: string | null
          shipping_handler: string | null
          stage: string | null
          tier: string | null
          updated_at: string | null
        }
        Insert: {
          approach_notes?: string | null
          budget_amount?: number | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          deleted_at?: string | null
          event_type_id?: string | null
          expansion_goal?: number | null
          fiscal_year_id?: string | null
          id?: string
          leads_generated?: number | null
          location?: string | null
          marketing_notes?: string | null
          meetings_booked?: number | null
          name: string
          net_new_goal?: number | null
          opportunities_created?: number | null
          organization_id?: string
          pipeline_generated?: number | null
          quarter?: Database["public"]["Enums"]["quarter_type"] | null
          revenue_closed?: number | null
          roi_notes?: string | null
          sales_notes?: string | null
          shipping_handler?: string | null
          stage?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Update: {
          approach_notes?: string | null
          budget_amount?: number | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          deleted_at?: string | null
          event_type_id?: string | null
          expansion_goal?: number | null
          fiscal_year_id?: string | null
          id?: string
          leads_generated?: number | null
          location?: string | null
          marketing_notes?: string | null
          meetings_booked?: number | null
          name?: string
          net_new_goal?: number | null
          opportunities_created?: number | null
          organization_id?: string
          pipeline_generated?: number | null
          quarter?: Database["public"]["Enums"]["quarter_type"] | null
          revenue_closed?: number | null
          roi_notes?: string | null
          sales_notes?: string | null
          shipping_handler?: string | null
          stage?: string | null
          tier?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_event_type_id_fkey"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "event_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_fiscal_year_id_fkey"
            columns: ["fiscal_year_id"]
            isOneToOne: false
            referencedRelation: "fiscal_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          budget_bucket: string
          category_id: string | null
          created_at: string | null
          deleted_at: string | null
          event_id: string | null
          expense_date: string
          id: string
          is_duplicate: boolean | null
          memo: string | null
          organization_id: string
          source_reference: string | null
          source_type: Database["public"]["Enums"]["expense_source"]
          travel_cost_type: string | null
          travel_logistics_entry_id: string | null
          updated_at: string | null
          vendor: string | null
        }
        Insert: {
          amount: number
          budget_bucket?: string
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          expense_date: string
          id?: string
          is_duplicate?: boolean | null
          memo?: string | null
          organization_id?: string
          source_reference?: string | null
          source_type?: Database["public"]["Enums"]["expense_source"]
          travel_cost_type?: string | null
          travel_logistics_entry_id?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Update: {
          amount?: number
          budget_bucket?: string
          category_id?: string | null
          created_at?: string | null
          deleted_at?: string | null
          event_id?: string | null
          expense_date?: string
          id?: string
          is_duplicate?: boolean | null
          memo?: string | null
          organization_id?: string
          source_reference?: string | null
          source_type?: Database["public"]["Enums"]["expense_source"]
          travel_cost_type?: string | null
          travel_logistics_entry_id?: string | null
          updated_at?: string | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      fiscal_years: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "fiscal_years_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      idempotency_keys: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          key: string
          method: string
          path: string
          response_body: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key: string
          method: string
          path: string
          response_body?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          key?: string
          method?: string
          path?: string
          response_body?: Json | null
          status_code?: number | null
        }
        Relationships: []
      }
      integration_digest_config: {
        Row: {
          created_at: string
          day_of_week: number | null
          digest_type: string
          id: string
          integration_id: string
          is_enabled: boolean
          organization_id: string
          recipient_type: string
          send_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          digest_type: string
          id?: string
          integration_id: string
          is_enabled?: boolean
          organization_id?: string
          recipient_type?: string
          send_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          digest_type?: string
          id?: string
          integration_id?: string
          is_enabled?: boolean
          organization_id?: string
          recipient_type?: string
          send_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_digest_config_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_digest_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_event_channels: {
        Row: {
          created_at: string
          event_id: string
          id: string
          integration_id: string
          organization_id: string
          slack_channel_id: string
          slack_channel_name: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          integration_id: string
          organization_id?: string
          slack_channel_id: string
          slack_channel_name?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          integration_id?: string
          organization_id?: string
          slack_channel_id?: string
          slack_channel_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_event_channels_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_event_channels_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_event_channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_notification_routes: {
        Row: {
          created_at: string
          destination: string
          id: string
          integration_id: string
          is_enabled: boolean
          notification_type: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination?: string
          id?: string
          integration_id: string
          is_enabled?: boolean
          notification_type: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          integration_id?: string
          is_enabled?: boolean
          notification_type?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_notification_routes_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_notification_routes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          installed_by: string | null
          organization_id: string
          settings: Json
          status: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          installed_by?: string | null
          organization_id?: string
          settings?: Json
          status?: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          installed_by?: string | null
          organization_id?: string
          settings?: Json
          status?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          is_read: boolean
          message: string
          metadata: Json
          organization_id: string
          title: string
          type: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          message: string
          metadata?: Json
          organization_id?: string
          title: string
          type: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          is_read?: boolean
          message?: string
          metadata?: Json
          organization_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          accepted_at: string | null
          email: string | null
          id: string
          invited_at: string | null
          legacy_username: string | null
          organization_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          legacy_username?: string | null
          organization_id?: string
          role?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          invited_at?: string | null
          legacy_username?: string | null
          organization_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          plan_tier: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          plan_tier?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          plan_tier?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      rate_limit_entries: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          key: string
          window_start: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          key: string
          window_start: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reminder_config: {
        Row: {
          channel: string | null
          created_at: string | null
          days_before: number | null
          enabled: boolean | null
          id: string
          organization_id: string
          reminder_type: string
          updated_at: string | null
        }
        Insert: {
          channel?: string | null
          created_at?: string | null
          days_before?: number | null
          enabled?: boolean | null
          id?: string
          organization_id?: string
          reminder_type: string
          updated_at?: string | null
        }
        Update: {
          channel?: string | null
          created_at?: string | null
          days_before?: number | null
          enabled?: boolean | null
          id?: string
          organization_id?: string
          reminder_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_log: {
        Row: {
          channel: string
          entity_id: string
          entity_type: string
          id: string
          organization_id: string
          reminder_type: string
          sent_at: string | null
        }
        Insert: {
          channel?: string
          entity_id: string
          entity_type: string
          id?: string
          organization_id?: string
          reminder_type: string
          sent_at?: string | null
        }
        Update: {
          channel?: string
          entity_id?: string
          entity_type?: string
          id?: string
          organization_id?: string
          reminder_type?: string
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_reminder_log_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          created_at: string | null
          default_role: string | null
          deleted_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          default_role?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          default_role?: string | null
          deleted_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      template_sections: {
        Row: {
          ai_instructions: string | null
          content_type: Database["public"]["Enums"]["section_content_type"]
          created_at: string | null
          default_content: string | null
          id: string
          organization_id: string
          sort_order: number
          template_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          ai_instructions?: string | null
          content_type?: Database["public"]["Enums"]["section_content_type"]
          created_at?: string | null
          default_content?: string | null
          id?: string
          organization_id?: string
          sort_order?: number
          template_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          ai_instructions?: string | null
          content_type?: Database["public"]["Enums"]["section_content_type"]
          created_at?: string | null
          default_content?: string | null
          id?: string
          organization_id?: string
          sort_order?: number
          template_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_template_sections_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_sections_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "document_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          company: string | null
          created_at: string
          email: string
          id: string
          name: string
          role: string | null
          source: string | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          role?: string | null
          source?: string | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          role?: string | null
          source?: string | null
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number | null
          created_at: string | null
          event_type: string
          id: string
          next_retry_at: string | null
          organization_id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          webhook_id: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          event_type: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          event_type?: string
          id?: string
          next_retry_at?: string | null
          organization_id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_webhook_deliveries_org"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string | null
          description: string | null
          event_types: Json
          id: string
          is_active: boolean | null
          organization_id: string
          secret: string | null
          updated_at: string | null
          url: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          event_types?: Json
          id?: string
          is_active?: boolean | null
          organization_id?: string
          secret?: string | null
          updated_at?: string | null
          url: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          event_types?: Json
          id?: string
          is_active?: boolean | null
          organization_id?: string
          secret?: string | null
          updated_at?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: {
          allowed: boolean
          remaining: number
          reset_at: string
        }[]
      }
      match_agent_learnings: {
        Args: {
          p_match_count?: number
          p_organization_id: string
          p_query_embedding: string
        }
        Returns: {
          correction: string
          created_at: string
          id: string
          metadata: Json
          similarity: number
          topic: string
        }[]
      }
      match_agent_memories: {
        Args: {
          p_match_count?: number
          p_organization_id: string
          p_query_embedding: string
        }
        Returns: {
          content: string
          created_at: string
          expires_at: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_type: string
        }[]
      }
    }
    Enums: {
      checklist_phase: "pre_event" | "day_of" | "post_event"
      contact_type: "vendor" | "lead" | "organizer" | "partner" | "other"
      document_source: "upload" | "api" | "generated"
      expense_source: "brex" | "pdf" | "manual"
      quarter_type: "Q1" | "Q2" | "Q3" | "Q4" | "TBD"
      section_content_type: "text" | "table" | "list" | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      checklist_phase: ["pre_event", "day_of", "post_event"],
      contact_type: ["vendor", "lead", "organizer", "partner", "other"],
      document_source: ["upload", "api", "generated"],
      expense_source: ["brex", "pdf", "manual"],
      quarter_type: ["Q1", "Q2", "Q3", "Q4", "TBD"],
      section_content_type: ["text", "table", "list", "custom"],
    },
  },
} as const


