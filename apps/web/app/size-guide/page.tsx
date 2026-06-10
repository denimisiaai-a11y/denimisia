import { Metadata } from 'next';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';
import { buildMetadata } from '@/lib/seo/metadata';
import { UniversalSizeChart } from '@/components/product/universal-size-chart';

export const revalidate = 3600;

export const metadata: Metadata = buildMetadata({
  title: 'Size Guide',
  description:
    'Find your perfect fit with the Denimisia universal size guide — denim, tops, and outerwear measurements, the same chart shown on every product.',
  pathname: '/size-guide',
});

export default function SizeGuidePage() {
  return (
    <main>
      <SlotHero
        pageKey="size-guide"
        slotKey="size_guide_chart_wide_leg"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Size guide."
        fallbackSubheading="One universal chart for every Denimisia piece. Find your perfect fit."
        height="h-[40vh] min-h-[280px]"
        priority
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Size Guide</h1>

        <div className="mx-auto max-w-3xl space-y-12">
          <UniversalSizeChart />

          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">
              How to Measure
            </h2>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <strong className="text-ink">Waist:</strong> Measure around the narrowest part of
                your natural waistline.
              </li>
              <li>
                <strong className="text-ink">Hip:</strong> Measure around the fullest part of your
                hips.
              </li>
              <li>
                <strong className="text-ink">Rise:</strong> Measure from the crotch seam up to the
                top of the waistband.
              </li>
              <li>
                <strong className="text-ink">Inseam:</strong> Measure from the crotch seam down the
                inner leg to the hem.
              </li>
              <li>
                <strong className="text-ink">Chest:</strong> Measure around the fullest part of your
                chest, under the arms.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
