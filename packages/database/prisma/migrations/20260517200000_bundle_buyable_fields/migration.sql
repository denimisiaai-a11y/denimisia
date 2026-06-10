-- LR-001: make bundles buyable (Option A — bundle as its own deal package).
--
-- Adds the three fields needed for the bundle-as-product checkout path:
--   ProductBundle.bundlePrice    Int      -- price in cents (admin sets)
--   ProductBundle.availableSizes Text[]   -- sizes the customer picks from
--   BundleItem.color             Text     -- pinned color of this product
--
-- Also relaxes the BundleItem unique constraint from (bundleId, productId)
-- to (bundleId, productId, color) so a single bundle can include the same
-- product in two different colors if desired (e.g. one Black Tee + one
-- White Tee). And drops the unused ProductBundle.deletedAt column +
-- @@index([deletedAt]) — declared since 2026-04 but never written or read
-- (BundlesService.delete cascades through bundleItem.deleteMany +
-- productBundle.delete, i.e. hard delete is the implementation).
--
-- Data treatment: 4 existing seed bundles + 12 seed items predate Option A
-- and have no bundlePrice/availableSizes/color to migrate. Defaults make
-- the ALTERs safe; the same migration then deactivates every existing
-- bundle so they cannot show on the storefront with bogus prices (a
-- bundlePrice=0 bundle would display as free). Admin re-enables each
-- bundle in Phase 2C after filling in real values via the new UI.

BEGIN;

-- 1. Add the new ProductBundle columns with safe defaults.
ALTER TABLE "ProductBundle"
  ADD COLUMN "bundlePrice"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "availableSizes" TEXT[]  NOT NULL DEFAULT '{}';

-- 2. Add the BundleItem.color column with safe default.
ALTER TABLE "BundleItem"
  ADD COLUMN "color" TEXT NOT NULL DEFAULT '';

-- 3. Swap the BundleItem unique index from (bundleId, productId) to
--    (bundleId, productId, color). Prisma's @@unique creates a UNIQUE INDEX
--    (not a CONSTRAINT), so DROP INDEX / CREATE UNIQUE INDEX is the right
--    pair. Existing 12 rows all have color='' from the default above, so
--    each (bundleId, productId, '') tuple is still unique (no possible
--    collision because the old constraint forbade duplicate (bundleId,
--    productId) pairs).
DROP INDEX "BundleItem_bundleId_productId_key";
CREATE UNIQUE INDEX "BundleItem_bundleId_productId_color_key"
  ON "BundleItem" ("bundleId", "productId", "color");

-- 4. Deactivate every existing bundle. The 4 seed bundles now hold
--    placeholder values for the buyable fields (price=0, sizes={},
--    item colors=''). Surfacing them on the storefront in this state
--    would be wrong. Admin reactivates each one after rebuilding it
--    via the new admin UI in Phase 2C.
UPDATE "ProductBundle" SET "isActive" = false;

-- 5. Drop the unused deletedAt column + its index from ProductBundle.
DROP INDEX IF EXISTS "ProductBundle_deletedAt_idx";
ALTER TABLE "ProductBundle" DROP COLUMN IF EXISTS "deletedAt";

COMMIT;
