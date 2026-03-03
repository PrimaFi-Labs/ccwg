//ccwg-web/src/app/api/matches/create/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { createRankedMatchSchema, createAIMatchSchema } from '@/src/lib/validation/schemas';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { getTopActiveSanction, blocksMatchmaking } from '@/src/lib/sanctions/check';
import { validateAndParseAddress } from 'starknet';
import { ZodError } from 'zod';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { match_type, ...matchData } = body;

    const serviceSupabase = createServiceClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;
    let walletLower = wallet.toLowerCase();
    try {
      walletLower = validateAndParseAddress(wallet).toLowerCase();
    } catch {}
    await ensurePlayerExists(walletLower);

    const activeSanction = await getTopActiveSanction(serviceSupabase, walletLower);
    if (activeSanction && blocksMatchmaking(activeSanction.sanction_type)) {
      return NextResponse.json(
        { error: 'Account restricted from matchmaking due to an active sanction.' },
        { status: 403 }
      );
    }

    if (match_type === 'ranked') {
      const validated = createRankedMatchSchema.parse(matchData);
      const eventContextId =
        validated.from_event_context === true ? (validated.event_id ?? null) : null;
      const roomContextId = validated.room_context_id ?? null;

      if (roomContextId !== null && eventContextId !== null) {
        return NextResponse.json(
          { error: 'Room-context matchmaking cannot be combined with event matchmaking' },
          { status: 400 }
        );
      }

      if (eventContextId !== null) {
        const { data: eventContext } = await serviceSupabase
          .from('events')
          .select('event_id, status, total_rounds, starts_at, ends_at')
          .eq('event_id', eventContextId)
          .maybeSingle();

        if (!eventContext) {
          return NextResponse.json({ error: 'Event not found for tournament matchmaking' }, { status: 404 });
        }

        const nowMs = Date.now();
        const startsAtMs = new Date(eventContext.starts_at).getTime();
        const endsAtMs = eventContext.ends_at ? new Date(eventContext.ends_at).getTime() : Number.POSITIVE_INFINITY;
        const isEventActive =
          (eventContext.status === 'Open' || eventContext.status === 'InProgress') &&
          nowMs >= startsAtMs &&
          nowMs < endsAtMs;

        if (!isEventActive) {
          return NextResponse.json(
            { error: 'Tournament is not active for matchmaking' },
            { status: 400 }
          );
        }

        if (validated.total_rounds !== eventContext.total_rounds) {
          return NextResponse.json(
            { error: 'Tournament rounds mismatch' },
            { status: 400 }
          );
        }

        const { data: selfParticipant } = await serviceSupabase
          .from('event_participants')
          .select('id')
          .eq('event_id', eventContextId)
          .eq('player_wallet', walletLower)
          .maybeSingle();

        if (!selfParticipant) {
          return NextResponse.json(
            { error: 'You must be registered in this tournament to queue' },
            { status: 403 }
          );
        }
      }

      if (roomContextId !== null) {
        const { data: room } = await (serviceSupabase
          .from('rooms')
          .select('room_id, status, matches_per_player') as any)
          .eq('room_id', roomContextId)
          .maybeSingle();

        if (!room) {
          return NextResponse.json({ error: 'Room not found' }, { status: 404 });
        }

        if (room.status !== 'InProgress') {
          return NextResponse.json({ error: 'Room is not active for matchmaking' }, { status: 400 });
        }

        const { data: member } = await serviceSupabase
          .from('room_members')
          .select('id, status')
          .eq('room_id', roomContextId)
          .eq('player_wallet', walletLower)
          .maybeSingle();

        if (!member || member.status !== 'Active') {
          return NextResponse.json(
            { error: 'You must be an active member of this room to queue' },
            { status: 403 }
          );
        }

        const { data: standing } = await serviceSupabase
          .from('room_standings')
          .select('wins, losses, draws')
          .eq('room_id', roomContextId)
          .eq('player_wallet', walletLower)
          .maybeSingle();

        const gamesPlayed = (standing?.wins ?? 0) + (standing?.losses ?? 0) + (standing?.draws ?? 0);
        if (gamesPlayed >= ((room as any).matches_per_player ?? 0)) {
          return NextResponse.json(
            { error: 'You already reached your room match limit' },
            { status: 400 }
          );
        }
      }

      const { data: creator } = await serviceSupabase
        .from('players')
        .select('wallet_address, stark_points')
        .eq('wallet_address', walletLower)
        .maybeSingle();

      if (!creator || (creator.stark_points ?? 0) <= 0) {
        return NextResponse.json(
          { error: 'Stark Points too low to start ranked matches. Play bots to earn SP.' },
          { status: 403 }
        );
      }

      // Verify cards ownership
      const { data: cards } = await serviceSupabase
        .from('player_cards')
        .select('id, owner_wallet')
        .in('id', validated.deck)
        .eq('owner_wallet', walletLower);

      if (!cards || cards.length !== 3) {
        return NextResponse.json({ error: 'Invalid deck - cards not owned' }, { status: 400 });
      }

      const opponentAddress = validated.opponent?.toLowerCase();
      const stakeTier = validated.stake_tier ?? null;

      if (roomContextId !== null && opponentAddress) {
        return NextResponse.json(
          { error: 'Room-context queue does not support direct-opponent invites' },
          { status: 400 }
        );
      }

      if (opponentAddress) {
        const { data: opponent } = await serviceSupabase
          .from('players')
          .select('wallet_address, stark_points')
          .eq('wallet_address', opponentAddress)
          .maybeSingle();

        if (!opponent) {
          return NextResponse.json(
            { error: 'Opponent profile not found. Ask them to connect wallet first.' },
            { status: 400 }
          );
        }
        if ((opponent.stark_points ?? 0) <= 0) {
          return NextResponse.json(
            { error: 'Opponent has 0 Stark Points and cannot play ranked matches.' },
            { status: 403 }
          );
        }

        if (eventContextId !== null) {
          const { data: opponentParticipant } = await serviceSupabase
            .from('event_participants')
            .select('id')
            .eq('event_id', eventContextId)
            .eq('player_wallet', opponentAddress)
            .maybeSingle();

          if (!opponentParticipant) {
            return NextResponse.json(
              { error: 'Opponent is not registered in this tournament' },
              { status: 403 }
            );
          }
        }

        // Create match in database first
        const { data: match, error: matchError } = await serviceSupabase
          .from('matches')
          .insert(({
            player_1: walletLower,
            player_2: opponentAddress,
            mode: 'Ranked1v1',
            event_context_id: eventContextId,
            room_context_id: roomContextId,
            room_context_player_wallet: roomContextId ? walletLower : null,
            status: 'WaitingForOpponent',
            stake_tier: stakeTier,
            total_stake: '0', // Will be set on-chain
            current_round: 0,
            total_rounds: validated.total_rounds,
            p1_rounds_won: 0,
            p2_rounds_won: 0,
          }) as any)
          .select()
          .single();

        if (matchError) {
          return NextResponse.json({ error: matchError.message }, { status: 500 });
        }

        // Create match_players entry
        const { error: matchPlayersError } = await serviceSupabase.from('match_players').insert({
          match_id: match.match_id,
          player_wallet: walletLower,
          card_1_id: validated.deck[0],
          card_2_id: validated.deck[1],
          card_3_id: validated.deck[2],
          active_card_id: validated.deck[0],
          swaps_used: 0,
          charge_used: false,
        });
        if (matchPlayersError) {
          return NextResponse.json({ error: matchPlayersError.message }, { status: 500 });
        }

        // Return match data for client to submit on-chain
        return NextResponse.json({
          match,
          needs_on_chain: true,
          contract_call: {
            opponent: opponentAddress,
            deck: validated.deck,
            stake_tier: stakeTier,
            total_rounds: validated.total_rounds,
          },
        });
      }

      // Matchmaker flow
      const { data: me } = await serviceSupabase
        .from('players')
        .select('stark_points')
        .eq('wallet_address', walletLower)
        .maybeSingle();

      const mySp = me?.stark_points ?? 0;

      let queueQuery: any = serviceSupabase
        .from('ranked_queue')
        .select('queue_id, player_wallet, card_1_id, card_2_id, card_3_id, event_id, room_context_id, created_at, players!inner(stark_points)')
        .eq('total_rounds', validated.total_rounds)
        .neq('player_wallet', walletLower);

      queueQuery =
        stakeTier === null
          ? queueQuery.is('stake_tier', null)
          : queueQuery.eq('stake_tier', stakeTier);

      // Event players must only match within the same event;
      // non-event players must only match with other non-event players.
      queueQuery =
        eventContextId !== null
          ? queueQuery.eq('event_id', eventContextId)
          : queueQuery.is('event_id', null);

      if (roomContextId !== null) {
        queueQuery = queueQuery.is('room_context_id', null);
      }

      const { data: queuedCandidates } = await queueQuery;

      type QueueCandidate = {
        queue_id: number;
        player_wallet: string;
        card_1_id: number;
        card_2_id: number;
        card_3_id: number;
        event_id: number | null;
        room_context_id: number | null;
        created_at: string | null;
        players: { stark_points: number | null } | { stark_points: number | null }[] | null;
      };

      const queuedOpponent = (queuedCandidates || [])
        .map((c: QueueCandidate) => {
          const playerStats = Array.isArray(c.players) ? c.players[0] : c.players;
          const sp = playerStats?.stark_points ?? 0;
          return {
          ...c,
          sp,
          diff: Math.abs(sp - mySp),
          };
        })
        .sort((a: { diff: number; created_at?: string | null }, b: { diff: number; created_at?: string | null }) => a.diff - b.diff || new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime())[0];

      if (queuedOpponent) {
        await serviceSupabase
          .from('ranked_queue')
          .delete()
          .eq('queue_id', queuedOpponent.queue_id);

        const matchRoomContextId = roomContextId ?? queuedOpponent.room_context_id ?? null;
        // Both players must share the same event context (enforced by the
        // queue filter above).  Never fall through to the opponent's event_id
        // to avoid leaking one event's context into an unrelated match.
        const matchEventContextId = eventContextId ?? null;
        const roomContextPlayerWallet =
          roomContextId !== null
            ? walletLower
            : queuedOpponent.room_context_id !== null
              ? queuedOpponent.player_wallet
              : null;

        const { data: match, error: matchError } = await serviceSupabase
          .from('matches')
          .insert(({
            player_1: queuedOpponent.player_wallet,
            player_2: walletLower,
            mode: 'Ranked1v1',
            event_context_id: matchEventContextId,
            room_context_id: matchRoomContextId,
            room_context_player_wallet: roomContextPlayerWallet,
            status: 'WaitingForOpponent',
            stake_tier: stakeTier,
            total_stake: '0',
            current_round: 0,
            total_rounds: validated.total_rounds,
            p1_rounds_won: 0,
            p2_rounds_won: 0,
          }) as any)
          .select()
          .single();

        if (matchError) {
          return NextResponse.json({ error: matchError.message }, { status: 500 });
        }

        const { error: matchPlayersError } = await serviceSupabase
          .from('match_players')
          .insert([
            {
              match_id: match.match_id,
              player_wallet: queuedOpponent.player_wallet,
              card_1_id: queuedOpponent.card_1_id,
              card_2_id: queuedOpponent.card_2_id,
              card_3_id: queuedOpponent.card_3_id,
              active_card_id: queuedOpponent.card_1_id,
              swaps_used: 0,
              charge_used: false,
            },
            {
              match_id: match.match_id,
              player_wallet: walletLower,
              card_1_id: validated.deck[0],
              card_2_id: validated.deck[1],
              card_3_id: validated.deck[2],
              active_card_id: validated.deck[0],
              swaps_used: 0,
              charge_used: false,
            },
          ]);

        if (matchPlayersError) {
          return NextResponse.json({ error: matchPlayersError.message }, { status: 500 });
        }

        return NextResponse.json({ match });
      }

      const { data: queuedRow, error: queueError } = await serviceSupabase
        .from('ranked_queue')
        .upsert(({
          player_wallet: walletLower,
          card_1_id: validated.deck[0],
          card_2_id: validated.deck[1],
          card_3_id: validated.deck[2],
          event_id: eventContextId,
          room_context_id: roomContextId,
          stake_tier: stakeTier,
          total_rounds: validated.total_rounds,
          created_at: new Date().toISOString(),
        }) as any)
        .select('created_at')
        .single();

      if (queueError) {
        return NextResponse.json({ error: queueError.message }, { status: 500 });
      }

      return NextResponse.json({ queued: true, queued_since: queuedRow?.created_at ?? null });

    } else if (match_type === 'ai') {
      const validated = createAIMatchSchema.parse(matchData);

      // Verify cards ownership
      const { data: cards } = await serviceSupabase
        .from('player_cards')
        .select('id, owner_wallet')
        .in('id', validated.deck)
        .eq('owner_wallet', walletLower);

      if (!cards || cards.length !== 3) {
        return NextResponse.json({ error: 'Invalid deck - cards not owned' }, { status: 400 });
      }

      // Resolve bot profile
      let bot = null;
      if (validated.bot_id) {
        const { data } = await serviceSupabase
          .from('bots')
          .select('*')
          .eq('bot_id', validated.bot_id)
          .eq('enabled', true)
          .maybeSingle();
        bot = data;
      } else {
        const { data } = await serviceSupabase
          .from('bots')
          .select('*')
          .eq('enabled', true)
          .eq('difficulty', validated.difficulty)
          .order('bot_id', { ascending: true });
        bot = data?.[Math.floor(Math.random() * (data?.length || 1))] || null;
      }

      // Create AI match (fully off-chain)
      const aiWallet = '0x4149'; // AI identifier
      await ensurePlayerExists(aiWallet);

      const { data: match, error: matchError } = await serviceSupabase
        .from('matches')
        .insert({
          player_1: walletLower,
          player_2: aiWallet,
          mode: 'VsAI',
          status: 'InProgress',
          stake_tier: 'Tier10' as const,
          total_stake: 0,
          current_round: 1,
          total_rounds: validated.total_rounds,
          p1_rounds_won: 0,
          p2_rounds_won: 0,
          bot_id: bot?.bot_id ?? null,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (matchError) {
        return NextResponse.json({ error: matchError.message }, { status: 500 });
      }

      // Create match_players entries
      const { error: aiMatchPlayersError } = await serviceSupabase.from('match_players').insert([
        {
          match_id: match.match_id,
          player_wallet: walletLower,
          card_1_id: validated.deck[0],
          card_2_id: validated.deck[1],
          card_3_id: validated.deck[2],
          active_card_id: validated.deck[0],
          swaps_used: 0,
          charge_used: false,
        },
        {
          match_id: match.match_id,
          player_wallet: aiWallet,
          swaps_used: 0,
          charge_used: false,
        },
      ]);
      if (aiMatchPlayersError) {
        return NextResponse.json({ error: aiMatchPlayersError.message }, { status: 500 });
      }

      return NextResponse.json({ match });

    } else {
      return NextResponse.json({ error: 'Invalid match type' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('Match creation error:', error);

    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
