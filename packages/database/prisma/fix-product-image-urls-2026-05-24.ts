/**
 * Replace any image URL in Product.images that points to an R2 key containing
 * a space, swapping the space for a hyphen. Matches the rename done on R2 by
 * docs/imports/fix-r2-filenames-with-spaces.py.
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

interface RenameEntry {
  sku: string;
  old_key: string;
  new_key: string;
  old_url: string;
  new_url: string;
}

// SKU codes don't live on Product directly -- map to product slug.
const SLUG_BY_SKU: Record<string, string> = {
  '2125': 'bow-sky-fade-baggy-denim',
  '3039': 'comfort-flow-stretch-jeans',
};

async function main(): Promise<void> {
  const log = JSON.parse(
    readFileSync(resolve('c:/Users/joycg/denimisia/docs/imports/rename-spaces-log.json'), 'utf8'),
  ) as RenameEntry[];

  // Group rename entries by SKU
  const renamesBySku = new Map<string, RenameEntry[]>();
  for (const entry of log) {
    const list = renamesBySku.get(entry.sku) ?? [];
    list.push(entry);
    renamesBySku.set(entry.sku, list);
  }

  for (const [sku, renames] of renamesBySku) {
    const slug = SLUG_BY_SKU[sku];
    if (!slug) {
      console.log(`  SKIP sku=${sku} -- no slug mapping`);
      continue;
    }
    const product = await prisma.product.findUnique({
      where: { slug },
      select: { id: true, images: true },
    });
    if (!product) {
      console.log(`  SKIP sku=${sku} slug=${slug} -- product not found`);
      continue;
    }

    const urlSwap = new Map(renames.map((r) => [r.old_url, r.new_url]));
    const before = product.images;
    const after = before.map((u) => urlSwap.get(u) ?? u);
    const changes = before.reduce((n, u, i) => (after[i] !== u ? n + 1 : n), 0);

    if (changes === 0) {
      console.log(`  OK   sku=${sku} -- already up to date (${before.length} images)`);
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { images: after },
    });
    console.log(`  OK   sku=${sku} -- replaced ${changes}/${before.length} image URLs`);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
