-- Guest checkout support: lets customers complete an order without an
-- account. The customer-detail capture moves from the User row to three
-- new optional columns directly on Order. A CHECK constraint enforces
-- "either userId OR the full guest tuple" so the API can't accidentally
-- create an order with neither owner nor reachable contact.
--
-- LR-001 amendment C2 (verified-email-attach flow) is service-layer work
-- that runs on top of this schema; no additional DB changes required for
-- the attach itself (it just updates userId + clears the guest_* fields).

BEGIN;

-- 1. Drop the existing foreign key so we can change the column nullability.
ALTER TABLE "Order" DROP CONSTRAINT "Order_userId_fkey";

-- 2. Relax userId to nullable. Existing rows keep their userId; new guest
--    orders write NULL here and populate the guest_* fields instead.
ALTER TABLE "Order" ALTER COLUMN "userId" DROP NOT NULL;

-- 3. Recreate the FK with the same ON DELETE behavior (RESTRICT — never
--    let a user with orders be hard-deleted; we soft-delete instead).
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

-- 4. Add the guest-contact tuple. All three are paired with the CHECK
--    constraint below; a single missing piece would let an order ship to
--    nowhere with no way to reach the customer.
ALTER TABLE "Order"
  ADD COLUMN "guestEmail" TEXT,
  ADD COLUMN "guestName"  TEXT,
  ADD COLUMN "guestPhone" TEXT;

-- 5. Enforce "must be either a user OR a complete guest tuple" at the
--    DB layer so misuse from any service path (including future bulk
--    inserts or scripts) cannot create an orphan order.
ALTER TABLE "Order"
  ADD CONSTRAINT "Order_owner_check"
  CHECK (
    ("userId" IS NOT NULL)
    OR (
      "guestEmail" IS NOT NULL
      AND "guestName"  IS NOT NULL
      AND "guestPhone" IS NOT NULL
    )
  );

-- 6. Partial index on guestEmail so the "attach prior guest orders after
--    verified signup" flow (LR-001 amendment C2) can find candidate rows
--    in O(log n).
CREATE INDEX "Order_guestEmail_idx"
  ON "Order" ("guestEmail")
  WHERE "guestEmail" IS NOT NULL;

-- 7. AuditLog.userId becomes nullable so events from guest-order paths
--    can still write an audit row (userId = NULL, with entity/entityId
--    pointing at the order). Without this, guest order creation/cancel
--    events would be silently dropped by order.listener.ts.
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";
ALTER TABLE "AuditLog" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT;

COMMIT;
