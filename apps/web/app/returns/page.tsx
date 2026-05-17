import { Metadata } from 'next';
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
        fallbackSubheading="14-day returns on full-price items."
        height="h-[45vh] min-h-[320px]"
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Exchange & Returns</h1>

      <div className="mx-auto max-w-2xl space-y-8 text-sm leading-relaxed text-muted">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Return Window</h2>
          <p>
            We accept returns and exchanges within <strong className="text-ink">7 days</strong> of delivery.
            Items must be unworn, unwashed, and in original packaging with all tags attached.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Conditions</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>Items must be in original, unused condition</li>
            <li>All tags and packaging must be intact</li>
            <li>Sale items and bundles are eligible for exchange only</li>
            <li>Customized or altered items cannot be returned</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">How to Return</h2>
          <ol className="list-inside list-decimal space-y-2">
            <li>Contact us at <a href="mailto:returns@denimisia.com" className="text-ink underline underline-offset-4">returns@denimisia.com</a> with your order number</li>
            <li>We&apos;ll send you a return authorization and pickup details</li>
            <li>Pack the item securely in its original packaging</li>
            <li>Our courier will pick up the package from your address</li>
          </ol>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Refund Timeline</h2>
          <p>
            Refunds are processed within <strong className="text-ink">5-7 business days</strong> after we receive and inspect the returned item.
            For COD orders, refunds are issued via bKash or bank transfer.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Exchanges</h2>
          <p>
            Need a different size? We offer free exchanges within Dhaka. For exchanges outside Dhaka,
            standard shipping rates apply. Contact us to initiate an exchange.
          </p>
        </section>
      </div>
      </div>
    </main>
  );
}
