-- Add Order.orderNumber: customer-facing identifier `DEN-NNNNNN`.
--
-- Three-step migration so existing rows do not violate NOT NULL:
--   1. ADD COLUMN nullable so the ALTER TABLE itself does not fail.
--   2. Backfill every row deterministically via a windowed sequence
--      ordered by (createdAt ASC, id ASC). Ordering by id breaks the
--      tie for two rows created in the same millisecond so re-running
--      this migration on a freshly restored dump always produces the
--      same numbers.
--   3. Promote the column to NOT NULL and add the UNIQUE constraint
--      (which also creates the supporting btree index).

-- Step 1: nullable column.
ALTER TABLE "Order" ADD COLUMN "orderNumber" TEXT;

-- Step 2: deterministic backfill.
WITH numbered AS (
  SELECT
    "id",
    'DEN-' || LPAD(
      (ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC))::text,
      6,
      '0'
    ) AS "new_order_number"
  FROM "Order"
)
UPDATE "Order" o
SET "orderNumber" = n."new_order_number"
FROM numbered n
WHERE o."id" = n."id";

-- Step 3: enforce constraints.
ALTER TABLE "Order" ALTER COLUMN "orderNumber" SET NOT NULL;
ALTER TABLE "Order" ADD CONSTRAINT "Order_orderNumber_key" UNIQUE ("orderNumber");
