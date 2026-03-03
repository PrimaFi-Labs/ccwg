import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { createRoomSchema } from '@/src/lib/validation/schemas';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { getTopActiveSanction, blocksEvents } from '@/src/lib/sanctions/check';
import { cancelRoomOnChain, createRoomOnChain, joinRoomOnChain } from '@/src/lib/starknet/chain';

const generateCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
};

/**
 * Generate a unique room_id for on-chain use instead of relying on the
 * Supabase BIGSERIAL auto-increment.
 *
 * Old sequential IDs (1, 2, 3, …) may still exist on-chain even after their
 * Supabase rows were deleted (via cleanup, retries, or a DB reset).  The
 * on-chain Room model keeps room_id permanently — even cancelled rooms have
 * room_id ≠ 0 — so re-using an old ID triggers "Room already exists".
 *
 * Date.now() * 1000 + random(0–999) produces a ~16-digit number that is
 * well above any old sequential IDs and has negligible collision probability.
 * It fits comfortably within BIGINT (max ~9.2 × 10¹⁸), JS safe integers
 * (max ~9 × 10¹⁵) and Cairo u128 (max ~3.4 × 10³⁸).
 */
const generateRoomId = () =>
  Date.now() * 1000 + Math.floor(Math.random() * 1000);

const generateUniqueRoomCode = async (supabase: any) => {
  let roomCode = generateCode();
  let attempts = 0;
  while (attempts < 10) {
    const { data: existing } = await supabase
      .from('rooms')
      .select('room_id')
      .eq('room_code', roomCode)
      .maybeSingle();
    if (!existing) return roomCode;
    roomCode = generateCode();
    attempts += 1;
  }
  return roomCode;
};

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const visibility =
      (url.searchParams.get('visibility') as 'Public' | 'Private' | null) || 'Public';
    const supabase = createServiceClient();

    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('visibility', visibility)
      .eq('status', 'Open')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (error) {
    console.error('Rooms fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json();
    const validated = createRoomSchema.parse(body);

    if (BigInt(validated.stake_fee) <= BigInt(0)) {
      return NextResponse.json(
        { error: 'Room fee must be greater than 0' },
        { status: 400 }
      );
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

    // The client deposits STRK (approve → deposit_stake) before calling this
    // API, but do not trust the mirrored players.strk_balance for immediate validation.
    // Do not gate on players.strk_balance here. That database mirror can lag
    // after deposit_stake, while the on-chain escrow state is the source of truth.
    let roomCode = await generateUniqueRoomCode(supabase);

    const now = new Date();
    const decayAt = new Date(now.getTime() + validated.timer_hours * 60 * 60 * 1000);

    const MAX_ROOM_ID_RETRIES = 5;
    let lastDebug = '';

    for (let roomIdAttempt = 1; roomIdAttempt <= MAX_ROOM_ID_RETRIES; roomIdAttempt += 1) {
      const candidateRoomId = generateRoomId();

      const { data: room, error: roomError } = await supabase
        .from('rooms')
        .insert(({
          room_id: candidateRoomId,
          room_code: roomCode,
          host_wallet: wallet,
          visibility: validated.visibility,
          status: 'Open',
          stake_fee: validated.stake_fee,
          max_players: validated.max_players,
          matches_per_player: validated.matches_per_player,
          current_players: 1,
          total_rounds: validated.total_rounds,
          timer_hours: validated.timer_hours,
          prize_pool: validated.stake_fee,
          created_at: now.toISOString(),
          decay_at: decayAt.toISOString(),
        }) as any)
        .select()
        .single();

      if (roomError || !room) {
        // If the generated room_id collided in Supabase (extremely unlikely), retry
        if (roomError?.code === '23505' && roomIdAttempt < MAX_ROOM_ID_RETRIES) {
          console.warn(
            `[rooms/create] Supabase room_id collision (attempt ${roomIdAttempt}/${MAX_ROOM_ID_RETRIES}); retrying`
          );
          continue;
        }
        return NextResponse.json({ error: roomError?.message || 'Failed to create room row' }, { status: 500 });
      }

      const { error: memberError } = await supabase
        .from('room_members')
        .insert(({
          room_id: room.room_id,
          player_wallet: wallet,
          status: 'Active',
          fee_paid: validated.stake_fee,
        }) as any);

      if (memberError) {
        await supabase.from('rooms').delete().eq('room_id', room.room_id);
        return NextResponse.json({ error: memberError.message }, { status: 500 });
      }

      let createdOnChain = false;
      try {
        // Let the on-chain calls enforce escrow sufficiency so valid deposits are
        // not rejected while the database mirror catches up.
        await createRoomOnChain({
          roomId: room.room_id,
          host: wallet,
          stakeFee: validated.stake_fee,
          maxPlayers: validated.max_players,
          matchesPerPlayer: validated.matches_per_player,
          totalRounds: validated.total_rounds,
        });
        createdOnChain = true;
        await joinRoomOnChain(room.room_id, wallet);
        return NextResponse.json({ room });
      } catch (onChainError: any) {
        const debug =
          onChainError instanceof Error
            ? onChainError.message
            : typeof onChainError === 'string'
              ? onChainError
              : JSON.stringify(onChainError, null, 2);
        lastDebug = debug;

        // Only cancel on-chain if this request actually created the room on-chain.
        if (createdOnChain) {
          try {
            await cancelRoomOnChain(room.room_id);
          } catch {
            // Ignore rollback-on-chain errors
          }
        }

        await supabase.from('room_members').delete().eq('room_id', room.room_id);
        await supabase.from('rooms').delete().eq('room_id', room.room_id);

        const roomAlreadyExists = debug.includes('Room already exists');
        if (roomAlreadyExists && roomIdAttempt < MAX_ROOM_ID_RETRIES) {
          console.warn(
            `[rooms/create] on-chain room_id collision for id=${room.room_id} (attempt ${roomIdAttempt}/${MAX_ROOM_ID_RETRIES}); retrying`
          );
          roomCode = await generateUniqueRoomCode(supabase);
          continue;
        }

        console.error('[rooms/create] on-chain failure debug:', debug);
        return NextResponse.json(
          {
            error: 'Failed to create room on-chain',
            debug,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'Failed to create room after retries',
        debug: lastDebug || 'No on-chain debug payload available',
      },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('Room create error:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
