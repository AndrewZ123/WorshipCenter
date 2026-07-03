import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ChakraProviderWrapper } from '@/components/providers/ChakraProvider';
import { MobileBootstrap } from '@/components/providers/MobileBootstrap';
import { AuthProvider } from '@/lib/auth';
import { Analytics } from '@vercel/analytics/next';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

export const metadata: Metadata = {
  title: 'WorshipCenter — Plan Services, Build Setlists, Coordinate Your Team',
  description:
    'WorshipCenter helps worship leaders plan service orders, manage song libraries, schedule team members, and track CCLI song usage — all in one place.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WorshipCenter',
  },
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0D9488',
  minimumScale: 1,
  initialScale: 1,
  width: 'device-width',
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.className}>
      <head>
        {/* iOS splash screen meta */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-192.png" />
        <link rel="apple-touch-startup-image" href="/icons/icon-512.png" />
        
        {/* Security Headers */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta httpEquiv="X-Frame-Options" content="DENY" />
        <meta httpEquiv="X-XSS-Protection" content="1; mode=block" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://m.stripe.com https://m.stripe.network; style-src 'self' 'unsafe-inline' 'unsafe-hashes' https://js.stripe.com https://m.stripe.network https://fonts.googleapis.com; img-src 'self' data: blob: https: https://*.stripe.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com https://m.stripe.com https://m.stripe.network; frame-src https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://m.stripe.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;"
        />
      </head>
      <body style={{ margin: 0, overflow: 'hidden' }} suppressHydrationWarning>
        <ChakraProviderWrapper>
          <MobileBootstrap />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ChakraProviderWrapper>
        <Analytics />
      </body>
    </html>
  );
}