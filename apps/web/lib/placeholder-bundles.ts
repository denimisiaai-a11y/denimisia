// Placeholder bundle data — all editable in one place.
// Images sourced from Unsplash (already whitelisted in next.config.js).
// Swap to API-driven data by replacing the constant with `await getBundles()`
// from lib/api.ts when backend content is ready.

export interface PlaceholderBundleItem {
  name: string;
  image: string;
  price: number;
  quantity: number;
  description: string;
  features: string[];
  material?: string;
  productHref?: string;
}

// Reusable item descriptor templates by garment type.
const DENIM = {
  description:
    'Constructed from 14oz raw Japanese selvedge denim with copper rivets and chainstitch hemming. Unsanforized — will soften and personalize with wear.',
  features: [
    '14oz Japanese selvedge denim',
    'Copper-riveted stress points',
    'Chainstitch hemming',
    'Unsanforized (expect ~3% shrinkage)',
  ],
  material: '100% cotton · Japanese selvedge',
};

const TEE = {
  description:
    'Cut from 200gsm combed cotton with a tubular body (no side seams) and reinforced collar. Modern relaxed silhouette, pre-shrunk for consistent fit.',
  features: [
    '200gsm combed cotton',
    'Tubular body construction',
    'Reinforced collar',
    'Pre-shrunk',
  ],
  material: '100% combed cotton',
};

const JACKET = {
  description:
    'Heavyweight 14oz denim construction with copper-buttoned closure, chest pockets, and finished side tabs. Designed to fade naturally with daily wear.',
  features: [
    '14oz denim shell',
    'Copper button closure',
    'Chest and hand pockets',
    'Chainstitch hemming',
  ],
  material: '100% cotton denim',
};

const BELT = {
  description:
    'Full-grain vegetable-tanned leather at 1.5-inch width with a solid brass buckle. Develops a rich patina over months of wear.',
  features: [
    'Full-grain leather',
    'Solid brass buckle',
    'Vegetable-tanned',
    '1.5 inch width',
  ],
  material: 'Full-grain leather · brass buckle',
};

const HOODIE = {
  description:
    'Heavyweight 450gsm French terry cotton. Relaxed fit with a kangaroo pocket and ribbed cuffs. Pre-shrunk for a consistent length across washes.',
  features: [
    '450gsm French terry',
    'Relaxed fit',
    'Kangaroo pocket',
    'Ribbed cuffs and hem',
  ],
  material: '100% cotton French terry',
};

const PANJABI = {
  description:
    'Hand-woven on traditional Bangladeshi looms by our partner artisans. Cotton-silk blend with a hand-embroidered placket and flowing silhouette.',
  features: [
    'Hand-woven in Bangladesh',
    'Cotton-silk blend',
    'Hand-embroidered placket',
    'Flowing cut',
  ],
  material: 'Cotton-silk blend',
};

const WORKER_PANT = {
  description:
    'Double-knee reinforced utility pant in heavy-gauge canvas. Triple-stitched seams and deep utility pockets. Built to outlast years of daily wear.',
  features: [
    'Double-knee reinforcement',
    'Triple-stitched seams',
    'Heavy canvas construction',
    'Deep utility pockets',
  ],
  material: 'Heavy cotton canvas',
};

export interface PlaceholderBundle {
  slug: string;
  name: string;
  eyebrow: string;
  badgeText: string;
  tagline: string;
  description: string;
  heroImage: string;
  gallery: string[];
  items: PlaceholderBundleItem[];
  originalPrice: number;
  bundlePrice: number;
  savingsPercent: number;
  category: 'essentials' | 'signature' | 'heritage' | 'seasonal';
  featuredOnHome?: boolean;
}

