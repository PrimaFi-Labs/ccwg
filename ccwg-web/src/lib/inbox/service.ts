import type { SupabaseClient } from '@supabase/supabase-js';

const INBOX_RETENTION_DAYS = 3;
const PURGE_INTERVAL_MS = 15 * 60 * 1000;

let lastPurgeAtMs = 0;

export type InboxCategory = 'system' | 'dispute_reply' | 'room';

export type InboxInsertInput = {
  player_wallet: string;
  subject: string;
  body: string;
  category?: InboxCategory;
  related_room_id?: number | null;
  related_report_id?: number | null;
  notification_key?: string | null;
  expires_at?: string;
};

function buildDefaultExpiresAt(now: Date): string {
  return new Date(now.getTime() + INBOX_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

function normalizeWallet(wallet: string): string {
  return wallet.toLowerCase();
}

function isMissingConflictTarget(errorMessage: string): boolean {
  return errorMessage.includes(
    'there is no unique or exclusion constraint matching the ON CONFLICT specification'
  );
}

async function insertKeyedWithoutUpsert(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inbox: any,
  withKey: InboxInsertInput[]
) {
  const wallets = Array.from(new Set(withKey.map((m) => m.player_wallet)));
  const keys = Array.from(
    new Set(withKey.map((m) => m.notification_key).filter((value): value is string => Boolean(value)))
  );

  if (wallets.length === 0 || keys.length === 0) return;

  const { data: existing, error: existingError } = await inbox
    .select('player_wallet, notification_key')
    .in('player_wallet', wallets)
    .in('notification_key', keys);

  if (existingError) {
    throw new Error(`Failed to read existing inbox notifications: ${existingError.message}`);
  }

  const existingSet = new Set(
    ((existing ?? []) as Array<{ player_wallet: string; notification_key: string | null }>)
      .filter((row) => Boolean(row.notification_key))
      .map((row) => `${normalizeWallet(row.player_wallet)}::${row.notification_key as string}`)
  );

  const missing = withKey.filter(
    (row) => !existingSet.has(`${normalizeWallet(row.player_wallet)}::${row.notification_key}`)
  );

  if (missing.length === 0) return;

  const { error: insertError } = await inbox.insert(missing);
  if (insertError) {
    throw new Error(`Failed to insert inbox messages: ${insertError.message}`);
  }
}

export async function insertInboxMessages(
  supabase: SupabaseClient,
  messages: InboxInsertInput[],
  now: Date = new Date()
) {
  if (messages.length === 0) return;

  const normalized = messages
    .filter((msg) => Boolean(msg.player_wallet))
    .map((msg) => ({
      ...msg,
      player_wallet: normalizeWallet(msg.player_wallet),
      category: msg.category ?? 'system',
      expires_at: msg.expires_at ?? buildDefaultExpiresAt(now),
      notification_key: msg.notification_key ?? null,
      related_room_id: msg.related_room_id ?? null,
      related_report_id: msg.related_report_id ?? null,
    }));

  if (normalized.length === 0) return;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inbox = (supabase as any).from('player_inbox');
  const withKey = normalized.filter((m) => m.notification_key);
  const withoutKey = normalized.filter((m) => !m.notification_key);

  if (withKey.length > 0) {
    const { error } = await inbox.upsert(withKey, {
      onConflict: 'player_wallet,notification_key',
      ignoreDuplicates: true,
    });
    if (error) {
      if (isMissingConflictTarget(error.message)) {
        // Backward-compatible fallback for DBs missing the expected unique index shape.
        await insertKeyedWithoutUpsert(inbox, withKey);
      } else {
        throw new Error(`Failed to upsert inbox messages: ${error.message}`);
      }
    }
  }

  if (withoutKey.length > 0) {
    const { error } = await inbox.insert(withoutKey);
    if (error) {
      throw new Error(`Failed to insert inbox messages: ${error.message}`);
    }
  }
}

export async function purgeExpiredInboxMessages(
  supabase: SupabaseClient,
  nowIso: string = new Date().toISOString()
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('player_inbox')
    .delete()
    .lte('expires_at', nowIso);

  if (error) {
    throw new Error(`Failed to purge expired inbox messages: ${error.message}`);
  }
}

export async function maybePurgeExpiredInboxMessages(
  supabase: SupabaseClient,
  now: Date = new Date()
) {
  const nowMs = now.getTime();
  if (nowMs - lastPurgeAtMs < PURGE_INTERVAL_MS) return;

  await purgeExpiredInboxMessages(supabase, now.toISOString());
  lastPurgeAtMs = nowMs;
}
