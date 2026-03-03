import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ matchId: string }> }
) {
  try {
    const { matchId } = await params;
    const matchIdNum = Number.parseInt(matchId, 10);
    const { on_chain_id, wallet_address } = await request.json();

    if (!on_chain_id) {
      return NextResponse.json({ error: 'on_chain_id required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify player owns this match
    const { data: match } = await supabase
      .from('matches')
      .select('player_1, player_2, on_chain_id')
      .eq('match_id', matchIdNum)
      .single();

    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    if (match.player_1 !== wallet_address && match.player_2 !== wallet_address) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (match.on_chain_id) {
      return NextResponse.json({ error: 'Already linked to on-chain match' }, { status: 400 });
    }

    // Update on_chain_id
    const { error } = await supabase
      .from('matches')
      .update({ on_chain_id })
      .eq('match_id', matchIdNum);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Link contract error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}