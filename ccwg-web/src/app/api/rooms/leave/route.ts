import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { leaveRoomOnChain } from '@/src/lib/starknet/chain';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const room_id = Number.parseInt(String(body?.room_id || ''), 10);
    if (!Number.isFinite(room_id)) {
      return NextResponse.json({ error: 'Invalid room_id' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: member } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room_id)
      .eq('player_wallet', wallet)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not in room' }, { status: 400 });
    }

    try {
      await leaveRoomOnChain(room_id, wallet);
    } catch (onChainError: any) {
      return NextResponse.json(
        { error: onChainError?.message || 'Failed to leave room on-chain' },
        { status: 500 }
      );
    }

    await supabase
      .from('room_members')
      .update({ status: 'Quit' })
      .eq('id', member.id);

    await (supabase
      .from('ranked_queue') as any)
      .delete()
      .eq('player_wallet', wallet)
      .eq('room_context_id', room_id);

    const { data: room } = await supabase
      .from('rooms')
      .select('current_players')
      .eq('room_id', room_id)
      .maybeSingle();

    await supabase
      .from('rooms')
      .update({ current_players: Math.max(0, (room?.current_players ?? 0) - 1) })
      .eq('room_id', room_id);

    await supabase
      .from('rooms')
      .update({ has_forfeit: true })
      .eq('room_id', room_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room leave error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
