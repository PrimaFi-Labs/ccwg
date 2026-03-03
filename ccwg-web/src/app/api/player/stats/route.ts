import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { validateAndParseAddress } from 'starknet';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');

    let wallet = walletParam?.toLowerCase() || '';
    if (walletParam) {
      try {
        wallet = validateAndParseAddress(walletParam).toLowerCase();
      } catch {}
    }
    if (!wallet) {
      const session = requireSessionWallet(request);
      if ('response' in session) return session.response;
      try {
        wallet = validateAndParseAddress(session.wallet).toLowerCase();
      } catch {
        wallet = session.wallet.toLowerCase();
      }
    }

    try {
      await ensurePlayerExists(wallet);
    } catch (bootstrapError) {
      console.warn('[player/stats] ensurePlayerExists warning:', bootstrapError);
    }

    const supabase = createServiceClient();
    const participantFilter = `player_1.eq.${wallet},player_2.eq.${wallet}`;

    const [
      playerResult,
      totalMatchesResult,
      winsResult,
      lossesResult,
      cardsOwnedResult,
      eventsJoinedResult,
    ] = await Promise.all([
      supabase
        .from('players')
        .select('stark_points, strk_balance')
        .eq('wallet_address', wallet)
        .maybeSingle(),
      supabase
        .from('matches')
        .select('match_id', { count: 'exact', head: true })
        .or(participantFilter)
        .eq('status', 'Completed'),
      supabase
        .from('matches')
        .select('match_id', { count: 'exact', head: true })
        .eq('status', 'Completed')
        .eq('winner', wallet),
      supabase
        .from('matches')
        .select('match_id', { count: 'exact', head: true })
        .or(participantFilter)
        .eq('status', 'Completed')
        .not('winner', 'is', null)
        .neq('winner', wallet),
      supabase
        .from('player_cards')
        .select('id', { count: 'exact', head: true })
        .eq('owner_wallet', wallet)
        .neq('is_ai_card', true),
      supabase
        .from('event_participants')
        .select('id', { count: 'exact', head: true })
        .eq('player_wallet', wallet),
    ]);

    if (playerResult.error) {
      console.warn('[player/stats] players read warning:', playerResult.error.message);
    }
    if (totalMatchesResult.error) {
      console.warn('[player/stats] total matches count warning:', totalMatchesResult.error.message);
    }
    if (winsResult.error) {
      console.warn('[player/stats] wins count warning:', winsResult.error.message);
    }
    if (lossesResult.error) {
      console.warn('[player/stats] losses count warning:', lossesResult.error.message);
    }
    if (cardsOwnedResult.error) {
      console.warn('[player/stats] cards owned count warning:', cardsOwnedResult.error.message);
    }
    if (eventsJoinedResult.error) {
      console.warn('[player/stats] events joined count warning:', eventsJoinedResult.error.message);
    }

    const totalMatches = totalMatchesResult.count ?? 0;
    const wins = winsResult.count ?? 0;
    const losses = lossesResult.count ?? 0;
    const winRate = totalMatches > 0 ? (wins / totalMatches) * 100 : 0;

    return NextResponse.json({
      stats: {
        total_matches: totalMatches,
        wins,
        losses,
        win_rate: Number(winRate.toFixed(1)),
        total_xp: 0,
        stark_points: playerResult.data?.stark_points ?? 0,
        cards_owned: cardsOwnedResult.count ?? 0,
        total_events_joined: eventsJoinedResult.count ?? 0,
        strk_balance: playerResult.data?.strk_balance ?? '0',
      },
    });
  } catch (error) {
    console.error('Player stats fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
