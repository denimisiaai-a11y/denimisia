import { Metadata } from 'next';
import { SlotHero } from '@/components/slot/slot-hero';
import { PLACEHOLDER_HERO } from '@/lib/placeholder-images';

import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 600;

export const metadata: Metadata = buildMetadata({
  title: 'Careers',
  description: 'Join the Denimisia team.',
  pathname: '/career',
});

export default function CareerPage() {
  return (
    <main>
      <SlotHero
        pageKey="career"
        slotKey="career_hero"
        fallbackImage={PLACEHOLDER_HERO}
        fallbackHeading="Build with us."
        fallbackSubheading="Open roles at Denimisia."
        height="h-[55vh] min-h-[360px]"
        priority
      />
      <div className="mx-auto max-w-[1440px] px-6 pt-16 pb-16 lg:px-12">
        <div className="mx-auto max-w-lg py-12 text-center">
          <p className="mb-4 text-lg font-medium text-ink">We&apos;re Growing</p>
          <p className="mb-6 text-sm text-muted">
            We don&apos;t have any open positions right now, but we&apos;re always on the lookout for talented people
            who share our passion for quality and design.
          </p>
          <p className="text-sm text-muted">
            Drop your CV at{' '}
            <a href="mailto:careers@denimisia.com" className="text-ink underline underline-offset-4">
              careers@denimisia.com
            </a>{' '}
            and we&apos;ll reach out when something opens up.
          </p>
        </div>
      </div>
    </main>
  );
}
