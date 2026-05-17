-- Rollback for 20260517150000_guest_checkout_support.
-- Reverses every statement in migration.sql in reverse order.
--
-- WARNING: this rollback fails if there are any rows with userId IS NULL.
-- Before applying, attach orphan guest orders to a user account (e.g. a
-- system-owned "abandoned" user) or hard-delete them, otherwise the
-- "ALTER COLUMN ... SET NOT NULL" will throw 23502.
--
-- Suggested data-migration before this rollback runs:
--   UPDATE "Order"
--     SET "userId" = (SELECT id FROM "User" WHERE email = 'system@denimisia.com')
--     WHERE "userId" IS NULL;

BEGIN;

-- 1. Drop the guestEmail index.
DROP INDEX IF EXISTS "Order_guestEmail_idx";

-- 2. Drop the owner-check constraint.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_owner_check";

-- 3. Drop the guest-contact columns.
ALTER TABLE "Order"
  DROP COLUMN IF EXISTS "guestPhone",
  DROP COLUMN IF EXISTS "guestName",
  DROP COLUMN IF EXISTS "guestEmail";

-- 4. Restore NOT NULL on Order.userId (data-migration prerequisite — see
--    header).
ALTER TABLE "Order" ALTER COLUMN "userId" SET NOT NULL;

-- The Order_userId_fkey constraint stays untouched: it was re-created in
-- the forward migration with the same ON DELETE behavior, so no flip is
-- needed here.

-- 5. Restore NOT NULL on AuditLog.userId (same caveat: any rows with
--    userId IS NULL from the guest-order audit path must be remapped or
--    deleted first).
ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

COMMIT;
