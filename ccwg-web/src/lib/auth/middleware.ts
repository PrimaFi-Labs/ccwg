// ccwg-web/src/lib/auth/middleware.ts

import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSessionWallet, getSessionData } from './session';
import { RateLimiter } from './session-store';

// ============== Session Guard ==============

export const requireSessionWallet = (request: NextRequest) => {
  const wallet = getSessionWallet(request);
  if (!wallet) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }
  return { wallet } as const;
};

export const requireSessionData = (request: NextRequest) => {
  const data = getSessionData(request);
  if (!data) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as const;
  }
  return { session: data } as const;
};

// ============== Rate Limiting ==============

export const requireRateLimit = (
  wallet: string,
  maxRequests: number = 60,
  windowMs: number = 60000
) => {
  if (!RateLimiter.check(wallet, maxRequests, windowMs)) {
    return {
      response: NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429 }
      ),
    } as const;
  }
  return { allowed: true } as const;
};

// ============== Admin Guard ==============

export const requireAdmin = async (
  request: NextRequest,
  supabase: SupabaseClient,
  allowedRoles: Array<'SuperAdmin' | 'Moderator' | 'Analyst'> = ['SuperAdmin', 'Moderator']
) => {
  const session = requireSessionWallet(request);
  if ('response' in session) return session;

  const wallet = session.wallet;
  const walletLower = wallet.toLowerCase();

  // Check database
  const { data: admin } = await supabase
    .from('admins')
    .select('role')
    .eq('wallet_address', wallet)
    .single();

  if (!admin) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    } as const;
  }

  if (!allowedRoles.includes(admin.role)) {
    return {
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    } as const;
  }

  return { wallet, role: admin.role } as const;
};
