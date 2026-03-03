import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { runRoomDecaySweep } from '@/src/lib/rooms/decay';

export async function POST(_request: NextRequest) {
  try {
    const supabase = createServiceClient();
    await runRoomDecaySweep(supabase);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Room decay sweep error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
