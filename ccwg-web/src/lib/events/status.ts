import type { SupabaseClient } from '@supabase/supabase-js';
import { insertInboxMessages } from '@/src/lib/inbox/service';

type UpdatableStatus = 'Open' | 'InProgress' | 'Completed' | 'Cancelled';

export async function syncEventStatuses(
  supabase: SupabaseClient,
  nowIso: string = new Date().toISOString()
) {
  const nowMs = new Date(nowIso).getTime();

  // Open -> InProgress when start time has passed and event hasn't ended.
  const { data: toInProgress } = await supabase
    .from('events')
    .select('event_id, event_name, ends_at')
    .eq('status', 'Open')
    .lte('starts_at', nowIso);

  const eligibleEvents = (toInProgress || []).filter(
    (e) => !e.ends_at || new Date(e.ends_at).getTime() > new Date(nowIso).getTime()
  );

  if (eligibleEvents.length > 0) {
    const eventIds = eligibleEvents.map((e) => e.event_id);
    await supabase
      .from('events')
      .update({ status: 'InProgress' as UpdatableStatus })
      .in('event_id', eventIds);

    const { data: participants } = await supabase
      .from('event_participants')
      .select('event_id, player_wallet')
      .in('event_id', eventIds);

    const eventNameById = new Map<number, string>(
      eligibleEvents.map((e) => [e.event_id, e.event_name ?? `Event #${e.event_id}`])
    );

    await insertInboxMessages(
      supabase,
      (participants || []).map((p) => {
        const eventName = eventNameById.get(p.event_id) ?? `Event #${p.event_id}`;
        return {
          player_wallet: p.player_wallet,
          subject: `Event Started: ${eventName}`,
          body:
            `Your registered event "${eventName}" is now live.\n` +
            'Queue into your matches to climb the leaderboard.',
          category: 'system',
          notification_key: `event_start:${p.event_id}`,
        };
      })
    );
  }

  // InProgress/Open -> Completed when end time has passed.
  const { data: toCompleted } = await supabase
    .from('events')
    .select('event_id, event_name, status, ends_at')
    .in('status', ['Open', 'InProgress'])
    .not('ends_at', 'is', null)
    .lte('ends_at', nowIso);

  const completedCandidates = (toCompleted || []).filter(
    (event) => Boolean(event.ends_at) && new Date(event.ends_at as string).getTime() <= nowMs
  );

  if (completedCandidates.length > 0) {
    const completedIds = completedCandidates.map((event) => event.event_id);

    await supabase
      .from('events')
      .update({ status: 'Completed' as UpdatableStatus })
      .in('event_id', completedIds);

    const { data: participants } = await supabase
      .from('event_participants')
      .select('event_id, player_wallet')
      .in('event_id', completedIds);

    const eventNameById = new Map<number, string>(
      completedCandidates.map((event) => [event.event_id, event.event_name ?? `Event #${event.event_id}`])
    );

    await insertInboxMessages(
      supabase,
      (participants || []).map((p) => {
        const eventName = eventNameById.get(p.event_id) ?? `Event #${p.event_id}`;
        return {
          player_wallet: p.player_wallet,
          subject: `Event Ended: ${eventName}`,
          body:
            `Event "${eventName}" has ended.\n` +
            'Final rankings and rewards will appear shortly in your inbox.',
          category: 'system' as const,
          notification_key: `event_end:${p.event_id}`,
        };
      })
    );
  }
}
