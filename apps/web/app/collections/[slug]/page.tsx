import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/ui/product-card';
import { fallbackProducts } from '@/lib/placeholder-products';
import { findCollection } from '@/lib/category-copy';
import { JsonLd } from '@/components/seo/json-ld';
import { generateCollectionMetadata } from '@/lib/seo/collection';
import { buildFallbackMetadata } from '@/lib/seo/defaults';
import { collectionPageJsonLd } from '@/lib/seo/jsonld/collection-page';
import { itemListJsonLd } from '@/lib/seo/jsonld/item-list';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld/breadcrumb';
import {
  getCollectionBySlug,
  deriveVisibilityState,
  sortProducts,
} from '@/lib/collections';
import { CollectionHero } from './_components/collection-hero';
import { CollectionGrid, CollectionGridWithLookbook } from './_components/collection-grid';
import { CountdownBanner } from './_components/countdown-banner';
import { LookbookBreak } from './_components/lookbook-break';
import { PromoBanner } from './_components/promo-banner';
import { RelatedCollections } from './_components/related-collections';

export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const copy = findCollection(slug);
  const api = await getCollectionBySlug(slug);
  const name = api?.name ?? copy?.name;
  if (!name) return buildFallbackMetadata({ pathname: `/collections/${slug}` });
  return generateCollectionMetadata({
    name: api?.seoTitle ?? name,
    slug,
    description:
      api?.seoDescription ??
      api?.description ??
      copy?.description ??
      null,
    image: api?.ogImage ?? api?.heroImageDesktop ?? api?.image ?? copy?.hero ?? null,
  });
}

