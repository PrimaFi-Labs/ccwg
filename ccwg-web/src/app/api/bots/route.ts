import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const includeDisabled = url.searchParams.get('include_disabled') === 'true';

    const supabase = createServiceClient();
    let query = supabase
      .from('bots')
      .select('bot_id, name, difficulty, preferred_assets, aggression, defense, charge_bias, description, enabled, avatar_url')
      .order('difficulty', { ascending: true })
      .order('name', { ascending: true });

    if (!includeDisabled) {
      query = query.eq('enabled', true);
    }

    const { data: bots, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ bots: bots || [] });
  } catch (error) {
    console.error('Bots fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
