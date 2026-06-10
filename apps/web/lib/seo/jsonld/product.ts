import { SITE_URL, brand } from '@/config/brand';
import { commercePolicies } from '@/config/commerce-policies';
import type { JsonLdNode } from './types';

interface VariantLike {
  id?: string;
  sku: string;
  size?: string;
  color?: string;
  price: string | number;
  stock: number;
  images?: string[];
}

interface ProductLike {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: string | number;
  compareAtPrice?: string | null;
  images: string[];
  category?: { name: string; slug: string };
  variants?: VariantLike[];
  averageRating?: number | null;
  reviewCount?: number;
}

function toNumber(v: string | number): number {
  return typeof v === 'number' ? v : Number(v);
}

function availability(stock: number): string {
  if (stock > 0) return 'https://schema.org/InStock';
  return 'https://schema.org/OutOfStock';
}

function offerShippingDetails(priceBdt: number): JsonLdNode {
  const { shipping, delivery } = commercePolicies;
  const isFree = priceBdt >= shipping.freeShippingMinBdt;
  return {
    '@context': 'https://schema.org',
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: isFree ? 0 : shipping.flatRateBdt,
      currency: shipping.currency,
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: shipping.destinationCountry,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: {
        '@type': 'QuantitativeValue',
        minValue: delivery.handlingMinDays,
        maxValue: delivery.handlingMaxDays,
        unitCode: 'DAY',
      },
      transitTime: {
        '@type': 'QuantitativeValue',
        minValue: delivery.transitMinDays,
        maxValue: delivery.transitMaxDays,
        unitCode: 'DAY',
      },
    },
  };
}

function merchantReturnPolicy(): JsonLdNode {
  const { returnWindow, returnMethod, returnFees, returnPolicyCountry } =
    commercePolicies;
  return {
    '@context': 'https://schema.org',
    '@type': 'MerchantReturnPolicy',
    applicableCountry: returnPolicyCountry,
    returnPolicyCategory:
      'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: returnWindow.value,
    returnMethod: `https://schema.org/${returnMethod}`,
    returnFees: `https://schema.org/${returnFees}`,
  };
}

function buildOffer(
  product: ProductLike,
  variantPrice: number,
  variantSku: string | undefined,
  variantStock: number,
): JsonLdNode {
  return {
    '@context': 'https://schema.org',
    '@type': 'Offer',
    url: `${SITE_URL}/products/${product.slug}`,
    price: variantPrice.toFixed(2),
    priceCurrency: 'BDT',
    availability: availability(variantStock),
    itemCondition: 'https://schema.org/NewCondition',
    sku: variantSku ?? undefined,
    seller: { '@id': `${SITE_URL}/#organization` },
    shippingDetails: offerShippingDetails(variantPrice),
    hasMerchantReturnPolicy: merchantReturnPolicy(),
  };
}

/**
 * Product + ProductGroup + Offer JSON-LD. Emits one `ProductGroup` per product
 * with `hasVariant[]` when variants differ in price/size/color. Otherwise
 * falls back to a single `Product` with aggregated Offer.
 */
export function productJsonLd(product: ProductLike): JsonLdNode {
  const variants = product.variants ?? [];
  const totalStock = variants.reduce((sum, v) => sum + (v.stock ?? 0), 0);
  const basePrice = toNumber(product.price);

  const rating =
    product.reviewCount && product.reviewCount > 0 && product.averageRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: product.averageRating,
          reviewCount: product.reviewCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined;

  // Single-variant product → plain Product.
  if (variants.length <= 1) {
    const single = variants[0];
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      '@id': `${SITE_URL}/products/${product.slug}#product`,
      name: product.name,
      description: product.description,
      image: product.images,
      sku: single?.sku ?? product.id,
      brand: { '@type': 'Brand', name: brand.displayName },
      category: product.category?.name,
      offers: buildOffer(
        product,
        single ? toNumber(single.price) : basePrice,
        single?.sku,
        single?.stock ?? (totalStock || 1),
      ),
      aggregateRating: rating,
    };
  }

  // Multi-variant → ProductGroup + hasVariant[].
  const variantNodes = variants.map((v) => ({
    '@type': 'Product',
    '@id': `${SITE_URL}/products/${product.slug}#variant-${v.id ?? v.sku}`,
    name: [product.name, v.color, v.size].filter(Boolean).join(' — '),
    sku: v.sku,
    image: v.images && v.images.length > 0 ? v.images : product.images,
    color: v.color,
    size: v.size,
    offers: buildOffer(product, toNumber(v.price), v.sku, v.stock),
  }));

  const prices = variants.map((v) => toNumber(v.price)).filter((n) => !Number.isNaN(n));
  const lowPrice = Math.min(...prices);
  const highPrice = Math.max(...prices);

  return {
    '@context': 'https://schema.org',
    '@type': 'ProductGroup',
    '@id': `${SITE_URL}/products/${product.slug}#group`,
    productGroupID: product.id,
    name: product.name,
    description: product.description,
    image: product.images,
    brand: { '@type': 'Brand', name: brand.displayName },
    category: product.category?.name,
    variesBy: [
      ...(variants.some((v) => v.color) ? ['https://schema.org/color'] : []),
      ...(variants.some((v) => v.size) ? ['https://schema.org/size'] : []),
    ],
    hasVariant: variantNodes,
    offers: {
      '@type': 'AggregateOffer',
      priceCurrency: 'BDT',
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      offerCount: variants.length,
      availability: availability(totalStock),
    },
    aggregateRating: rating,
  };
}
