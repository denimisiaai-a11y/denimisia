import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ProductCard } from '@/components/ui/product-card';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';

export const revalidate = 60;

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

interface CampaignVariant {
  id: string;
  size: string;
  color: string;
  stock: number;
  price: string;
}

interface CampaignProductRow {
  id: string;
  productId: string;
  discountType: DiscountType;
  discountValue: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: string;
    compareAtPrice: string | null;
    images: string[];
    variants?: CampaignVariant[];
    category: { id: string; name: string; slug: string } | null;
  };
}

interface Campaign {
  id: string;
  name: string;
  slug: string;
  type: 'FLASH_SALE' | 'SEASONAL' | 'PROMO';
  startDate: string;
  endDate: string;
  products: CampaignProductRow[];
}

function applyDiscount(
  basePrice: number,
  type: DiscountType,
  value: number,
): number {
  if (type === 'PERCENTAGE') return Math.max(0, basePrice - (basePrice * value) / 100);
  if (type === 'FIXED_AMOUNT') return Math.max(0, basePrice - value);
  return basePrice;
}

async function fetchCampaign(slug: string): Promise<Campaign | null> {
  try {
    const res = await fetch(`${API}/campaigns/by-slug/${encodeURIComponent(slug)}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body?.data ?? body) as Campaign;
  } catch {
    return null;
  }
}

const TYPE_EYEBROW: Record<Campaign['type'], string> = {
  FLASH_SALE: 'Flash sale — limited window',
  SEASONAL: 'Seasonal edit',
  PROMO: 'Promo',
};

function formatWindow(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${fmt(s)} → ${fmt(e)}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await fetchCampaign(slug);
  if (!campaign) return { title: 'Campaign — Denimisia' };
  return {
    title: `${campaign.name} — Denimisia`,
    description: `${TYPE_EYEBROW[campaign.type]}. ${campaign.products.length} pieces at campaign pricing.`,
  };
}

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const campaign = await fetchCampaign(slug);
  if (!campaign) notFound();

  return (
    <main className="min-h-screen pt-24">
      {/* Hero */}
      <section className="border-b border-border bg-paper">
        <div className="mx-auto max-w-[1440px] px-6 py-16 lg:px-12 lg:py-20">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted">
            {TYPE_EYEBROW[campaign.type]} · {formatWindow(campaign.startDate, campaign.endDate)}
          </p>
          <h1 className="mt-4 font-serif text-5xl tracking-tight text-ink md:text-6xl lg:text-7xl">
            {campaign.name}
          </h1>
          <p className="mt-4 text-sm font-medium uppercase tracking-[0.2em] text-muted">
            {campaign.products.length} {campaign.products.length === 1 ? 'piece' : 'pieces'} on sale
          </p>
        </div>
      </section>

      {/* Products grid */}
      <section className="mx-auto max-w-[1440px] px-6 py-12 lg:px-12 lg:py-16">
        {campaign.products.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted">
            No products attached to this campaign yet — check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
            {campaign.products.map((row) => {
              const basePrice = Number(row.product.price);
              const finalPrice = applyDiscount(
                basePrice,
                row.discountType,
                Number(row.discountValue),
              );
              return (
                <ProductCard
                  key={row.id}
                  productId={row.product.id}
                  name={row.product.name}
                  slug={row.product.slug}
                  price={finalPrice}
                  originalPrice={basePrice}
                  image={resolveProductImage(row.product.images?.[0], row.product.slug)}
                  hoverImage={resolveHoverImage(row.product.images?.[1], row.product.slug)}
                />
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
