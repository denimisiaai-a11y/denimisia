import { brand, SITE_URL } from '@/config/brand';
import type { JsonLdNode } from './types';

/** Organization node — emitted in root layout so every page carries it. */
export function organizationJsonLd(): JsonLdNode {
  const socials = brand.socialProfiles.filter((url) => url.startsWith('http'));

  // Don't emit the placeholder phone (+8801XXXXXXXXX) into structured data —
  // a fake telephone trips Google's rich-results validator. It appears
  // automatically once a real number (no 'X') is set in config/brand.ts.
  const phone = brand.contact.phone;
  const telephone = phone && !/x/i.test(phone) ? phone : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${SITE_URL}/#organization`,
    name: brand.legalName,
    alternateName: brand.displayName,
    url: SITE_URL,
    logo: {
      '@type': 'ImageObject',
      url: brand.logo.url,
      width: brand.logo.width,
      height: brand.logo.height,
    },
    description: brand.description,
    foundingDate: String(brand.foundingYear),
    sameAs: socials.length > 0 ? socials : undefined,
    contactPoint: {
      '@type': 'ContactPoint',
      email: brand.contact.email,
      telephone,
      contactType: 'customer support',
      areaServed: 'BD',
      availableLanguage: ['English', 'Bengali'],
    },
  };
}
