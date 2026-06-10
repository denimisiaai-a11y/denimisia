-- Persist the per-variant hex color so the storefront can paint a solid
-- swatch instead of a tiny product photo on the PDP color selector. The
-- admin form has captured this value in local state since the product
-- create page shipped but it was never sent to the API. Optional so
-- existing variants without a chosen hex stay unchanged and fall back
-- to the legacy image swatch.
ALTER TABLE "ProductVariant" ADD COLUMN "colorHex" TEXT;
