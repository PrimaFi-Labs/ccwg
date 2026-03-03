// ccwg/ccwg-web/src/app/api/admin/upload/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { uploadToCloudinary } from '@/src/lib/cloudinary/server';
import { requireAdmin } from '@/src/lib/auth/guards';


// Upload image to Cloudinary (admin only)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const folder = formData.get('folder') as 'CARDS' | 'ABILITIES' | 'UI' | 'MARKET';
    const public_id = formData.get('public_id') as string | undefined;

    if (!file || !folder) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = createServiceClient();

    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Cloudinary
    const result = await uploadToCloudinary(buffer, folder, public_id);

    // Audit log
    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'upload_image',
      table_name: null,
      record_id: result.publicId,
      after_data: { url: result.url, publicId: result.publicId, folder },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
