-- CreateEnum
CREATE TYPE "BulkOperationOutboxState" AS ENUM ('PENDING', 'APPLIED', 'UNDONE', 'EXPIRED');

-- AlterTable: ProductBundle gets soft-delete support to match the other
-- catalog tables (Product, Collection, Category, Review).
ALTER TABLE "ProductBundle" ADD COLUMN "deletedAt" TIMESTAMP(3);
CREATE INDEX "ProductBundle_deletedAt_idx" ON "ProductBundle"("deletedAt");

-- CreateTable: BulkOperationOutbox tracks reversible bulk admin writes for
-- the 30-second undo window and forward-replay on partial failure.
CREATE TABLE "BulkOperationOutbox" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "undoToken" TEXT NOT NULL,
    "state" "BulkOperationOutboxState" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BulkOperationOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BulkOperationOutbox_undoToken_key" ON "BulkOperationOutbox"("undoToken");
-- (state, expiresAt) serves the cleanup sweeper: WHERE state='PENDING' AND expiresAt < now().
CREATE INDEX "BulkOperationOutbox_state_expiresAt_idx" ON "BulkOperationOutbox"("state", "expiresAt");
-- (adminUserId, createdAt) serves "my recent undoable ops" in the admin UI.
CREATE INDEX "BulkOperationOutbox_adminUserId_createdAt_idx" ON "BulkOperationOutbox"("adminUserId", "createdAt");

-- NOTE: An earlier draft of this migration added partial indexes
-- `ON (id) WHERE deletedAt IS NULL` on Product/ProductBundle/Collection/
-- Category/Review. Dropped because indexing the primary key column alone is
-- near-useless — the PK index already serves PK lookups, and the partial
-- index only helps `SELECT id WHERE deletedAt IS NULL` count/exists queries
-- which aren't a hot path here. Re-add targeted partial indexes on the
-- actual sort/filter columns (e.g. `(updatedAt) WHERE deletedAt IS NULL`)
-- when a specific bulk query is measured to need one.

-- NOTE: This migration uses plain CREATE INDEX (not CONCURRENTLY) because
-- Prisma's migration runner doesn't support concurrent index creation. On
-- the pre-launch dev DB the table is small enough that the brief
-- ACCESS EXCLUSIVE lock is invisible. For post-launch index changes against
-- a populated production DB, hand-run CREATE INDEX CONCURRENTLY and mark
-- the migration as applied via `prisma migrate resolve`.
