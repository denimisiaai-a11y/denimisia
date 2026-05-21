import { ProductType } from '@prisma/client';

export const ATTRIBUTE_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: [
    'silhouette',
    'rise',
    'length',
    'wash',
    'season',
    'occasion',
    'material',
    'pattern',
  ],
  SHIRTS: [
    'silhouette',
    'sleeve',
    'neckline',
    'length',
    'season',
    'occasion',
    'material',
    'pattern',
  ],
  JACKETS: [
    'silhouette',
    'length',
    'closure',
    'warmth',
    'season',
    'occasion',
    'material',
    'pattern',
  ],
};

export const REQUIRED_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: ['silhouette', 'rise', 'season', 'material'],
  SHIRTS: ['silhouette', 'sleeve', 'neckline', 'season', 'material'],
  JACKETS: ['silhouette', 'length', 'closure', 'warmth', 'season', 'material'],
};

export const SIZE_CHART_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'thigh'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve'],
};

export const SIZING_FLOW_STEPS: Record<ProductType, string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'fitPref'],
  SHIRTS: ['chest', 'shoulder', 'sleeve', 'fitPref'],
  JACKETS: ['chest', 'shoulder', 'fitPref'],
};

export const FIT_PREF_PENALTY = 0.5;
export const SIZE_TIE_TOLERANCE = 1.0;
export const SYNONYM_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_PRODUCTS_RETURNED = 6;
export const MAX_SIZING_CANDIDATES = 100;

export const VALID_FIT_PREFS: ReadonlySet<string> = new Set([
  'slim',
  'regular',
  'baggy',
  'fitted',
  'oversized',
]);
