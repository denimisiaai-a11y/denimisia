import Link from 'next/link';

interface LatestOrderRow {
  readonly id: string;
  readonly status: string;
  readonly total: number;
  readonly createdAt: string;
  readonly customer: string;
  readonly email: string;
}

interface LatestOrdersTableProps {
  readonly rows: readonly LatestOrderRow[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-[#fff4e6] text-[#8a5a00] dark:bg-[#3a2a00] dark:text-[#ffd68c]',
  CONFIRMED: 'bg-[#e3f2fd] text-[#1565c0] dark:bg-[#0d253d] dark:text-[#7fc0ff]',
  PROCESSING: 'bg-[#e8eaf6] text-[#3949ab] dark:bg-[#1a1f3a] dark:text-[#9aa7ff]',
  SHIPPED: 'bg-[#e1f5fe] text-[#0277bd] dark:bg-[#0a2a3e] dark:text-[#81d4fa]',
  DELIVERED: 'bg-[#e8f5e9] text-[#2e7d32] dark:bg-[#1a2e1c] dark:text-[#a5d6a7]',
  CANCELLED: 'bg-[#ffebee] text-[#c62828] dark:bg-[#2e1212] dark:text-[#ff8a80]',
  REFUNDED: 'bg-[#f3e5f5] text-[#6a1b9a] dark:bg-[#2a1433] dark:text-[#ce93d8]',
  PAYMENT_FAILED: 'bg-[#ffebee] text-[#c62828] dark:bg-[#2e1212] dark:text-[#ff8a80]',
  RETURNED: 'bg-[#f5f5f5] text-[#424242] dark:bg-[#2a2a2a] dark:text-[#bdbdbd]',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-BD', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function statusLabel(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ');
}

export function LatestOrdersTable({ rows }: LatestOrdersTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center font-body text-xs uppercase tracking-[0.2em] text-secondary">
        No recent orders
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-outline-variant/15">
            <Th>Order ID</Th>
            <Th>Customer</Th>
            <Th>Status</Th>
            <Th>Date Added</Th>
            <Th className="text-right">Total</Th>
            <Th className="text-right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-outline-variant/10 transition-colors duration-300 ease-editorial hover:bg-surface-container-low"
            >
              <Td>
                <Link
                  href={`/orders/${row.id}`}
                  className="font-mono text-xs text-on-surface hover:underline"
                >
                  #{row.id.slice(-6).toUpperCase()}
                </Link>
              </Td>
              <Td>
                <span className="font-body text-sm text-on-surface">
                  {row.customer || row.email}
                </span>
              </Td>
              <Td>
                <span
                  className={
                    'inline-block px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] ' +
                    (STATUS_STYLE[row.status] ?? STATUS_STYLE.PENDING)
                  }
                >
                  {statusLabel(row.status)}
                </span>
              </Td>
              <Td>
                <span className="font-body text-xs text-secondary">
                  {formatDate(row.createdAt)}
                </span>
              </Td>
              <Td className="text-right">
                <span className="font-body text-sm font-semibold text-on-surface">
                  BDT {formatCurrency(row.total)}
                </span>
              </Td>
              <Td className="text-right">
                <Link
                  href={`/orders/${row.id}`}
                  className="inline-flex items-center justify-center p-2 text-secondary transition-colors duration-300 ease-editorial hover:text-on-surface"
                  aria-label="View order"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden>
                    visibility
                  </span>
                </Link>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CellProps {
  readonly children: React.ReactNode;
  readonly className?: string;
}

function Th({ children, className }: CellProps) {
  return (
    <th
      className={
        'py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary ' +
        (className ?? '')
      }
    >
      {children}
    </th>
  );
}

function Td({ children, className }: CellProps) {
  return <td className={'py-3.5 ' + (className ?? '')}>{children}</td>;
}
