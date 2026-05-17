-- Rollback for 20260516120000_bulk_operations_foundation.
-- Reverses every statement in migration.sql.
--
-- Apply order if rolling back multiple migrations: run THIS file AFTER
-- the rollbacks for any migrations that were applied LATER than this one
-- (currently 20260517100000_product_placement_flags and
-- 20260517110000_product_placement_index_reorder). Prisma does not
-- auto-apply rollback SQL; run it manually with `psql` against the target
-- DB and then `prisma migrate resolve --rolled-back <migration_name>` to
-- update _prisma_migrations.

BEGIN;

-- 1. BulkOperationOutbox table + its indexes.
DROP INDEX IF EXISTS "BulkOperationOutbox_adminUserId_createdAt_idx";
DROP INDEX IF EXISTS "BulkOperationOutbox_state_expiresAt_idx";
DROP INDEX IF EXISTS "BulkOperationOutbox_undoToken_key";
DROP TABLE IF EXISTS "BulkOperationOutbox";

-- 2. The enum used by the table above.
DROP TYPE IF EXISTS "BulkOperationOutboxState";

-- 3. ProductBundle soft-delete addition.
DROP INDEX IF EXISTS "ProductBundle_deletedAt_idx";
ALTER TABLE "ProductBundle" DROP COLUMN IF EXISTS "deletedAt";

COMMIT;
