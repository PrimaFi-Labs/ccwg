import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { createCardTemplateSchema } from '@/src/lib/validation/schemas';
import { requireAdmin } from '@/src/lib/auth/guards';

// Get all card templates (admin view)
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: templates, error } = await supabase
      .from('card_templates')
      .select('*')
      .order('template_id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Create card template (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = createCardTemplateSchema.parse(body);

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Verify ability exists
    const { data: ability } = await supabase
      .from('abilities')
      .select('ability_id')
      .eq('ability_id', validated.ability_id)
      .single();

    if (!ability) {
      return NextResponse.json({ error: 'Ability not found' }, { status: 404 });
    }

    const base_focus = validated.base + validated.charge_affinity;

    // Create template
    const { data: template, error } = await supabase
      .from('card_templates')
      .insert({
        asset: validated.asset,
        name: validated.name,
        rarity: validated.rarity,
        base: validated.base,
        attack_affinity: validated.attack_affinity,
        defense_affinity: validated.defense_affinity,
        charge_affinity: validated.charge_affinity,
        base_focus,
        volatility_sensitivity: validated.volatility_sensitivity,
        ability_id: validated.ability_id,
        is_ai_card: validated.is_ai_card ?? false,
        image_url: validated.image_public_id 
          ? `${validated.image_public_id}`
          : null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_card_template',
      table_name: 'card_templates',
      record_id: template.template_id.toString(),
      after_data: template,
    });

    return NextResponse.json({ template });
  } catch (error: any) {
    console.error('Template creation error:', error);

    if (error.name === 'ZodError') {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update card template (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { template_id, ...updates } = body;

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin']);
    if ('response' in adminAuth) return adminAuth.response;

    // Get current template
    const { data: before } = await supabase
      .from('card_templates')
      .select('*')
      .eq('template_id', template_id)
      .single();

    if (!before) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const resolvedUpdates: Record<string, any> = { ...updates };

    const hasNewStats =
      typeof resolvedUpdates.base === 'number' ||
      typeof resolvedUpdates.attack_affinity === 'number' ||
      typeof resolvedUpdates.defense_affinity === 'number' ||
      typeof resolvedUpdates.charge_affinity === 'number';

    const hasLegacyStats =
      typeof resolvedUpdates.base_focus === 'number';

    // Remove any stale legacy keys the client may still send
    delete resolvedUpdates.base_power;
    delete resolvedUpdates.base_defense;

    if (hasNewStats) {
      const base =
        typeof resolvedUpdates.base === 'number' ? resolvedUpdates.base : before.base;
      const attack_affinity =
        typeof resolvedUpdates.attack_affinity === 'number'
          ? resolvedUpdates.attack_affinity
          : before.attack_affinity;
      const defense_affinity =
        typeof resolvedUpdates.defense_affinity === 'number'
          ? resolvedUpdates.defense_affinity
          : before.defense_affinity;
      const charge_affinity =
        typeof resolvedUpdates.charge_affinity === 'number'
          ? resolvedUpdates.charge_affinity
          : before.charge_affinity;

      resolvedUpdates.base = base;
      resolvedUpdates.attack_affinity = attack_affinity;
      resolvedUpdates.defense_affinity = defense_affinity;
      resolvedUpdates.charge_affinity = charge_affinity;
      resolvedUpdates.base_focus = base + (charge_affinity ?? 0);
    } else if (hasLegacyStats) {
      const base_focus =
        typeof resolvedUpdates.base_focus === 'number'
          ? resolvedUpdates.base_focus
          : before.base_focus;

      const base = before.base ?? 0;
      resolvedUpdates.charge_affinity = (base_focus ?? 0) - base;
      resolvedUpdates.base_focus = base_focus ?? 0;
    }

    // Update template
    const { data: template, error } = await supabase
      .from('card_templates')
      .update(resolvedUpdates)
      .eq('template_id', template_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_card_template',
      table_name: 'card_templates',
      record_id: template_id.toString(),
      before_data: before,
      after_data: template,
    });

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
