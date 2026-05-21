-- ─── CMS Section Composer ────────────────────────────────────────────────────
-- Replaces the unused HomepageSection table with a real section-instance model.
-- Adds the section type enum and a singleton row for global storefront styles.

-- 1. Section type enum
CREATE TYPE "HomepageSectionType" AS ENUM (
  'HERO',
  'CATEGORY_CARDS',
  'NEW_ARRIVALS',
  'EDITORIAL_BANNER',
  'BUNDLE_DEALS',
  'TRENDING',
  'BESTSELLERS',
  'BRAND_STORY'
);

-- 2. Drop the obsolete table
DROP TABLE IF EXISTS "HomepageSection";

-- 3. Section instance table
CREATE TABLE "HomepageSectionInstance" (
  "id"        TEXT NOT NULL,
  "type"      "HomepageSectionType" NOT NULL,
  "position"  INTEGER NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "config"    JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HomepageSectionInstance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomepageSectionInstance_position_idx"
  ON "HomepageSectionInstance"("position");

CREATE INDEX "HomepageSectionInstance_isActive_position_idx"
  ON "HomepageSectionInstance"("isActive", "position");

-- 4. Seed the 8 default sections matching the current hard-coded homepage order.
INSERT INTO "HomepageSectionInstance" ("id", "type", "position", "isActive", "config", "createdAt", "updatedAt") VALUES
  ('seed-hero',              'HERO',              0, true, '{}'::jsonb, NOW(), NOW()),
  ('seed-category-cards',    'CATEGORY_CARDS',    1, true, '{}'::jsonb, NOW(), NOW()),
  ('seed-new-arrivals',      'NEW_ARRIVALS',      2, true, '{"title":"New Arrivals","limit":17}'::jsonb, NOW(), NOW()),
  ('seed-editorial-banner',  'EDITORIAL_BANNER',  3, true, '{"slotGroupKey":"home.editorial"}'::jsonb, NOW(), NOW()),
  ('seed-bundle-deals',      'BUNDLE_DEALS',      4, true, '{"title":"Bundle Deals","limit":4}'::jsonb, NOW(), NOW()),
  ('seed-trending',          'TRENDING',          5, true, '{"title":"Trending","limit":8}'::jsonb, NOW(), NOW()),
  ('seed-bestsellers',       'BESTSELLERS',       6, true, '{"title":"Bestsellers"}'::jsonb, NOW(), NOW()),
  ('seed-brand-story',       'BRAND_STORY',       7, true, '{}'::jsonb, NOW(), NOW());

-- 5. Global storefront styles singleton
CREATE TABLE "GlobalStorefrontStyles" (
  "id"              TEXT NOT NULL DEFAULT 'singleton',
  "negativeSpace"   INTEGER NOT NULL DEFAULT 1,
  "typographyFlow"  INTEGER NOT NULL DEFAULT 1,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GlobalStorefrontStyles_pkey" PRIMARY KEY ("id")
);

INSERT INTO "GlobalStorefrontStyles" ("id", "negativeSpace", "typographyFlow", "updatedAt")
VALUES ('singleton', 1, 1, NOW());
