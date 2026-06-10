/**
 * Backfill default ProductSizeChart rows for every Product that has
 * type != null and at least one variant size, but no chart entries yet.
 *
 * Defaults match the admin's "Auto-fill defaults" button (see
 * apps/admin/components/products/size-and-fit-editor.tsx :: buildDefaultSizeChart)
 * so admin and storefront agree on the same baseline numbers.
 *
 * Idempotent: skips any (product, size, dimension) tuple that already exists.
 */

import { PrismaClient, ProductType } from '@prisma/client';

const prisma = new PrismaClient();

const DIMS_BY_TYPE: Record<ProductType, string[]> = {
  PANTS:   ['waist', 'hip', 'inseam', 'thigh', 'front rise', 'back rise', 'hem opening', 'waistband height'],
  SHIRTS:  ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'neck width', 'cuff opening', 'armhole depth'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'cuff opening', 'back length', 'armhole depth'],
};

const SHIRT_LETTER_DEFAULTS: Record<string, Partial<Record<string, [number, number]>>> = {
  XS:  { chest: [34, 38], shoulder: [14, 15], length: [24, 25], sleeve: [22, 23], bicep: [12, 14], 'hem opening': [36, 40], 'neck width': [14, 15],     'cuff opening': [8, 9],   'armhole depth': [8, 9] },
  S:   { chest: [36, 40], shoulder: [15, 16], length: [25, 26], sleeve: [23, 24], bicep: [13, 15], 'hem opening': [38, 42], 'neck width': [14.5, 15.5], 'cuff opening': [8, 9],   'armhole depth': [8.5, 9.5] },
  M:   { chest: [38, 42], shoulder: [16, 17], length: [26, 27], sleeve: [24, 25], bicep: [14, 16], 'hem opening': [40, 44], 'neck width': [15, 16],     'cuff opening': [9, 10],  'armhole depth': [9, 10] },
  L:   { chest: [40, 44], shoulder: [17, 18], length: [27, 28], sleeve: [25, 26], bicep: [15, 17], 'hem opening': [42, 46], 'neck width': [15.5, 16.5], 'cuff opening': [9, 10],  'armhole depth': [9.5, 10.5] },
  XL:  { chest: [42, 46], shoulder: [18, 19], length: [28, 29], sleeve: [26, 27], bicep: [16, 18], 'hem opening': [44, 48], 'neck width': [16, 17],     'cuff opening': [10, 11], 'armhole depth': [10, 11] },
  XXL: { chest: [44, 48], shoulder: [19, 20], length: [29, 30], sleeve: [27, 28], bicep: [17, 19], 'hem opening': [46, 50], 'neck width': [16.5, 17.5], 'cuff opening': [10, 11], 'armhole depth': [10.5, 11.5] },
};

const JACKET_LETTER_DEFAULTS: Record<string, Partial<Record<string, [number, number]>>> = {
  XS:  { chest: [36, 41], shoulder: [16, 17], length: [25, 26], sleeve: [23, 24], bicep: [13, 16], 'hem opening': [38, 43], 'cuff opening': [9, 10],  'back length': [25, 26], 'armhole depth': [9, 10] },
  S:   { chest: [38, 43], shoulder: [17, 18], length: [26, 27], sleeve: [24, 25], bicep: [14, 17], 'hem opening': [40, 45], 'cuff opening': [9, 10],  'back length': [26, 27], 'armhole depth': [9.5, 10.5] },
  M:   { chest: [40, 45], shoulder: [18, 19], length: [27, 28], sleeve: [25, 26], bicep: [15, 18], 'hem opening': [42, 47], 'cuff opening': [10, 11], 'back length': [27, 28], 'armhole depth': [10, 11] },
  L:   { chest: [42, 47], shoulder: [19, 20], length: [28, 29], sleeve: [26, 27], bicep: [16, 19], 'hem opening': [44, 49], 'cuff opening': [10, 11], 'back length': [28, 29], 'armhole depth': [10.5, 11.5] },
  XL:  { chest: [44, 49], shoulder: [20, 21], length: [29, 30], sleeve: [27, 28], bicep: [17, 20], 'hem opening': [46, 51], 'cuff opening': [11, 12], 'back length': [29, 30], 'armhole depth': [11, 12] },
  XXL: { chest: [46, 51], shoulder: [21, 22], length: [30, 31], sleeve: [28, 29], bicep: [18, 21], 'hem opening': [48, 53], 'cuff opening': [11, 12], 'back length': [30, 31], 'armhole depth': [11.5, 12.5] },
};

