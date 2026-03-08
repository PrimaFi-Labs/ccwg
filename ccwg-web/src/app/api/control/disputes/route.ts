import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { insertInboxMessages } from '@/src/lib/inbox/service';

/**
 * GET /api/control/disputes - List all room disputes (admin-only).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: disputes, error } = await (supabase as any)
      .from('room_disputes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ disputes: disputes || [] });
  } catch (error) {
    console.error('Admin disputes fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/control/disputes - Reply to / update a room dispute (admin-only).
 * Body: { dispute_id, status?, admin_reply? }
 * When admin_reply is provided, it also sends an inbox message to the player.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const disputeId = Number.parseInt(String(body?.dispute_id || ''), 10);
    const status = typeof body?.status === 'string' ? body.status : undefined;
    const adminReply = typeof body?.admin_reply === 'string' ? body.admin_reply.trim() : undefined;

    if (!Number.isFinite(disputeId)) {
      return NextResponse.json({ error: 'Invalid dispute_id' }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase as any)
      .from('room_disputes')
      .select('*')
      .eq('dispute_id', disputeId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: 'Dispute not found' }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      admin_wallet: adminAuth.wallet,
    };
    if (status) updatePayload.status = status;
    if (adminReply) updatePayload.admin_reply = adminReply;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error } = await (supabase as any)
      .from('room_disputes')
      .update(updatePayload)
      .eq('dispute_id', disputeId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (adminReply && existing.player_wallet) {
      await insertInboxMessages(supabase, [
        {
          player_wallet: existing.player_wallet,
          subject: `Room Dispute Reply - ${existing.room_code}`,
          body: adminReply,
          category: 'dispute_reply',
          related_room_id: existing.room_id ?? null,
          related_report_id: existing.report_id ?? null,
        },
      ]);
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_room_dispute',
      table_name: 'room_disputes',
      record_id: disputeId.toString(),
      after_data: updated,
    });

    return NextResponse.json({ dispute: updated });
  } catch (error) {
    console.error('Admin dispute update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
