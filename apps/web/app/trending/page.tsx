import { Suspense } from 'react';
import { Metadata } from 'next';
import { getProducts, getProductFacets } from '@/lib/api';
import { ShopContent } from '@/components/shop/shop-content';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 60;

export const metadata: Metadata = buildMetadata({
  title: 'Trending',
  description:
    'Trending pieces from the Denimisia archive — what the studio is watching right now.',
  pathname: '/trending',
  canonicalAllowed: ['page'],
});

interface Props {
  searchParams: Promise<Record<string, string | undefined>>;
}

const PAGE_SIZE = 24;

export default async function TrendingPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);

  const [data, facets] = await Promise.all([
    getProducts({
      trending: true,
      sort: params.sort ?? 'newest',
      page,
      limit: PAGE_SIZE,
      category: params.category,
      minPrice: params.minPrice,
      maxPrice: params.maxPrice,
      size: params.size,
      color: params.color,
    }).catch(() => ({
      products: [],
      total: 0,
      page: 1,
      limit: PAGE_SIZE,
      totalPages: 0,
    })),
    getProductFacets().catch(() => ({
      categories: [],
      sizes: [],
      colors: [],
      price: { min: 0, max: 25000 },
    })),
  ]);

  return (
    <div className="w-full px-4 pb-20 sm:px-6 lg:px-8 2xl:px-12">
      <header className="mb-12 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">
          Trending Now
        </p>
        <h1 className="mt-3 text-3xl font-medium uppercase tracking-[0.2em] text-ink md:text-4xl">
          Trending
        </h1>
        {data.total > 0 && (
          <p className="mt-4 text-xs uppercase tracking-[0.2em] text-muted">
            {data.total} pieces
          </p>
        )}
      </header>

      <Suspense>
        <ShopContent
          products={data.products}
          total={data.total}
          page={data.page}
          totalPages={data.totalPages}
          facets={facets}
        />
      </Suspense>
    </div>
  );
}
