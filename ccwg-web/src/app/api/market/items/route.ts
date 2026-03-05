//ccwg/ccwg-web/src/app/api/market/items/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase/server';
import { createMarketItemSchema } from '@/src/lib/validation/schemas';
import { requireAdmin } from '@/src/lib/auth/guards';
import { getSessionWallet } from '@/src/lib/auth/session';
import { validateAndParseAddress } from 'starknet';
import {
  upsertMarketItemCardConfigOnChain,
  upsertMarketItemOnChain,
} from '@/src/lib/starknet/chain';

// Get all active market items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: items, error } = await supabase
      .from('market_items')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');
    let wallet = (walletParam || getSessionWallet(request) || '').toLowerCase();
    if (walletParam) {
      try {
        wallet = validateAndParseAddress(walletParam).toLowerCase();
      } catch {}
    }
    if (!wallet || !items || items.length === 0) {
      return NextResponse.json({ items });
    }

    const walletCandidates = Array.from(
      new Set(
        [wallet, walletParam?.toLowerCase()].filter(Boolean) as string[]
      )
    );

    const serviceSupabase = createServiceClient();
    const { data: purchases } = await serviceSupabase
      .from('purchase_history')
      .select('item_id, player_wallet')
      .in('player_wallet', walletCandidates);

    const counts = new Map<number, number>();
    (purchases || []).forEach((p: any) => {
      counts.set(p.item_id, (counts.get(p.item_id) || 0) + 1);
    });

    const withCounts = items.map((item: any) => ({
      ...item,
      purchases_count: counts.get(item.item_id) || 0,
    }));

    return NextResponse.json({ items: withCounts });
  } catch (error) {
    console.error('Market items fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create market item (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createMarketItemSchema.parse(body);

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Validate prize distribution for packs
    if (validated.item_type === 'pack') {
      if (!validated.possible_cards || validated.possible_cards.length === 0) {
        return NextResponse.json({ error: 'Packs must specify possible cards' }, { status: 400 });
      }

      // Verify all template IDs exist
      const { data: templates } = await supabase
        .from('card_templates')
        .select('template_id')
        .in('template_id', validated.possible_cards);

      if (!templates || templates.length !== validated.possible_cards.length) {
        return NextResponse.json({ error: 'Invalid template IDs in possible_cards' }, { status: 400 });
      }
    }

    const { data: item, error } = await supabase
      .from('market_items')
      .insert(({
        name: validated.name,
        description: validated.description,
        item_type: validated.item_type,
        price_strk: validated.price_strk,
        cards_granted: validated.cards_granted,
        possible_cards: validated.possible_cards || null,
        per_wallet_limit: validated.per_wallet_limit ?? null,
        image_url: validated.image_public_id 
          ? `${validated.image_public_id}`
          : null,
        is_active: true,
      }) as any)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      await upsertMarketItemOnChain({
        itemId: item.item_id,
        name: validated.name,
        itemType: validated.item_type,
        priceStrk: validated.price_strk,
        cardsGranted: validated.cards_granted,
        perWalletLimit: validated.per_wallet_limit ?? 0,
        isActive: true,
      });

      const possibleCards = validated.possible_cards || [];
      const guaranteedCards = new Set(validated.guaranteed_cards || []);
      const weights = validated.card_weights || {};

      let index = 0;
      for (const templateId of possibleCards) {
        await upsertMarketItemCardConfigOnChain({
          itemId: item.item_id,
          index,
          templateId,
          guaranteed: guaranteedCards.has(templateId),
          weight: Number(weights[String(templateId)] || 0),
        });
        index += 1;
      }
    } catch (onChainError: any) {
      await supabase.from('market_items').delete().eq('item_id', item.item_id);
      return NextResponse.json(
        { error: onChainError?.message || 'Failed to sync market item on-chain' },
        { status: 500 }
      );
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_market_item',
      table_name: 'market_items',
      record_id: item.item_id.toString(),
      after_data: item,
    });

    return NextResponse.json({ item });
  } catch (error: any) {
    console.error('Market item creation error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
