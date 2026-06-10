import type { Metadata } from 'next';
import Link from 'next/link';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Exchange & Returns',
  description: 'Denimisia exchange and return policy.',
  pathname: '/returns',
});

export default function ReturnsPage() {
  return (
    <main>
      <SlotHero
        pageKey="returns"
        slotKey="returns_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Returns & exchanges."
        fallbackSubheading="7-day returns. Honest policy. Simple process."
        height="h-[45vh] min-h-[320px]"
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Exchange & Returns</h1>

        <div className="mx-auto max-w-2xl space-y-10">
          {/* Primary CTAs */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/returns/new"
              className="block rounded-sm border border-ink bg-ink p-6 text-paper transition hover:opacity-90"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.1em]">
                Start a return
              </div>
              <div className="mt-1 text-xs text-paper/80">
                Request a return for a recent order. Takes about 2 minutes.
              </div>
            </Link>
            <Link
              href="/account/returns"
              className="block rounded-sm border border-border p-6 transition hover:border-ink"
            >
              <div className="text-sm font-semibold uppercase tracking-[0.1em] text-ink">
                Track your return
              </div>
              <div className="mt-1 text-xs text-muted">
                View your return requests and their current status.
              </div>
            </Link>
          </div>

          {/* Policy */}
          <div className="space-y-8 text-sm leading-relaxed text-muted">
            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Return window
              </h2>
              <p>
                Returns must be requested within{' '}
                <strong className="text-ink">7 days of delivery</strong>. Items
                must be unworn, unwashed, and in their original condition with
                tags attached. Final sale items are not eligible.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Reasons for return
              </h2>
              <ul className="list-inside list-disc space-y-1">
                <li>Defective product</li>
                <li>Damaged in transit</li>
                <li>Not as described</li>
                <li>Wrong item sent</li>
                <li>Wrong size</li>
                <li>Changed your mind</li>
              </ul>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Who pays for return shipping
              </h2>
              <p>
                If the return is our fault (defective, damaged, wrong item, not
                as described) we arrange and pay for pickup. Otherwise, you
                arrange the return shipping at your cost.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Refunds
              </h2>
              <p>
                Once we receive and inspect your return, refunds are issued via{' '}
                <strong className="text-ink">cash</strong> or{' '}
                <strong className="text-ink">bank transfer</strong>. Funds
                typically reflect within 2-3 business days for bank transfers.
              </p>
            </section>

            <section>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
                Timeline
              </h2>
              <p>
                We aim to review every return request within{' '}
                <strong className="text-ink">48 hours</strong> and follow up by
                email.
              </p>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
