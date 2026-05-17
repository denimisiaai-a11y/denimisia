-- Rollback for 20260517200000_bundle_buyable_fields.
--
-- WARNING: this rollback discards real bundlePrice + availableSizes + color
-- data that admin may have entered since the forward migration. Export first
-- if the data must be preserved:
--   COPY "ProductBundle" ("id", "bundlePrice", "availableSizes")
--     TO '/tmp/bundle_buyable_backup.csv' CSV HEADER;
--   COPY "BundleItem"    ("id", "bundleId", "productId", "color")
--     TO '/tmp/bundleitem_buyable_backup.csv' CSV HEADER;
--
-- Pre-check: the rollback restores the old (bundleId, productId) unique
-- constraint. If admin has used the new same-product-different-color
-- feature, BundleItem will contain (bundleId, productId, *) duplicates
-- that violate the restored constraint. Dedup first:
--   DELETE FROM "BundleItem" a USING "BundleItem" b
--     WHERE a."bundleId" = b."bundleId"
--       AND a."productId" = b."productId"
--       AND a."id" > b."id";
--
-- The isActive=false sweep from the forward migration is NOT auto-reversed.
-- Pre-migration state was "every bundle active"; restore manually if needed:
--   UPDATE "ProductBundle" SET "isActive" = true;

BEGIN;

-- 1. Restore the deletedAt column + its index.
ALTER TABLE "ProductBundle" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "ProductBundle_deletedAt_idx" ON "ProductBundle" ("deletedAt");

-- 2. Restore the (bundleId, productId) unique index.
DROP INDEX IF EXISTS "BundleItem_bundleId_productId_color_key";
CREATE UNIQUE INDEX "BundleItem_bundleId_productId_key"
  ON "BundleItem" ("bundleId", "productId");

-- 3. Drop the BundleItem.color column.
ALTER TABLE "BundleItem" DROP COLUMN IF EXISTS "color";

-- 4. Drop the new ProductBundle columns.
ALTER TABLE "ProductBundle"
  DROP COLUMN IF EXISTS "availableSizes",
  DROP COLUMN IF EXISTS "bundlePrice";

COMMIT;
