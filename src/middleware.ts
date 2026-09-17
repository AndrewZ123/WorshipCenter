import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const response = NextResponse.next();
  
  // Block all debug endpoints in production
  if (url.pathname.startsWith('/api/debug/')) {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Not Found' },
        { status: 404 }
      );
    }
  }

  // CORS Configuration
  const allowedOrigins = [
    'https://app.worshipcenter.app',
    'https://worshipcenter.app',
    // Capacitor native origins (iOS + Android WebView)
    'capacitor://worshipcenter.app',
    'ionic://worshipcenter.app',
    'http://worshipcenter.app',
    'https://localhost',
    process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : null,
    process.env.NODE_ENV === 'development' ? 'http://localhost:19006' : null,
  ].filter(Boolean);

  const origin = request.headers.get('origin');

  // Allow listed web origins, or Capacitor native scheme requests (no Origin header)
  if (origin && allowedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  if (request.method === 'OPTIONS') {
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Max-Age', '86400');
  }

  // Security Headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  response.headers.delete('x-powered-by');
  
  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Cache Control for sensitive endpoints
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/(app)/')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    response.headers.set('Pragma', 'no-cache');
  }

  return response;
}

export const config = {
  matcher: [
    '/api/debug/:path*',
    '/api/:path*',
    '/(app)/:path*',
  ],
};