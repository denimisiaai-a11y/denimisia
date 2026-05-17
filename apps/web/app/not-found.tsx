import Link from 'next/link';
import type { Metadata } from 'next';
import { fetchPageSlots, pickSlot, resolveSlotText } from '@/lib/page-slots';

export const metadata: Metadata = {
  title: 'Page Not Found',
  description: 'The page you are looking for does not exist at Denimisia.',
};

export default async function NotFound() {
  const slots = await fetchPageSlots('not-found');
  const slot  = pickSlot(slots, 'not_found_illustration');
  const heading = resolveSlotText(slot, 'This thread ran out.', 'heading');
  const sub     = resolveSlotText(slot, 'The page you were looking for has been moved, renamed, or never existed. Nothing lost — the archive is one click away.', 'subheading');

  return (
    <div
      data-slot="not-found.not_found_illustration"
      className="relative flex min-h-screen w-full flex-col items-center justify-center bg-ink px-6 py-24 text-paper"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.4)_80%)]" />

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center text-center">
        <span className="mb-6 text-[10px] font-bold uppercase tracking-[0.4em] text-paper/50">
          Off the Grid
        </span>
        <h1 className="mb-4 text-[clamp(6rem,18vw,12rem)] font-black leading-[0.85] tracking-tighter">
          404
        </h1>
        <p
          data-slot-field="heading"
          className="mb-3 text-lg font-bold uppercase tracking-[0.2em] text-paper md:text-xl"
        >
          {heading}
        </p>
        <p
          data-slot-field="subheading"
          className="mb-12 max-w-md text-sm leading-relaxed text-paper/70 md:text-base"
        >
          {sub}
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

        <div className="mt-16 flex items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-paper/40">
          <Link href="/bundles" className="transition-colors hover:text-paper">
            Bundles
          </Link>
          <span className="h-px w-6 bg-paper/20" />
          <Link href="/search" className="transition-colors hover:text-paper">
            Search
          </Link>
          <span className="h-px w-6 bg-paper/20" />
          <Link href="/contact" className="transition-colors hover:text-paper">
            Contact
          </Link>
        </div>
      </div>

      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.35em] text-paper/25">
        Denimisia · Made in Bangladesh
      </span>
    </div>
  );
}
