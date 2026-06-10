import { reservedMetadata, RESERVED_PAGES } from '@/lib/reserved-pages';
import { ComingSoonPage } from '@/components/marketing/coming-soon-page';

export const revalidate = 86400;
export const metadata = reservedMetadata('editorial');

export default function Page() {
  const page = RESERVED_PAGES['editorial'];
  return (
    <ComingSoonPage
      eyebrow={page.eyebrow}
      title={page.title}
      description={page.description}
    />
  );
}
