/**
 * Comprehensive damage audit — what did Session 19 cleanup + schema hardening
 * actually empty, break, or leave half-populated?
 *
 * Read-only. Groups findings by severity.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const log = (label: string, value: unknown): void => {
  console.log(`  ${label.padEnd(42)} ${String(value)}`);
};

async function main(): Promise<void> {
  console.log('\n=== PRODUCTS ===');
  const products = await prisma.product.findMany({
    include: { variants: { select: { stock: true } }, _count: { select: { reviews: true } } },
  });
  log('total active products', products.length);
  log('products with 0 images', products.filter((p) => p.images.length === 0).length);
  log('products with local /images/ path', products.filter((p) => (p.images[0] || '').startsWith('/images/')).length);
  log('products with storola CDN images', products.filter((p) => (p.images[0] || '').includes('storola-client-space')).length);
  log('products with unsplash images', products.filter((p) => (p.images[0] || '').includes('unsplash')).length);
  log('products with 0 variants', products.filter((p) => p.variants.length === 0).length);
  log('products with 0 stock across variants', products.filter((p) => p.variants.reduce((a, v) => a + v.stock, 0) === 0).length);

  console.log('\n=== COLLECTIONS ===');
  const cols = await prisma.collection.findMany({ include: { _count: { select: { products: true } } } });
  for (const c of cols) log(`  ${c.slug}${c.isActive ? '' : ' [inactive]'}`, `${c._count.products} products`);

  console.log('\n=== BUNDLES ===');
  const bundles = await prisma.productBundle.findMany({ include: { _count: { select: { items: true } } } });
  for (const b of bundles) {
    log(`  ${b.slug}${b.isActive ? '' : ' [inactive]'}`, `${b._count.items} items, img=${(b.image || 'null').slice(0, 40)}`);
  }

  console.log('\n=== CATEGORIES ===');
  const cats = await prisma.category.findMany({ include: { _count: { select: { products: true } } } });
  log('total categories', cats.length);
  log('categories with 0 products', cats.filter((c) => c._count.products === 0).length);
  log('categories with local /images/ image', cats.filter((c) => (c.image || '').startsWith('/images/')).length);
  const emptyCats = cats.filter((c) => c._count.products === 0).slice(0, 10).map((c) => c.slug);
  log('  sample empty', emptyCats.join(', '));

  console.log('\n=== BANNERS ===');
  const banners = await prisma.banner.findMany();
  log('total banners', banners.length);
  log('active banners', banners.filter((b) => b.isActive).length);
  log('banners with local /images/ url', banners.filter((b) => (b.imageUrl || '').startsWith('/images/')).length);
  for (const b of banners.slice(0, 5)) log(`  ${b.title?.slice(0, 30)}`, `active=${b.isActive} img=${(b.imageUrl || '').slice(0, 40)}`);

  console.log('\n=== HOMEPAGE SECTIONS (legacy) ===');
  const hps = await prisma.homepageSection.findMany();
  log('total sections', hps.length);
  for (const s of hps) log(`  ${s.key || s.id}`, `type=${s.type || '?'} active=${s.isActive}`);

  console.log('\n=== SECTION CURATION ===');
  const curations = await prisma.sectionCuration.findMany({
    include: { _count: { select: { products: true } } },
  });
  for (const c of curations) {
    log(`  ${c.pageKey}/${c.sectionKey}`, `${c._count.products} items · mode=${c.sourceMode} · maxItems=${c.maxItems} · active=${c.isActive}`);
  }

  console.log('\n=== PAGE SLOTS ===');
  const slots = await prisma.pageSlot.findMany();
  const byPage = slots.reduce<Record<string, { total: number; filled: number }>>((acc, s) => {
    const k = s.pageKey;
    if (!acc[k]) acc[k] = { total: 0, filled: 0 };
    acc[k].total += 1;
    if (s.assetId) acc[k].filled += 1;
    return acc;
  }, {});
  log('total slots', slots.length);
  log('slots with asset attached', slots.filter((s) => s.assetId).length);
  for (const [page, counts] of Object.entries(byPage).sort()) {
    log(`  ${page}`, `${counts.filled}/${counts.total}`);
  }

  console.log('\n=== DISCOUNTS / CAMPAIGNS ===');
  const discounts = await prisma.discount.findMany();
  log('total discounts', discounts.length);
  log('active discounts', discounts.filter((d) => d.isActive).length);
  log('expired discounts', discounts.filter((d) => d.endsAt && d.endsAt < new Date()).length);
  const camps = await prisma.campaign.findMany({ include: { _count: { select: { products: true } } } });
  log('total campaigns', camps.length);
  for (const c of camps) log(`  ${c.slug}`, `active=${c.isActive} · ${c._count.products} products`);

  console.log('\n=== REVIEWS ===');
  const revs = await prisma.review.findMany();
  log('total reviews', revs.length);
  log('approved reviews', revs.filter((r) => r.isApproved).length);
  log('unapproved reviews (hidden from public)', revs.filter((r) => !r.isApproved).length);

  console.log('\n=== USERS / ORDERS / CART / WISHLIST ===');
  const [userCount, orderCount, cartCount, wishCount] = await Promise.all([
    prisma.user.count(),
    prisma.order.count(),
    prisma.cart.count(),
    prisma.wishlist.count(),
  ]);
  log('users', userCount);
  log('orders', orderCount);
  log('carts', cartCount);
  log('wishlists', wishCount);

  console.log('\n=== SHIPPING ===');
  const zones = await prisma.shippingZone.findMany({ include: { rates: true } });
  log('shipping zones', zones.length);
  for (const z of zones) log(`  ${z.name}`, `${z.rates.length} rates · active=${z.isActive}`);

  console.log('\n=== MEDIA ASSETS ===');
  const assets = await prisma.mediaAsset.count();
  log('total assets uploaded', assets);

  console.log('\n=== ORPHAN / REFERENTIAL INTEGRITY ===');
  const orphanSectionProducts = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "SectionProduct" sp
    WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = sp."productId")
  `;
  log('orphan SectionProduct rows', orphanSectionProducts[0]?.c ?? 0);

  const orphanCartItems = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "CartItem" ci
    WHERE NOT EXISTS (SELECT 1 FROM "ProductVariant" v WHERE v.id = ci."variantId")
  `;
  log('orphan CartItem rows', orphanCartItems[0]?.c ?? 0);

  const orphanWishlistItems = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*)::bigint AS c FROM "WishlistItem" wi
    WHERE NOT EXISTS (SELECT 1 FROM "Product" p WHERE p.id = wi."productId")
  `;
  log('orphan WishlistItem rows', orphanWishlistItems[0]?.c ?? 0);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
