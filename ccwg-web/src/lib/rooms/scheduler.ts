import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/supabase';
import { insertInboxMessages } from '@/src/lib/inbox/service';
import { startRoomOnChain } from '@/src/lib/starknet/chain';

type RoomRow = Database['public']['Tables']['rooms']['Row'];
type RoomMemberRow = Database['public']['Tables']['room_members']['Row'];

export async function startRoom(supabase: SupabaseClient<Database>, roomId: number) {
  const { data: room } = await supabase
    .from('rooms')
    .select('*')
    .eq('room_id', roomId)
    .maybeSingle<RoomRow>();

  if (!room || room.status !== 'Open') return;

  const { data: members } = (await supabase
    .from('room_members')
    .select('*')
    .eq('room_id', roomId)
    .eq('status', 'Active')) as { data: RoomMemberRow[] | null };

  const activeMembers = members ?? [];
  if (activeMembers.length < 2) return;

  await startRoomOnChain(room.room_id);

  await supabase
    .from('rooms')
    .update({ status: 'InProgress', starts_at: new Date().toISOString() })
    .eq('room_id', roomId);

  for (const member of activeMembers) {
    await supabase
      .from('room_standings')
      .upsert({
        room_id: room.room_id,
        player_wallet: member.player_wallet,
        wins: 0,
        losses: 0,
        draws: 0,
        points: 0,
      });
  }

  await insertInboxMessages(
    supabase,
    activeMembers.map((member) => ({
      player_wallet: member.player_wallet,
      subject: `Room Started: ${room.room_code}`,
      body:
        `Room ${room.room_code} has begun and matches are now live.\n` +
        'Open the room page to start queueing for your fixtures.',
      category: 'room' as const,
      related_room_id: room.room_id,
      notification_key: `room_start:${room.room_id}:${member.player_wallet.toLowerCase()}`,
    }))
  );
}
