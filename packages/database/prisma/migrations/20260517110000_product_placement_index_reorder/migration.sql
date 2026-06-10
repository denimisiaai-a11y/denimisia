-- Reorder composite placement indexes from (flag, isActive) to
-- (isActive, flag). The new order lets the same index serve queries that
-- filter only on isActive (e.g. findAll, getSlugFeed) in addition to the
-- (isActive=true AND flag=true) section queries. Postgres can use a
-- composite index for prefix-matching column lookups, so the leading
-- column needs to be the one shared across query patterns.
--
-- Note on CONCURRENTLY: Prisma migrate wraps each migration in a single
-- transaction, and CREATE/DROP INDEX CONCURRENTLY cannot run inside one.
-- Index recreation here takes a brief AccessExclusiveLock; acceptable at
-- current product-table scale (sub-thousand rows). At larger scale, split
-- the index work into a separately-applied SQL script and run with the
-- transaction off.

DROP INDEX IF EXISTS "Product_isTrending_isActive_idx";
DROP INDEX IF EXISTS "Product_isNewArrival_isActive_idx";

CREATE INDEX "Product_isActive_isTrending_idx"
  ON "Product" ("isActive", "isTrending");

CREATE INDEX "Product_isActive_isNewArrival_idx"
  ON "Product" ("isActive", "isNewArrival");
