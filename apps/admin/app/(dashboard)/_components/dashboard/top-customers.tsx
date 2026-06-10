import Link from 'next/link';

interface TopCustomerRow {
  readonly user: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
  } | null;
  readonly orderCount: number;
  readonly totalRevenue: number;
}

interface TopCustomersProps {
  readonly rows: readonly TopCustomerRow[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function TopCustomersList({ rows }: TopCustomersProps) {
  const filtered = rows.filter((r) => r.user);

  if (filtered.length === 0) {
    return (
      <p className="py-8 text-center font-body text-xs uppercase tracking-[0.2em] text-secondary">
        No customer sales in range
      </p>
    );
  }

  return (
    <ul className="divide-y divide-outline-variant/15">
      {filtered.map((row) => {
        const u = row.user!;
        return (
          <li key={u.id}>
            <Link
              href={`/customers?id=${u.id}`}
              className="group flex items-center gap-4 py-3 transition-colors duration-300 ease-editorial"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-surface-container font-headline text-[11px] font-semibold uppercase tracking-wider text-on-surface">
                {initials(u.name || u.email)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-body text-sm font-semibold text-on-surface group-hover:underline">
                  {u.name || u.email}
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-secondary">
                  {row.orderCount} Order{row.orderCount === 1 ? '' : 's'} · Revenue BDT {formatCurrency(row.totalRevenue)}
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
