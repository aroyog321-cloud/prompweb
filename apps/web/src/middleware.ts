import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only apply to /api/* routes
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  const origin = request.headers.get('origin') || '';
  
  // The API is consumed by a Chrome extension content script which can be injected 
  // into any webpage (chatgpt.com, claude.ai, etc.). Thus, we must allow any origin.
  const allowedOrigin = origin || '*';

  // FIX 1.3: Only allow private network access for localhost dev origins.
  // Sending Access-Control-Allow-Private-Network: true for public domains lets
  // any malicious site reach the user's local dev server.
  const isLocalhost = origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1');

  // Handle preflight
  if (request.method === 'OPTIONS') {
    const headers: Record<string, string> = {
      'Access-Control-Allow-Origin': allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    };
    if (isLocalhost) {
      headers['Access-Control-Allow-Private-Network'] = 'true';
    }
    return new NextResponse(null, { status: 204, headers });
  }

  // For actual requests, add headers to the response
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
  if (isLocalhost) {
    response.headers.set('Access-Control-Allow-Private-Network', 'true');
  }
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
