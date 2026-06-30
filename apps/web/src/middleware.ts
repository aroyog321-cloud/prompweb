import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ALLOWED_ORIGINS_SET } from '@/lib/allowedOrigins';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('WARNING: UPSTASH rate limit env vars missing. Falling back to memory limiter.');
  }
}

let ratelimit: Ratelimit | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, '1 m'),
    analytics: true,
  });
}

const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

/**
 * Lazily sweeps expired entries from the in-memory rate-limit map.
 * Only runs when the map exceeds 500 entries to keep the overhead minimal.
 */
function sweepExpiredRateLimitEntries(): void {
  if (rateLimitMap.size < 500) return;
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) rateLimitMap.delete(key);
  }
}

async function checkRateLimit(ip: string): Promise<boolean> {
  if (ratelimit) {
    try {
      const { success } = await ratelimit.limit(ip);
      return success;
    } catch (e) {
      console.warn('Upstash rate limit error, falling back to memory', e);
    }
  }
  sweepExpiredRateLimitEntries();
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 30;
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count += 1;
  return true;
}

// Dev origins are allowed in addition to the shared production list
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);

/**
 * Decodes the JWT sub-claim WITHOUT verifying the signature.
 * This is intentionally used ONLY for rate-limit key derivation — NOT for auth.
 * Authorization is always done server-side via Supabase's auth.getUser().
 * A malicious actor can forge the sub-claim to target a different rate-limit
 * bucket, but cannot gain access to other users' data this way.
 */
function tryDecodeJwtSub(authHeader: string): string | null {
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export default async function proxy(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const ip =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  if (!(await checkRateLimit(ip))) {
    return new NextResponse(JSON.stringify({ error: 'Too Many Requests' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (
    request.nextUrl.pathname === '/api/optimize' &&
    process.env.UPSTASH_REDIS_REST_URL
  ) {
    const authHeader = request.headers.get('authorization') ?? '';
    const jwtPayload = tryDecodeJwtSub(authHeader);
    if (jwtPayload) {
      try {
        const userRatelimit = new Ratelimit({
          redis: Redis.fromEnv(),
          limiter: Ratelimit.slidingWindow(60, '1 m'),
          prefix: 'rl:user',
        });
        const { success: userOk } = await userRatelimit.limit(jwtPayload);
        if (!userOk) {
          return new NextResponse(JSON.stringify({ error: 'Rate limit exceeded' }), {
            status: 429,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } catch (e) {
        console.warn('Upstash user rate limit error, bypassing', e);
      }
    }
  }

  const origin = request.headers.get('origin') || '';
  const isKnownOrigin =
    ALLOWED_ORIGINS_SET.has(origin) ||
    DEV_ORIGINS.has(origin) ||
    origin.startsWith('chrome-extension://');

  // FIXED: Never fall back to '*'. Return null for unknown origins.
  // The browser will reject cross-origin requests when no CORS header is set.
  const allowedOrigin: string | null = isKnownOrigin ? origin : null;

  const isLocalDev = DEV_ORIGINS.has(origin);

  if (request.method === 'OPTIONS') {
    // Reject preflight from unknown origins immediately
    if (!allowedOrigin) {
      return new NextResponse(null, { status: 403 });
    }
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Request-Private-Network',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true',
    };
    if (isLocalDev) headers['Access-Control-Allow-Private-Network'] = 'true';
    return new NextResponse(null, { status: 204, headers });
  }

  const response = NextResponse.next();
  // Only set CORS headers for known origins — unknown origins get no header (browser blocks them)
  if (allowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  const requestId = crypto.randomUUID();
  response.headers.set('x-request-id', requestId);

  if (isLocalDev) {
    response.headers.set('Access-Control-Allow-Private-Network', 'true');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
