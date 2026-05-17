import { Metadata } from 'next';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Size Guide',
  description: 'Find your perfect fit with the Denimisia size guide.',
  pathname: '/size-guide',
});

const WOMEN_SIZES = [
  { size: '24', waist: '60', hip: '84', length: '100' },
  { size: '26', waist: '66', hip: '90', length: '101' },
  { size: '28', waist: '71', hip: '96', length: '102' },
  { size: '30', waist: '76', hip: '101', length: '103' },
  { size: '32', waist: '81', hip: '106', length: '104' },
  { size: '34', waist: '86', hip: '112', length: '105' },
];

const MEN_SIZES = [
  { size: '28', waist: '71', hip: '90', length: '104' },
  { size: '30', waist: '76', hip: '96', length: '105' },
  { size: '32', waist: '81', hip: '101', length: '106' },
  { size: '34', waist: '86', hip: '106', length: '107' },
  { size: '36', waist: '91', hip: '112', length: '108' },
  { size: '38', waist: '96', hip: '117', length: '109' },
];

function SizeTable({ title, sizes }: { title: string; sizes: typeof WOMEN_SIZES }) {
  return (
    <div>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-ink">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Size</th>
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Waist (cm)</th>
              <th className="py-3 pr-6 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Hip (cm)</th>
              <th className="py-3 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Length (cm)</th>
            </tr>
          </thead>
          <tbody>
            {sizes.map((row) => (
              <tr key={row.size} className="border-b border-border">
                <td className="py-3 pr-6 font-medium text-ink">{row.size}</td>
                <td className="py-3 pr-6 text-muted">{row.waist}</td>
                <td className="py-3 pr-6 text-muted">{row.hip}</td>
                <td className="py-3 text-muted">{row.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SizeGuidePage() {
  return (
    <main>
      <SlotHero
        pageKey="size-guide"
        slotKey="size_guide_chart_wide_leg"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Size guide."
        fallbackSubheading="Measurements in centimeters. Find your perfect fit."
        height="h-[40vh] min-h-[280px]"
        priority
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <h1 className="sr-only">Size Guide</h1>

      <div className="mx-auto max-w-2xl space-y-12">
        <SizeTable title="Women" sizes={WOMEN_SIZES} />
        <SizeTable title="Men" sizes={MEN_SIZES} />

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-ink">How to Measure</h2>
          <ul className="space-y-2 text-sm text-muted">
            <li><strong className="text-ink">Waist:</strong> Measure around the narrowest part of your natural waistline.</li>
            <li><strong className="text-ink">Hip:</strong> Measure around the fullest part of your hips.</li>
            <li><strong className="text-ink">Length:</strong> Measure from the waistband down the outer seam to the hem.</li>
          </ul>
        </section>
      </div>
      </div>
    </main>
  );
}
