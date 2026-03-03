import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { setMarketItemStatusOnChain } from '@/src/lib/starknet/chain';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: items, error } = await supabase
      .from('market_items')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ items });
  } catch (error) {
    console.error('Market items fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const item_id = body?.item_id as number | undefined;
    const is_active = body?.is_active as boolean | undefined;

    if (!item_id || typeof is_active !== 'boolean') {
      return NextResponse.json({ error: 'Missing item_id or is_active' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    await setMarketItemStatusOnChain(item_id, is_active);

    const { data: updated, error } = await supabase
      .from('market_items')
      .update({ is_active })
      .eq('item_id', item_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: is_active ? 'activate_market_item' : 'deactivate_market_item',
      table_name: 'market_items',
      record_id: item_id.toString(),
      after_data: updated,
    });

    return NextResponse.json({ item: updated });
  } catch (error) {
    console.error('Market item update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
