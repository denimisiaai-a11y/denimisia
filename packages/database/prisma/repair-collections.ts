/**
 * Repair script — restore content collaterally emptied by the
 * A-040 prod-cleanup.ts pass. When 17 placeholder products were deleted,
 * the CASCADE rules silently dropped:
 *   - CollectionProduct rows for `new-arrivals` and `bestsellers`
 *   - BundleItem rows for all 4 ProductBundles
 * leaving the homepage sections blank.
 *
 * What this script restores (all idempotent):
 *   1. new-arrivals collection        → 10 newest active products
 *   2. bestsellers collection         → 10 highest-stock active products
 *   3. bestsellers_section curation   → maxItems bumped to 10
 *   4. trending_section curation      → 10 highest-price products (MANUAL)
 *   5. product bundles                → 3 variants from different products each
 *
 * Run: pnpm --filter database exec tsx prisma/repair-collections.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function repairCollections(): Promise<void> {
  const [newArrivals, bestsellers] = await Promise.all([
    prisma.collection.findUnique({ where: { slug: 'new-arrivals' } }),
    prisma.collection.findUnique({ where: { slug: 'bestsellers' } }),
  ]);
  if (!newArrivals || !bestsellers) throw new Error('Required collections missing');

  const newest = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, name: true },
  });
  for (const [i, p] of newest.entries()) {
    await prisma.collectionProduct.upsert({
      where:  { collectionId_productId: { collectionId: newArrivals.id, productId: p.id } },
      update: { position: i },
      create: { collectionId: newArrivals.id, productId: p.id, position: i },
    });
  }

  const productsWithStock = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: { variants: { select: { stock: true } } },
  });
  const topStock = productsWithStock
    .filter((p) => p.variants.length > 0)
    .map((p) => ({ id: p.id, name: p.name, totalStock: p.variants.reduce((a, v) => a + v.stock, 0) }))
    .sort((a, b) => b.totalStock - a.totalStock)
    .slice(0, 10);
  for (const [i, p] of topStock.entries()) {
    await prisma.collectionProduct.upsert({
      where:  { collectionId_productId: { collectionId: bestsellers.id, productId: p.id } },
      update: { position: i },
      create: { collectionId: bestsellers.id, productId: p.id, position: i },
    });
  }
  console.log(`collections · new-arrivals=${newest.length} · bestsellers=${topStock.length}`);
}

async function repairCurations(): Promise<void> {
  const bestSec = await prisma.sectionCuration.findUnique({
    where: { pageKey_sectionKey: { pageKey: 'home', sectionKey: 'bestsellers_section' } },
  });
  if (bestSec && bestSec.maxItems !== 10) {
    await prisma.sectionCuration.update({ where: { id: bestSec.id }, data: { maxItems: 10 } });
  }

  const trendSec = await prisma.sectionCuration.findUnique({
    where: { pageKey_sectionKey: { pageKey: 'home', sectionKey: 'trending_section' } },
  });
  if (trendSec) {
    const existing = await prisma.sectionProduct.count({ where: { curationId: trendSec.id } });
    if (existing === 0) {
      const highPrice = await prisma.product.findMany({
        where: { isActive: true, deletedAt: null },
        orderBy: { price: 'desc' },
        take: 10,
        select: { id: true, name: true },
      });
      for (const [i, p] of highPrice.entries()) {
        await prisma.sectionProduct.upsert({
          where:  { curationId_productId: { curationId: trendSec.id, productId: p.id } },
          update: { position: i, isPinned: true },
          create: { curationId: trendSec.id, productId: p.id, position: i, isPinned: true },
        });
      }
      if (trendSec.sourceMode !== 'MANUAL' && trendSec.sourceMode !== 'MIXED') {
        await prisma.sectionCuration.update({ where: { id: trendSec.id }, data: { sourceMode: 'MANUAL' } });
      }
      console.log(`trending_section · ${highPrice.length} products pinned`);
    } else {
      console.log(`trending_section · ${existing} products already present`);
    }
  }

  console.log(`curations · bestsellers maxItems=${bestSec?.maxItems ?? '?'}`);
}

async function repairBundles(): Promise<void> {
  const bundles = await prisma.productBundle.findMany({ include: { items: true } });
  const products = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null },
    include: { variants: { select: { stock: true } } },
  });
  const topStockProducts = products
    .map((p) => ({ id: p.id, totalStock: p.variants.reduce((a, v) => a + v.stock, 0) }))
    .filter((p) => p.totalStock > 0)
    .sort((a, b) => b.totalStock - a.totalStock);

  if (topStockProducts.length < 3) {
    console.log(`bundles · insufficient products (${topStockProducts.length})`);
    return;
  }

  let populated = 0;
  for (const [bIdx, bundle] of bundles.entries()) {
    if (bundle.items.length > 0) continue;
    const offset = (bIdx * 3) % Math.max(1, topStockProducts.length - 3);
    const picks = topStockProducts.slice(offset, offset + 3);
    if (picks.length === 0) continue;
    for (const p of picks) {
      await prisma.bundleItem.upsert({
        where: {
          bundleId_productId_color: {
            bundleId: bundle.id,
            productId: p.id,
            color: '',
          },
        },
        update: {},
        create: { bundleId: bundle.id, productId: p.id },
      });
    }
    populated += 1;
  }
  console.log(`bundles · ${populated}/${bundles.length} bundles repopulated`);
}

async function main(): Promise<void> {
  await repairCollections();
  await repairCurations();
  await repairBundles();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
