-- LR-001 Phase 1 Slice 3: cart lines can be either a variant OR a bundle.
--
-- CartItem gains nullable bundleId + bundleSize columns paired with an FK
-- to ProductBundle. variantId + productId become nullable so a bundle
-- line can exist without referencing a variant. A line-kind CHECK
-- constraint guarantees exactly one of (variantId, bundleId) is set per
-- row, and that bundleSize is set when bundleId is set.
--
-- The existing UNIQUE (cartId, variantId) index continues to work for
-- variant lines (PostgreSQL treats NULL as distinct, so multiple bundle
-- lines with NULL variantId in the same cart coexist without
-- collision). A separate partial unique index covers bundle lines so a
-- cart cannot hold two rows of the same (bundleId, bundleSize).
--
-- Live data treatment: 0 existing Cart + 0 existing CartItem rows
-- (verified before applying) — the nullability relaxation is
-- behaviorally a no-op against current state.

BEGIN;

-- 1. Relax NOT NULL on productId + variantId so bundle lines can exist.
ALTER TABLE "CartItem" ALTER COLUMN "productId" DROP NOT NULL;

-- Drop + recreate variantId FK so its column can change nullability.
ALTER TABLE "CartItem" DROP CONSTRAINT "CartItem_variantId_fkey";
ALTER TABLE "CartItem" ALTER COLUMN "variantId" DROP NOT NULL;
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_variantId_fkey"
  FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id")
  ON DELETE RESTRICT;

-- 2. Add the bundle-line columns.
ALTER TABLE "CartItem"
  ADD COLUMN "bundleId"   TEXT,
  ADD COLUMN "bundleSize" TEXT,
  ADD CONSTRAINT "CartItem_bundleId_fkey"
    FOREIGN KEY ("bundleId") REFERENCES "ProductBundle"("id")
    ON DELETE CASCADE;

-- 3. Enforce exactly-one line-kind per row.
ALTER TABLE "CartItem"
  ADD CONSTRAINT "CartItem_line_kind_check"
  CHECK (
    ("variantId" IS NOT NULL AND "bundleId" IS NULL AND "bundleSize" IS NULL)
    OR
    ("variantId" IS NULL AND "bundleId" IS NOT NULL AND "bundleSize" IS NOT NULL)
  );

-- 4. Partial unique index for bundle lines. Prisma's DSL does not express
--    partial unique indexes, so this index is managed at the SQL layer.
--    The service uses findFirst() for bundle-line lookups; no Prisma
--    findUnique compound type is exposed for this index.
CREATE UNIQUE INDEX "CartItem_cartId_bundleId_bundleSize_key"
  ON "CartItem" ("cartId", "bundleId", "bundleSize")
  WHERE "bundleId" IS NOT NULL;

-- 5. Plain index on bundleId speeds bundle-deletion cascades + admin
--    lookups for "carts containing bundle X".
CREATE INDEX "CartItem_bundleId_idx" ON "CartItem" ("bundleId");

COMMIT;
