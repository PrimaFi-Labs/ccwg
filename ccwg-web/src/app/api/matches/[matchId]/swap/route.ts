//ccwg-web/src/app/api/matches/[matchId]/swap/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { swapCardSchema } from '@/src/lib/validation/schemas';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { getChallengeSwapLimit } from '@/src/lib/social/shared';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const validated = swapCardSchema.parse({
      ...body,
      match_id: parseInt(matchId),
    });

    const supabase = await createClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;

    // Verify player owns the card and it's in their deck
    const { data: matchPlayer } = await supabase
      .from('match_players')
      .select('card_1_id, card_2_id, card_3_id, swaps_used, active_card_id')
      .eq('match_id', validated.match_id)
      .eq('player_wallet', wallet)
      .single();

    if (!matchPlayer) {
      return NextResponse.json({ error: 'Player not found in match' }, { status: 404 });
    }

    const deckCards = [matchPlayer.card_1_id, matchPlayer.card_2_id, matchPlayer.card_3_id];

    if (!deckCards.includes(validated.new_card_id)) {
      return NextResponse.json({ error: 'Card not in deck' }, { status: 400 });
    }

    if (matchPlayer.active_card_id === validated.new_card_id) {
      return NextResponse.json({ error: 'Card already active' }, { status: 400 });
    }

    // Check swap limit
    const { data: match } = await supabase
      .from('matches')
      .select('total_rounds, mode')
      .eq('match_id', validated.match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    let swapLimit = match.mode === 'VsAI' ? 999 : match.total_rounds === 10 ? 999 : 2;

    if (match.mode === 'Challenge') {
      const { data: challenge } = await (supabase as any)
        .from('challenge_invites')
        .select('swap_rule')
        .eq('match_id', validated.match_id)
        .maybeSingle();
      swapLimit = getChallengeSwapLimit(match.total_rounds, challenge?.swap_rule ?? 'Strict');
    }

    if ((matchPlayer.swaps_used ?? 0) >= swapLimit) {
      return NextResponse.json({ error: 'Swap limit reached' }, { status: 400 });
    }

    // Perform swap
    const { error: updateError } = await supabase
      .from('match_players')
      .update({
        active_card_id: validated.new_card_id,
        swaps_used: (matchPlayer.swaps_used ?? 0) + 1,
      })
      .eq('match_id', validated.match_id)
      .eq('player_wallet', wallet);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Clear charge if swapping charged card
    await supabase
      .from('match_players')
      .update({
        charge_armed: false,
        charged_card_id: null,
        charged_applies_round: null,
      })
      .eq('match_id', validated.match_id)
      .eq('player_wallet', wallet)
      .eq('charged_card_id', matchPlayer.active_card_id!);

    return NextResponse.json({ success: true, swaps_remaining: swapLimit - (matchPlayer.swaps_used ?? 0) - 1 });
  } catch (error: any) {
    console.error('Card swap error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
