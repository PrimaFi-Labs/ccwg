// ccwg-web/src/lib/auth/fingerprint.ts

import 'server-only';
import type { NextRequest } from 'next/server';
import { hashFingerprint } from './token';


export const generateFingerprint = (request: NextRequest): string => {
  // ✅ In development, use a simpler fingerprint that's more stable
  if (process.env.NODE_ENV === 'development') {
    const components = [
      request.headers.get('user-agent') || 'dev-agent',
      'development-mode',
    ];
    
    const fp = hashFingerprint(components);
    console.log('[Fingerprint] Development fingerprint generated');
    return fp;
  }

  // Production: Full fingerprint
  const components = [
    request.headers.get('user-agent') || '',
    request.headers.get('accept-language') || '',
    request.headers.get('accept-encoding') || '',
    request.headers.get('x-forwarded-for') || 
    request.headers.get('x-real-ip') || 
    '',
  ];

  return hashFingerprint(components);
};

export const validateFingerprint = (
  request: NextRequest,
  storedFingerprint: string
): boolean => {
  const currentFingerprint = generateFingerprint(request);
  const matches = currentFingerprint === storedFingerprint;
  
  console.log('[Fingerprint] Validation:', {
    matches,
    stored: storedFingerprint.substring(0, 10) + '...',
    current: currentFingerprint.substring(0, 10) + '...',
  });
  
  return matches;
};