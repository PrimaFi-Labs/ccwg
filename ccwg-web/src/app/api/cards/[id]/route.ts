import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/src/lib/supabase/server';
import { requireSessionWallet } from '@/src/lib/auth/guards';

// Get specific card
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cardId = Number.parseInt(id, 10);
    const supabase = await createClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;

    const { data: card, error } = await supabase
      .from('player_cards')
      .select(`
        *,
        template:card_templates(*)
      `)
      .eq('id', cardId)
      .eq('owner_wallet', wallet)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    return NextResponse.json({ card });
  } catch (error) {
    console.error('Card fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Merge/level up card
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cardId = Number.parseInt(id, 10);
    const { merge_with_card_id } = await request.json();

    const supabase = await createClient();
    const session = requireSessionWallet(request);
    if ('response' in session) return session.response;
    const wallet = session.wallet;

    // Verify both cards exist and are owned by same player
    const { data: baseCard } = await supabase
      .from('player_cards')
      .select('*, template:card_templates(*)')
      .eq('id', cardId)
      .eq('owner_wallet', wallet)
      .single();

    const { data: mergeCard } = await supabase
      .from('player_cards')
      .select('*, template:card_templates(*)')
      .eq('id', merge_with_card_id)
      .eq('owner_wallet', wallet)
      .single();

    if (!baseCard || !mergeCard) {
      return NextResponse.json({ error: 'Cards not found or not owned' }, { status: 404 });
    }

    // Verify same template
    if (baseCard.template_id !== mergeCard.template_id) {
      return NextResponse.json({ error: 'Cards must be same type to merge' }, { status: 400 });
    }

    // Verify level limit
    if ((baseCard.level ?? 0) >= 5) {
      return NextResponse.json({ error: 'Card already at max level' }, { status: 400 });
    }

    // Merge: level up base card, delete merge card
    const { error: updateError } = await supabase
      .from('player_cards')
      .update({
        level: (baseCard.level ?? 0) + 1,
        merge_count: (baseCard.merge_count ?? 0) + 1,
      })
      .eq('id', cardId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabase
      .from('player_cards')
      .delete()
      .eq('id', merge_with_card_id);

    // Fetch updated card
    const { data: updatedCard } = await supabase
      .from('player_cards')
      .select(`
        *,
        template:card_templates(*)
      `)
      .eq('id', cardId)
      .single();

    return NextResponse.json({ card: updatedCard });
  } catch (error) {
    console.error('Card merge error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
