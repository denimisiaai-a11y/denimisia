import { ProductCard } from '@/components/ui/product-card';
import { resolveProductImage, resolveHoverImage } from '@/lib/placeholder-images';
import type { Collection, ProductInCollection } from '@/lib/collections';

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
          price={Number(product.price)}
          image={resolveProductImage(product.images?.[0], product.slug)}
          hoverImage={resolveHoverImage(product.images?.[1], product.slug)}
          starBadge={Boolean(product.showStarBadge)}
        />
      ))}
    </div>
  );
}
