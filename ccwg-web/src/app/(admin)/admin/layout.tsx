//ccwg-web/app/admin/layout.tsx

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyAccessToken, SESSION_COOKIE } from '@/src/lib/auth/session';
import { createServiceClient } from '@/src/lib/supabase/server';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  const data = token ? verifyAccessToken(token) : null;
  const wallet = data?.wallet ?? null;
  if (!wallet) {
    redirect('/lobby');
  }

  const supabase = createServiceClient();
  const { data: admin } = await supabase
    .from('admins')
    .select('role')
    .eq('wallet_address', wallet)
    .single();

  if (!admin) {
    redirect('/lobby');
  }

  return <>{children}</>;
}
