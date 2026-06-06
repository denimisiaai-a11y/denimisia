import Link from 'next/link';

interface ComingSoonProps {
  title?: string;
  message?: string;
}

/**
 * Branded empty state for catalog pages whose category has no real products
 * yet. Replaces the old behaviour of rendering fabricated placeholder
 * products (which were unclickable dead-ends in production). Keeps the URL
 * live (HTTP 200) so the nav entry still works and the page can light up the
 * moment inventory is assigned to that category.
 */
export function ComingSoon({
  title = 'Coming soon',
  message = "These pieces aren't available yet. Check back soon.",
}: ComingSoonProps) {
  return (
    <div className="flex flex-col items-center gap-5 border border-ink/10 px-6 py-24 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted">
        Coming soon
      </p>
      <h2 className="font-serif text-2xl tracking-tight text-ink md:text-3xl">{title}</h2>
      <p className="max-w-sm text-sm leading-relaxed text-muted">{message}</p>
      <Link
        href="/shop"
        className="mt-2 inline-flex items-center justify-center bg-ink px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-paper transition-colors hover:bg-ink/90"
      >
        Browse the shop
      </Link>
    </div>
  );
}
