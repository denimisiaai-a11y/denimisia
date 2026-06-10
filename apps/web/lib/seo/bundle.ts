import type { Metadata } from 'next';
import { buildMetadata } from './metadata';
import { plainText } from './truncate';

interface BundleLike {
  name: string;
  slug: string;
  description: string | null;
  image?: string | null;
}

export function generateBundleMetadata(bundle: BundleLike): Metadata {
  const desc = plainText(
    bundle.description ??
      `${bundle.name} — curated bundle from Denimisia. Save on essential pairings.`,
    160,
  );

  return buildMetadata({
    title: bundle.name,
    description: desc,
    pathname: `/bundles/${bundle.slug}`,
    // og:type=product rejected by Next.js Metadata API; JSON-LD carries the
    // commerce semantics instead.
    ogType: 'website',
    images: bundle.image
      ? [{ url: bundle.image, alt: bundle.name }]
      : undefined,
  });
}
