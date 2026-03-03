//ccwg-web/src/app/api/matches/queue/status/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet.toLowerCase();

    const supabase = createServiceClient();
    await supabase.from('ranked_queue').delete().eq('player_wallet', wallet);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Queue cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
