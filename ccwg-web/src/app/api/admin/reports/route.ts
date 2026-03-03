import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: reports, error } = await supabase
      .from('player_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Admin reports fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const report_id = Number.parseInt(String(body?.report_id || ''), 10);
    const status = body?.status as string | undefined;
    const resolution_notes = typeof body?.resolution_notes === 'string' ? body.resolution_notes.trim() : null;

    if (!report_id || !status) {
      return NextResponse.json({ error: 'Missing report_id or status' }, { status: 400 });
    }

    const { data: updated, error } = await supabase
      .from('player_reports')
      .update({
        status: status as 'Open' | 'Reviewed' | 'Actioned' | 'Closed',
        admin_wallet: adminAuth.wallet,
        resolution_notes,
      })
      .eq('report_id', report_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_report',
      table_name: 'player_reports',
      record_id: report_id.toString(),
      after_data: updated,
    });

    return NextResponse.json({ report: updated });
  } catch (error) {
    console.error('Admin report update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
