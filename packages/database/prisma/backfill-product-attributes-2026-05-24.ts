/**
 * Backfill `type` and required `ProductTag` rows for the 17 products imported
 * 2026-05-24. Without these fields the admin product editor blocks save with
 * "Type is required" / "Missing required attributes". This script sets:
 *
 *  - product.type: PANTS
 *  - productTag rows for season (All-season), material (Denim),
 *    silhouette (per category mapping), rise (High or Mid per source doc)
 *
 * Idempotent: uses upsert-style logic so re-runs are safe.
 */

import { PrismaClient, ProductType, TagDimension } from '@prisma/client';

const prisma = new PrismaClient();

type Rise = 'High' | 'Mid' | 'Low';

interface AttributeBundle {
  silhouettes: string[];
  rise: Rise;
}

const ATTRS_BY_SLUG: Record<string, AttributeBundle> = {
  'signature-chic-denim-wide-leg-baggy-jeans': { silhouettes: ['Baggy', 'Wide-leg'], rise: 'High' },
  'trendy-stretchable-wide-leg-jeans':         { silhouettes: ['Flared', 'Bootcut'], rise: 'High' },
  'super-baggy-wide-leg-denim-jeans':          { silhouettes: ['Baggy', 'Wide-leg'], rise: 'High' },
  'cloud-fit-wide-leg-denim':                  { silhouettes: ['Wide-leg'],           rise: 'High' },
  'comfy-wide-leg-denim-pant-for-women':       { silhouettes: ['Wide-leg'],           rise: 'High' },
  'noor-high-waisted-denim':                   { silhouettes: ['Straight'],           rise: 'High' },
  'zenith-wide-leg-baggy-jeans':               { silhouettes: ['Baggy', 'Wide-leg'], rise: 'Mid' },
  'sasha-straight-fit-granding-jeans':         { silhouettes: ['Straight', 'Wide-leg'], rise: 'High' },
  'alyza-patch-pocket-wide-leg':               { silhouettes: ['Wide-leg', 'Flared'], rise: 'High' },
  'mocha-mist-wide-leg-denim':                 { silhouettes: ['Wide-leg', 'Relaxed'], rise: 'High' },
  'freha-flares-mid-waist-jeans':              { silhouettes: ['Flared', 'Bootcut'], rise: 'Mid' },
  'comfort-flow-stretch-jeans':                { silhouettes: ['Flared', 'Bootcut'], rise: 'High' },
  'kiara-urban-denim-cargo':                   { silhouettes: ['Straight', 'Baggy'], rise: 'High' },
  'smoke-form-denim':                          { silhouettes: ['Baggy', 'Wide-leg'], rise: 'High' },
  'celina-back-zip-closure':                   { silhouettes: ['Wide-leg', 'Relaxed'], rise: 'High' },
  'little-star-baggy-denim':                   { silhouettes: ['Baggy'],              rise: 'Mid' },
  'bow-sky-fade-baggy-denim':                  { silhouettes: ['Baggy'],              rise: 'Mid' },
};

const UNIVERSAL_TAGS: Array<{ dimension: TagDimension; value: string }> = [
  { dimension: TagDimension.season,   value: 'All-season' },
  { dimension: TagDimension.material, value: 'Denim' },
];

async function backfillOne(slug: string, attrs: AttributeBundle): Promise<{ tagsCreated: number; tagsSkipped: number }> {
  const product = await prisma.product.findUnique({ where: { slug }, select: { id: true, type: true } });
  if (!product) {
    console.log(`  SKIP  ${slug} -- product not found`);
    return { tagsCreated: 0, tagsSkipped: 0 };
  }

  // 1. Set type if missing
  if (product.type !== ProductType.PANTS) {
    await prisma.product.update({
      where: { id: product.id },
      data: { type: ProductType.PANTS },
    });
  }

  // 2. Compose required tag rows (universal + per-type required)
  const tagsToEnsure: Array<{ dimension: TagDimension; value: string }> = [
    ...UNIVERSAL_TAGS,
    { dimension: TagDimension.rise, value: attrs.rise },
    ...attrs.silhouettes.map((s) => ({ dimension: TagDimension.silhouette, value: s })),
  ];

  let created = 0;
  let skipped = 0;
  for (const tag of tagsToEnsure) {
    const existing = await prisma.productTag.findUnique({
      where: {
        productId_dimension_value: {
          productId: product.id,
          dimension: tag.dimension,
          value: tag.value,
        },
      },
    });
    if (existing) {
      skipped++;
      continue;
    }
    await prisma.productTag.create({
      data: {
        productId: product.id,
        dimension: tag.dimension,
        value: tag.value,
      },
    });
    created++;
  }
  return { tagsCreated: created, tagsSkipped: skipped };
}

async function main(): Promise<void> {
  const slugs = Object.keys(ATTRS_BY_SLUG);
  console.log(`Backfilling type + required attributes for ${slugs.length} products...\n`);
  let totalCreated = 0;
  let totalSkipped = 0;
  for (const slug of slugs) {
    const attrs = ATTRS_BY_SLUG[slug];
    const { tagsCreated, tagsSkipped } = await backfillOne(slug, attrs);
    totalCreated += tagsCreated;
    totalSkipped += tagsSkipped;
    console.log(
      `  OK    ${slug.padEnd(46)}  type=PANTS  silhouettes=[${attrs.silhouettes.join(',')}]  rise=${attrs.rise}  (+${tagsCreated} tags, ${tagsSkipped} already-present)`,
    );
  }
  console.log(`\nDone. Created ${totalCreated} new ProductTag rows, skipped ${totalSkipped} already-present.`);

  // Verification snapshot
  const totals = await Promise.all([
    prisma.product.count({ where: { type: ProductType.PANTS } }),
    prisma.product.count({ where: { type: null } }),
    prisma.productTag.count(),
  ]);
  console.log(`\nVerification:`);
  console.log(`  Products with type=PANTS:  ${totals[0]}`);
  console.log(`  Products with type=null:   ${totals[1]}`);
  console.log(`  ProductTag rows total:     ${totals[2]}`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
