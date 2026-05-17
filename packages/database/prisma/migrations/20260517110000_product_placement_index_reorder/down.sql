-- Rollback for 20260517110000_product_placement_index_reorder.
-- Reverses every statement in migration.sql.
--
-- Returns Product's placement indexes to the (flag, isActive) column order
-- introduced by 20260517100000_product_placement_flags.

BEGIN;

-- 1. Drop the new (isActive, flag) composite indexes.
DROP INDEX IF EXISTS "Product_isActive_isNewArrival_idx";
DROP INDEX IF EXISTS "Product_isActive_isTrending_idx";

-- 2. Recreate the prior (flag, isActive) indexes from
--    20260517100000_product_placement_flags.
CREATE INDEX "Product_isNewArrival_isActive_idx"
  ON "Product" ("isNewArrival", "isActive");

CREATE INDEX "Product_isTrending_isActive_idx"
  ON "Product" ("isTrending", "isActive");

COMMIT;
