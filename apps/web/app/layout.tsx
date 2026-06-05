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
import { ChatBubble } from '@/components/chat/chat-bubble';
import { PromoPopup } from '@/components/promo/promo-popup';
import { JsonLd } from '@/components/seo/json-ld';
import { defaultMetadata } from '@/lib/seo/metadata';
import { seoEnv } from '@/lib/seo/env';
import { organizationJsonLd } from '@/lib/seo/jsonld/organization';
import { websiteJsonLd } from '@/lib/seo/jsonld/website';
import { fetchHomepageStyles } from '@/lib/homepage-sections';
import { buildNavWithCollections } from '@/lib/nav';

// CSS variable mappings — must mirror the apps/admin GlobalStylesPanel scale.
// Default (1) preserves the pre-composer layout exactly.
const SPACING_SCALE = [0.75, 1.0, 1.4] as const;
const FONT_RATIO    = [1.15, 1.25, 1.333] as const;
function clamp01to2(n: number): 0 | 1 | 2 {
  if (n <= 0) return 0;
  if (n >= 2) return 2;
  return 1;
}

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
  other: {
    'msapplication-TileColor': '#030302',
    'msapplication-config': '/browserconfig.xml',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#030302',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [styles, navItems] = await Promise.all([
    fetchHomepageStyles(),
    buildNavWithCollections(),
  ]);
  const spacing = SPACING_SCALE[clamp01to2(styles.negativeSpace)];
  const fontRatio = FONT_RATIO[clamp01to2(styles.typographyFlow)];

  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body
        className="min-h-screen bg-paper font-sans text-ink antialiased"
        style={{
          ['--section-spacing-scale' as string]: String(spacing),
          ['--font-scale-ratio' as string]: String(fontRatio),
        }}
      >
        <Script id="denimisia-splash-init" strategy="beforeInteractive">
          {SPLASH_INIT_SCRIPT}
        </Script>
        <JsonLd id="ld-organization" data={organizationJsonLd()} />
        <JsonLd id="ld-website" data={websiteJsonLd()} />
        <Providers>
          <SplashProvider>
            <SplashGate />
            <Navbar navItems={navItems} />
            <main>{children}</main>
            <Footer />
            <CartDrawer />
            <SignupSticker />
            <SlotDraftListener />
            <ChatBubble />
            <PromoPopup />
          </SplashProvider>
        </Providers>
      </body>
    </html>
  );
}
