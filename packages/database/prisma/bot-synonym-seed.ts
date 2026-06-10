import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SEED: Array<{ dimension: string; canonical: string; aliases: string[] }> = [
  { dimension: 'category', canonical: 'pants', aliases: ['trousers', 'bottoms', 'denims'] },
  { dimension: 'category', canonical: 'shirts', aliases: ['shirt', 'tee', 't-shirt', 'tops'] },
  { dimension: 'category', canonical: 'jackets', aliases: ['jacket', 'coats', 'coat', 'outerwear'] },
  { dimension: 'color', canonical: 'black', aliases: ['blk'] },
  { dimension: 'color', canonical: 'white', aliases: [] },
  { dimension: 'color', canonical: 'blue', aliases: ['navy', 'indigo'] },
  { dimension: 'color', canonical: 'grey', aliases: ['gray', 'charcoal'] },
  { dimension: 'color', canonical: 'beige', aliases: ['tan', 'khaki', 'sand', 'cream'] },
  { dimension: 'color', canonical: 'brown', aliases: [] },
  { dimension: 'color', canonical: 'olive', aliases: ['green'] },
  { dimension: 'silhouette', canonical: 'skinny', aliases: ['tight'] },
  { dimension: 'silhouette', canonical: 'slim', aliases: ['slimfit'] },
  { dimension: 'silhouette', canonical: 'straight', aliases: ['regular-fit'] },
  { dimension: 'silhouette', canonical: 'relaxed', aliases: ['loose'] },
  { dimension: 'silhouette', canonical: 'baggy', aliases: ['oversized-fit'] },
  { dimension: 'silhouette', canonical: 'wide-leg', aliases: ['wide', 'flared'] },
  { dimension: 'silhouette', canonical: 'oversized', aliases: ['oversize', 'os'] },
  { dimension: 'silhouette', canonical: 'cropped', aliases: ['crop', 'short'] },
  { dimension: 'sleeve', canonical: 'short', aliases: ['half'] },
  { dimension: 'sleeve', canonical: 'long', aliases: ['full'] },
  { dimension: 'sleeve', canonical: 'sleeveless', aliases: ['tank'] },
];

async function main() {
  for (const row of SEED) {
    await prisma.botSynonym.upsert({
      where: { dimension_canonical: { dimension: row.dimension, canonical: row.canonical } },
      create: row,
      update: { aliases: row.aliases },
    });
  }
  console.log(`Seeded ${SEED.length} synonyms`);
}

main().finally(() => prisma.$disconnect());
