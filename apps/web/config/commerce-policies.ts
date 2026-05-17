/**
 * Commerce policies powering MerchantReturnPolicy and OfferShippingDetails
 * JSON-LD on product pages. Google uses these to render shipping/return info
 * directly in Shopping snippets and free listings.
 */

export const commercePolicies = {
  returnWindow: { value: 7, unit: 'DAY' } as const,
  returnMethod: 'ReturnByMail' as const,
  returnFees: 'CustomerResponsibleForReturnFees' as const,
  returnPolicyCountry: 'BD' as const,
  returnPolicyUrl: 'https://denimisia.com/returns',

  delivery: {
    handlingMinDays: 1,
    handlingMaxDays: 1,
    transitMinDays: 3,
    transitMaxDays: 5,
    unit: 'DAY' as const,
  },

  shipping: {
    freeShippingMinBdt: 3000,
    flatRateBdt: 100,
    currency: 'BDT' as const,
    destinationCountry: 'BD' as const,
  },
} as const;

export type CommercePolicies = typeof commercePolicies;
