-- Product placement flags: surface flags admins set per-product to control
-- where the product appears on the storefront.
--
-- isTrending     → Trending row on homepage
-- isNewArrival   → New Arrivals row on homepage (replaces createdAt-only logic)
-- showStarBadge  → Renders a "★" badge on the product card

ALTER TABLE "Product"
  ADD COLUMN "isTrending"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isNewArrival"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showStarBadge" BOOLEAN NOT NULL DEFAULT false;

-- Partial indexes are not used here because the queries filter on
-- (flag, isActive) — composite indexes match better and stay useful even
-- when a flag is later flipped off on many rows.
CREATE INDEX "Product_isTrending_isActive_idx"
  ON "Product" ("isTrending", "isActive");

CREATE INDEX "Product_isNewArrival_isActive_idx"
  ON "Product" ("isNewArrival", "isActive");
