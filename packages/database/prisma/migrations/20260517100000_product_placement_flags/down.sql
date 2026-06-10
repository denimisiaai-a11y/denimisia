-- Rollback for 20260517100000_product_placement_flags.
-- Reverses every statement in migration.sql.
--
-- Apply order if rolling back multiple migrations: run the rollback for
-- 20260517110000_product_placement_index_reorder FIRST (it depends on the
-- columns this migration adds). Then run this file.

BEGIN;

-- 1. Composite indexes added by this migration (may have been replaced
--    by 20260517110000_product_placement_index_reorder; use IF EXISTS).
DROP INDEX IF EXISTS "Product_isTrending_isActive_idx";
DROP INDEX IF EXISTS "Product_isNewArrival_isActive_idx";

-- 2. Columns added by this migration.
ALTER TABLE "Product" DROP COLUMN IF EXISTS "showStarBadge";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "isNewArrival";
ALTER TABLE "Product" DROP COLUMN IF EXISTS "isTrending";

COMMIT;
