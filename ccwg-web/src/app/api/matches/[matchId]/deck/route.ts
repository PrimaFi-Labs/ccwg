//ccwg-web/src/app/api/matches/[matchId]/deck/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { setMatchDeckSchema } from '@/src/lib/validation/schemas';
import { validateAndParseAddress } from 'starknet';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
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

    const stripLeadingZeros = (addr: string) => {
      if (!addr) return addr;
      const lower = addr.toLowerCase();
      if (!lower.startsWith('0x')) return lower;
      const stripped = lower.replace(/^0x0+/, '0x');
      return stripped === '0x' ? '0x0' : stripped;
    };

    const walletCandidates = Array.from(
      new Set(
        [
          normalizedWallet,
          walletParam?.toLowerCase(),
          stripLeadingZeros(normalizedWallet),
          walletParam ? stripLeadingZeros(walletParam) : null,
        ].filter(Boolean) as string[]
      )
    );

    let matchPlayer = await supabase
      .from('match_players')
      .select('card_1_id, card_2_id, card_3_id')
      .eq('match_id', Number.parseInt(matchId, 10))
      .in('player_wallet', walletCandidates)
      .single();

    if (!matchPlayer.data) {
      const { data: match } = await supabase
        .from('matches')
        .select('player_1, player_2')
        .eq('match_id', Number.parseInt(matchId, 10))
        .maybeSingle();

      if (!match) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      }

      const matchPlayers = [match.player_1, match.player_2]
        .map((w) => (w ? stripLeadingZeros(w.toLowerCase()) : null))
        .filter(Boolean) as string[];

      const requester = stripLeadingZeros(normalizedWallet);

      if (!matchPlayers.includes(requester)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      const { data: allPlayers } = await supabase
        .from('match_players')
        .select('player_wallet, card_1_id, card_2_id, card_3_id')
        .eq('match_id', Number.parseInt(matchId, 10));

      const resolved = allPlayers?.find((row) => {
        const rowWallet = stripLeadingZeros(row.player_wallet?.toLowerCase() || '');
        return rowWallet === requester;
      });

      if (!resolved) {
        return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
      }

      matchPlayer = { data: resolved } as unknown as typeof matchPlayer;
    }

    if (!matchPlayer?.data) {
      return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
    }

    if (!matchPlayer.data.card_1_id || !matchPlayer.data.card_2_id || !matchPlayer.data.card_3_id) {
      return NextResponse.json({ deck: [] });
    }

    // Fetch the actual cards
    const { data: cards } = await supabase
      .from('player_cards')
      .select(`
        *,
        template:card_templates(*)
      `)
      .in('id', [
        matchPlayer.data.card_1_id,
        matchPlayer.data.card_2_id,
        matchPlayer.data.card_3_id,
      ]);

    return NextResponse.json({ deck: cards || [] });
  } catch (error) {
    console.error('Deck fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json();
    const { matchId } = await params;
    const matchIdNum = Number.parseInt(matchId, 10);
    const validated = setMatchDeckSchema.parse({ match_id: matchIdNum, deck: body?.deck });

    const supabase = createServiceClient();

    // Verify match participation
    const { data: match } = await supabase
      .from('matches')
      .select('player_1, player_2')
      .eq('match_id', validated.match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const isParticipant = [match.player_1, match.player_2]
      .map((w) => (w ? w.toLowerCase() : ''))
      .includes(wallet);

    if (!isParticipant) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify cards ownership
    const { data: cards } = await supabase
      .from('player_cards')
      .select('id, owner_wallet')
      .in('id', validated.deck)
      .eq('owner_wallet', wallet);

    if (!cards || cards.length !== 3) {
      return NextResponse.json({ error: 'Invalid deck - cards not owned' }, { status: 400 });
    }

    const { data: existing } = await supabase
      .from('match_players')
      .select('id')
      .eq('match_id', validated.match_id)
      .eq('player_wallet', wallet)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('match_players')
        .update({
          card_1_id: validated.deck[0],
          card_2_id: validated.deck[1],
          card_3_id: validated.deck[2],
          active_card_id: validated.deck[0],
          swaps_used: 0,
          charge_used: false,
        })
        .eq('id', existing.id);
    } else {
      await supabase.from('match_players').insert({
        match_id: validated.match_id,
        player_wallet: wallet,
        card_1_id: validated.deck[0],
        card_2_id: validated.deck[1],
        card_3_id: validated.deck[2],
        active_card_id: validated.deck[0],
        swaps_used: 0,
        charge_used: false,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Deck set error:', error);
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
