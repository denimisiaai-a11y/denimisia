// MVP placeholder reviews. Deterministic selection keyed by productId so each
// product gets a stable set of reviews across renders. Disable the flag below
// once the real review pipeline is wired to the API.

const ALWAYS_USE_PLACEHOLDER_REVIEWS = true;

export interface PlaceholderReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  isVerified: boolean;
  helpfulCount: number;
  user: { firstName: string; lastName: string };
  createdAt: string;
}

interface ReviewSeed {
  rating: number;
  title: string | null;
  body: string;
  firstName: string;
  lastName: string;
  verified: boolean;
  helpful: number;
  daysAgo: number;
}

// Realistic review pool — mixed ratings, diverse names, specific product
// details (fit, fabric, wash, wear history) so copy reads like real customers.
const REVIEW_POOL: readonly ReviewSeed[] = [
  {
    rating: 5,
    title: 'Finally, jeans that fit my actual body',
    body: "I'm 5'7\" with athletic thighs and a smaller waist — size 28 fits perfectly at the hip and the waist doesn't gap. The denim has a bit of structure but softens up after a wash. Third pair I've ordered.",
    firstName: 'Tasnim',
    lastName: 'Rahman',
    verified: true,
    helpful: 34,
    daysAgo: 12,
  },
  {
    rating: 4,
    title: 'Great quality, runs slightly long',
    body: 'Fabric feels premium and the stitching is clean. Only knock is the inseam — I had to get them hemmed about 1.5 inches. Would still buy again. Colour held up after three washes with cold water.',
    firstName: 'Arjun',
    lastName: 'Menon',
    verified: true,
    helpful: 21,
    daysAgo: 28,
  },
  {
    rating: 5,
    title: null,
    body: "Wore these on a 9-hour flight and they didn't feel stiff by the end. That alone earns 5 stars. Denim looks way more expensive than it is.",
    firstName: 'Sophie',
    lastName: 'Okafor',
    verified: true,
    helpful: 18,
    daysAgo: 44,
  },
  {
    rating: 3,
    title: 'Good jeans, sizing chart is off',
    body: 'Ordered my usual 30 and they were noticeably tight. Exchanged for a 31 and those fit fine. Love the shape once you get the right size — just size up if you are between.',
    firstName: 'Marcus',
    lastName: 'Lindqvist',
    verified: true,
    helpful: 47,
    daysAgo: 9,
  },
  {
    rating: 5,
    title: 'Worth every taka',
    body: "Honestly the best denim I've bought from a Bangladeshi brand. The raw selvedge edge is a nice touch. Paired them with boots and a white tee — looks sharp.",
    firstName: 'Rafid',
    lastName: 'Hossain',
    verified: true,
    helpful: 52,
    daysAgo: 3,
  },
  {
    rating: 4,
    title: 'Soft, structured, and holds its shape',
    body: 'The denim has enough stretch to be comfortable through a long day but doesn\'t bag out at the knees. Only reason I\'m not giving 5 stars is because the tag is a bit scratchy — cut it out on day one.',
    firstName: 'Ishita',
    lastName: 'Chowdhury',
    verified: true,
    helpful: 15,
    daysAgo: 62,
  },
  {
    rating: 5,
    title: 'The wash is perfect',
    body: "Not too dark, not overly faded — the mid-indigo I was hoping for. I've owned them for two months now and the fade pattern is starting to come in naturally around the knees.",
    firstName: 'Daniel',
    lastName: 'Park',
    verified: false,
    helpful: 9,
    daysAgo: 73,
  },
  {
    rating: 4,
    title: null,
    body: "Delivery was faster than I expected. Jeans feel substantial — heavier than what I'm used to from fast fashion brands. Will need a second wash to see how they settle.",
    firstName: 'Ayesha',
    lastName: 'Siddique',
    verified: true,
    helpful: 6,
    daysAgo: 19,
  },
  {
    rating: 5,
    title: 'Replaced my APCs with these',
    body: "I've been loyal to APC petit standards for years. These are about 70% of the feel at 30% of the cost. That's a win. Raw denim crowd — give these a shot.",
    firstName: 'Julian',
    lastName: 'Bakker',
    verified: true,
    helpful: 88,
    daysAgo: 55,
  },
  {
    rating: 3,
    title: 'Nice jeans but the pocket is shallow',
    body: "Fit is good, fabric quality is good — but the front pockets are small. My phone barely fits. Small gripe but worth mentioning if you actually use your pockets.",
    firstName: 'Nabeel',
    lastName: 'Iqbal',
    verified: true,
    helpful: 24,
    daysAgo: 38,
  },
  {
    rating: 5,
    title: 'Compliments every time I wear them',
    body: 'Got stopped twice at a cafe asking where I got these. The cut is flattering without being tight. They hit right at the ankle for me (5\'5") which is ideal.',
    firstName: 'Priya',
    lastName: 'Sharma',
    verified: true,
    helpful: 31,
    daysAgo: 5,
  },
  {
    rating: 4,
    title: 'Impressed for a first-time buyer',
    body: "First order from Denimisia — not my last. Packaging was thoughtful, the jeans were folded not crumpled. Sizing ran true for me. Docked one star only because the brand is new and I want to see how they hold up at 6 months.",
    firstName: 'Elena',
    lastName: 'Marchetti',
    verified: true,
    helpful: 12,
    daysAgo: 87,
  },
];

function hash(key: string): number {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) {
    h = (h * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function daysAgoToIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

// Deterministic: same productId always yields the same review set + order.
export function fallbackReviewsForProduct(productId: string): PlaceholderReview[] {
  const seed = hash(productId);
  const count = 5 + (seed % 4); // 5–8 reviews per product
  const start = seed % REVIEW_POOL.length;
  const picked: PlaceholderReview[] = [];
  for (let i = 0; i < count; i += 1) {
    const src = REVIEW_POOL[(start + i * 3) % REVIEW_POOL.length]!;
    picked.push({
      id: `ph-${productId}-${i}`,
      rating: src.rating,
      title: src.title,
      body: src.body,
      isVerified: src.verified,
      helpfulCount: src.helpful,
      user: { firstName: src.firstName, lastName: src.lastName },
      createdAt: daysAgoToIso(src.daysAgo),
    });
  }
  return picked;
}

export function fallbackRatingBreakdown(
  reviews: PlaceholderReview[],
): { rating: number; _count: { rating: number } }[] {
  const counts = new Map<number, number>();
  for (const r of reviews) counts.set(r.rating, (counts.get(r.rating) ?? 0) + 1);
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    _count: { rating: counts.get(rating) ?? 0 },
  }));
}

export function shouldUsePlaceholderReviews(): boolean {
  return ALWAYS_USE_PLACEHOLDER_REVIEWS;
}
