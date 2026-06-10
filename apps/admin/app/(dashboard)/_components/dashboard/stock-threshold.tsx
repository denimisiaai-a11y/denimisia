import Link from 'next/link';
import Image from 'next/image';

interface StockRow {
  readonly variantId: string;
  readonly sku: string;
  readonly size: string;
  readonly color: string;
  readonly stock: number;
  readonly image: string | null;
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly images: readonly string[];
  };
}

interface StockThresholdProps {
  readonly rows: readonly StockRow[];
}

export function StockThresholdList({ rows }: StockThresholdProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center font-body text-xs uppercase tracking-[0.2em] text-secondary">
        All stock healthy
      </p>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant/15">
      {rows.map((row) => (
        <li key={row.variantId}>
          <Link
            href={`/products/${row.product.id}`}
            className="group flex items-center gap-4 py-3 transition-colors duration-300 ease-editorial"
          >
            <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden bg-surface-container">
              {row.image ? (
                <Image
                  src={row.image}
                  alt={row.product.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              ) : (
                <span className="material-symbols-outlined flex h-full items-center justify-center text-secondary">
                  inventory_2
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-body text-sm font-semibold text-on-surface group-hover:underline">
                {row.product.name}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-secondary">
                {row.color} · {row.size}
              </p>
            </div>
            <span
              className={
                row.stock === 0
                  ? 'text-[10px] font-bold uppercase tracking-[0.2em] text-primary'
                  : 'text-[10px] font-bold uppercase tracking-[0.2em] text-[#d97706]'
              }
            >
              {row.stock === 0 ? '0 Left' : `${row.stock} Left`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
