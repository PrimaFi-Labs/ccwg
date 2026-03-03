import type { SupabaseClient } from '@supabase/supabase-js';
import { syncEventStatuses } from '@/src/lib/events/status';
import { autoSettleEndedEvents, type SettlementResult } from '@/src/lib/events/settlement';
import { purgeExpiredInboxMessages } from '@/src/lib/inbox/service';

const DEFAULT_RETENTION_DAYS = 15;

export async function purgeEventsOlderThanDays(
  supabase: SupabaseClient,
  days: number = DEFAULT_RETENTION_DAYS,
  nowIso: string = new Date().toISOString()
) {
  const nowMs = new Date(nowIso).getTime();
  const cutoffMs = nowMs - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();

  const { data, error } = await supabase
    .from('events')
    .delete()
    .lt('created_at', cutoffIso)
    .select('event_id');

  if (error) {
    throw new Error(`Failed to purge old events: ${error.message}`);
  }

  return {
    cutoffIso,
    deletedCount: (data || []).length,
  };
}

export async function runEventMaintenance(
  supabase: SupabaseClient,
  nowIso: string = new Date().toISOString(),
  retentionDays: number = DEFAULT_RETENTION_DAYS
) {
  // 1. Transition event statuses (Open → InProgress, InProgress → Completed)
  await syncEventStatuses(supabase, nowIso);

  // 2. Auto-settle any events whose ends_at has passed but haven't been settled
  let settlementResults: SettlementResult[] = [];
  try {
    settlementResults = await autoSettleEndedEvents(supabase, nowIso);
  } catch (err) {
    console.error('[maintenance] auto-settlement batch failed:', err);
  }

  // 3. Purge old events
  const purgeResult = await purgeEventsOlderThanDays(supabase, retentionDays, nowIso);
  await purgeExpiredInboxMessages(supabase, nowIso);

  return {
    ...purgeResult,
    settledEvents: settlementResults.filter((r) => r.settled).length,
    settlementErrors: settlementResults.filter((r) => !r.settled && r.error).length,
  };
}
