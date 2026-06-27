import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Strict environment matrix per audit feedback
if (process.env.NODE_ENV === 'production') {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('WARNING: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN should be defined in production for rate limiting. Falling back to memory limiter.');
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

// Basic in-memory rate limiter for dev fallback
const rateLimitMap = new Map<string, { count: number, resetTime: number }>();

// FIX #13: Periodically evict stale entries to prevent memory leaks in long-running instances
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(ip);
      }
    }
  }, 60 * 1000); // Clean up every minute
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

  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30;     // 30 requests per minute

  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count += 1;
  return true;
}

export default async function proxy(request: NextRequest) {
  // Only apply to /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rate Limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || '127.0.0.1';
  if (!(await checkRateLimit(ip))) {
    return new NextResponse(JSON.stringify({ error: "Too Many Requests" }), { 
      status: 429,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const origin = request.headers.get('origin') || '*';
  
  // The extension injects into any webpage (e.g. chatgpt.com) so the origin will be that webpage.
  // We reflect the origin back since the API is protected by Bearer auth.
  const allowedOrigin = origin;

  // For localhost dev, always allow PNA so the extension can reach the local dev server from a public origin.
  const isLocalhost = true; 

  // Handle preflight
  if (request.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Request-Private-Network',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'true',
    };
    if (isLocalhost) {
      headers['Access-Control-Allow-Private-Network'] = 'true';
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // For actual requests, add headers to the response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  response.headers.set('Access-Control-Allow-Credentials', 'true');
  if (isLocalhost) {
    response.headers.set('Access-Control-Allow-Private-Network', 'true');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
