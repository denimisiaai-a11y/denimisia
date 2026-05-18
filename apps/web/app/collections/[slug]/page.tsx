import { cache } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { ProductCard } from '@/components/ui/product-card';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import { fallbackProducts } from '@/lib/placeholder-products';
import { findCollection } from '@/lib/category-copy';
import { JsonLd } from '@/components/seo/json-ld';
import { generateCollectionMetadata } from '@/lib/seo/collection';
import { buildFallbackMetadata } from '@/lib/seo/defaults';
import { collectionPageJsonLd } from '@/lib/seo/jsonld/collection-page';
import { itemListJsonLd } from '@/lib/seo/jsonld/item-list';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld/breadcrumb';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface CollectionProduct {
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    compareAtPrice: string | null;
    images: string[];
    variants: { id: string; size: string; color: string; price: string; stock: number }[];
  };
}

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  products: CollectionProduct[];
}

const getCollection = cache(async (slug: string): Promise<Collection | null> => {
  try {
    const res = await fetch(`${API}/collections/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const copy = findCollection(slug);
  const api = await getCollection(slug);
  const name = api?.name ?? copy?.name;
  if (!name) return buildFallbackMetadata({ pathname: `/collections/${slug}` });
  return generateCollectionMetadata({
    name,
    slug,
    description: api?.description ?? copy?.description ?? null,
    image: api?.image ?? copy?.hero ?? null,
  });
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const copy = findCollection(slug);
  const api = await getCollection(slug);

  // Neither a curated collection nor API data — real 404
  if (!copy && !api) notFound();

  const name = api?.name ?? copy!.name;
  const description = api?.description ?? copy!.description;
  // Admin can set Collection.image from the admin panel (manage-collection
  // modal). When present it overrides the hardcoded copy.hero. The
  // hardcoded value remains as fallback for collections that exist in
  // category-copy.ts but were not yet seeded in the API.
  const hero = api?.image ?? copy?.hero;
  const season = copy?.season;
  const tagline = copy?.tagline;
  const status = copy?.status;

  const apiProducts = api?.products.map((cp) => cp.product) ?? [];
  const usingPlaceholders = apiProducts.length === 0;
  const cards = usingPlaceholders
    ? fallbackProducts({
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
      }))
    : apiProducts.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        price: Number(p.price),
        image: resolveProductImage(p.images[0], p.slug),
        hoverImage: resolveHoverImage(p.images[1], p.slug),
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
      {/* Editorial hero */}
      {hero && (
        <div className="relative mt-20 h-[52vh] min-h-[360px] w-full overflow-hidden bg-ink">
          <Image src={hero} alt={name} fill priority sizes="100vw" className="object-cover opacity-85" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/70" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-paper">
            {season && (
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.3em] text-paper/75">
                {season}
              </p>
            )}
            <h1 className="font-serif text-4xl tracking-tight md:text-6xl">{name}</h1>
            {tagline && <p className="mt-3 text-sm uppercase tracking-[0.2em] text-paper/70">{tagline}</p>}
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
              productId={'id' in product ? (product.id as string) : undefined}
              name={product.name}
              slug={product.slug}
              price={product.price}
              image={product.image}
              hoverImage={product.hoverImage}
              starBadge={
                'showStarBadge' in product
                  ? Boolean(product.showStarBadge)
                  : false
              }
            />
          ))}
        </div>

        {usingPlaceholders && (
          <p className="mt-12 text-center text-[11px] uppercase tracking-[0.15em] text-muted/60">
            Showing curated preview — full assortment syncing soon.
          </p>
        )}
      </div>
    </div>
  );
}
