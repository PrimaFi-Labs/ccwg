// ccwg-web/src/app/api/matches/[matchId]/forfeit/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { validateAndParseAddress } from 'starknet';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const matchIdNum = Number.parseInt(matchId, 10);
    if (Number.isNaN(matchIdNum)) {
      return NextResponse.json({ error: 'Invalid match id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');

    let wallet: string | null = null;
    const session = requireSessionWallet(request);
    if (!('response' in session)) {
      wallet = session.wallet;
    } else if (walletParam) {
      wallet = walletParam;
    }

    if (!wallet) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let normalizedWallet = wallet.toLowerCase();
    try {
      normalizedWallet = validateAndParseAddress(wallet).toLowerCase();
    } catch {}

    // Fetch match — include event_context_id explicitly so the tournament
    // standings update below always has access to it regardless of whether
    // the Supabase-generated types have been regenerated after the migration.
    const { data: match, error } = await supabase
      .from('matches')
      .select('match_id, player_1, player_2, total_rounds, status, mode, bot_id, event_context_id')
      .eq('match_id', matchIdNum)
      .single();

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const p1 = match.player_1?.toLowerCase();
    const p2 = match.player_2?.toLowerCase();
    if (normalizedWallet !== p1 && normalizedWallet !== p2) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // The forfeiting player loses; their opponent wins.
    const winner = normalizedWallet === p1 ? match.player_2 : match.player_1;
    const loser = normalizedWallet;
    const totalRounds = match.total_rounds || 0;

    const update = {
      status: 'Completed' as const,
      winner,
      ended_at: new Date().toISOString(),
      current_round: totalRounds,
      p1_rounds_won: normalizedWallet === p1 ? 0 : totalRounds,
      p2_rounds_won: normalizedWallet === p2 ? 0 : totalRounds,
    };

    await supabase.from('matches').update(update).eq('match_id', matchIdNum);

    // ─── Helpers ────────────────────────────────────────────────────────────

    const adjustStarkPoints = async (walletAddr: string, delta: number) => {
      if (!delta) return;
      const { data: player } = await supabase
        .from('players')
        .select('stark_points')
        .eq('wallet_address', walletAddr)
        .maybeSingle();

      if (!player) return;
      const current = player.stark_points ?? 0;
      const next = Math.max(0, current + delta);
      if (next === current) return;

      await supabase
        .from('players')
        .update({ stark_points: next })
        .eq('wallet_address', walletAddr);
    };

    const getBotSpDelta = (difficulty: string | null, didWin: boolean) => {
      if (!difficulty) return 0;
      const table: Record<string, number> = { Easy: 3, Medium: 5, Hard: 8 };
      const base = table[difficulty] ?? 0;
      return didWin ? base : -base;
    };

    // ─── Win / loss counters ─────────────────────────────────────────────────

    if (winner) {
      const { data: players } = await supabase
        .from('players')
        .select('wallet_address, wins, losses')
        .in('wallet_address', [winner, loser].filter(Boolean) as string[]);

      const winnerRow = players?.find((p) => p.wallet_address === winner);
      const loserRow = players?.find((p) => p.wallet_address === loser);

      if (winnerRow) {
        await supabase
          .from('players')
          .update({ wins: (winnerRow.wins ?? 0) + 1 })
          .eq('wallet_address', winnerRow.wallet_address);
      }

      if (loserRow) {
        await supabase
          .from('players')
          .update({ losses: (loserRow.losses ?? 0) + 1 })
          .eq('wallet_address', loserRow.wallet_address);
      }
    }

    // ─── Stark Points ────────────────────────────────────────────────────────

    if (winner && match.mode === 'Ranked1v1') {
      await Promise.all([
        adjustStarkPoints(winner, 10),
        adjustStarkPoints(loser, -6),
      ]);
    } else if (winner && match.mode === 'VsAI') {
      const aiWallet = '0x4149';
      const human = winner === aiWallet ? loser : winner;
      if (human) {
        const { data: bot } = await supabase
          .from('bots')
          .select('difficulty')
          .eq('bot_id', match.bot_id ?? 0)
          .maybeSingle();
        const didWin = winner === human;
        await adjustStarkPoints(human, getBotSpDelta(bot?.difficulty ?? null, didWin));
      }
    }

    // ─── Event leaderboard ──────────────────────────────────────────────────
    //
    // A forfeited match still counts as a result for the tournament leaderboard
    // if and only if:
    //   • The match was a Ranked1v1 initiated via a specific tournament
    //     (event_context_id is non-null).
    //   • The event is still Open or InProgress.
    //   • The event's total_rounds matches the match's total_rounds.
    //   • Both players are registered participants in that event.
    //
    // Regular lobby ranked matches have event_context_id = null and therefore
    // never touch any event leaderboard here.

    const eventContextId: number | null = (match as unknown as { event_context_id: number | null }).event_context_id ?? null;

    if (winner && match.mode === 'Ranked1v1' && eventContextId !== null) {
      const playerWalletSet = new Set(
        [match.player_1, match.player_2]
          .filter(Boolean)
          .map((wallet) => wallet.toLowerCase())
      );

      const { data: participants } = await supabase
        .from('event_participants')
        .select(`
          id,
          event_id,
          player_wallet,
          war_points,
          total_wins,
          total_losses,
          total_draws,
          event:events!event_participants_event_id_fkey(status, total_rounds)
        `)
        .eq('event_id', eventContextId)
        .returns<Array<{
          id: number;
          event_id: number;
          player_wallet: string;
          war_points: number | null;
          total_wins: number | null;
          total_losses: number | null;
          total_draws: number | null;
          event: { status: string | null; total_rounds: number } | null;
        }>>();

      // Filter: event must be active and rounds must match
      const activeParticipants = (participants || []).filter((row) => {
        if (!row.event) return false;
        const status = row.event.status ?? '';
        const participantWallet = row.player_wallet?.toLowerCase() ?? '';
        return (
          playerWalletSet.has(participantWallet) &&
          (status === 'Open' || status === 'InProgress') &&
          row.event.total_rounds === match.total_rounds
        );
      });

      // Update only event participants that match this game context.
      if (activeParticipants.length >= 1) {
        const winnerLower = winner.toLowerCase();
        for (const row of activeParticipants) {
          const didWin = (row.player_wallet?.toLowerCase() ?? '') === winnerLower;

          await supabase
            .from('event_participants')
            .update({
              war_points: (row.war_points ?? 0) + (didWin ? 3 : 0),
              total_wins: (row.total_wins ?? 0) + (didWin ? 1 : 0),
              total_losses: (row.total_losses ?? 0) + (didWin ? 0 : 1),
            })
            .eq('id', row.id);
        }

        console.log(
          `[FORFEIT] Event ${eventContextId} standings updated for match ${matchIdNum} — winner: ${winner}`
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Forfeit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
