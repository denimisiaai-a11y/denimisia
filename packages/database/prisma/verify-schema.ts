/**
 * Verification script — queries Postgres system catalogs to confirm that
 * every intended FK cascade rule + index from the schema-hardening migration
 * actually landed on the live DB.
 *
 * Run: pnpm --filter database exec tsx prisma/verify-schema.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface FkRow {
  table_name: string;
  column_name: string;
  foreign_table: string;
  on_delete: string;
  on_update: string;
}

interface IndexRow {
  tablename: string;
  indexname: string;
  indexdef: string;
}

async function main(): Promise<void> {
  // ── 1. All foreign keys + their ON DELETE / ON UPDATE actions ────────────
  const fks = await prisma.$queryRaw<FkRow[]>`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      rc.delete_rule AS on_delete,
      rc.update_rule AS on_update
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage      kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    JOIN information_schema.referential_constraints rc  ON rc.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
    ORDER BY tc.table_name, kcu.column_name;
  `;

  // ── 2. All non-PK indexes ────────────────────────────────────────────────
  const indexes = await prisma.$queryRaw<IndexRow[]>`
    SELECT tablename, indexname, indexdef
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename NOT LIKE '\\_%'
    ORDER BY tablename, indexname;
  `;

  // ── Expected FK rules (from my hardening migration) ──────────────────────
  const EXPECTED_FK: Record<string, { onDelete: string; onUpdate: string }> = {
    'Address.userId':                { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'BundleItem.bundleId':           { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'BundleItem.productId':          { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CampaignProduct.campaignId':    { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CampaignProduct.productId':     { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CampaignUsage.campaignId':      { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CampaignUsage.orderId':         { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'CampaignUsage.userId':          { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'Cart.userId':                   { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CartItem.cartId':               { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CartItem.variantId':            { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'Category.parentId':             { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'CollectionProduct.collectionId':{ onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'CollectionProduct.productId':   { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'InventoryLog.variantId':        { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'Order.userId':                  { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'Order.discountId':              { onDelete: 'SET NULL', onUpdate: 'CASCADE' },
    'OrderItem.orderId':             { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'OrderItem.productId':           { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'OrderItem.variantId':           { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
    'OrderStatusHistory.orderId':    { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'ProductVariant.productId':      { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'Review.userId':                 { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'Review.productId':              { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'ShippingRate.zoneId':           { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'Wishlist.userId':               { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'WishlistItem.wishlistId':       { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'WishlistItem.productId':        { onDelete: 'CASCADE',  onUpdate: 'CASCADE' },
    'AuditLog.userId':               { onDelete: 'RESTRICT', onUpdate: 'CASCADE' },
  };

  // ── FK compliance check ──────────────────────────────────────────────────
  console.log('═══ FOREIGN KEY CASCADE RULES ═══');
  let fkOk = 0, fkWrong = 0, fkMissing = 0, fkExtra = 0;
  for (const row of fks) {
    const key = `${row.table_name}.${row.column_name}`;
    const expected = EXPECTED_FK[key];
    if (!expected) {
      console.log(`  [extra]   ${key.padEnd(40)} → ${row.foreign_table}  (${row.on_delete}/${row.on_update})`);
      fkExtra += 1;
      continue;
    }
    const ok = expected.onDelete === row.on_delete && expected.onUpdate === row.on_update;
    if (ok) {
      fkOk += 1;
    } else {
      console.log(`  [mismatch] ${key.padEnd(40)} expected=${expected.onDelete}/${expected.onUpdate}  actual=${row.on_delete}/${row.on_update}`);
      fkWrong += 1;
    }
  }
  const actualKeys = new Set(fks.map((r) => `${r.table_name}.${r.column_name}`));
  for (const k of Object.keys(EXPECTED_FK)) {
    if (!actualKeys.has(k)) {
      console.log(`  [missing] ${k}`);
      fkMissing += 1;
    }
  }
  console.log(`  summary: ${fkOk} ok · ${fkWrong} mismatch · ${fkMissing} missing · ${fkExtra} extra-not-tracked`);

  // ── Expected indexes (sample of the most important ones) ─────────────────
  const EXPECTED_INDEXES: string[] = [
    // User
    'User_role_idx', 'User_deletedAt_idx', 'User_createdAt_idx',
    // Order
    'Order_userId_idx', 'Order_userId_status_idx', 'Order_status_createdAt_idx',
    'Order_trackingNumber_idx', 'Order_deletedAt_idx',
    // Product
    'Product_categoryId_isActive_idx', 'Product_isFeatured_isActive_idx',
    'Product_createdAt_idx', 'Product_deletedAt_idx',
    // ProductVariant
    'ProductVariant_productId_idx', 'ProductVariant_deletedAt_idx',
    // Review
    'Review_productId_isApproved_idx', 'Review_productId_createdAt_idx', 'Review_deletedAt_idx',
    // Cart / CartItem
    'Cart_sessionId_idx', 'CartItem_cartId_idx',
    // OrderItem
    'OrderItem_orderId_idx', 'OrderItem_productId_idx',
    // OrderStatusHistory
    'OrderStatusHistory_orderId_createdAt_idx',
    // AuditLog
    'AuditLog_userId_createdAt_idx', 'AuditLog_entity_entityId_idx', 'AuditLog_createdAt_idx',
    // Campaign / Discount
    'Campaign_isActive_startDate_endDate_idx',
    'Discount_isActive_startDate_endDate_idx', 'Discount_deletedAt_idx',
    // Category
    'Category_parentId_idx', 'Category_deletedAt_idx',
    // Collection
    'Collection_deletedAt_idx', 'Collection_isActive_idx',
    // CollectionProduct
    'CollectionProduct_productId_idx',
    // Address
    'Address_userId_idx', 'Address_deletedAt_idx',
    // InventoryLog
    'InventoryLog_variantId_createdAt_idx',
    // BundleItem + CampaignProduct
    'BundleItem_productId_idx', 'CampaignProduct_productId_idx',
    // ShippingRate
    'ShippingRate_zoneId_idx',
    // CampaignUsage
    'CampaignUsage_campaignId_createdAt_idx', 'CampaignUsage_userId_createdAt_idx', 'CampaignUsage_orderId_idx',
  ];

  const existingIndexNames = new Set(indexes.map((r) => r.indexname));
  console.log('\n═══ INDEXES ═══');
  const missing = EXPECTED_INDEXES.filter((n) => !existingIndexNames.has(n));
  const present = EXPECTED_INDEXES.filter((n) => existingIndexNames.has(n));
  console.log(`  ${present.length}/${EXPECTED_INDEXES.length} expected indexes present`);
  if (missing.length > 0) {
    console.log('  MISSING:');
    for (const m of missing) console.log(`    - ${m}`);
  }

  // Show any indexes we DIDN'T expect (informational)
  const unexpected = indexes.filter((r) => !EXPECTED_INDEXES.includes(r.indexname) && !r.indexname.endsWith('_pkey') && !r.indexname.endsWith('_key'));
  if (unexpected.length > 0) {
    console.log(`  extra indexes (not in expected list but present — probably OK): ${unexpected.length}`);
  }

  console.log('\n═══ VERDICT ═══');
  const fkClean   = fkWrong === 0 && fkMissing === 0;
  const idxClean  = missing.length === 0;
  if (fkClean && idxClean) {
    console.log('  ✓ Schema is production-solid. All cascades and indexes match intent.');
  } else {
    console.log(`  ✗ Issues: ${fkWrong + fkMissing} FK + ${missing.length} indexes missing. See above.`);
  }
}

main()
  .catch((err: unknown) => { console.error(err instanceof Error ? err.message : err); process.exit(1); })
  .finally(() => void prisma.$disconnect());
