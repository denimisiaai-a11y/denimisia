import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { CartDrawer } from '@/components/layout/cart-drawer';
import { SignupSticker } from '@/components/marketing/signup-sticker';
import { Providers } from '@/components/providers';
import { SplashProvider } from '@/components/splash/splash-provider';
import { SplashGate } from '@/components/splash/splash-gate';
import { SlotDraftListener } from '@/components/slot-draft-listener';
import { JsonLd } from '@/components/seo/json-ld';
import { defaultMetadata } from '@/lib/seo/metadata';
import { seoEnv } from '@/lib/seo/env';
import { organizationJsonLd } from '@/lib/seo/jsonld/organization';
import { websiteJsonLd } from '@/lib/seo/jsonld/website';

// Runs in SSR HTML before body paints. Sets data-splash-skip on <html> when
// the splash should not run (repeat session, bfcache). No user input reaches
// this script — it's a static string, XSS-safe.
const SPLASH_INIT_SCRIPT =
  "(function(){try{var s=false;try{if(sessionStorage.getItem('denimisia:splash-seen')==='1')s=true;}catch(e){}try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.type==='back_forward')s=true;}catch(e){}if(s)document.documentElement.setAttribute('data-splash-skip','');}catch(e){}})();";
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  ...defaultMetadata,
  verification: {
    google: seoEnv.googleSiteVerification,
    other: seoEnv.metaDomainVerification
      ? { 'facebook-domain-verification': seoEnv.metaDomainVerification }
      : undefined,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="min-h-screen bg-paper font-sans text-ink antialiased">
        <Script id="denimisia-splash-init" strategy="beforeInteractive">
          {SPLASH_INIT_SCRIPT}
        </Script>
        <JsonLd id="ld-organization" data={organizationJsonLd()} />
        <JsonLd id="ld-website" data={websiteJsonLd()} />
        <Providers>
          <SplashProvider>
            <SplashGate />
            <Navbar />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <SignupSticker />
            <SlotDraftListener />
          </SplashProvider>
        </Providers>
      </body>
    </html>
  );
}
