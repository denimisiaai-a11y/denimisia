import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { formatPrice } from '@/lib/utils';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

interface SharedWishlistProduct {
  id: string;
  name: string;
  slug: string;
  price: string;
  images: string[];
  variants: { stock: number }[];
}

interface SharedWishlistItem {
  id: string;
  productId: string;
  product: SharedWishlistProduct | null;
}

interface SharedWishlist {
  ownerFirstName: string;
  items: SharedWishlistItem[];
}

async function getSharedWishlist(token: string): Promise<SharedWishlist | null> {
  try {
    const res = await fetch(`${API}/wishlist/shared/${encodeURIComponent(token)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? (json.data as SharedWishlist) : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wishlist = await getSharedWishlist(token);
  if (!wishlist) return { title: 'Wishlist — Denimisia' };
  return {
    title: `${wishlist.ownerFirstName}'s Wishlist — Denimisia`,
    description: `A curated wishlist of ${wishlist.items.length} pieces.`,
    robots: { index: false, follow: false },
  };
}

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const wishlist = await getSharedWishlist(token);
  if (!wishlist) notFound();

  return (
    <div className="mx-auto max-w-7xl px-6 py-16 md:px-12 md:py-24">
      <header className="mb-12 space-y-3 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-muted">A curated wishlist</p>
        <h1 className="text-3xl font-black uppercase tracking-tight text-ink md:text-5xl">
          {wishlist.ownerFirstName}&apos;s picks
        </h1>
        <p className="text-sm text-muted">
          {wishlist.items.length} piece{wishlist.items.length === 1 ? '' : 's'}
        </p>
      </header>

      {wishlist.items.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted">This wishlist is empty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
          {wishlist.items.map((item) => {
            if (!item.product) return null;
            const outOfStock =
              (item.product.variants?.reduce((sum, v) => sum + v.stock, 0) ?? 0) === 0;
            return (
              <Link
                key={item.id}
                href={`/products/${item.product.slug}`}
                className="group block"
              >
                <div className="relative aspect-[3/4] overflow-hidden bg-[var(--color-surface-low)]">
                  {item.product.images?.[0] && (
                    <Image
                      src={item.product.images[0]}
                      alt={item.product.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                    />
                  )}
                  {outOfStock && (
                    <span className="absolute left-3 top-3 bg-ink/90 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.25em] text-paper">
                      Out of stock
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-start justify-between gap-3">
                  <h3 className="truncate text-xs font-bold uppercase tracking-widest text-ink">
                    {item.product.name}
                  </h3>
                  <span className="shrink-0 text-xs font-medium text-ink">
                    {formatPrice(Number(item.product.price))}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-20 flex justify-center">
        <Link
          href="/shop"
          className="border border-ink px-10 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Shop Denimisia
        </Link>
      </div>
    </div>
  );
}
