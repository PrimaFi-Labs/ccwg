import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const admin = adminAuth as { wallet: string; role: string };
    return NextResponse.json({ wallet: admin.wallet, role: admin.role });
  } catch (error) {
    console.error('Admin me error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
