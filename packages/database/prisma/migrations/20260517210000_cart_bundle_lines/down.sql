-- Rollback for 20260517210000_cart_bundle_lines.
--
-- WARNING: bundle lines (CartItem rows with variantId IS NULL) cannot
-- migrate back to the variant-only schema. Delete them first if any
-- exist:
--   DELETE FROM "CartItem" WHERE "variantId" IS NULL;
--
-- The same applies to CartItem rows with productId IS NULL.

BEGIN;

-- 1. Drop the bundle-related indexes + constraints.
DROP INDEX IF EXISTS "CartItem_bundleId_idx";
DROP INDEX IF EXISTS "CartItem_cartId_bundleId_bundleSize_key";
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_line_kind_check";
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_bundleId_fkey";

-- 2. Drop the bundle columns.
ALTER TABLE "CartItem"
  DROP COLUMN IF EXISTS "bundleSize",
  DROP COLUMN IF EXISTS "bundleId";

-- 3. Restore NOT NULL on variantId + productId.
ALTER TABLE "CartItem" DROP CONSTRAINT IF EXISTS "CartItem_variantId_fkey";
ALTER TABLE "CartItem" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "CartItem" ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT;

COMMIT;
