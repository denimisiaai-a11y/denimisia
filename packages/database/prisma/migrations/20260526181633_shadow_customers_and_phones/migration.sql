-- Shadow customer records + multi-phone schema migration.
--
-- ⚠️  This SQL is NOT applied automatically. Per the project's no-local-DB
--    workflow, it is applied to production via `prisma db execute` as the
--    first step of the deploy task (plan Task 17.1). Code that uses the new
--    schema must be deployed within minutes of this migration applying, or
--    the prod API will fail user-touching queries that still reference
--    `user.phone`.
--
-- See the shadow-customer records design spec, section 4.3.

-- 1. Add new nullable columns
ALTER TABLE "User" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "User" ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. Backfill: existing users with passwordHash are "claimed" (self-registered)
UPDATE "User"
  SET "claimedAt" = "createdAt"
  WHERE "claimedAt" IS NULL AND "passwordHash" IS NOT NULL;

-- 3. Backfill: copy phone -> phones[]
UPDATE "User"
  SET "phones" = ARRAY["phone"]
  WHERE "phone" IS NOT NULL AND cardinality("phones") = 0;

-- 4. Relax passwordHash, drop old phone column
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" DROP COLUMN "phone";

-- 5. GIN index for phone-array lookups (faster than btree for ANY queries)
CREATE INDEX "User_phones_gin_idx" ON "User" USING GIN ("phones");
