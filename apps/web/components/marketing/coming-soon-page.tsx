import Link from 'next/link';

interface ComingSoonPageProps {
  eyebrow?: string;
  title: string;
  description: string;
}

/**
 * Full-page branded "coming soon" placeholder for reserved future URLs
 * (see lib/reserved-pages.ts). Keeps the path live and on-brand instead of
 * a 404, while the page itself is noindex until real content ships.
 */
export function ComingSoonPage({
  eyebrow = 'Coming Soon',
  title,
  description,
}: ComingSoonPageProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center bg-ink px-6 py-32 text-center text-paper">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_80%)]" />
      <div className="relative z-10 mx-auto flex max-w-xl flex-col items-center">
        <p className="mb-5 text-[11px] font-bold uppercase tracking-[0.4em] text-paper/50">
          {eyebrow}
        </p>
        <h1 className="mb-5 font-serif text-4xl tracking-tight md:text-6xl">{title}</h1>
        <p className="mb-12 max-w-md text-sm leading-relaxed text-paper/70 md:text-base">
          {description}
        </p>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="bg-paper px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-ink transition-opacity hover:opacity-85"
          >
            Back to Homepage
          </Link>
          <Link
            href="/shop"
            className="border border-paper/40 px-10 py-4 text-[11px] font-bold uppercase tracking-[0.3em] text-paper transition-colors hover:bg-paper/10"
          >
            Shop the Collection
          </Link>
        </div>
      </div>
    </div>
  );
}
