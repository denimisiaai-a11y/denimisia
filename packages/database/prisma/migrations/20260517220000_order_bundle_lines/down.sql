-- Rollback for 20260517220000_order_bundle_lines.
--
-- WARNING: any OrderItem row representing a bundle line (variantId IS NULL
-- and bundleId IS NOT NULL) cannot fit the pre-migration schema. Refusing
-- to silently drop order history. Delete or rewire those rows manually
-- before running this rollback:
--   SELECT id, "orderId", "bundleId" FROM "OrderItem" WHERE "variantId" IS NULL;
--
-- Also true for any OrderItem row with productId IS NULL (only possible if
-- a bundle line was somehow created without the matching CHECK).

BEGIN;

-- 1. Drop bundle-related index + constraints.
DROP INDEX IF EXISTS "OrderItem_bundleId_idx";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_line_kind_check";
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_bundleId_fkey";

-- 2. Drop the bundle columns.
ALTER TABLE "OrderItem"
  DROP COLUMN IF EXISTS "bundleSize",
  DROP COLUMN IF EXISTS "bundleId";

-- 3. Restore NOT NULL on variantId + productId.
ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_variantId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" SET NOT NULL;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT;

ALTER TABLE "OrderItem" DROP CONSTRAINT IF EXISTS "OrderItem_productId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "productId" SET NOT NULL;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT;

COMMIT;
