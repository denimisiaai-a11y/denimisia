import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { BundleCard } from '@/components/ui/bundle-card';
import { getFeaturedBundles } from '@/lib/placeholder-bundles';
import { resolveProductImage } from '@/lib/placeholder-images';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';
const HOMEPAGE_BUNDLE_LIMIT = 4;

interface RealBundleItem {
  product: { slug: string; images: string[]; price: string };
}

interface RealBundle {
  id: string;
  name: string;
  slug: string;
  badgeText: string;
  description: string | null;
  image: string | null;
  items: RealBundleItem[];
}

interface BundleCardData {
  name: string;
  slug: string;
  image: string;
  badgeText: string;
  eyebrow?: string;
  tagline?: string;
  originalPrice?: number;
  bundlePrice?: number;
  savingsPercent?: number;
  itemCount?: number;
}

async function fetchRealBundles(): Promise<RealBundle[]> {
  try {
    const res = await fetch(`${API}/bundles`, { next: { revalidate: 60 } });
    if (!res.ok) return [];
    const json = await res.json();
    return json.success && Array.isArray(json.data) ? json.data : [];
  } catch {
    return [];
  }
}

function realBundleToCard(bundle: RealBundle): BundleCardData {
  // Old seed data stamped bundles with /images/stitch/*.jpg paths that were
  // never shipped — those URLs 400 on the optimizer. Treat that prefix as
  // "no image" and fall back to the first item's product photo.
  const validImage =
    bundle.image && !bundle.image.startsWith('/images/stitch/')
      ? bundle.image
      : null;
  const cover =
    validImage ??
    bundle.items[0]?.product.images[0] ??
    resolveProductImage(undefined, bundle.slug);

  // Sum item prices as the "original" reference price. We don't model a
  // bundle-level discount in the schema yet, so leave bundlePrice/savings
  // undefined — BundleCard hides those visual elements when missing.
  const originalPrice = bundle.items.reduce(
    (sum, item) => sum + Number(item.product.price ?? 0),
    0,
  );

  return {
    name: bundle.name,
    slug: bundle.slug,
    image: cover,
    badgeText: bundle.badgeText,
    tagline: bundle.description ?? undefined,
    itemCount: bundle.items.length,
    ...(originalPrice > 0 ? { originalPrice } : {}),
  };
}

interface BundleDealsProps {
  /** Heading text. Defaults to the styled "Bundle Deals" design. */
  title?: string;
  /** Max bundles to show. Defaults to HOMEPAGE_BUNDLE_LIMIT. */
  limit?: number;
}

export async function BundleDeals({ title, limit }: BundleDealsProps = {}) {
  const cap = typeof limit === 'number' && limit > 0 ? limit : HOMEPAGE_BUNDLE_LIMIT;
  // Prefer real admin-created bundles; fall back to placeholders so the
  // homepage doesn't go empty before any bundles exist.
  const real = await fetchRealBundles();
  const placeholders = getFeaturedBundles();

  const bundles: BundleCardData[] =
    real.length > 0
      ? real.slice(0, cap).map(realBundleToCard)
      : placeholders.slice(0, cap).map((b) => ({
          name: b.name,
          slug: b.slug,
          image: b.heroImage,
          badgeText: b.badgeText,
          eyebrow: b.eyebrow,
          tagline: b.tagline,
          originalPrice: b.originalPrice,
          bundlePrice: b.bundlePrice,
          savingsPercent: b.savingsPercent,
          itemCount: b.items.length,
        }));

  if (!bundles.length) return null;

  const maxSavings = bundles.reduce(
    (max, b) => Math.max(max, b.savingsPercent ?? 0),
    0,
  );

  return (
    <section
      data-slot="home.bundles_section"
      data-slot-kind="product-section"
      className="relative overflow-hidden bg-ink py-24 text-paper md:py-32"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(255,255,255,0.6) 0px, rgba(255,255,255,0.6) 1px, transparent 1px, transparent 14px)',
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-24 top-1/3 h-[420px] w-[420px] rounded-full bg-paper/[0.04] blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-32 bottom-0 h-[520px] w-[520px] rounded-full bg-paper/[0.05] blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-[1440px] px-6 md:px-12">
        <div className="mb-14 flex flex-col gap-10 md:mb-20 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-3 border border-paper/20 bg-paper/5 px-4 py-1.5 backdrop-blur-sm">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-paper" />
              <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-paper/80">
                Limited · While supplies last
              </span>
            </div>
            <h2 className="text-5xl font-black uppercase leading-[0.88] tracking-tighter text-paper sm:text-6xl md:text-7xl">
              {title ? (
                title
              ) : (
                <>
                  Bundle{' '}
                  <span className="relative inline-block">
                    <span className="relative z-10">Deals</span>
                    <span className="absolute inset-x-0 bottom-1 z-0 h-3 bg-paper/15 md:h-4" />
                  </span>
                </>
              )}
            </h2>
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-paper/70 md:text-base">
              Editor-curated pairings.{' '}
              {maxSavings > 0 ? (
                <>
                  Save up to{' '}
                  <span className="font-bold text-paper">{maxSavings}%</span>{' '}
                  when you buy the look together.
                </>
              ) : (
                <>Buy the look together in one go.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-6">
            {maxSavings > 0 && (
              <div className="hidden flex-col items-end border-r border-paper/15 pr-6 md:flex">
                <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-paper/50">
                  Up to
                </span>
                <span className="text-4xl font-black leading-none tracking-tight text-paper">
                  {maxSavings}% OFF
                </span>
              </div>
            )}
            <Link
              href="/bundles"
              className="group inline-flex items-center gap-3 bg-paper px-7 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink transition-all duration-300 hover:bg-white"
            >
              View All
              <ArrowRight
                size={14}
                strokeWidth={2.5}
                className="transition-transform group-hover:translate-x-1"
              />
            </Link>
          </div>
        </div>

        <div className="denimisia-bundle-grid grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-7">
          {bundles.map((bundle) => (
            <BundleCard
              key={bundle.slug}
              name={bundle.name}
              slug={bundle.slug}
              image={bundle.image}
              badgeText={bundle.badgeText}
              eyebrow={bundle.eyebrow}
              tagline={bundle.tagline}
              originalPrice={bundle.originalPrice}
              bundlePrice={bundle.bundlePrice}
              savingsPercent={bundle.savingsPercent}
              itemCount={bundle.itemCount}
            />
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 border-t border-paper/10 pt-10 text-[10px] font-medium uppercase tracking-[0.3em] text-paper/55">
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-paper/55" />
            Free nationwide delivery
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-paper/55" />
            Cash on delivery
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-paper/55" />
            7-day returns
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-paper/55" />
            Bundle discount applied at cart
          </span>
        </div>
      </div>
    </section>
  );
}
