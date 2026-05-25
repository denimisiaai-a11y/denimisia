import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

interface Snapshot {
  // Product-side (everything below will be wiped to zero)
  products: number;
  variants: number;
  inventoryLogs: number;
  orderItems: number;
  orders: number;
  orderStatusHistory: number;
  campaignUsages: number;
  refundTransactions: number;
  returns: number;
  returnItems: number;
  reviews: number;
  wishlistItems: number;
  cartItems: number;
  collProductLinks: number;
  sectionProductLinks: number;
  bundleItems: number;
  productTags: number;
  productSizeCharts: number;
  campaignProducts: number;

  // Preserved (must not change)
  categories: number;
  collections: number;
  sectionCurations: number;
  homepageSectionInstances: number;
  campaigns: number;
  banners: number;
  users: number;
  mediaAssets: number;
}

async function snapshot(): Promise<Snapshot> {
  const [
    products, variants, inventoryLogs, orderItems, orders, orderStatusHistory,
    campaignUsages, refundTransactions, returns, returnItems, reviews,
    wishlistItems, cartItems, collProductLinks, sectionProductLinks, bundleItems,
    productTags, productSizeCharts, campaignProducts,
    categories, collections, sectionCurations, homepageSectionInstances,
    campaigns, banners, users, mediaAssets,
  ] = await Promise.all([
    p.product.count(),
    p.productVariant.count(),
    p.inventoryLog.count(),
    p.orderItem.count(),
    p.order.count(),
    p.orderStatusHistory.count(),
    p.campaignUsage.count(),
    p.refundTransaction.count(),
    p.return.count(),
    p.returnItem.count(),
    p.review.count(),
    p.wishlistItem.count(),
    p.cartItem.count(),
    p.collectionProduct.count(),
    p.sectionProduct.count(),
    p.bundleItem.count(),
    p.productTag.count(),
    p.productSizeChart.count(),
    p.campaignProduct.count(),
    p.category.count(),
    p.collection.count(),
    p.sectionCuration.count(),
    p.homepageSectionInstance.count(),
    p.campaign.count(),
    p.banner.count(),
    p.user.count(),
    p.mediaAsset.count(),
  ]);
  return {
    products, variants, inventoryLogs, orderItems, orders, orderStatusHistory,
    campaignUsages, refundTransactions, returns, returnItems, reviews,
    wishlistItems, cartItems, collProductLinks, sectionProductLinks, bundleItems,
    productTags, productSizeCharts, campaignProducts,
    categories, collections, sectionCurations, homepageSectionInstances,
    campaigns, banners, users, mediaAssets,
  };
}

const PRODUCT_SIDE_KEYS = [
  'products', 'variants', 'inventoryLogs', 'orderItems', 'orders',
  'orderStatusHistory', 'campaignUsages', 'refundTransactions', 'returns',
  'returnItems', 'reviews', 'wishlistItems', 'cartItems', 'collProductLinks',
  'sectionProductLinks', 'bundleItems', 'productTags', 'productSizeCharts',
  'campaignProducts',
] as const;

const PRESERVED_KEYS = [
  'categories', 'collections', 'sectionCurations', 'homepageSectionInstances',
  'campaigns', 'banners', 'users', 'mediaAssets',
] as const;

async function main(): Promise<void> {
  console.log('--- Pre-purge snapshot ---');
  const before = await snapshot();
  console.log(JSON.stringify(before, null, 2));

  console.log('\nExecuting purge transaction (FK-safe order)...');
  await p.$transaction([
    // 1. Returns chain (must come before Orders + OrderItems)
    p.refundTransaction.deleteMany(),
    p.returnItem.deleteMany(),
    p.return.deleteMany(),
    // 2. Order-related dependents
    p.campaignUsage.deleteMany(),
    p.orderStatusHistory.deleteMany(),
    p.orderItem.deleteMany(),
    p.order.deleteMany(),
    // 3. Other product/variant references
    p.review.deleteMany(),
    p.wishlistItem.deleteMany(),
    p.cartItem.deleteMany(),
    p.collectionProduct.deleteMany(),
    p.sectionProduct.deleteMany(),
    p.bundleItem.deleteMany(),
    p.productTag.deleteMany(),
    p.productSizeChart.deleteMany(),
    p.campaignProduct.deleteMany(),
    p.inventoryLog.deleteMany(),
    // 4. Finally variants then products
    p.productVariant.deleteMany(),
    p.product.deleteMany(),
  ]);
  console.log('Purge committed.');

  console.log('\n--- Post-purge snapshot ---');
  const after = await snapshot();
  console.log(JSON.stringify(after, null, 2));

  console.log('\n--- Sanity checks ---');
  const stillThere = PRODUCT_SIDE_KEYS.filter((k) => after[k] !== 0);
  if (stillThere.length === 0) {
    console.log('OK -- all product-side tables empty.');
  } else {
    console.log(`PROBLEM -- non-zero after purge: ${stillThere.join(', ')}`);
    process.exit(1);
  }

  const lost = PRESERVED_KEYS.filter((k) => after[k] !== before[k]);
  if (lost.length === 0) {
    console.log('OK -- all preserved entities intact.');
  } else {
    console.log(`PROBLEM -- preserved entity rows changed: ${lost.join(', ')}`);
    process.exit(1);
  }
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
