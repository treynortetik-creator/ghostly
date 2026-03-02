import { createClient } from '@/lib/supabase/server';

export const EXPENSE_BUDGET_BUCKETS = ['event', 'travel', 'category'] as const;
export type ExpenseBudgetBucket = typeof EXPENSE_BUDGET_BUCKETS[number];

export const TRAVEL_COST_TYPES = ['lodging', 'airfare', 'ground_transport', 'meals', 'misc'] as const;
export type TravelCostType = typeof TRAVEL_COST_TYPES[number];

export type TravelBudgetField =
  | 'lodging_budget'
  | 'airfare_budget'
  | 'ground_transport_budget'
  | 'meals_budget'
  | 'misc_travel_budget';

interface TravelEntryBudgetRow {
  id: string;
  traveler_name: string;
  lodging_budget: number | null;
  airfare_budget: number | null;
  ground_transport_budget: number | null;
  meals_budget: number | null;
  misc_travel_budget: number | null;
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TRAVEL_FIELD_BY_COST: Record<TravelCostType, TravelBudgetField> = {
  lodging: 'lodging_budget',
  airfare: 'airfare_budget',
  ground_transport: 'ground_transport_budget',
  meals: 'meals_budget',
  misc: 'misc_travel_budget',
};

const TRAVEL_LABEL_BY_COST: Record<TravelCostType, string> = {
  lodging: 'lodging',
  airfare: 'airfare',
  ground_transport: 'ground transport',
  meals: 'meals',
  misc: 'misc',
};

const GENERATED_TRAVEL_SOURCE_PREFIX = 'travel-logistics';
const AUTO_TRAVEL_POOL_NAME = 'Unassigned Travel';

export function isExpenseBudgetBucket(value: unknown): value is ExpenseBudgetBucket {
  return EXPENSE_BUDGET_BUCKETS.includes(String(value) as ExpenseBudgetBucket);
}

export function isTravelCostType(value: unknown): value is TravelCostType {
  return TRAVEL_COST_TYPES.includes(String(value) as TravelCostType);
}

export function toTravelBudgetField(costType: TravelCostType): TravelBudgetField {
  return TRAVEL_FIELD_BY_COST[costType];
}

export function buildGeneratedTravelSourceReference(entryId: string, costType: TravelCostType): string {
  return `${GENERATED_TRAVEL_SOURCE_PREFIX}:${entryId}:${costType}`;
}

export function isGeneratedTravelSourceReference(sourceReference: string | null | undefined): boolean {
  return Boolean(sourceReference && sourceReference.startsWith(`${GENERATED_TRAVEL_SOURCE_PREFIX}:`));
}

export async function getEventInOrg(
  supabase: SupabaseClient,
  orgId: string,
  eventId: string
): Promise<{ id: string; date_start: string | null } | null> {
  const { data } = await supabase
    .from('events')
    .select('id, date_start')
    .eq('id', eventId)
    .eq('organization_id', orgId)
    .is('deleted_at', null)
    .single();

  return data || null;
}

export async function validateTravelEntryForEvent(
  supabase: SupabaseClient,
  orgId: string,
  eventId: string,
  entryId: string
): Promise<boolean> {
  const { data: entry } = await supabase
    .from('event_travel_logistics')
    .select('id, event_id')
    .eq('id', entryId)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .single();

  if (!entry) return false;

  const event = await getEventInOrg(supabase, orgId, eventId);
  return Boolean(event);
}

export async function ensureUnassignedTravelEntry(
  supabase: SupabaseClient,
  orgId: string,
  eventId: string
): Promise<string> {
  const event = await getEventInOrg(supabase, orgId, eventId);
  if (!event) {
    throw new Error('Event not found');
  }

  const { data: existingRows, error: existingError } = await supabase
    .from('event_travel_logistics')
    .select('id')
    .eq('event_id', eventId)
    .eq('traveler_name', AUTO_TRAVEL_POOL_NAME)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(1);

  if (existingError) throw existingError;

  if (existingRows && existingRows.length > 0) {
    return existingRows[0].id;
  }

  const { data: created, error: insertError } = await supabase
    .from('event_travel_logistics')
    .insert({
      event_id: eventId,
      traveler_name: AUTO_TRAVEL_POOL_NAME,
      traveler_role: 'Auto-assigned from expenses',
      created_by: 'system',
    })
    .select('id')
    .single();

  if (insertError || !created) {
    throw insertError || new Error('Failed to create unassigned travel entry');
  }

  return created.id;
}

export async function resolveTravelEntryIdForExpense(
  supabase: SupabaseClient,
  orgId: string,
  eventId: string,
  requestedEntryId?: string | null
): Promise<string> {
  const trimmed = requestedEntryId?.trim() || null;
  if (trimmed) {
    const isValid = await validateTravelEntryForEvent(supabase, orgId, eventId, trimmed);
    if (!isValid) {
      throw new Error('Invalid travel_logistics_entry_id for this event');
    }
    return trimmed;
  }

  return ensureUnassignedTravelEntry(supabase, orgId, eventId);
}

export async function syncTravelBudgetForEntryCostType(
  supabase: SupabaseClient,
  entryId: string,
  costType: TravelCostType
): Promise<void> {
  const field = toTravelBudgetField(costType);

  const { data: rows, error: sumError } = await supabase
    .from('expenses')
    .select('amount')
    .eq('budget_bucket', 'travel')
    .eq('travel_logistics_entry_id', entryId)
    .eq('travel_cost_type', costType)
    .is('deleted_at', null);

  if (sumError) throw sumError;

  const total = (rows || []).reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const { error: updateError } = await supabase
    .from('event_travel_logistics')
    .update({ [field]: total })
    .eq('id', entryId)
    .is('deleted_at', null);

  if (updateError) throw updateError;
}

export async function syncTravelBudgetsForPairs(
  supabase: SupabaseClient,
  pairs: Array<{ entryId?: string | null; costType?: string | null }>
): Promise<void> {
  const unique = new Set<string>();

  for (const pair of pairs) {
    if (!pair.entryId || !pair.costType || !isTravelCostType(pair.costType)) continue;
    unique.add(`${pair.entryId}:${pair.costType}`);
  }

  for (const key of unique) {
    const [entryId, costType] = key.split(':');
    if (!entryId || !isTravelCostType(costType)) continue;
    await syncTravelBudgetForEntryCostType(supabase, entryId, costType);
  }
}

export async function upsertGeneratedTravelBudgetExpensesForEntry(
  supabase: SupabaseClient,
  options: {
    orgId: string;
    eventId: string;
    entry: TravelEntryBudgetRow;
    expenseDate: string;
  }
): Promise<void> {
  const { orgId, eventId, entry, expenseDate } = options;
  const nowIso = new Date().toISOString();

  for (const costType of TRAVEL_COST_TYPES) {
    const field = toTravelBudgetField(costType);
    const amount = Number(entry[field] || 0);
    const sourceReference = buildGeneratedTravelSourceReference(entry.id, costType);

    const { data: existingRows, error: existingError } = await supabase
      .from('expenses')
      .select('id')
      .eq('organization_id', orgId)
      .eq('event_id', eventId)
      .eq('source_reference', sourceReference)
      .is('deleted_at', null)
      .limit(1);

    if (existingError) throw existingError;

    const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

    if (amount > 0) {
      const payload = {
        event_id: eventId,
        category_id: null,
        amount,
        expense_date: expenseDate,
        vendor: `Travel Budget - ${entry.traveler_name}`,
        memo: `Travel ${TRAVEL_LABEL_BY_COST[costType]} budget for ${entry.traveler_name}`,
        source_type: 'manual' as const,
        source_reference: sourceReference,
        budget_bucket: 'travel' as const,
        travel_logistics_entry_id: entry.id,
        travel_cost_type: costType,
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('expenses')
          .update({ ...payload, deleted_at: null, updated_at: nowIso })
          .eq('id', existing.id)
          .eq('organization_id', orgId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('expenses')
          .insert({
            organization_id: orgId,
            ...payload,
            is_duplicate: false,
          });

        if (insertError) throw insertError;
      }
    } else if (existing) {
      const { error: deleteError } = await supabase
        .from('expenses')
        .update({ deleted_at: nowIso, updated_at: nowIso })
        .eq('id', existing.id)
        .eq('organization_id', orgId);

      if (deleteError) throw deleteError;
    }
  }
}

export async function softDeleteGeneratedTravelBudgetExpenses(
  supabase: SupabaseClient,
  orgId: string,
  eventId: string,
  entryId: string
): Promise<void> {
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from('expenses')
    .update({ deleted_at: nowIso, updated_at: nowIso })
    .eq('organization_id', orgId)
    .eq('event_id', eventId)
    .like('source_reference', `${GENERATED_TRAVEL_SOURCE_PREFIX}:${entryId}:%`)
    .is('deleted_at', null);

  if (error) throw error;
}
