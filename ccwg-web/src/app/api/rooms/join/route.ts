import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { joinRoomSchema } from '@/src/lib/validation/schemas';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { getTopActiveSanction, blocksEvents } from '@/src/lib/sanctions/check';
import { joinRoomOnChain } from '@/src/lib/starknet/chain';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json();
    const validated = joinRoomSchema.parse(body);

    if (!validated.room_id && !validated.room_code) {
      return NextResponse.json({ error: 'room_id or room_code required' }, { status: 400 });
    }

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);

    const activeSanction = await getTopActiveSanction(supabase, wallet);
    if (activeSanction && blocksEvents(activeSanction.sanction_type)) {
      return NextResponse.json(
        { error: 'Account restricted from rooms due to an active sanction.' },
        { status: 403 }
      );
    }

    const roomQuery = supabase.from('rooms').select('*');
    const { data: room, error: roomError } = validated.room_id
      ? await roomQuery.eq('room_id', validated.room_id).single()
      : await roomQuery.eq('room_code', String(validated.room_code).toUpperCase()).single();

    if (roomError || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from('room_members')
      .select('id, status')
      .eq('room_id', room.room_id)
      .eq('player_wallet', wallet)
      .maybeSingle();

    if (existing) {
      if (existing.status !== 'Quit') {
        return NextResponse.json({ room_id: room.room_id, room_code: room.room_code, already_joined: true });
      }

      if (room.status !== 'Open') {
        return NextResponse.json({ error: 'Room is not open' }, { status: 400 });
      }

      if (room.current_players >= room.max_players) {
        return NextResponse.json({ error: 'Room is full' }, { status: 400 });
      }

      if (room.decay_at && new Date(room.decay_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: 'Room has expired' }, { status: 400 });
      }

      if (existing.status === 'Quit') {
        // The client still deposits first, but the escrow balance must be
        // validated on-chain because the database mirror can be briefly stale.
        try {
          // Let the on-chain room join enforce escrow sufficiency. The mirrored
          // players.strk_balance column can lag right after deposit_stake.
          await joinRoomOnChain(room.room_id, wallet);
        } catch (onChainError: any) {
          return NextResponse.json(
            { error: onChainError?.message || 'Failed to join room on-chain' },
            { status: 500 }
          );
        }

        await supabase
          .from('room_members')
          .update(({ status: 'Active', fee_paid: room.stake_fee }) as any)
          .eq('id', existing.id);
        const nextPlayers = room.current_players + 1;
        await supabase
          .from('rooms')
          .update(({
            current_players: nextPlayers,
            prize_pool: (BigInt(room.prize_pool) + BigInt(room.stake_fee)).toString(),
          }) as any)
          .eq('room_id', room.room_id);

        if (nextPlayers >= room.max_players) {
          const { startRoom } = await import('@/src/lib/rooms/scheduler');
          await startRoom(supabase, room.room_id);
        }
        return NextResponse.json({ room_id: room.room_id, room_code: room.room_code, already_joined: true });
      }
    }

    if (room.status !== 'Open') {
      return NextResponse.json({ error: 'Room is not open' }, { status: 400 });
    }

    if (room.current_players >= room.max_players) {
      return NextResponse.json({ error: 'Room is full' }, { status: 400 });
    }

    if (room.decay_at && new Date(room.decay_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Room has expired' }, { status: 400 });
    }

    // The client still deposits first, but the escrow balance must be
    // validated on-chain because the database mirror can be briefly stale.
    try {
      // Let the on-chain room join enforce escrow sufficiency. The mirrored
      // players.strk_balance column can lag right after deposit_stake.
      await joinRoomOnChain(room.room_id, wallet);
    } catch (onChainError: any) {
      return NextResponse.json(
        { error: onChainError?.message || 'Failed to join room on-chain' },
        { status: 500 }
      );
    }

    const { error: memberError } = await supabase
      .from('room_members')
      .insert(({
        room_id: room.room_id,
        player_wallet: wallet,
        status: 'Active',
        fee_paid: room.stake_fee,
      }) as any);

    if (memberError) {
      return NextResponse.json({ error: memberError.message }, { status: 500 });
    }

    const nextPlayers = room.current_players + 1;

    await supabase
      .from('rooms')
      .update(({
        current_players: nextPlayers,
        prize_pool: (BigInt(room.prize_pool) + BigInt(room.stake_fee)).toString(),
      }) as any)
      .eq('room_id', room.room_id);

    // Auto-start when full
    if (nextPlayers >= room.max_players) {
      const { startRoom } = await import('@/src/lib/rooms/scheduler');
      await startRoom(supabase, room.room_id);
    }

    return NextResponse.json({ room_id: room.room_id, room_code: room.room_code });
  } catch (error: any) {
    console.error('Room join error:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
