import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { settleRoomDecayIfNeeded } from '@/src/lib/rooms/decay';

/**
 * GET /api/control/rooms/[roomCode] — Admin access to any room by code.
 * Admins do NOT need to be room members.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const { roomCode } = await params;
    const code = roomCode.toUpperCase();

    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_code', code)
      .maybeSingle();

    if (error || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    // Check decay
    await settleRoomDecayIfNeeded(supabase, room);

    // Refetch after potential decay settlement
    const { data: roomRefetch } = await supabase
      .from('rooms')
      .select('*')
      .eq('room_id', room.room_id)
      .single();

    const { data: members } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room.room_id);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: disputes } = await (supabase as any)
      .from('room_disputes')
      .select('*')
      .eq('room_id', room.room_id)
      .order('created_at', { ascending: false });

    // Resolve usernames
    const allWallets = Array.from(new Set([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(members || []).map((m: any) => m.player_wallet),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(fixtures || []).flatMap((f: any) => [f.player_a, f.player_b].filter(Boolean)),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(standings || []).map((s: any) => s.player_wallet),
    ].map((w: string) => w.toLowerCase())));

    const { data: players } = allWallets.length
      ? await supabase.from('players').select('wallet_address, username').in('wallet_address', allWallets)
      : { data: [] };

    const usernameMap = new Map(
      (players || []).map((p) => [p.wallet_address?.toLowerCase(), p.username])
    );

    return NextResponse.json({
      room: roomRefetch ?? room,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      members: (members || []).map((m: any) => ({ ...m, username: usernameMap.get(m.player_wallet?.toLowerCase()) ?? null })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fixtures: (fixtures || []).map((f: any) => ({
        ...f,
        player_a_username: f.player_a ? usernameMap.get(f.player_a.toLowerCase()) ?? null : null,
        player_b_username: f.player_b ? usernameMap.get(f.player_b.toLowerCase()) ?? null : null,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      standings: (standings || []).map((s: any) => ({ ...s, username: usernameMap.get(s.player_wallet?.toLowerCase()) ?? null })),
      disputes: disputes || [],
    });
  } catch (error) {
    console.error('Admin room fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
