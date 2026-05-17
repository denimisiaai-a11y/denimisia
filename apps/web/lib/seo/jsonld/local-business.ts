import { SITE_URL, brand } from '@/config/brand';
import type { JsonLdNode } from './types';

/**
 * Store schema for the Denimisia office/showroom. Helps local SEO ("denim
 * showroom Dhaka") and gets us into Google Business Profile matching.
 * Returns null when address placeholders haven't been filled in — emitting
 * "TBD" into Google's structured data would land us in local-pack with that
 * literal string.
 */
export function storeJsonLd(): JsonLdNode | null {
  const { office, contact } = brand;

  if (
    office.streetAddress === 'TBD' ||
    office.postalCode === 'TBD' ||
    !contact.phone ||
    contact.phone.includes('XXXXXXXXX')
  ) {
    return null;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Store',
    '@id': `${SITE_URL}/#showroom`,
    name: office.name,
    description: office.note,
    url: `${SITE_URL}/contact`,
    image: brand.logo.url,
    telephone: contact.phone,
    email: contact.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: office.streetAddress,
      addressLocality: office.addressLocality,
      addressRegion: office.addressRegion,
      postalCode: office.postalCode,
      addressCountry: office.addressCountry,
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: office.geo.latitude,
      longitude: office.geo.longitude,
    },
    openingHoursSpecification: office.openingHours.map((spec) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: spec,
    })),
    parentOrganization: { '@id': `${SITE_URL}/#organization` },
  };
}