export default async function CollectionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const copy = findCollection(slug);
  const api = await getCollectionBySlug(slug);

  // No collection at all → 404
  if (!copy && !api) notFound();

  // If we have API data, honor visibility/scheduling rules
  if (api) {
    const { state } = deriveVisibilityState(api);

    if (state === 'hidden') notFound();

    if (state === 'prelaunch') {
      // Pre-launch teaser page (Phase 6 will polish; for now show name + countdown
      // anchor placeholder if prelaunchTeaser=true, else 404)
      if (!api.prelaunchTeaser) notFound();
      const startsAt = api.startDate ? new Date(api.startDate).toLocaleString() : '';
      return (
        <div className="mt-20 flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted">
            Coming
          </p>
          <h1 className="mt-3 font-serif text-5xl tracking-tight text-ink md:text-7xl">
            {api.name}
          </h1>
          {api.subtitle && (
            <p className="mt-4 text-sm uppercase tracking-[0.25em] text-muted">
              {api.subtitle}
            </p>
          )}
          <p className="mt-8 font-mono text-xs uppercase tracking-[0.2em] text-muted">
            Launches {startsAt}
          </p>
        </div>
      );
    }

    if (state === 'ended') {
      if (api.postEndBehavior === 'redirect' && api.postEndRedirect) {
        redirect(`/collections/${api.postEndRedirect}`);
      }
      if (api.postEndBehavior === 'hide') notFound();
      // 'archive' falls through to render with a banner
    }
  }

  // Render with full API data when available
  if (api) {
    const sortedProducts = sortProducts(api.products, api.defaultSort);
    const ended =
      api.endDate && new Date(api.endDate).getTime() < Date.now() && api.postEndBehavior === 'archive';

    return (
      <div>
        <JsonLd
          id="ld-collection"
          data={[
            collectionPageJsonLd({
              name: api.name,
              slug,
              description: api.description,
            }),
            breadcrumbJsonLd([
              { name: 'Collections', path: '/collections' },
              { name: api.name, path: `/collections/${slug}` },
            ]),
            itemListJsonLd(
              api.name,
              slug,
              sortedProducts.map(({ product }) => ({
                name: product.name,
                slug: product.slug,
                image: product.images?.[0] ?? '',
              })),
            ),
          ]}
        />

        <CollectionHero collection={api} />

        {api.showCountdown && api.endDate && (
          <CountdownBanner endDate={api.endDate} />
        )}

        <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12">
          <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
            <Link href="/" className="transition-colors hover:text-ink">
              Home
            </Link>
            <ChevronRight size={12} />
            <Link href="/collections" className="transition-colors hover:text-ink">
              Collections
            </Link>
            <ChevronRight size={12} />
            <span className="text-ink">{api.name}</span>
          </nav>

          {ended && (
            <div className="mb-12 border border-ink/20 bg-paper px-6 py-4 text-center">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                This drop has ended. Browse current collections.
              </p>
            </div>
          )}

          {api.type === 'PROMO' && (
            <div className="mb-12 mx-auto max-w-2xl">
              <PromoBanner collection={api} />
            </div>
          )}

          {api.description && (
            <div className="mx-auto mb-12 max-w-2xl text-center">
              <p className="text-sm leading-relaxed text-muted">{api.description}</p>
            </div>
          )}

          <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">
              {api.type === 'AUTO' ? 'Currently featured' : 'Pieces'}
            </p>
            <p className="text-xs uppercase tracking-[0.15em] text-muted">
              {sortedProducts.length} piece{sortedProducts.length === 1 ? '' : 's'}
            </p>
          </div>

          {api.lookbook.length === 0 ? (
            <CollectionGrid collection={api} products={sortedProducts} />
          ) : (
            <CollectionGridWithLookbook
              collection={api}
              products={sortedProducts}
              lookbook={api.lookbook}
            />
          )}

          {api.showRelated && (
            <div className="mt-20">
              <RelatedCollections currentSlug={slug} />
            </div>
          )}
        </div>
      </div>
    );
  }

  // No API data — fall back to category-copy preview with placeholder products
  const name = copy!.name;
  const description = copy?.description;
  const hero = copy?.hero;
  const season = copy?.season;
  const tagline = copy?.tagline;
  const status = copy?.status;

  const cards = fallbackProducts({
    key: `collection-${slug}`,
    title: name,
    categorySlug: slug,
    adjectives: 'generic',
    fit: slug,
    count: copy?.productCount ? Math.min(copy.productCount, 16) : 12,
  }).map((p) => ({
    name: p.name,
    slug: p.slug,
    price: Number(p.price),
    image: p.images[0] ?? '',
    hoverImage: p.images[1],
  }));

  return (
    <div>
      <JsonLd
        id="ld-collection"
        data={[
          collectionPageJsonLd({ name, slug, description: description ?? null }),
          breadcrumbJsonLd([
            { name: 'Collections', path: '/collections' },
            { name, path: `/collections/${slug}` },
          ]),
          itemListJsonLd(
            name,
            slug,
            cards.map((c) => ({ name: c.name, slug: c.slug, image: c.image })),
          ),
        ]}
      />

      {hero && (
        <div className="relative mt-20 h-[52vh] min-h-[360px] w-full overflow-hidden bg-ink">
          <picture>
            <img src={hero} alt={name} className="absolute inset-0 h-full w-full object-cover opacity-85" />
          </picture>
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-paper">
            {season && (
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-paper/75">
                {season}
              </p>
            )}
            <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{name}</h1>
            {tagline && (
              <p className="mt-3 text-sm uppercase tracking-[0.2em] text-paper/70">{tagline}</p>
            )}
            {description && (
              <p className="mt-5 max-w-xl text-sm leading-relaxed text-paper/85">{description}</p>
            )}
            {status && (
              <span
                className={`mt-6 inline-block border px-3 py-1 text-[10px] uppercase tracking-[0.2em] ${
                  status === 'active'
                    ? 'border-paper/40 text-paper'
                    : status === 'archive'
                      ? 'border-paper/20 text-paper/60'
                      : 'border-[#D4A853]/60 text-[#D4A853]'
                }`}
              >
                {status === 'active' ? 'Available now' : status === 'archive' ? 'Archived' : 'Upcoming'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12">
        <nav className="mb-6 flex items-center gap-1 text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-ink">Home</Link>
          <ChevronRight size={12} />
          <Link href="/collections" className="transition-colors hover:text-ink">Collections</Link>
          <ChevronRight size={12} />
          <span className="text-ink">{name}</span>
        </nav>

        {!hero && (
          <header className="mb-12 text-center">
            <h1 className="font-serif text-4xl tracking-tight text-ink md:text-5xl">{name}</h1>
            {description && <p className="mx-auto mt-4 max-w-lg text-sm text-muted">{description}</p>}
          </header>
        )}

        <div className="mb-8 flex items-end justify-between border-b border-ink/10 pb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Pieces</p>
          <p className="text-xs uppercase tracking-[0.15em] text-muted">
            {cards.length} piece{cards.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {cards.map((product) => (
            <ProductCard
              key={product.slug}
              name={product.name}
              slug={product.slug}
              price={product.price}
              image={product.image}
              hoverImage={product.hoverImage}
              starBadge={false}
            />
          ))}
        </div>

        <p className="mt-12 text-center text-[11px] uppercase tracking-[0.15em] text-muted/60">
          Showing curated preview — full assortment syncing soon.
        </p>
      </div>
    </div>
  );
}
