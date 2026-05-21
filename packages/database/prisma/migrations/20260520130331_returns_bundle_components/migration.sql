-- Add per-component bundle return tracking columns to ReturnItem.
-- All four columns are nullable; they are populated only when the row
-- represents a returned constituent of a bundle line (i.e. the source
-- OrderItem has bundleId set). Snapshot fields are denormalized from
-- OrderItem.snapshot.items[] at write time so that later edits to the
-- bundle catalog cannot retroactively alter the return record.
--
-- Invariants enforced in the service layer (no DB CHECK constraint):
--   * If OrderItem.bundleId IS NULL → all four columns MUST be NULL.
--   * If OrderItem.bundleId IS NOT NULL → bundleComponentVariantId MUST be
--     set and MUST match one of OrderItem.snapshot.items[].variantId.

ALTER TABLE "ReturnItem"
  ADD COLUMN "bundleComponentVariantId" TEXT,
  ADD COLUMN "bundleComponentName" TEXT,
  ADD COLUMN "bundleComponentSize" TEXT,
  ADD COLUMN "bundleComponentColor" TEXT;
