import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { insertInboxMessages } from '@/src/lib/inbox/service';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: sanctions, error } = await supabase
      .from('player_sanctions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ sanctions });
  } catch (error) {
    console.error('Admin sanctions fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const player_wallet = String(body?.player_wallet || '').toLowerCase();
    const sanction_type = body?.sanction_type as string | undefined;
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const expires_at = body?.expires_at ? new Date(body.expires_at).toISOString() : null;
    const sp_penalty_raw = Number.parseInt(String(body?.sp_penalty ?? ''), 10);
    const sp_penalty = Number.isFinite(sp_penalty_raw) && sp_penalty_raw > 0 ? sp_penalty_raw : 0;

    if (!player_wallet || !sanction_type || !reason) {
      return NextResponse.json({ error: 'Missing player_wallet, sanction_type, or reason' }, { status: 400 });
    }

    const { data: sanction, error } = await supabase
      .from('player_sanctions')
      .insert({
        player_wallet,
        sanction_type: sanction_type as 'Suspension' | 'PermanentBan' | 'TournamentBan',
        reason,
        status: 'Active',
        sp_penalty,
        created_by: adminAuth.wallet,
        expires_at,
        petition_status: 'None',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_sanction',
      table_name: 'player_sanctions',
      record_id: sanction.sanction_id.toString(),
      after_data: sanction,
    });

    if (sp_penalty > 0) {
      const { data: player } = await supabase
        .from('players')
        .select('stark_points')
        .eq('wallet_address', player_wallet)
        .maybeSingle();

      if (player) {
        const current = player.stark_points ?? 0;
        const next = Math.max(0, current - sp_penalty);
        if (next !== current) {
          await supabase
            .from('players')
            .update({ stark_points: next })
            .eq('wallet_address', player_wallet);
        }
      }
    }

    await insertInboxMessages(supabase, [
      {
        player_wallet,
        subject: `Account Notice: ${sanction_type}`,
        body:
          `A ${sanction_type} has been applied to your account.\n` +
          `Reason: ${reason}\n` +
          (expires_at ? `Expires: ${new Date(expires_at).toLocaleString()}\n` : '') +
          (sp_penalty > 0 ? `SP Penalty: ${sp_penalty}\n` : '') +
          'Please review this notice in your inbox and contact support if needed.',
        category: 'system',
        notification_key: `sanction:${sanction.sanction_id}:applied`,
      },
    ]);

    return NextResponse.json({ sanction });
  } catch (error) {
    console.error('Admin sanction create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const sanction_id = Number.parseInt(String(body?.sanction_id || ''), 10);
    const status = body?.status as string | undefined;
    const review_notes = typeof body?.review_notes === 'string' ? body.review_notes.trim() : null;
    const petition_status = body?.petition_status as string | undefined;

    if (!sanction_id) {
      return NextResponse.json({ error: 'Missing sanction_id' }, { status: 400 });
    }

    const updates: Record<string, any> = {
      reviewed_by: adminAuth.wallet,
      reviewed_at: new Date().toISOString(),
    };

    if (status) updates.status = status;
    if (review_notes !== null) updates.review_notes = review_notes;
    if (petition_status) updates.petition_status = petition_status;

    const { data: updated, error } = await supabase
      .from('player_sanctions')
      .update(updates)
      .eq('sanction_id', sanction_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_sanction',
      table_name: 'player_sanctions',
      record_id: sanction_id.toString(),
      after_data: updated,
    });

    if (updated?.player_wallet && (status || petition_status)) {
      await insertInboxMessages(supabase, [
        {
          player_wallet: updated.player_wallet,
          subject: `Sanction Update: ${updated.sanction_type}`,
          body:
            `Your sanction has been updated.\n` +
            (status ? `Status: ${status}\n` : '') +
            (petition_status ? `Petition: ${petition_status}\n` : '') +
            (review_notes ? `Admin notes: ${review_notes}\n` : ''),
          category: 'system',
          notification_key: `sanction:${sanction_id}:update:${updated.reviewed_at ?? Date.now()}`,
        },
      ]);
    }

    return NextResponse.json({ sanction: updated });
  } catch (error) {
    console.error('Admin sanction update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
