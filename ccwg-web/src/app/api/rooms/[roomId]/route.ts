import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { settleRoomDecayIfNeeded } from '@/src/lib/rooms/decay';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params;
    const roomIdNum = Number.parseInt(roomId, 10);

    const supabase = createServiceClient();
    const roomQuery = supabase.from('rooms').select('*');
    const { data: room, error } = Number.isFinite(roomIdNum)
      ? await roomQuery.eq('room_id', roomIdNum).single()
      : await roomQuery.eq('room_code', roomId.toUpperCase()).single();

    if (error || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    await settleRoomDecayIfNeeded(supabase, room);

    const { data: roomRefetch } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', room.room_id)
      .single();

    const { data: members } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room.room_id);

    const memberWallets = (members || []).map((m) => m.player_wallet);
    const { data: fixtures } = await supabase
      .from('room_fixtures')
      .select('*')
      .eq('room_id', room.room_id)
      .order('round_number', { ascending: true });

    const { data: standings } = await supabase
      .from('room_standings')
      .select('*')
      .eq('room_id', room.room_id)
      .order('points', { ascending: false });

    const fixtureWallets = (fixtures || []).flatMap((f) =>
      [f.player_a, f.player_b].filter(Boolean)
    ) as string[];
    const standingWallets = (standings || []).map((s) => s.player_wallet);
    const allWallets = Array.from(
      new Set([...memberWallets, ...fixtureWallets, ...standingWallets].map((w) => w.toLowerCase()))
    );

    const { data: playerRowsAll } = allWallets.length
      ? await supabase
          .from('players')
          .select('wallet_address, username')
          .in('wallet_address', allWallets)
      : { data: [] };
    const usernameByWalletAll = new Map(
      (playerRowsAll || []).map((p) => [p.wallet_address?.toLowerCase(), p.username])
    );

    const membersWithNames = (members || []).map((m) => ({
      ...m,
      username: usernameByWalletAll.get(m.player_wallet?.toLowerCase()) ?? null,
    }));

    const fixturesWithNames = (fixtures || []).map((f) => ({
      ...f,
      player_a_username: f.player_a ? usernameByWalletAll.get(f.player_a.toLowerCase()) ?? null : null,
      player_b_username: f.player_b ? usernameByWalletAll.get(f.player_b.toLowerCase()) ?? null : null,
    }));

    const standingsWithNames = (standings || []).map((s) => ({
      ...s,
      username: usernameByWalletAll.get(s.player_wallet?.toLowerCase()) ?? null,
    }));

    return NextResponse.json({
      room: roomRefetch ?? room,
      members: membersWithNames,
      fixtures: fixturesWithNames,
      standings: standingsWithNames,
    });
  } catch (error) {
    console.error('Room fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
