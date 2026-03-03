import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/src/types/supabase';

export type ActiveSanction = {
  sanction_type: 'PermanentBan' | 'Suspension' | 'TournamentBan';
  reason: string;
  expires_at: string | null;
};

const sanctionPriority = (type: ActiveSanction['sanction_type']) => {
  if (type === 'PermanentBan') return 3;
  if (type === 'Suspension') return 2;
  return 1;
};

export const getTopActiveSanction = async (
  supabase: SupabaseClient<Database>,
  wallet: string
): Promise<ActiveSanction | null> => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('player_sanctions')
    .select('sanction_type, reason, expires_at')
    .eq('player_wallet', wallet)
    .eq('status', 'Active')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) return null;

  const sorted = [...data].sort(
    (a, b) => sanctionPriority(b.sanction_type) - sanctionPriority(a.sanction_type)
  );
  const top = sorted[0];
  return {
    sanction_type: top.sanction_type as ActiveSanction['sanction_type'],
    reason: top.reason ?? '',
    expires_at: top.expires_at ?? null,
  };
};

export const blocksMatchmaking = (type: ActiveSanction['sanction_type']) =>
  type === 'PermanentBan' || type === 'Suspension';

export const blocksEvents = (type: ActiveSanction['sanction_type']) =>
  type === 'PermanentBan' || type === 'Suspension' || type === 'TournamentBan';
