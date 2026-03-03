import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ botId: string }> }
) {
  try {
    const { botId } = await params;
    const botIdNum = Number.parseInt(botId, 10);
    if (Number.isNaN(botIdNum)) {
      return NextResponse.json({ error: 'Invalid bot id' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { data: bot, error } = await supabase
      .from('bots')
      .select('bot_id, name, difficulty, preferred_assets, aggression, defense, charge_bias, description, enabled, avatar_url')
      .eq('bot_id', botIdNum)
      .maybeSingle();

    if (error) {
      const msg = error.message || 'Failed to fetch bot';
      if (msg.toLowerCase().includes('does not exist')) {
        return NextResponse.json(
          { error: 'Bots table missing. Run migration 009_bots.sql.' },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    if (!bot) {
      return NextResponse.json({ error: 'Bot not found' }, { status: 404 });
    }

    return NextResponse.json({ bot });
  } catch (error) {
    console.error('Bot fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
