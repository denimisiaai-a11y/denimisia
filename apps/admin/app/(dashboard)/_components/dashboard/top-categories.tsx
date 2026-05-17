import Link from 'next/link';

interface TopCategoryRow {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly productCount: number;
  readonly totalSales: number;
  readonly totalRevenue: number;
}

interface TopCategoriesProps {
  readonly rows: readonly TopCategoryRow[];
}

export function TopCategoriesList({ rows }: TopCategoriesProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center font-body text-xs uppercase tracking-[0.2em] text-secondary">
        No category sales in range
      </p>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant/15">
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href="/catalog/categories"
            className="group flex items-center justify-between py-3.5 transition-colors duration-300 ease-editorial hover:text-on-surface"
          >
            <div>
              <p className="font-body text-sm font-semibold text-on-surface group-hover:underline">
                {row.name}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-secondary">
                {row.productCount} Products · {row.totalSales} Sales
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
      ))}
    </ul>
  );
}
