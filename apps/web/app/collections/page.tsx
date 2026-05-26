import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CATEGORY_IMAGES, NAV_FEATURED } from '@/lib/placeholder-images';
import { SlotHero } from '@/components/slot/slot-hero';
import { buildMetadata } from '@/lib/seo/metadata';
import { getActiveCollections } from '@/lib/collections';

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: 'Collections',
  description:
    'Seasonal drops and retired archives from Denimisia. Each collection is a study — released, refined, retired.',
  pathname: '/collections',
});

interface CollectionEntry {
  slug: string;
  name: string;
  season: string;
  tagline: string;
  description: string;
  image: string;
  itemCount: number;
  status: 'active' | 'archive' | 'upcoming';
}

const COLLECTIONS: CollectionEntry[] = [
  {
    slug: 'spring26',
    name: 'Spring · Summer 26',
    season: 'SS26',
    tagline: 'Raw Collection',
    description:
      'A study in form, texture, and understated luxury. Unsanforized selvedge, editorial cuts, and considered proportions.',
    image: NAV_FEATURED.collectionLatest,
    itemCount: 24,
    status: 'active',
  },
  {
    slug: 'aw25',
    name: 'Autumn · Winter 25',
    season: 'AW25',
    tagline: 'The Heritage Study',
    description:
      'Heavyweight denim, chore coats, and workwear-rooted silhouettes. Built for layered winters and longer evenings.',
    image: CATEGORY_IMAGES.jackets,
    itemCount: 37,
    status: 'active',
  },
  {
    slug: 'dropout25',
    name: 'Dropout · 25',
    season: 'SS25 DROP 02',
    tagline: 'Limited Release',
    description:
      'A mid-season release featuring our most-requested cuts returned in one-time washes. Retired on sell-through.',
    image: NAV_FEATURED.seriesWideLeg,
    itemCount: 20,
    status: 'active',
  },
  {
    slug: 'ss25',
    name: 'Spring · Summer 25',
    season: 'SS25',
    tagline: 'The Lightweight Series',
    description:
      'Breathable weights, relaxed tailoring, and the introduction of our signature Panjabi cut. Partially retired.',
    image: CATEGORY_IMAGES.tops,
    itemCount: 13,
    status: 'archive',
  },
  {
    slug: 'aw24',
    name: 'Autumn · Winter 24',
    season: 'AW24',
    tagline: 'Inaugural Drop',
    description:
      'Denimisia&apos;s first full collection. Six silhouettes that defined our pattern language — now fully retired.',
    image: CATEGORY_IMAGES.denims,
    itemCount: 6,
    status: 'archive',
  },
];

const STATUS_LABEL: Record<CollectionEntry['status'], string> = {
  active: 'Available',
  archive: 'Archive',
  upcoming: 'Upcoming',
};

function statusFor(api: { isActive: boolean; startDate: string | null; endDate: string | null }): 'active' | 'archive' | 'upcoming' {
  const now = Date.now();
  if (!api.isActive) return 'archive';
  if (api.startDate && new Date(api.startDate).getTime() > now) return 'upcoming';
  if (api.endDate && new Date(api.endDate).getTime() < now) return 'archive';
  return 'active';
}

function seasonBadge(type: string): string {
  if (type === 'AUTO') return 'AUTO';
  if (type === 'PROMO') return 'PROMO';
  if (type === 'DROP') return 'DROP';
  return 'EDIT';
}

export default async function CollectionsPage() {
  const apiCollections = await getActiveCollections();

  // Render API collections when present, otherwise fall back to the hardcoded
  // editorial list so the page never looks empty for a customer.
  const entries: CollectionEntry[] = apiCollections.length > 0
    ? apiCollections.map((c) => ({
        slug: c.slug,
        name: c.name,
        season: seasonBadge(c.type),
        tagline: c.subtitle ?? c.railTitle ?? c.type,
        description:
          c.description ??
          c.seoDescription ??
          'A curated edit from the Denimisia studio.',
        image:
          c.heroImageDesktop ??
          c.image ??
          c.ogImage ??
          NAV_FEATURED.collectionLatest,
        itemCount: 0, // not returned in list endpoint; could add _count later
        status: statusFor(c),
      }))
    : COLLECTIONS;

  return (
    <div className="bg-paper pb-32">
      <SlotHero
        pageKey="collections-index"
        slotKey="collections_hero"
        fallbackImage={NAV_FEATURED.shopWomen}
        fallbackHeading="Curated collections."
        fallbackSubheading="Seasonal drops and retired archives — each a self-contained study."
        height="h-[52vh] min-h-[360px]"
        priority
      />
      <header className="mx-auto mb-20 mt-16 max-w-[1440px] px-6 md:px-12">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          The Archive
        </span>
        <h1 className="sr-only">Collections</h1>
      </header>

      <section className="mx-auto max-w-[1440px] px-6 md:px-12">
        <ul className="denimisia-bundle-grid grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entries.map((collection) => (
            <li key={collection.slug} className="relative bg-paper">
              <Link
                href={`/collections/${collection.slug}`}
                className="group block overflow-hidden"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-surface-highest)]">
                  <Image
                    src={collection.image}
                    alt={collection.name}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                  <div className="absolute left-5 top-5 flex items-center gap-2">
                    <span className="bg-ink px-3 py-1 text-[9px] font-bold uppercase tracking-[0.3em] text-paper">
                      {collection.season}
                    </span>
                    {collection.status === 'archive' && (
                      <span className="border border-paper/60 bg-transparent px-3 py-1 text-[9px] font-bold uppercase tracking-[0.3em] text-paper backdrop-blur-sm">
                        {STATUS_LABEL[collection.status]}
                      </span>
                    )}
                  </div>
                  {collection.itemCount > 0 && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/60 via-ink/10 to-transparent px-5 py-4 text-paper">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-paper/80">
                        {collection.itemCount} pieces
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-start justify-between gap-4 px-1 pt-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-[var(--color-secondary)]">
                      {collection.tagline}
                    </p>
                    <h2 className="mt-2 text-lg font-black uppercase tracking-tight text-ink">
                      {collection.name}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--color-secondary)]">
                      {collection.description}
                    </p>
                  </div>
                  <ArrowRight
                    size={18}
                    strokeWidth={1.5}
                    className="mt-1 shrink-0 text-ink transition-transform duration-300 group-hover:translate-x-1"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto mt-32 max-w-3xl px-6 text-center md:px-12">
        <span className="mb-4 block text-[10px] font-bold uppercase tracking-[0.4em] text-[var(--color-secondary)]">
          The Practice
        </span>
        <h2 className="mb-6 text-3xl font-black uppercase leading-tight tracking-tight text-ink md:text-4xl">
          Released. Refined. Retired.
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-secondary)] md:text-base">
          We don&apos;t restock. When a collection sells through it moves to the archive, making
          room for the next study. Our best-sellers carry over to the next season in evolved
          form — everything else is a one-time release.
        </p>
      </section>
    </div>
  );
}
