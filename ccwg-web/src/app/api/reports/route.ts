import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

const VALID_REASONS = new Set(['Cheating', 'Stalling', 'Harassment', 'BugExploit', 'Other']);

export async function POST(request: NextRequest) {
  try {
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const reporter = session.wallet.toLowerCase();

    const body = await request.json().catch(() => ({}));
    const reported_wallet = String(body?.reported_wallet || '').toLowerCase();
    const reason = String(body?.reason || '');
    const details = typeof body?.details === 'string' ? body.details.trim() : null;

    if (!reported_wallet || !reported_wallet.startsWith('0x')) {
      return NextResponse.json({ error: 'Invalid reported wallet' }, { status: 400 });
    }

    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ error: 'Invalid reason' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: report, error } = await supabase
      .from('player_reports')
      .insert({
        reporter_wallet: reporter,
        reported_wallet,
        reason: reason as 'Cheating' | 'Stalling' | 'Harassment' | 'BugExploit' | 'Other',
        details,
        status: 'Open',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Report submit error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
