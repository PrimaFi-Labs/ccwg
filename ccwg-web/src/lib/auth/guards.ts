// ccwg-web/src/lib/auth/guards.ts

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireSessionWallet, requireAdmin as middlewareRequireAdmin } from './middleware';

export { requireSessionWallet };

export const requireAdmin = async (
  request: NextRequest,
  supabase: SupabaseClient,
  allowedRoles: Array<'SuperAdmin' | 'Moderator' | 'Analyst'> = ['SuperAdmin', 'Moderator']
) => {
  return middlewareRequireAdmin(request, supabase, allowedRoles);
};
