import { reservedMetadata, RESERVED_PAGES } from '@/lib/reserved-pages';
import { ComingSoonPage } from '@/components/marketing/coming-soon-page';

export const revalidate = 86400;
export const metadata = reservedMetadata('lookbook');

export default function Page() {
  const page = RESERVED_PAGES['lookbook'];
  return (
    <ComingSoonPage
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
    />
  );
}
