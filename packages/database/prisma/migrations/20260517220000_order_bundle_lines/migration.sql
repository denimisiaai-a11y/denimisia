-- LR-001 Phase 1 Slice 4: order lines can be either a variant OR a bundle.
--
-- OrderItem mirrors the CartItem changes from Slice 3
-- (20260517210000_cart_bundle_lines): productId + variantId become
-- nullable; new nullable bundleId + bundleSize columns; line-kind CHECK
-- constraint enforces exactly-one-of (variantId, bundleId) and pairs
-- bundleSize with bundleId.
--
-- Bundle deletion is restricted (ON DELETE RESTRICT) — once a bundle is
-- in an order, deleting it would erase audit trail and break refund
-- accounting. Admin must deactivate (isActive=false) instead.
--
-- The OrderItem.snapshot Json column continues to capture point-in-time
-- data per line. For bundle lines, the service writes a snapshot with
-- per-constituent variantId + product/color/size so stock restore on
-- cancel/refund can walk the snapshot without re-reading the bundle
-- (which may have been edited or deactivated).
--
-- Live data: 0 existing Order + 0 existing OrderItem rows (verified
-- before applying), so the nullability relaxation is behaviorally a
-- no-op against current state.

BEGIN;

-- 1. Relax NOT NULL on productId + variantId so bundle lines can exist.
ALTER TABLE "OrderItem" ALTER COLUMN "productId" DROP NOT NULL;

-- Drop + recreate the productId FK so the column can change nullability.
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_productId_fkey";
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE RESTRICT;

ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_variantId_fkey";
ALTER TABLE "OrderItem" ALTER COLUMN "variantId" DROP NOT NULL;
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT;

-- 2. Add the bundle-line columns.
ALTER TABLE "OrderItem"
  ADD COLUMN "bundleId"   TEXT,
  ADD COLUMN "bundleSize" TEXT,
  ADD CONSTRAINT "OrderItem_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id")
    ON DELETE RESTRICT;

-- 3. Enforce exactly-one line-kind per row.
ALTER TABLE "OrderItem"
  ADD CONSTRAINT "OrderItem_line_kind_check"
  CHECK (
    ("variantId" IS NOT NULL AND "bundleId" IS NULL AND "bundleSize" IS NULL)
    OR
    ("variantId" IS NULL AND "bundleId" IS NOT NULL AND "bundleSize" IS NOT NULL)
  );

-- 4. Index on bundleId for admin "orders that included bundle X" queries
--    and to speed the RESTRICT cascade check on bundle deletion.
CREATE INDEX "OrderItem_bundleId_idx" ON "OrderItem" ("bundleId");

COMMIT;
