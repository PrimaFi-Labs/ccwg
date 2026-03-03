import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');
    if (!walletParam) {
      return NextResponse.json({ error: 'wallet_address required' }, { status: 400 });
    }
    const wallet = walletParam.toLowerCase();
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('players')
      .select('wallet_address, username, stark_points, strk_balance, created_at')
      .eq('wallet_address', wallet)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ player: data });
  } catch (err) {
    console.error('Player profile GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const username = typeof body?.username === 'string' ? body.username.trim() : '';

    await ensurePlayerExists(wallet, { username: username || undefined });

    if (!username) {
      return NextResponse.json({ ok: true });
    }

    const supabase = createServiceClient();
    const { error } = await supabase
      .from('players')
      .update({ username })
      .eq('wallet_address', wallet);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Player profile update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
