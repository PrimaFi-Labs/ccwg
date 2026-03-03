//ccwg-web/src/app/api/matches/[matchId]/action/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { submitActionSchema } from '@/src/lib/validation/schemas';
import { requireSessionWallet } from '@/src/lib/auth/guards';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const body = await request.json();
    const validated = submitActionSchema.parse({
      ...body,
      match_id: parseInt(matchId),
    });

    const supabase = await createClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;

    // Verify match exists and player is participant
    const { data: match } = await supabase
      .from('matches')
      .select('player_1, player_2, status, current_round')
      .eq('match_id', validated.match_id)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.player_1 !== wallet && match.player_2 !== wallet) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    if (match.status !== 'InProgress') {
      return NextResponse.json({ error: 'Match not in progress' }, { status: 400 });
    }

    if (match.current_round !== validated.round_number) {
      return NextResponse.json({ error: 'Invalid round number' }, { status: 400 });
    }

    // Check if action already submitted
    const { data: existing } = await supabase
      .from('match_actions')
      .select('id')
      .eq('match_id', validated.match_id)
      .eq('round_number', validated.round_number)
      .eq('player_wallet', wallet)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Action already submitted' }, { status: 400 });
    }

    // Get active card
    const { data: matchPlayer } = await supabase
      .from('match_players')
      .select('active_card_id, charge_armed, charged_applies_round')
      .eq('match_id', validated.match_id)
      .eq('player_wallet', wallet)
      .single();

    if (!matchPlayer) {
      return NextResponse.json({ error: 'Player not found in match' }, { status: 404 });
    }

    // Check if charge action is valid
    if (validated.action === 'Charge') {
      const { data: opponentCharge } = await supabase
        .from('match_actions')
        .select('id, player_wallet')
        .eq('match_id', validated.match_id)
        .eq('round_number', validated.round_number)
        .eq('action', 'Charge')
        .maybeSingle();

      if (opponentCharge) {
        return NextResponse.json({ error: 'Charge already used this round' }, { status: 400 });
      }

      const { data: mp } = await supabase
        .from('match_players')
        .select('charge_used')
        .eq('match_id', validated.match_id)
        .eq('player_wallet', wallet)
        .single();

      if (mp?.charge_used) {
        return NextResponse.json({ error: 'Charge already used' }, { status: 400 });
      }
    }

    // Record action
    const { error: insertError } = await supabase
      .from('match_actions')
      .insert({
        match_id: validated.match_id,
        round_number: validated.round_number,
        player_wallet: wallet,
        action: validated.action,
        card_id: matchPlayer.active_card_id,
        client_nonce: validated.client_nonce,
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (validated.action === 'Charge') {
      await supabase
        .from('match_players')
        .update({ charge_used: true })
        .eq('match_id', validated.match_id)
        .eq('player_wallet', wallet);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Action submission error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
