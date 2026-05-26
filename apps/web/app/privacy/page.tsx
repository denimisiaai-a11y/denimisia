import { Metadata } from 'next';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: 'Privacy Policy',
  description: 'Denimisia privacy policy — how we collect, use, and protect your data.',
  pathname: '/privacy',
});

export default function PrivacyPage() {
  return (
    <main>
      <SlotHero
        pageKey="privacy"
        slotKey="privacy_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Privacy policy."
        height="h-[40vh] min-h-[280px]"
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Privacy Policy</h1>

      <div className="mx-auto max-w-2xl space-y-8 text-sm leading-relaxed text-muted">
        <p>Last updated: April 2026</p>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Information We Collect</h2>
          <p>
            When you place an order or create an account, we collect your name, email address, phone number,
            shipping address, and payment information. We also collect browsing data through cookies to improve
            your shopping experience.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">How We Use Your Information</h2>
          <ul className="list-inside list-disc space-y-2">
            <li>Process and fulfill your orders</li>
            <li>Send order updates and delivery notifications</li>
            <li>Improve our products and services</li>
            <li>Send promotional offers (only with your consent)</li>
            <li>Prevent fraud and ensure security</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Data Sharing</h2>
          <p>
            We do not sell your personal information. We share data only with:
          </p>
          <ul className="list-inside list-disc space-y-2 mt-2">
            <li>Delivery partners (Pathao, RedX) for order fulfillment</li>
            <li>Payment processors for transaction handling</li>
            <li>Analytics tools to improve our service</li>
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Cookies</h2>
          <p>
            We use essential cookies for cart functionality and authentication, and optional analytics cookies
            to understand how visitors use our site. You can disable non-essential cookies in your browser settings.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Your Rights</h2>
          <p>
            You can request access to, correction of, or deletion of your personal data at any time.
            Contact us at{' '}
            <a href="mailto:privacy@denimisia.com" className="text-ink underline underline-offset-4">
              privacy@denimisia.com
            </a>.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">Contact</h2>
          <p>
            Denimisia Ltd., Dhaka, Bangladesh<br />
            <a href="mailto:privacy@denimisia.com" className="text-ink underline underline-offset-4">
              privacy@denimisia.com
            </a>
          </p>
        </section>
      </div>
      </div>
    </main>
  );
}
