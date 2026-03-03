import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const sanction_id = Number.parseInt(String(body?.sanction_id || ''), 10);
    const petition_text = typeof body?.petition_text === 'string' ? body.petition_text.trim() : '';

    if (!sanction_id || !petition_text) {
      return NextResponse.json({ error: 'Missing sanction_id or petition_text' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: sanction } = await supabase
      .from('player_sanctions')
      .select('sanction_id, player_wallet')
      .eq('sanction_id', sanction_id)
      .single();

    if (!sanction || sanction.player_wallet.toLowerCase() !== wallet) {
      return NextResponse.json({ error: 'Sanction not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('player_sanctions')
      .update({
        petition_text,
        petition_status: 'Pending',
        petition_created_at: new Date().toISOString(),
      })
      .eq('sanction_id', sanction_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Petition submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
