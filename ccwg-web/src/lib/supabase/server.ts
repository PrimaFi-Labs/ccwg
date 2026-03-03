
// ccwg-web/src/lib/supabase/server.ts
// Existing createClient + NEW createServiceClient (admin/service operations)

import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/src/types/supabase';

// ✅ Safe masking for dev logs
const mask = (value?: string, showStart = 6, showEnd = 4) => {
  if (!value) return '(missing)';
  if (value.length <= showStart + showEnd) return '(too short)';
  return `${value.slice(0, showStart)}...${value.slice(-showEnd)}`;
};

// ✅ Only logs in development with DEBUG_SUPABASE=true
const logSupabaseEnv = (label: string) => {
  if (process.env.NODE_ENV !== 'development' || !process.env.DEBUG_SUPABASE) return;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log(`[supabase][${label}] NEXT_PUBLIC_SUPABASE_URL:`, url ? '✅ set' : '❌ missing');
  console.log(`[supabase][${label}] NEXT_PUBLIC_SUPABASE_ANON_KEY:`, mask(anon));
  console.log(`[supabase][${label}] SUPABASE_SERVICE_ROLE_KEY:`, mask(service));
};

// Existing createClient function...
export async function createClient() {
  const cookieStore = await cookies();

  logSupabaseEnv('createClient');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    console.error('[supabase][createClient] Missing env:', {
      NEXT_PUBLIC_SUPABASE_URL: url ? 'present' : 'missing',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: anon ? 'present' : 'missing',
    });
    throw new Error('Supabase env missing for createClient');
  }

  return createServerClient<Database>(url, anon, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component; safe to ignore
        }
      },
    },
  });
}

// NEW: Service role client for admin operations (bypasses RLS)
export function createServiceClient() {
  logSupabaseEnv('createServiceClient');

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !service) {
    console.error('[supabase][createServiceClient] Missing env:', {
      NEXT_PUBLIC_SUPABASE_URL: url ? 'present' : 'missing',
      SUPABASE_SERVICE_ROLE_KEY: service ? 'present' : 'missing',
    });
    throw new Error('Supabase env missing for createServiceClient');
  }

  return createServerClient<Database>(url, service, {
    cookies: {
      getAll() {
        return [];
      },
      setAll() {},
    },
  });
}

