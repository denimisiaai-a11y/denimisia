/**
 * Public SEO/marketing env access. All vars are optional at boot; callers
 * gracefully no-op when absent. Validation happens in-place (type narrowing
 * after check) — we avoid zod here to keep the SEO layer dependency-free.
 */

export const seoEnv = {
  siteUrl:
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://denimisiabd.com',
  googleSiteVerification: process.env.GOOGLE_SITE_VERIFICATION,
  metaDomainVerification: process.env.META_DOMAIN_VERIFICATION,
  ga4MeasurementId: process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID,
  metaPixelId: process.env.NEXT_PUBLIC_META_PIXEL_ID,
  googleAdsId: process.env.NEXT_PUBLIC_GOOGLE_ADS_ID,
  googleAdsConversionLabel:
    process.env.NEXT_PUBLIC_GOOGLE_ADS_CONVERSION_LABEL,
} as const;
