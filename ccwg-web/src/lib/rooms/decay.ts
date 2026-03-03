import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/supabase';
import { insertInboxMessages, purgeExpiredInboxMessages } from '@/src/lib/inbox/service';
import { cancelRoomOnChain, settleRoomOnChain } from '@/src/lib/starknet/chain';
import { formatStrk } from '@/src/lib/cartridge/utils';

type RoomRow = Database['public']['Tables']['rooms']['Row'];

/** Treasury fee percentage (10%) */
const TREASURY_FEE_PERCENT = BigInt(10);

const computeWinnerFromStandings = async (
  supabase: SupabaseClient<Database>,
  roomId: number
) => {
  const { data: standings } = await supabase
    .from('room_standings')
    .select('*')
    .eq('room_id', roomId)
    .order('points', { ascending: false })
    .order('wins', { ascending: false });

  return standings?.[0]?.player_wallet ?? null;
};

export const settleRoom = async (
  supabase: SupabaseClient<Database>,
  room: RoomRow,
  finalStatus: 'Completed' | 'Expired'
) => {
  if (room.status === 'Completed' || room.status === 'Expired') return;

  const winner = await computeWinnerFromStandings(supabase, room.room_id);

  const prizePool = BigInt(room.prize_pool ?? 0);
  const treasuryFee = (prizePool * TREASURY_FEE_PERCENT) / BigInt(100);
  const payout = prizePool - treasuryFee;

  if (winner) {
    await settleRoomOnChain(room.room_id, winner);
  } else {
    await cancelRoomOnChain(room.room_id);
  }

  const now = new Date();
  const destroyAfter = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours later

  const { data: members } = await supabase
    .from('room_members')
    .select('player_wallet, status')
    .eq('room_id', room.room_id);

  if (winner) {
    await supabase
      .from('room_members')
      .update({ status: 'Winner', prize_won: Number(payout) })
      .eq('room_id', room.room_id)
      .eq('player_wallet', winner);

    await supabase
      .from('room_members')
      .update({ status: 'Eliminated' })
      .eq('room_id', room.room_id)
      .neq('player_wallet', winner)
      .neq('status', 'Quit');

    await insertInboxMessages(supabase, [
      {
        player_wallet: winner,
        subject: `Room Winner: ${room.room_code}`,
        body:
          `Congratulations! You won room ${room.room_code}.\n` +
          `Award confirmed: ${formatStrk(payout)} STRK.`,
        category: 'room',
        related_room_id: room.room_id,
        notification_key: `room_settlement:${room.room_id}:winner:${winner.toLowerCase()}`,
      },
    ]);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('rooms')
    .update({
      status: finalStatus,
      ends_at: now.toISOString(),
      settled_at: now.toISOString(),
      destroy_after: destroyAfter.toISOString(),
      treasury_fee: treasuryFee.toString(),
      winner_payout: payout.toString(),
    })
    .eq('room_id', room.room_id);

  const settledLabel = finalStatus === 'Expired' ? 'decayed and ended' : 'ended';
  await insertInboxMessages(
    supabase,
    (members || [])
      .filter((member) => Boolean(member.player_wallet) && member.status !== 'Quit')
      .map((member) => ({
        player_wallet: member.player_wallet,
        subject: `Room ${finalStatus === 'Expired' ? 'Decayed' : 'Ended'}: ${room.room_code}`,
        body:
          `Room ${room.room_code} has ${settledLabel}.\n` +
          (winner
            ? `Winner: ${winner}.`
            : 'No winner could be determined for this room.'),
        category: 'room' as const,
        related_room_id: room.room_id,
        notification_key: `room_end:${room.room_id}:${member.player_wallet.toLowerCase()}`,
      }))
  );
};

export const settleRoomDecayIfNeeded = async (
  supabase: SupabaseClient<Database>,
  room: RoomRow
) => {
  if (!room.decay_at) return false;
  if (room.status !== 'Open' && room.status !== 'InProgress') return false;
  if (new Date(room.decay_at).getTime() > Date.now()) return false;
  await settleRoom(supabase, room, 'Expired');
  return true;
};

/**
 * Destroy rooms whose 24-hour review window has passed.
 * Deletes fixtures, standings, members, disputes, then the room itself.
 */
export const destroyExpiredRooms = async (supabase: SupabaseClient<Database>) => {
  const now = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rooms } = await (supabase as any)
    .from('rooms')
    .select('room_id')
    .in('status', ['Completed', 'Expired'])
    .not('destroy_after', 'is', null)
    .lte('destroy_after', now);

  for (const room of rooms || []) {
    const rid = room.room_id;
    // Delete dependent rows first
    await supabase.from('room_fixtures').delete().eq('room_id', rid);
    await supabase.from('room_standings').delete().eq('room_id', rid);
    await supabase.from('room_members').delete().eq('room_id', rid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('room_disputes').delete().eq('room_id', rid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('player_inbox').delete().eq('related_room_id', rid);
    // Null out room references on matches so FK doesn't block deletion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('matches').update({ room_context_id: null } as any).eq('room_context_id', rid);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('ranked_queue').delete().eq('room_context_id', rid);
    // Delete the room
    await supabase.from('rooms').delete().eq('room_id', rid);
  }

  return (rooms || []).length;
};

export const runRoomDecaySweep = async (supabase: SupabaseClient<Database>) => {
  const now = new Date().toISOString();
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .in('status', ['Open', 'InProgress'])
    .lte('decay_at', now);

  for (const room of rooms || []) {
    await settleRoom(supabase, room, 'Expired');
  }

  // Also destroy rooms past their 24hr review window
  await destroyExpiredRooms(supabase);
  await purgeExpiredInboxMessages(supabase, now);
};
