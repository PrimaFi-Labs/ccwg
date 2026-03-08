import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/src/lib/supabase/server';
import { requireAdmin } from '@/src/lib/auth/guards';
import { insertInboxMessages } from '@/src/lib/inbox/service';

const PLAYER_FETCH_PAGE_SIZE = 1000;
const INBOX_INSERT_BATCH_SIZE = 250;

type AnnouncementRow = {
  announcement_id: number;
  title: string;
  body: string;
  expires_at: string | null;
  is_active: boolean | null;
};

async function fetchAllPlayerWallets(supabase: ReturnType<typeof createServiceClient>) {
  const wallets: string[] = [];
  let from = 0;

  while (true) {
    const to = from + PLAYER_FETCH_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from('players')
      .select('wallet_address')
      .order('wallet_address', { ascending: true })
      .range(from, to);

    if (error) {
      throw new Error(`Failed to fetch players for announcement fanout: ${error.message}`);
    }

    const pageWallets = (data ?? [])
      .map((row) => row.wallet_address?.trim().toLowerCase())
      .filter((wallet): wallet is string => Boolean(wallet));

    if (pageWallets.length === 0) break;
    wallets.push(...pageWallets);
    if (pageWallets.length < PLAYER_FETCH_PAGE_SIZE) break;

    from += PLAYER_FETCH_PAGE_SIZE;
  }

  return wallets;
}

function isAnnouncementStillActive(announcement: AnnouncementRow) {
  if (announcement.is_active !== true) return false;
  if (!announcement.expires_at) return true;
  return new Date(announcement.expires_at).getTime() > Date.now();
}

async function fanoutAnnouncementToInbox(
  supabase: ReturnType<typeof createServiceClient>,
  announcement: AnnouncementRow,
  mode: 'publish' | 'ping'
) {
  if (!isAnnouncementStillActive(announcement)) return 0;

  const wallets = await fetchAllPlayerWallets(supabase);
  if (wallets.length === 0) return 0;

  const notificationKeyBase =
    mode === 'publish'
      ? `announcement:${announcement.announcement_id}:publish`
      : `announcement:${announcement.announcement_id}:ping:${Date.now()}`;

  for (let i = 0; i < wallets.length; i += INBOX_INSERT_BATCH_SIZE) {
    const slice = wallets.slice(i, i + INBOX_INSERT_BATCH_SIZE);
    await insertInboxMessages(
      supabase,
      slice.map((wallet) => ({
        player_wallet: wallet,
        subject: announcement.title,
        body: announcement.body,
        category: 'system' as const,
        notification_key: `${notificationKeyBase}:${wallet}`,
      }))
    );
  }

  return wallets.length;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator', 'Analyst']);
    if ('response' in adminAuth) return adminAuth.response;

    const { data: announcements, error } = await supabase
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ announcements });
  } catch (error) {
    console.error('Admin announcements fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const bodyText = typeof body?.body === 'string' ? body.body.trim() : '';
    const expires_at = body?.expires_at ? new Date(body.expires_at).toISOString() : null;
    const is_active = body?.is_active === false ? false : true;

    if (!title || !bodyText) {
      return NextResponse.json({ error: 'Missing title or body' }, { status: 400 });
    }

    const { data: announcement, error } = await supabase
      .from('announcements')
      .insert({
        title,
        body: bodyText,
        created_by: adminAuth.wallet,
        expires_at,
        is_active,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const delivered = await fanoutAnnouncementToInbox(supabase, announcement, 'publish');

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'create_announcement',
      table_name: 'announcements',
      record_id: announcement.announcement_id.toString(),
      after_data: { ...announcement, inbox_delivered_count: delivered },
    });

    return NextResponse.json({ announcement, inbox_delivered_count: delivered });
  } catch (error) {
    console.error('Admin announcement create error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const adminAuth = await requireAdmin(request, supabase, ['SuperAdmin', 'Moderator']);
    if ('response' in adminAuth) return adminAuth.response;

    const body = await request.json().catch(() => ({}));
    const announcement_id = Number.parseInt(String(body?.announcement_id || ''), 10);
    if (!announcement_id) {
      return NextResponse.json({ error: 'Missing announcement_id' }, { status: 400 });
    }

    if (body?.action === 'ping') {
      const { data: announcement, error } = await supabase
        .from('announcements')
        .select('announcement_id, title, body, expires_at, is_active')
        .eq('announcement_id', announcement_id)
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      if (!isAnnouncementStillActive(announcement)) {
        return NextResponse.json(
          { error: 'Announcement is inactive or expired and cannot be pinged' },
          { status: 400 }
        );
      }

      const delivered = await fanoutAnnouncementToInbox(supabase, announcement, 'ping');
      await supabase.from('audit_logs').insert({
        admin_wallet: adminAuth.wallet,
        action: 'ping_announcement',
        table_name: 'announcements',
        record_id: announcement_id.toString(),
        after_data: { announcement_id, inbox_delivered_count: delivered },
      });

      return NextResponse.json({ success: true, inbox_delivered_count: delivered });
    }

    const updates: Record<string, any> = {};
    if (typeof body?.title === 'string') updates.title = body.title.trim();
    if (typeof body?.body === 'string') updates.body = body.body.trim();
    if (body?.expires_at) updates.expires_at = new Date(body.expires_at).toISOString();
    if (typeof body?.is_active === 'boolean') updates.is_active = body.is_active;

    const { data: updated, error } = await supabase
      .from('announcements')
      .update(updates)
      .eq('announcement_id', announcement_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from('audit_logs').insert({
      admin_wallet: adminAuth.wallet,
      action: 'update_announcement',
      table_name: 'announcements',
      record_id: announcement_id.toString(),
      after_data: updated,
    });

    return NextResponse.json({ announcement: updated });
  } catch (error) {
    console.error('Admin announcement update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
