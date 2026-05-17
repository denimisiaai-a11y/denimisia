import Link from 'next/link';
import Image from 'next/image';

interface TopProductRow {
  readonly product: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
    readonly images: readonly string[];
  } | undefined;
  readonly totalSold: number;
  readonly totalRevenue: number;
}

interface TopProductsProps {
  readonly rows: readonly TopProductRow[];
}

export function TopProductsList({ rows }: TopProductsProps) {
  const filtered = rows.filter((r) => r.product);

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center font-body text-xs uppercase tracking-[0.2em] text-secondary">
        No product sales in range
      </p>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant/15">
      {filtered.map((row) => {
        const p = row.product!;
        const img = p.images[0];
        return (
          <li key={p.id}>
            <Link
              href={`/products/${p.id}`}
              className="group flex items-center gap-4 py-3 transition-colors duration-300 ease-editorial"
            >
              <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden bg-surface-container">
                {img ? (
                  <Image
                    src={img}
                    alt={p.name}
                    fill
                    sizes="56px"
                    className="object-cover transition-transform duration-300 ease-editorial group-hover:scale-105"
                  />
                ) : (
                  <span className="material-symbols-outlined flex h-full items-center justify-center text-secondary">
                    inventory_2
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-on-surface group-hover:underline">
                  {p.name}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-secondary">
                  {row.totalSold} Sales
                </p>
              </div>
              <span
                className="material-symbols-outlined text-sm text-secondary transition-transform duration-300 ease-editorial group-hover:translate-x-1"
                aria-hidden
              >
                chevron_right
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
