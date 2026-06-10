import { Metadata } from 'next';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: 'Terms of Service',
  description:
    'Denimisia terms of service — the rules that govern your use of our site and the orders you place with us.',
  pathname: '/terms',
});

export default function TermsPage() {
  return (
    <main>
      <SlotHero
        pageKey="terms"
        slotKey="terms_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Terms of service."
        height="h-[40vh] min-h-[280px]"
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Terms of Service</h1>

        <div className="mx-auto max-w-2xl space-y-8 text-sm leading-relaxed text-muted">
          <p>Last updated: May 2026</p>

          <p>
            These terms govern your use of the Denimisia website, your
            account, and any order you place with us. By browsing, creating
            an account, or placing an order, you agree to these terms. If
            you do not agree, please do not use the site.
          </p>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Your Account
            </h2>
            <p>
              You are responsible for keeping your account credentials
              confidential and for any activity under your account. Tell us
              immediately at{' '}
              <a
                href="mailto:support@denimisia.com"
                className="text-ink underline underline-offset-4"
              >
                support@denimisia.com
              </a>{' '}
              if you suspect unauthorised use. We may suspend or close
              accounts that violate these terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Placing an Order
            </h2>
            <p>
              When you place an order it becomes a request to buy at the
              listed price. We confirm acceptance when our team marks the
              order as confirmed and prepares it for delivery. We may
              decline or cancel an order if an item is out of stock, the
              price was listed in error, or the delivery address falls
              outside the zones we serve.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Pricing and Payment
            </h2>
            <p>
              All prices are in Bangladeshi Taka (BDT) and include
              applicable taxes unless stated otherwise. Shipping costs are
              calculated at checkout. We currently accept{' '}
              <strong>cash on delivery only</strong>. Please keep the
              exact total ready when our courier arrives. The total
              includes the item subtotal, any active discount, and the
              shipping cost shown at checkout.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Delivery
            </h2>
            <p>
              We deliver across Bangladesh through partners including
              Pathao and RedX. Delivery timelines are estimates, not
              guarantees, and can vary with traffic, weather, and partner
              capacity. If you refuse a delivery without a valid reason
              (for example, the order matches what you placed and arrives
              in good condition), we may decline future cash-on-delivery
              orders to your address.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Returns and Refunds
            </h2>
            <p>
              Our returns process and timelines are explained on the{' '}
              <a
                href="/returns"
                className="text-ink underline underline-offset-4"
              >
                Returns page
              </a>
              . Items must be unworn, unwashed, and in their original
              condition with tags attached. Sale items and intimate
              apparel are not eligible for return unless faulty.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Product Information
            </h2>
            <p>
              We aim for accuracy in product descriptions, sizing,
              materials, and photography, but colour can vary slightly
              between devices and small natural variations are part of
              denim. If a listing has a material error we will correct it
              and, where relevant, contact you to confirm whether you
              still want to proceed.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Reviews and Submitted Content
            </h2>
            <p>
              When you submit a review, photo, or other content you grant
              Denimisia a non-exclusive licence to display it on our site
              and in our marketing. Keep submissions truthful, respectful,
              and free of personal information about others. We may remove
              content that is abusive, off-topic, or violates a third
              party&apos;s rights.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Prohibited Use
            </h2>
            <p>You agree not to:</p>
            <ul className="list-inside list-disc space-y-2 mt-2">
              <li>
                Use the site to break the law, defraud anyone, or harass
                another person
              </li>
              <li>
                Attempt to bypass authentication, rate limits, or other
                security measures
              </li>
              <li>
                Scrape, copy, or resell our content or product data
              </li>
              <li>
                Place orders you do not intend to accept or pay for on
                delivery
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Intellectual Property
            </h2>
            <p>
              The Denimisia name, logo, site design, and product imagery
              belong to Denimisia Ltd. You may not use them without our
              written permission, other than the limited personal use that
              browsing and ordering implies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Limitation of Liability
            </h2>
            <p>
              To the maximum extent allowed by law, Denimisia is not
              liable for indirect, incidental, or consequential losses
              arising from your use of the site or our products. Our
              total liability for any claim is capped at the value of the
              order the claim relates to.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Governing Law
            </h2>
            <p>
              These terms are governed by the laws of Bangladesh. Any
              dispute that cannot be resolved through our support team
              will be settled in the courts of Dhaka.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Changes to These Terms
            </h2>
            <p>
              We may update these terms from time to time. The version on
              this page is always the current one. Material changes will
              be highlighted with a banner on the site or an email to
              registered customers. Continued use of the site after an
              update means you accept the revised terms.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              Contact
            </h2>
            <p>
              Denimisia Ltd., Dhaka, Bangladesh
              <br />
              <a
                href="mailto:support@denimisia.com"
                className="text-ink underline underline-offset-4"
              >
                support@denimisia.com
              </a>
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