function pantsDefaultRow(sizeKey: string, dim: string): [number, number] | null {
  const N = Number(sizeKey);
  if (Number.isNaN(N)) return null;
  switch (dim) {
    case 'waist':            return [N, N + 1];
    case 'hip':              return [N + 9, N + 11];
    case 'inseam':           return [32, 32];
    case 'thigh':            return [Math.floor(N / 2) + 9, Math.floor(N / 2) + 11];
    case 'front rise':       return [11, 11];
    case 'back rise':        return [14, 14];
    case 'hem opening':      return [22, 22];
    case 'waistband height': return [2, 2];
    default:                 return null;
  }
}

function defaultRowsFor(type: ProductType, sizeKeys: string[]): Array<{ sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }> {
  const dims = DIMS_BY_TYPE[type];
  const rows: Array<{ sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }> = [];
  for (const sizeKey of sizeKeys) {
    if (type === ProductType.PANTS) {
      for (const dim of dims) {
        const pair = pantsDefaultRow(sizeKey, dim);
        if (!pair) continue;
        rows.push({ sizeKey, dimension: dim, bodyValueIn: pair[0], garmentValueIn: pair[1] });
      }
    } else {
      const table = type === ProductType.SHIRTS ? SHIRT_LETTER_DEFAULTS : JACKET_LETTER_DEFAULTS;
      const entry = table[sizeKey.toUpperCase()];
      if (!entry) continue;
      for (const dim of dims) {
        const pair = entry[dim];
        if (!pair) continue;
        rows.push({ sizeKey, dimension: dim, bodyValueIn: pair[0], garmentValueIn: pair[1] });
      }
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const products = await prisma.product.findMany({
    where: { type: { not: null }, deletedAt: null },
    select: {
      id: true,
      slug: true,
      type: true,
      variants: { select: { size: true } },
      sizeCharts: { select: { sizeKey: true, dimension: true } },
    },
  });

  console.log(`Scanning ${products.length} products for size-chart backfill...\n`);
  let productsTouched = 0;
  let rowsCreated = 0;
  let rowsSkipped = 0;

  for (const p of products) {
    if (!p.type) continue;
    const sizeKeys = [...new Set(p.variants.map((v) => v.size).filter((s): s is string => Boolean(s)))];
    if (sizeKeys.length === 0) {
      console.log(`  SKIP ${p.slug.padEnd(46)} -- no variant sizes`);
      continue;
    }

    const desired = defaultRowsFor(p.type, sizeKeys);
    if (desired.length === 0) {
      console.log(`  SKIP ${p.slug.padEnd(46)} -- no default rows generated (non-numeric pants sizes or unknown letter)`);
      continue;
    }

    const existing = new Set(p.sizeCharts.map((c) => `${c.sizeKey}__${c.dimension}`));
    const toCreate = desired.filter((r) => !existing.has(`${r.sizeKey}__${r.dimension}`));

    if (toCreate.length === 0) {
      console.log(`  OK   ${p.slug.padEnd(46)} -- already complete (${existing.size} rows)`);
      rowsSkipped += desired.length;
      continue;
    }

    await prisma.productSizeChart.createMany({
      data: toCreate.map((r) => ({ ...r, productId: p.id })),
      skipDuplicates: true,
    });

    productsTouched++;
    rowsCreated += toCreate.length;
    console.log(`  OK   ${p.slug.padEnd(46)} -- +${toCreate.length} rows (${sizeKeys.length} sizes x ${DIMS_BY_TYPE[p.type].length} dims = ${desired.length} target)`);
  }

  console.log(`\nDone. ${productsTouched} products touched, ${rowsCreated} new rows created, ${rowsSkipped} already-present rows skipped.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
