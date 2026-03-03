//ccwg-web/src/app/api/matches/join/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';

export async function POST(request: NextRequest) {
  try {
    const { match_id, deck } = await request.json();

    const supabase = await createClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;
    await ensurePlayerExists(wallet);

    // Verify match exists and is waiting
    const { data: match } = await supabase
      .from('matches')
      .select('*')
      .eq('match_id', match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.status !== 'WaitingForOpponent') {
      return NextResponse.json({ error: 'Match already started or completed' }, { status: 400 });
    }

    if (match.player_2 !== wallet) {
      return NextResponse.json({ error: 'Not invited to this match' }, { status: 403 });
    }

    // Verify cards ownership
    const { data: cards } = await supabase
      .from('player_cards')
      .select('id, owner_wallet')
      .in('id', deck)
      .eq('owner_wallet', wallet);

    if (!cards || cards.length !== 3) {
      return NextResponse.json({ error: 'Invalid deck - cards not owned' }, { status: 400 });
    }

    // Create match_players entry for player 2
    await supabase.from('match_players').insert({
      match_id,
      player_wallet: wallet,
      card_1_id: deck[0],
      card_2_id: deck[1],
      card_3_id: deck[2],
      active_card_id: deck[0],
      swaps_used: 0,
      charge_used: false,
    });

    return NextResponse.json({ 
      success: true,
      match,
      needs_on_chain: true, // Client needs to lock escrow on-chain
    });
  } catch (error) {
    console.error('Match join error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
