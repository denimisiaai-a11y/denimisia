import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { BundleCard } from '@/components/ui/bundle-card';
import { BundleAddToCart } from '@/components/bundles/bundle-add-to-cart';
import { BundleItemsAccordion } from '@/components/bundles/bundle-items-accordion';
import { getBundleBySlug, getBundles, type Bundle } from '@/lib/api';
import { bundleToView } from '@/lib/bundle-view';
import {
  PLACEHOLDER_BUNDLES,
  getPlaceholderBundle,
  getRelatedBundles,
  type PlaceholderBundle,
} from '@/lib/placeholder-bundles';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return PLACEHOLDER_BUNDLES.map((b) => ({ slug: b.slug }));
}

async function loadBundle(slug: string): Promise<PlaceholderBundle | null> {
  try {
    const real = await getBundleBySlug(slug);
    return bundleToView(real);
  } catch {
    return getPlaceholderBundle(slug) ?? null;
  }
}

async function loadRelated(
  currentSlug: string,
  fallback: PlaceholderBundle[],
): Promise<PlaceholderBundle[]> {
  try {
    const all = await getBundles();
    const others = all.filter((b: Bundle) => b.slug !== currentSlug);
    if (others.length === 0) return fallback;
    return others.slice(0, 3).map(bundleToView);
  } catch {
    return fallback;
  }
}

export const revalidate = 60;

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const bundle = await loadBundle(slug);
  if (!bundle) return { title: 'Bundle Not Found' };
  return {
    title: bundle.name,
    description: bundle.description,
  };
}

function formatPrice(value: number): string {
  return `BDT ${value.toLocaleString('en-BD', { maximumFractionDigits: 0 })}`;
}

export default async function BundleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const bundle = await loadBundle(slug);

  if (!bundle) {
    notFound();
  }

  const related = await loadRelated(bundle.slug, getRelatedBundles(bundle.slug, 3));
  const savings = bundle.originalPrice - bundle.bundlePrice;

  return (
    <div className="bg-paper pb-32 pt-28">
      <div className="mx-auto max-w-[1440px] px-6 md:px-12">
        <Link
          href="/bundles"
          className="mb-10 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-ink/60 transition-colors hover:text-ink"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          All Bundles
        </Link>

        <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Hero image + gallery */}
          <div className="space-y-4">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[20px] bg-[var(--color-surface-highest)]">
              <Image
                src={bundle.heroImage}
                alt={bundle.name}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
              <div className="absolute left-6 top-6 bg-ink px-3 py-1.5 text-[9px] font-medium uppercase leading-tight tracking-[0.2em] text-paper">
                {bundle.badgeText}
              </div>
            </div>
            {bundle.gallery.length > 1 && (
              <div className="grid grid-cols-3 gap-4">
                {bundle.gallery.slice(0, 3).map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="relative aspect-square overflow-hidden rounded-[12px] bg-[var(--color-surface-highest)]"
                  >
                    <Image
                      src={src}
                      alt={`${bundle.name} detail ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 33vw, 16vw"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Details panel */}
          <div className="flex flex-col">
            <span className="mb-3 text-[10px] font-medium uppercase tracking-[0.4em] text-[var(--color-secondary)]">
              {bundle.eyebrow}
            </span>
            <h1 className="mb-4 text-4xl font-black uppercase leading-[0.95] tracking-tight text-ink md:text-5xl">
              {bundle.name}
            </h1>
            {bundle.tagline && (
              <p className="mb-8 text-sm italic leading-relaxed text-[var(--color-secondary)]">
                {bundle.tagline}
              </p>
            )}
            {bundle.description && (
              <p className="mb-10 text-[15px] leading-relaxed text-ink/80">
                {bundle.description}
              </p>
            )}

            {/* Pricing */}
            <div className="mb-10 border-y border-[var(--color-outline-variant)] py-8">
              <div className="flex items-baseline gap-4">
                <span className="text-3xl font-black text-ink">
                  {formatPrice(bundle.bundlePrice)}
                </span>
                {bundle.originalPrice > bundle.bundlePrice && (
                  <span className="text-lg text-ink/40 line-through">
                    {formatPrice(bundle.originalPrice)}
                  </span>
                )}
                {bundle.savingsPercent > 0 && (
                  <span className="ml-auto rounded-full bg-ink px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-paper">
                    Save {bundle.savingsPercent}%
                  </span>
                )}
              </div>
              {savings > 0 && (
                <p className="mt-2 text-xs uppercase tracking-widest text-[var(--color-secondary)]">
                  {formatPrice(savings)} saved versus individual pricing
                </p>
              )}
            </div>

            {/* Items included — expandable accordion with per-item detail */}
            <div className="mb-10">
              <div className="mb-5 flex items-baseline justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink">
                  What&apos;s Included
                </h2>
                <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-secondary)]">
                  Tap each item for detail
                </span>
              </div>
              <BundleItemsAccordion items={bundle.items} />
            </div>

            <BundleAddToCart bundle={bundle} />
            <p className="mt-4 text-center text-[10px] uppercase tracking-widest text-[var(--color-secondary)]">
              Free returns · Crafted in Bangladesh
            </p>
          </div>
        </div>

        {/* Related bundles */}
        {related.length > 0 && (
          <section className="mt-32 border-t border-[var(--color-outline-variant)] pt-16">
            <div className="mb-10 flex items-end justify-between">
              <div>
                <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.4em] text-[var(--color-secondary)]">
                  More Bundles
                </span>
                <h2 className="text-2xl font-black uppercase tracking-tight text-ink md:text-3xl">
                  You May Also Like
                </h2>
              </div>
              <Link
                href="/bundles"
                className="text-[10px] font-bold uppercase tracking-[0.3em] text-ink underline-offset-4 hover:underline"
              >
                View All →
              </Link>
            </div>
            <div className="denimisia-bundle-grid grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((b) => (
                <BundleCard
                  key={b.slug}
                  name={b.name}
                  slug={b.slug}
                  image={b.heroImage}
                  badgeText={b.badgeText}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
