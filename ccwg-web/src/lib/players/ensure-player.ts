import 'server-only';
import { createServiceClient } from '@/src/lib/supabase/server';

type EnsurePlayerOptions = {
  username?: string | null;
};

export async function ensurePlayerExists(
  walletAddress: string,
  options: EnsurePlayerOptions = {}
) {
  const wallet = walletAddress.toLowerCase();
  const username = options.username?.trim();
  const supabase = createServiceClient();

  console.log('[Players] ensurePlayerExists start:', {
    wallet,
    hasUsername: !!username,
  });

  const { data: existing, error: selectError } = await supabase
    .from('players')
    .select('wallet_address, username')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (selectError) {
    console.error('[Players] ensurePlayerExists select failed:', {
      wallet,
      message: selectError.message,
      code: selectError.code,
      details: selectError.details,
    });
    throw new Error(`Failed to check player row for ${wallet}: ${selectError.message}`);
  }

  if (!existing) {
    const { error: insertError } = await supabase
      .from('players')
      .insert({
        wallet_address: wallet,
        ...(username ? { username } : {}),
      });

    if (insertError) {
      console.error('[Players] ensurePlayerExists insert failed:', {
        wallet,
        message: insertError.message,
        code: insertError.code,
        details: insertError.details,
      });
      throw new Error(`Failed to insert player row for ${wallet}: ${insertError.message}`);
    }

    console.log('[Players] ensurePlayerExists inserted:', { wallet });
    return;
  }

  if (username && !existing.username) {
    const { error: updateError } = await supabase
      .from('players')
      .update({ username })
      .eq('wallet_address', wallet);

    if (updateError) {
      console.error('[Players] ensurePlayerExists update failed:', {
        wallet,
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
      });
      throw new Error(`Failed to update player row for ${wallet}: ${updateError.message}`);
    }

    console.log('[Players] ensurePlayerExists updated username:', { wallet });
  }

  console.log('[Players] ensurePlayerExists success:', { wallet });
}
