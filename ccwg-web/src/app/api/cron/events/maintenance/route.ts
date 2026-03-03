import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { runEventMaintenance } from '@/src/lib/events/maintenance';

export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET is not configured' }, { status: 500 });
    }

    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();
    const result = await runEventMaintenance(supabase);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error('Event maintenance cron error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

