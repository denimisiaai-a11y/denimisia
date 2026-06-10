/**
 * Storefront curation helper.
 *
 * Fetches the resolved product list for a dynamic section
 * (e.g. home/new_arrivals_section). Returns empty arrays on any error so
 * that the storefront can fall back to existing static placeholder data.
 */

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export interface CuratedVariant {
  readonly price: string;
  readonly stock: number;
  readonly size: string;
  readonly color: string;
  readonly sku: string;
}

export interface CuratedProduct {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly price: string;
  readonly images: readonly string[];
  readonly tags: readonly string[];
  readonly category: { readonly slug: string; readonly name: string } | null;
  readonly variants: readonly CuratedVariant[];
  readonly showStarBadge?: boolean;
}

export interface CuratedItem {
  readonly productId: string;
  readonly product: CuratedProduct;
  readonly customImageUrl: string | null;
  readonly customImagePoster: string | null;
  readonly isPinned: boolean;
  readonly isManual: boolean;
  readonly sectionProductId: string | null;
}

export interface CuratedSection {
  readonly curation: {
    readonly id: string;
    readonly label: string;
    readonly heading: string | null;
    readonly subheading: string | null;
    readonly ctaLabel: string | null;
    readonly ctaHref: string | null;
    readonly maxItems: number;
    readonly isActive: boolean;
  } | null;
  readonly items: readonly CuratedItem[];
}

export async function fetchCuratedSection(
  pageKey: string,
  sectionKey: string,
): Promise<CuratedSection> {
  try {
    const res = await fetch(`${API}/curation/${encodeURIComponent(pageKey)}/${encodeURIComponent(sectionKey)}`, {
      next: { revalidate: 30, tags: [`curation:${pageKey}:${sectionKey}`] },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return { curation: null, items: [] };
    const json = (await res.json()) as { data?: CuratedSection };
    return json.data ?? { curation: null, items: [] };
  } catch {
    return { curation: null, items: [] };
  }
}

/**
 * Picks the image for a curated product card. The per-section override
 * takes precedence, then the product's first image, then empty string.
 */
export function resolveCuratedImage(item: CuratedItem): string {
  if (item.customImageUrl) return item.customImageUrl;
  return item.product.images[0] ?? '';
}
