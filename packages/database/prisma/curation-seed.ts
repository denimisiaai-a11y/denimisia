/**
 * Bootstrap SectionCuration rows for the 4 dynamic homepage sections.
 * Idempotent — upserts by (pageKey, sectionKey).
 *
 * Run: pnpm --filter database seed:curation
 */

import { PrismaClient, CurationSource } from '@prisma/client';

const prisma = new PrismaClient();

interface Seed {
  readonly sectionKey: string;
  readonly label: string;
  readonly heading: string;
  readonly subheading: string;
  readonly collectionSlug: string | null;
  readonly maxItems: number;
  readonly source: CurationSource;
}

const SEEDS: readonly Seed[] = [
  {
    sectionKey: 'new_arrivals_section',
    label: 'New Arrivals',
    heading: "What's New",
    subheading: 'Fresh from the studio.',
    collectionSlug: 'new-arrivals',
    maxItems: 8,
    source: 'COLLECTION',
  },
  {
    sectionKey: 'bestsellers_section',
    label: 'Best Sellers',
    heading: 'Best Sellers',
    subheading: 'Our most-loved silhouettes.',
    collectionSlug: 'bestsellers',
    maxItems: 4,
    source: 'COLLECTION',
  },
  {
    sectionKey: 'trending_section',
    label: 'Trending',
    heading: 'Trending now',
    subheading: 'Moving fast this week.',
    collectionSlug: null,
    maxItems: 10,
    source: 'MANUAL',
  },
  {
    sectionKey: 'bundles_section',
    label: 'Bundle Deals',
    heading: 'Pairs, done for you',
    subheading: 'Considered pairings at bundled pricing.',
    collectionSlug: null,
    maxItems: 4,
    source: 'MANUAL',
  },
];

async function main(): Promise<void> {
  console.log(`Curation seed — ${SEEDS.length} homepage sections.`);
  for (const s of SEEDS) {
    let collectionId: string | null = null;
    if (s.collectionSlug) {
      const c = await prisma.collection.findUnique({ where: { slug: s.collectionSlug } });
      collectionId = c?.id ?? null;
      if (!c) console.warn(`  [warn] collection "${s.collectionSlug}" not found — leaving unlinked.`);
    }
    await prisma.sectionCuration.upsert({
      where:  { pageKey_sectionKey: { pageKey: 'home', sectionKey: s.sectionKey } },
      update: {
        label:       s.label,
        heading:     s.heading,
        subheading:  s.subheading,
        maxItems:    s.maxItems,
        sourceMode:  s.source,
        collectionId,
      },
      create: {
        pageKey:     'home',
        sectionKey:  s.sectionKey,
        label:       s.label,
        heading:     s.heading,
        subheading:  s.subheading,
        maxItems:    s.maxItems,
        sourceMode:  s.source,
        collectionId,
      },
    });
    console.log(`  ok: home/${s.sectionKey} (${s.source}${collectionId ? ` → ${s.collectionSlug}` : ''})`);
  }
  console.log('Done.');
}

main()
  .catch((err: unknown) => {
    const m = err instanceof Error ? err.message : String(err);
    console.error('Curation seed failed:', m);
    process.exit(1);
  })
  .finally(() => { void prisma.$disconnect(); });
