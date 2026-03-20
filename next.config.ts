import type { NextConfig } from "next";
import withPWA from "next-pwa";

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  buildExcludes: [/middleware-manifest\.json$/],
  publicExcludes: ["!robots.txt"],
  fallbacks: {
    document: "/_offline",
  },
});

// Security headers configuration
const securityHeaders = [
  // Prevent XSS attacks
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // Prevent MIME-type sniffing
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Prevent clickjacking
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // Referrer policy
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // Permissions policy (restrict browser features)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self), usb=()',
  },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://m.stripe.com",
      "style-src 'self' 'unsafe-inline' https://js.stripe.com https://m.stripe.network",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co https://api.stripe.com https://m.stripe.com",
      "frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
  // Strict Transport Security (HSTS)
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
];

const nextConfig: NextConfig = {
  // Disable Strict Mode - prevents double-mounting in dev that causes Supabase lock conflicts
  reactStrictMode: false,
  // For Vercel deployment: use server-side rendering to enable API routes
  // For Capacitor builds: use environment variable to enable static export
  output: process.env.STATIC_EXPORT === "true" ? "export" : undefined,
  // Required for static export — Next.js Image Optimization doesn't work server-side
  images: {
    unoptimized: process.env.STATIC_EXPORT === "true",
  },
  // Trailing slashes for better Capacitor WebView compatibility
  trailingSlash: true,
  // Silence Turbopack conflict with next-pwa (which uses webpack)
  // @ts-ignore
  turbopack: {},
  // Security headers (only applies when running with server, not static export)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
      // API routes get additional security
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
};

export default pwaConfig(nextConfig);
