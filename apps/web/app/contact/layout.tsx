import type { Metadata } from 'next';
import { JsonLd } from '@/components/seo/json-ld';
import { buildMetadata } from '@/lib/seo/metadata';
import { storeJsonLd } from '@/lib/seo/jsonld/local-business';
import { breadcrumbJsonLd } from '@/lib/seo/jsonld/breadcrumb';

export const metadata: Metadata = buildMetadata({
  title: 'Contact & Showroom',
  description:
    'Get in touch with Denimisia. Visit our Dhaka showroom to try on pieces in person, or reach us by email and phone for any question.',
  pathname: '/contact',
});

// Contact page form uses client-side session hooks; opt out of static prerender.
export const dynamic = 'force-dynamic';

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        id="ld-contact"
        data={[
          storeJsonLd(),
          breadcrumbJsonLd([{ name: 'Contact', path: '/contact' }]),
        ].filter((node): node is NonNullable<typeof node> => node !== null)}
      />
      {children}
    </>
  );
}
