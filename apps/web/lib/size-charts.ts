export type Rise = 'high-waist' | 'mid-rise' | 'low-rise';
export type Category = 'denim' | 'tshirt' | 'outerwear' | 'sweater';

export interface DenimRow {
  size: string;
  waist: number;
  hip: number;
  rise: number;
  inseam: number;
  leg: number;
}

export interface TopRow {
  size: string;
  fullLength: number;
  chest: number;
  shoulder: number;
  sleeve: number;
  jacketLength?: number;
}

export const DENIM_WOMEN: DenimRow[] = [
  { size: '24', waist: 60, hip: 84, rise: 27, inseam: 76, leg: 24 },
  { size: '26', waist: 66, hip: 90, rise: 28, inseam: 76, leg: 25 },
  { size: '28', waist: 71, hip: 96, rise: 28, inseam: 77, leg: 26 },
  { size: '30', waist: 76, hip: 101, rise: 29, inseam: 77, leg: 27 },
  { size: '32', waist: 81, hip: 106, rise: 29, inseam: 78, leg: 28 },
  { size: '34', waist: 86, hip: 112, rise: 30, inseam: 78, leg: 29 },
];

export const DENIM_MEN: DenimRow[] = [
  { size: '28', waist: 71, hip: 90, rise: 27, inseam: 81, leg: 25 },
  { size: '30', waist: 76, hip: 96, rise: 28, inseam: 81, leg: 26 },
  { size: '32', waist: 81, hip: 101, rise: 28, inseam: 82, leg: 27 },
  { size: '34', waist: 86, hip: 106, rise: 29, inseam: 82, leg: 28 },
  { size: '36', waist: 91, hip: 112, rise: 29, inseam: 83, leg: 29 },
  { size: '38', waist: 96, hip: 117, rise: 30, inseam: 83, leg: 30 },
];

export const TSHIRT: TopRow[] = [
  { size: 'XS', fullLength: 64, chest: 50, shoulder: 41, sleeve: 20 },
  { size: 'S', fullLength: 66, chest: 52, shoulder: 43, sleeve: 21 },
  { size: 'M', fullLength: 68, chest: 54, shoulder: 45, sleeve: 22 },
  { size: 'L', fullLength: 70, chest: 56, shoulder: 47, sleeve: 23 },
  { size: 'XL', fullLength: 72, chest: 58, shoulder: 49, sleeve: 24 },
  { size: 'XXL', fullLength: 74, chest: 60, shoulder: 51, sleeve: 25 },
];

export const SWEATER: TopRow[] = [
  { size: 'XS', fullLength: 66, chest: 52, shoulder: 42, sleeve: 58 },
  { size: 'S', fullLength: 68, chest: 54, shoulder: 44, sleeve: 59 },
  { size: 'M', fullLength: 70, chest: 56, shoulder: 46, sleeve: 60 },
  { size: 'L', fullLength: 72, chest: 58, shoulder: 48, sleeve: 61 },
  { size: 'XL', fullLength: 74, chest: 60, shoulder: 50, sleeve: 62 },
  { size: 'XXL', fullLength: 76, chest: 62, shoulder: 52, sleeve: 63 },
];

export const OUTERWEAR: TopRow[] = [
  { size: 'XS', fullLength: 68, chest: 54, shoulder: 44, sleeve: 60, jacketLength: 68 },
  { size: 'S', fullLength: 70, chest: 56, shoulder: 46, sleeve: 61, jacketLength: 70 },
  { size: 'M', fullLength: 72, chest: 58, shoulder: 48, sleeve: 62, jacketLength: 72 },
  { size: 'L', fullLength: 74, chest: 60, shoulder: 50, sleeve: 63, jacketLength: 74 },
  { size: 'XL', fullLength: 76, chest: 62, shoulder: 52, sleeve: 64, jacketLength: 76 },
  { size: 'XXL', fullLength: 78, chest: 64, shoulder: 54, sleeve: 65, jacketLength: 78 },
];

const DENIM_CATEGORY_KEYWORDS = ['denim', 'jean', 'trouser', 'pant', 'baggy', 'flare', 'cargo', 'culotte', 'wide-leg', 'skinny', 'slouchy', 'straight', 'mom', 'jegging'];
const TSHIRT_KEYWORDS = ['tshirt', 't-shirt', 'tee', 'top'];
const SWEATER_KEYWORDS = ['sweater', 'knit', 'hoodie', 'sweatshirt'];
const OUTERWEAR_KEYWORDS = ['jacket', 'outerwear', 'coat'];

export function pickCategory(product: {
  category?: { slug?: string; name?: string } | null;
  tags?: string[];
  name?: string;
}): Category {
  const haystack = [
    product.category?.slug ?? '',
    product.category?.name ?? '',
    product.name ?? '',
    ...(product.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();

  if (TSHIRT_KEYWORDS.some((k) => haystack.includes(k))) return 'tshirt';
  if (SWEATER_KEYWORDS.some((k) => haystack.includes(k))) return 'sweater';
  if (OUTERWEAR_KEYWORDS.some((k) => haystack.includes(k))) return 'outerwear';
  if (DENIM_CATEGORY_KEYWORDS.some((k) => haystack.includes(k))) return 'denim';
  return 'denim';
}

export function detectRise(product: { tags?: string[] }): Rise | null {
  const tags = (product.tags ?? []).map((t) => t.toLowerCase());
  if (tags.includes('high-waist') || tags.includes('high-rise')) return 'high-waist';
  if (tags.includes('mid-rise')) return 'mid-rise';
  if (tags.includes('low-rise')) return 'low-rise';
  return null;
}

export function detectGender(product: {
  category?: { slug?: string; name?: string } | null;
  tags?: string[];
}): 'women' | 'men' | null {
  const haystack = [
    product.category?.slug ?? '',
    product.category?.name ?? '',
    ...(product.tags ?? []),
  ]
    .join(' ')
    .toLowerCase();
  if (haystack.includes('women') || haystack.includes('ladies')) return 'women';
  if (haystack.includes('men') && !haystack.includes('women')) return 'men';
  return null;
}

export function cmToIn(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10;
}
