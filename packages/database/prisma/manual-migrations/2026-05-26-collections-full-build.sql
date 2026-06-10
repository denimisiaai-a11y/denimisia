-- Collections Full Build — Schema Extension
-- 2026-05-26 — adds CollectionType/HeroLayout/CollectionSort enums,
-- extends Collection with type/visual/layout/schedule/SEO fields,
-- and creates CollectionLookbook table.
-- Idempotent: safe to re-run.

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "CollectionType" AS ENUM ('DROP', 'EDIT', 'AUTO', 'PROMO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HeroLayout" AS ENUM ('FULL_BLEED', 'SPLIT', 'VIDEO', 'MINIMAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CollectionSort" AS ENUM ('MANUAL', 'NEWEST', 'PRICE_ASC', 'PRICE_DESC', 'BESTSELLING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ─── COLLECTION TABLE ─────────────────────────────────────────────────────────

ALTER TABLE "Collection"
  ADD COLUMN IF NOT EXISTS "subtitle"            TEXT,
  ADD COLUMN IF NOT EXISTS "internalNote"        TEXT,
  ADD COLUMN IF NOT EXISTS "type"                "CollectionType" NOT NULL DEFAULT 'EDIT',
  ADD COLUMN IF NOT EXISTS "heroImageDesktop"    TEXT,
  ADD COLUMN IF NOT EXISTS "heroImageMobile"     TEXT,
  ADD COLUMN IF NOT EXISTS "heroVideo"           TEXT,
  ADD COLUMN IF NOT EXISTS "heroTextColor"       TEXT NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS "heroOverlay"         INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "heroAlign"           TEXT NOT NULL DEFAULT 'left',
  ADD COLUMN IF NOT EXISTS "backgroundColor"     TEXT,
  ADD COLUMN IF NOT EXISTS "heroLayout"          "HeroLayout" NOT NULL DEFAULT 'FULL_BLEED',
  ADD COLUMN IF NOT EXISTS "gridColumnsDesktop"  INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "gridColumnsMobile"   INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS "defaultSort"         "CollectionSort" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN IF NOT EXISTS "showFilters"         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "filterConfig"        JSONB,
  ADD COLUMN IF NOT EXISTS "showCountdown"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "showSocialProof"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "showRelated"         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "timezone"            TEXT NOT NULL DEFAULT 'Asia/Dhaka',
  ADD COLUMN IF NOT EXISTS "prelaunchTeaser"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "postEndBehavior"     TEXT NOT NULL DEFAULT 'hide',
  ADD COLUMN IF NOT EXISTS "postEndRedirect"     TEXT,
  ADD COLUMN IF NOT EXISTS "visibility"          TEXT NOT NULL DEFAULT 'public',
  ADD COLUMN IF NOT EXISTS "passwordHash"        TEXT,
  ADD COLUMN IF NOT EXISTS "autoRules"           JSONB,
  ADD COLUMN IF NOT EXISTS "seoTitle"            TEXT,
  ADD COLUMN IF NOT EXISTS "seoDescription"      TEXT,
  ADD COLUMN IF NOT EXISTS "ogImage"             TEXT,
  ADD COLUMN IF NOT EXISTS "showInNav"           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "navOrder"            INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "isFeaturedHome"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "homepageSlot"        INTEGER,
  ADD COLUMN IF NOT EXISTS "showAsRail"          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "railTitle"           TEXT,
  ADD COLUMN IF NOT EXISTS "promoCode"           TEXT,
  ADD COLUMN IF NOT EXISTS "utmSource"           TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS "Collection_type_idx" ON "Collection"("type");
CREATE INDEX IF NOT EXISTS "Collection_showInNav_idx" ON "Collection"("showInNav");
CREATE INDEX IF NOT EXISTS "Collection_isFeaturedHome_idx" ON "Collection"("isFeaturedHome");

-- ─── LOOKBOOK TABLE ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CollectionLookbook" (
  "id"           TEXT PRIMARY KEY,
  "collectionId" TEXT NOT NULL,
  "imageUrl"     TEXT NOT NULL,
  "caption"      TEXT,
  "altText"      TEXT,
  "position"     INTEGER NOT NULL DEFAULT 0,
  "hotspots"     JSONB,
  "createdAt"    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "CollectionLookbook_collectionId_fkey"
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "CollectionLookbook_collectionId_idx" ON "CollectionLookbook"("collectionId");

-- ─── SEED: ASSIGN TYPES TO EXISTING 5 COLLECTIONS ─────────────────────────────

UPDATE "Collection" SET "type" = 'AUTO'  WHERE "slug" IN ('bestsellers', 'new-arrivals');
UPDATE "Collection" SET "type" = 'EDIT'  WHERE "slug" IN ('baggy', 'wide-leg');
UPDATE "Collection" SET "type" = 'PROMO' WHERE "slug" = 'b2g1';

-- Wire AUTO rules for bestsellers / new-arrivals
UPDATE "Collection"
  SET "autoRules"  = '{"includeIfBestseller": true, "maxProducts": 24, "inStockOnly": true}'::jsonb,
      "showAsRail" = true,
      "railTitle"  = 'Bestsellers'
  WHERE "slug" = 'bestsellers';

UPDATE "Collection"
  SET "autoRules"  = '{"includeIfNewArrival": true, "newArrivalDays": 14, "maxProducts": 24, "inStockOnly": true}'::jsonb,
      "showAsRail" = true,
      "railTitle"  = 'New Arrivals'
  WHERE "slug" = 'new-arrivals';
