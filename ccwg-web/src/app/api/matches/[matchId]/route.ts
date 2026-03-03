//ccwg-web/src/app/api/matches/[matchId]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { validateAndParseAddress } from 'starknet';

export async function GET(
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

    const { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('match_id', matchIdNum)
      .single();

    if (error || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    // Verify player is in the match
    if (
      match.player_1?.toLowerCase() !== normalizedWallet &&
      match.player_2?.toLowerCase() !== normalizedWallet
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (match.mode === 'Challenge') {
      const { data: challenge } = await (supabase as any)
        .from('challenge_invites')
        .select('swap_rule')
        .eq('match_id', matchIdNum)
        .maybeSingle();

      return NextResponse.json({
        match: {
          ...match,
          challenge_swap_rule: challenge?.swap_rule ?? 'Strict',
        },
      });
    }

    return NextResponse.json({ match });
  } catch (error) {
    console.error('Match fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
