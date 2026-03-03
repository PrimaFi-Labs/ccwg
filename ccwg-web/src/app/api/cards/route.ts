import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/src/lib/supabase/server';
import { validateAndParseAddress } from 'starknet';
import { grantCardSchema } from '@/src/lib/validation/schemas';
import { requireAdmin, requireSessionWallet } from '@/src/lib/auth/guards';

// Get player's cards
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const walletParam = url.searchParams.get('wallet_address');

    let wallet = (walletParam || '').toLowerCase();
    if (walletParam) {
      try {
        wallet = validateAndParseAddress(walletParam).toLowerCase();
      } catch {}
    }
    let supabase = await createClient();

    if (!wallet) {
      const session = requireSessionWallet(request);
      if ('response' in session) return session.response;
      try {
        wallet = validateAndParseAddress(session.wallet).toLowerCase();
      } catch {
        wallet = session.wallet.toLowerCase();
      }
    } else {
      supabase = createServiceClient();
    }

    const walletCandidates = Array.from(
      new Set(
        [wallet, walletParam?.toLowerCase()].filter(Boolean) as string[]
      )
    );

    const { data: cards, error } = await supabase
      .from('player_cards')
      .select(`
        *,
        template:card_templates(*)
      `)
      .in('owner_wallet', walletCandidates)
      .order('acquired_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cards });
  } catch (error) {
    console.error('Cards fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Grant cards to player (admin/purchase)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = grantCardSchema.parse(body);

    const supabase = await createClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Create cards
    const cardsToInsert = Array(validated.quantity)
      .fill(null)
      .map(() => ({
        owner_wallet: validated.player_wallet,
        template_id: validated.template_id,
        level: 1,
        merge_count: 0,
      }));

    const { data: cards, error } = await supabase
      .from('player_cards')
      .insert(cardsToInsert)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cards });
  } catch (error: any) {
    console.error('Card grant error:', error);
    
    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
