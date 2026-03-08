import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { createAbilitySchema } from '@/src/lib/validation/schemas';
import { requireAdmin } from '@/src/lib/auth/guards';

// Get all abilities
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: abilities, error } = await supabase
      .from('abilities')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ abilities });
  } catch (error) {
    console.error('Abilities fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create ability
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createAbilitySchema.parse(body);

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Check for duplicate ability_id
    const { data: existing } = await supabase
      .from('abilities')
      .select('ability_id')
      .eq('ability_id', validated.ability_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'Ability ID already exists' }, { status: 400 });
    }

    const { data: ability, error } = await supabase
      .from('abilities')
      .insert({
        ability_id: validated.ability_id,
        name: validated.name,
        description: validated.description,
        trigger_type: validated.trigger_type,
        effect_type: validated.effect_type,
        config: validated.config as any,
        usage_limit: validated.usage_limit,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_ability',
      table_name: 'abilities',
      record_id: ability.ability_id,
      after_data: ability,
    });

    return NextResponse.json({ ability });
  } catch (error: any) {
    console.error('Ability creation error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update ability
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ability_id, ...updates } = body;

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Get current ability
    const { data: before } = await supabase
      .from('abilities')
      .select('*')
      .eq('ability_id', ability_id)
      .single();

    if (!before) {
      return NextResponse.json({ error: 'Ability not found' }, { status: 404 });
    }

    // Update ability
    const { data: ability, error } = await supabase
      .from('abilities')
      .update(updates)
      .eq('ability_id', ability_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_ability',
      table_name: 'abilities',
      record_id: ability_id,
      before_data: before,
      after_data: ability,
    });

    return NextResponse.json({ ability });
  } catch (error) {
    console.error('Ability update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
