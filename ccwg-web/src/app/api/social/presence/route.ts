import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';
import { ensurePlayerExists } from '@/src/lib/players/ensure-player';
import { touchPlayerPresence } from '@/src/lib/social/shared';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const currentPage =
      typeof body?.current_page === 'string' && body.current_page.length <= 120
        ? body.current_page
        : null;

    const supabase = createServiceClient();
    await ensurePlayerExists(wallet);
    await touchPlayerPresence(supabase as any, wallet, currentPage);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Presence update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