const U = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1200&q=80`;

export const PLACEHOLDER_BUNDLES: PlaceholderBundle[] = [
  {
    slug: 'curator-pack',
    name: 'The Curator Pack',
    eyebrow: 'ESSENTIALS',
    badgeText: 'FULL LOOK • 20% OFF',
    tagline: 'Complete starter wardrobe in one drop',
    description:
      'Our hand-picked starter ensemble pairs signature raw denim with essential layering pieces and a full-grain leather belt. Built for daily wear with construction intended to soften and last.',
    heroImage: U('1542272604-787c3835535d'),
    gallery: [
      U('1542272604-787c3835535d'),
      U('1591047139829-d91aecb6caea'),
      U('1516726817505-f5ed825624d8'),
    ],
    items: [
      { name: 'Raw Indigo Jean', image: U('1591047139829-d91aecb6caea'), price: 2800, quantity: 1, ...DENIM },
      { name: 'Essential Tee — Ivory', image: U('1521572163474-6864f9cf17ab'), price: 900, quantity: 1, ...TEE },
      { name: 'Full-Grain Leather Belt', image: U('1553062407-98eeb64c6a62'), price: 1200, quantity: 1, ...BELT },
    ],
    originalPrice: 4900,
    bundlePrice: 3920,
    savingsPercent: 20,
    category: 'essentials',
    featuredOnHome: true,
  },
  {
    slug: 'core-basics',
    name: 'Core Basics',
    eyebrow: 'ESSENTIALS',
    badgeText: '3-TEE ESSENTIALS • BDT 1,000 SAVINGS',
    tagline: 'Three-pack tee foundation',
    description:
      'Three of our signature-weight cotton tees in editorial neutrals. Spun from 200gsm combed cotton, pre-shrunk, and cut for a modern relaxed silhouette.',
    heroImage: U('1521572163474-6864f9cf17ab'),
    gallery: [
      U('1521572163474-6864f9cf17ab'),
      U('1618354691249-18772bbac3a5'),
      U('1583743089695-4b816a340e08'),
    ],
    items: [
      { name: 'Essential Tee — Ivory', image: U('1521572163474-6864f9cf17ab'), price: 900, quantity: 1, ...TEE },
      { name: 'Essential Tee — Clay', image: U('1618354691249-18772bbac3a5'), price: 900, quantity: 1, ...TEE },
      { name: 'Essential Tee — Ink', image: U('1583743089695-4b816a340e08'), price: 900, quantity: 1, ...TEE },
    ],
    originalPrice: 2700,
    bundlePrice: 1700,
    savingsPercent: 37,
    category: 'essentials',
    featuredOnHome: true,
  },
  {
    slug: 'outerwear-set',
    name: 'Outerwear Set',
    eyebrow: 'SIGNATURE',
    badgeText: 'DUO JACKET PACK • 10% OFF',
    tagline: 'Two-jacket transitional wardrobe',
    description:
      'Our two most-requested silhouettes bundled together: the heavy-weight trucker and the unlined chore coat. Engineered to layer across Dhaka seasons.',
    heroImage: U('1551232864-3f0890e580d9'),
    gallery: [
      U('1551232864-3f0890e580d9'),
      U('1604176354204-9268737828e4'),
      U('1582552938357-32b906df40cb'),
    ],
    items: [
      { name: 'Trucker Jacket — Vintage Indigo', image: U('1551232864-3f0890e580d9'), price: 4500, quantity: 1, ...JACKET },
      { name: 'Chore Coat — Raw Denim', image: U('1604176354204-9268737828e4'), price: 4200, quantity: 1, ...JACKET },
    ],
    originalPrice: 8700,
    bundlePrice: 7830,
    savingsPercent: 10,
    category: 'signature',
    featuredOnHome: true,
  },
  {
    slug: 'heritage-bundle',
    name: 'Heritage Bundle',
    eyebrow: 'HERITAGE',
    badgeText: 'BUY 2 JEANS + 1 PANJABI • 15% OFF',
    tagline: 'Modern-traditional pairing',
    description:
      'Two pairs of our signature jeans with a hand-woven Panjabi from our Heritage collection. Built for cross-occasion wardrobes — denim weekdays, Panjabi weekends.',
    heroImage: U('1594633312681-425c7b97ccd1'),
    gallery: [
      U('1594633312681-425c7b97ccd1'),
      U('1542060748-10c28b62716f'),
      U('1515886657613-9f3515b0c78f'),
    ],
    items: [
      { name: 'Raw Indigo Jean', image: U('1591047139829-d91aecb6caea'), price: 2800, quantity: 2, ...DENIM },
      { name: 'Heritage Panjabi — Ivory', image: U('1542060748-10c28b62716f'), price: 3200, quantity: 1, ...PANJABI },
    ],
    originalPrice: 8800,
    bundlePrice: 7480,
    savingsPercent: 15,
    category: 'heritage',
    featuredOnHome: true,
  },
  {
    slug: 'archive-drop',
    name: 'The Archive Drop',
    eyebrow: 'SIGNATURE',
    badgeText: 'SS24 ARCHIVE • 25% OFF',
    tagline: 'Last-run pieces from SS24',
    description:
      'The final inventory from our SS24 collection, bundled at archive pricing. Includes two pieces from our most-loved silhouettes — not restocking after this drop.',
    heroImage: U('1604176354204-9268737828e4'),
    gallery: [
      U('1604176354204-9268737828e4'),
      U('1582552938357-32b906df40cb'),
      U('1551232864-3f0890e580d9'),
    ],
    items: [
      { name: 'Raw Denim Jean — Archive', image: U('1541099649105-f69ad21f3246'), price: 3200, quantity: 1, ...DENIM },
      { name: 'Chore Coat — Archive', image: U('1604176354204-9268737828e4'), price: 4200, quantity: 1, ...JACKET },
    ],
    originalPrice: 7400,
    bundlePrice: 5550,
    savingsPercent: 25,
    category: 'signature',
  },
  {
    slug: 'weekend-edit',
    name: 'The Weekend Edit',
    eyebrow: 'SEASONAL',
    badgeText: 'WEEKENDER • 18% OFF',
    tagline: 'Off-duty essentials bundle',
    description:
      'Relaxed denim + our hooded sweat + essential tee. The off-duty trio that lives in rotation — comfortable, crafted, and quietly considered.',
    heroImage: U('1542291026-7eec264c27ff'),
    gallery: [
      U('1542291026-7eec264c27ff'),
      U('1583744946564-b52ac1c389c8'),
      U('1521572163474-6864f9cf17ab'),
    ],
    items: [
      { name: 'Relaxed Jean — Mid Indigo', image: U('1542291026-7eec264c27ff'), price: 2600, quantity: 1, ...DENIM },
      { name: 'Heavyweight Hooded Sweat', image: U('1583744946564-b52ac1c389c8'), price: 2400, quantity: 1, ...HOODIE },
      { name: 'Essential Tee — Clay', image: U('1618354691249-18772bbac3a5'), price: 900, quantity: 1, ...TEE },
    ],
    originalPrice: 5900,
    bundlePrice: 4840,
    savingsPercent: 18,
    category: 'seasonal',
  },
  {
    slug: 'worker-pack',
    name: 'The Worker Pack',
    eyebrow: 'HERITAGE',
    badgeText: 'UTILITY SET • 12% OFF',
    tagline: 'Workwear-rooted layering kit',
    description:
      'Three utility-rooted pieces: a double-knee worker pant, chore coat, and our heavyweight pocket tee. Hand-finished details, built for hard wear.',
    heroImage: U('1515886657613-9f3515b0c78f'),
    gallery: [
      U('1515886657613-9f3515b0c78f'),
      U('1604176354204-9268737828e4'),
      U('1506629082955-511b1aa562c8'),
    ],
    items: [
      { name: 'Double-Knee Worker Pant', image: U('1515886657613-9f3515b0c78f'), price: 3400, quantity: 1, ...WORKER_PANT },
      { name: 'Chore Coat — Raw Denim', image: U('1604176354204-9268737828e4'), price: 4200, quantity: 1, ...JACKET },
      { name: 'Heavyweight Pocket Tee', image: U('1506629082955-511b1aa562c8'), price: 1200, quantity: 1, ...TEE },
    ],
    originalPrice: 8800,
    bundlePrice: 7740,
    savingsPercent: 12,
    category: 'heritage',
  },
  {
    slug: 'indigo-trio',
    name: 'The Indigo Trio',
    eyebrow: 'SIGNATURE',
    badgeText: 'THREE WASHES • 22% OFF',
    tagline: 'One silhouette, three washes',
    description:
      'Our signature slim-tapered silhouette across three washes — raw, mid-indigo, and stone. Build a season around one cut.',
    heroImage: U('1541099649105-f69ad21f3246'),
    gallery: [
      U('1541099649105-f69ad21f3246'),
      U('1591047139829-d91aecb6caea'),
      U('1542291026-7eec264c27ff'),
    ],
    items: [
      { name: 'Signature Jean — Raw', image: U('1591047139829-d91aecb6caea'), price: 2800, quantity: 1, ...DENIM },
      { name: 'Signature Jean — Mid Indigo', image: U('1542291026-7eec264c27ff'), price: 2800, quantity: 1, ...DENIM },
      { name: 'Signature Jean — Stone', image: U('1541099649105-f69ad21f3246'), price: 2800, quantity: 1, ...DENIM },
    ],
    originalPrice: 8400,
    bundlePrice: 6550,
    savingsPercent: 22,
    category: 'signature',
  },
];

export function getPlaceholderBundle(slug: string): PlaceholderBundle | undefined {
  return PLACEHOLDER_BUNDLES.find((b) => b.slug === slug);
}

export function getFeaturedBundles(): PlaceholderBundle[] {
  return PLACEHOLDER_BUNDLES.filter((b) => b.featuredOnHome);
}

export function getRelatedBundles(currentSlug: string, limit = 3): PlaceholderBundle[] {
  return PLACEHOLDER_BUNDLES.filter((b) => b.slug !== currentSlug).slice(0, limit);
}
