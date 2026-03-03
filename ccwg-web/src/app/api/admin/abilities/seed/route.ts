import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { DEFAULT_ABILITIES } from '@/src/config/abilities';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    const defaults = Object.values(DEFAULT_ABILITIES);
    if (defaults.length === 0) {
      return NextResponse.json({ error: 'No default abilities configured' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('abilities')
      .upsert(defaults as any, { onConflict: 'ability_id' })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'seed_default_abilities',
      table_name: 'abilities',
      after_data: { count: data?.length ?? 0 },
    });

    return NextResponse.json({ abilities: data ?? [] });
  } catch (error) {
    console.error('Seed abilities error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
