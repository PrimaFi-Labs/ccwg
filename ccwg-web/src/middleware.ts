// ccwg-web/src/middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(_request: NextRequest) {
  // ✅ Same-origin Next.js API routes do not need CORS headers.
  // Adding wildcard CORS can cause cookie/session weirdness in some environments.
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
