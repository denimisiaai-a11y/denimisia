import type { Metadata } from 'next';
import { BundleCard } from '@/components/ui/bundle-card';
import { getBundles, type Bundle } from '@/lib/api';
import { PLACEHOLDER_BUNDLES } from '@/lib/placeholder-bundles';
import { bundleToView } from '@/lib/bundle-view';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: 'Bundles',
  description: 'Curated bundles and collections — considered pairings at bundled pricing.',
  pathname: '/bundles',
});

const CATEGORIES = [
  { key: 'all', label: 'All Bundles' },
  { key: 'essentials', label: 'Essentials' },
  { key: 'signature', label: 'Signature' },
  { key: 'heritage', label: 'Heritage' },
  { key: 'seasonal', label: 'Seasonal' },
] as const;

async function fetchRealBundles(): Promise<Bundle[]> {
  try {
    return await getBundles();
  } catch {
    return [];
  }
}

export default async function BundlesPage() {
  const real = await fetchRealBundles();

  // Prefer admin-created bundles; fall back to placeholder catalog only when
  // the API has no bundles yet so the page never goes empty pre-launch.
  const bundles =
    real.length > 0 ? real.map(bundleToView) : PLACEHOLDER_BUNDLES;

  return (
    <div className="bg-paper pb-32">
      <SlotHero
        pageKey="bundles-index"
        slotKey="bundles_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Denim pairs, done for you."
        fallbackSubheading="Considered pairings at bundled pricing."
        height="h-[55vh] min-h-[360px]"
        priority
      />
      <header className="mx-auto mb-20 mt-20 max-w-[1440px] px-6 md:px-12">
        <span className="mb-4 block text-[10px] font-medium uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          The Archive
        </span>
        <h1 className="text-4xl font-black uppercase leading-[0.9] tracking-tighter text-ink md:text-6xl lg:text-7xl">
          Bundles &amp;<br />
          Collections
        </h1>
        <p className="mt-8 max-w-xl text-sm leading-relaxed text-[var(--color-secondary)]">
          Considered pairings at bundled pricing. Each set is curated for a specific wardrobe moment — rotating seasonally, retired when sold.
        </p>
      </header>

      <nav className="mx-auto mb-16 max-w-[1440px] px-6 md:px-12">
        <ul className="flex flex-wrap items-center gap-3 border-b border-[var(--color-outline-variant)] pb-6 text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
          {CATEGORIES.map((cat) => (
            <li key={cat.key}>
              <button
                type="button"
                className="rounded-full border border-ink/10 px-5 py-2 transition-colors hover:bg-ink hover:text-paper"
              >
                {cat.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="denimisia-bundle-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {bundles.map((bundle) => (
            <BundleCard
              key={bundle.slug}
              name={bundle.name}
              slug={bundle.slug}
              image={bundle.heroImage}
              badgeText={bundle.badgeText}
              eyebrow={bundle.eyebrow}
              tagline={bundle.tagline}
              originalPrice={bundle.originalPrice}
              bundlePrice={bundle.bundlePrice}
              savingsPercent={bundle.savingsPercent}
              itemCount={bundle.items.length}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
