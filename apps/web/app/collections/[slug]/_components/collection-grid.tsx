import { ProductCard } from '@/components/ui/product-card';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import type {
  Collection,
  LookbookItem,
  ProductInCollection,
} from '@/lib/collections';
import { LookbookBreak } from './lookbook-break';

interface Props {
  readonly collection: Collection;
  readonly products: ProductInCollection[];
}

function gridClass(desktop: number, mobile: number): string {
  const desktopCls =
    desktop === 2 ? 'lg:grid-cols-2' : desktop === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';
  const mobileCls = mobile === 1 ? 'grid-cols-1' : 'grid-cols-2';
  return `grid ${mobileCls} md:grid-cols-3 ${desktopCls} gap-x-4 gap-y-10 lg:gap-x-6`;
}

export function CollectionGrid({ collection, products }: Props) {
  if (products.length === 0) {
    return (
      <div className="border border-dashed border-ink/20 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          No products in this collection yet
        </p>
      </div>
    );
  }

  return (
    <div className={gridClass(collection.gridColumnsDesktop, collection.gridColumnsMobile)}>
      {products.map(({ product }) => (
        <ProductCard
          key={product.id}
          productId={product.id}
          name={product.name}
          slug={product.slug}
          price={product.activeCampaign ? product.activeCampaign.finalPrice : Number(product.price)}
          originalPrice={product.activeCampaign ? Number(product.price) : undefined}
          image={resolveProductImage(product.images?.[0], product.slug)}
          hoverImage={resolveHoverImage(product.images?.[1], product.slug)}
          starBadge={Boolean(product.showStarBadge)}
        />
      ))}
    </div>
  );
}

interface LookbookGridProps {
  readonly collection: Collection;
  readonly products: ProductInCollection[];
  readonly lookbook: LookbookItem[];
}

/**
 * Grid with editorial lookbook images interspersed after every 6 products.
 * Lookbook items are placed in `position` order; if there are more items
 * than break points, extra items render at the end.
 */
export function CollectionGridWithLookbook({
  collection,
  products,
  lookbook,
}: LookbookGridProps) {
  if (products.length === 0) {
    return (
      <div className="border border-dashed border-ink/20 py-20 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">
          No products in this collection yet
        </p>
      </div>
    );
  }

  const orderedLookbook = [...lookbook].sort((a, b) => a.position - b.position);
  const BREAK_EVERY = 6;
  const chunks: Array<{ kind: 'products'; items: ProductInCollection[] } | { kind: 'lookbook'; item: LookbookItem }> = [];

  for (let i = 0; i < products.length; i += BREAK_EVERY) {
    chunks.push({ kind: 'products', items: products.slice(i, i + BREAK_EVERY) });
    const lookbookIdx = Math.floor(i / BREAK_EVERY);
    if (orderedLookbook[lookbookIdx]) {
      chunks.push({ kind: 'lookbook', item: orderedLookbook[lookbookIdx] });
    }
  }

  // Render any remaining lookbook items at the end
  const usedLookbookCount = Math.floor(products.length / BREAK_EVERY);
  for (let i = usedLookbookCount; i < orderedLookbook.length; i++) {
    const extra = orderedLookbook[i];
    if (extra) chunks.push({ kind: 'lookbook', item: extra });
  }

  return (
    <div className="space-y-8">
      {chunks.map((chunk, idx) =>
        chunk.kind === 'products' ? (
          <div
            key={`g-${idx}`}
            className={gridClass(collection.gridColumnsDesktop, collection.gridColumnsMobile)}
          >
            {chunk.items.map(({ product }) => (
              <ProductCard
                key={product.id}
                productId={product.id}
                name={product.name}
                slug={product.slug}
                price={Number(product.price)}
                image={resolveProductImage(product.images?.[0], product.slug)}
                hoverImage={resolveHoverImage(product.images?.[1], product.slug)}
                starBadge={Boolean(product.showStarBadge)}
              />
            ))}
          </div>
        ) : (
          <LookbookBreak key={`l-${idx}`} item={chunk.item} />
        ),
      )}
    </div>
  );
}
