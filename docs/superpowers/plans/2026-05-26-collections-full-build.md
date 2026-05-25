# Collections Full Build — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Project memory says: NO subagent dispatches per task — execute inline in main session.

**Goal:** Turn the Collections module into a complete merchandising layer: 4 collection types (DROP, EDIT, AUTO, PROMO), a 6-tab admin editor, and full storefront surfaces (landing pages, hero variants, lookbook, countdown, homepage rails, mega-menu, PDP badges, SEO).

**Architecture:**
- Extend the `Collection` Prisma model with type + visual + layout + SEO fields. Add a `CollectionLookbook` join model for editorial images. Keep `CollectionProduct` as-is (already has `position`).
- API: extend DTOs, add reorder + AUTO-population endpoints. Service stays single-purpose with helpers for auto-resolution.
- Admin: replace the giant modal with a tiny "create stub" modal + a dedicated full-page editor at `/catalog/collections/[id]` with a 6-tab layout. Autosave per tab.
- Storefront: rewrite `/collections/[slug]` into a typed renderer (hero variant chosen by collection.type), add lookbook interspersion, sticky filter/sort, related-collections footer. Wire homepage rails to AUTO collections by slug.

**Tech Stack:** Prisma 5 + Postgres (Supabase), NestJS 10, Next.js 14 (App Router), Tailwind v4, Zod (where DTOs need it), React Query (already in admin via adminFetch), `@dnd-kit/sortable` (for drag-reorder; verify install in admin tab).

**Out of scope (not in this plan):** Promotion rule engine itself (PROMO type references an existing promoCode but doesn't build the discount logic). A/B testing two heroes. Password gating (defer — add field but skip enforcement). Email/push notification triggers.

**Project constraints to honor:**
- NO subagent dispatches per task (memory: `feedback_no_subagents_for_plan_exec`)
- Live DB has no `_prisma_migrations` table — use `prisma db execute` with raw SQL, not `prisma migrate`
- NEVER run seed against live DB
- Build first, polish later
- Modular code rule — clean module boundaries

---

## File Structure

### New files (create)

**API**
- `apps/api/src/modules/collections/collections.auto.service.ts` — AUTO-population logic
- `apps/api/src/modules/collections/collections.auto.service.spec.ts`

**Admin**
- `apps/admin/app/(dashboard)/catalog/collections/[id]/page.tsx` — full-page editor wrapper
- `apps/admin/app/(dashboard)/catalog/collections/[id]/editor-shell.tsx` — tab nav + save bar
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/basics-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/visuals-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/products-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/layout-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/schedule-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/seo-tab.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/_components/lookbook-uploader.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/_components/sortable-product-list.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/[id]/_components/auto-rules-form.tsx`

**Web (storefront)**
- `apps/web/app/collections/[slug]/_components/collection-hero.tsx` — variant chooser (FullBleed / Split / Video / Minimal)
- `apps/web/app/collections/[slug]/_components/collection-grid.tsx`
- `apps/web/app/collections/[slug]/_components/lookbook-break.tsx`
- `apps/web/app/collections/[slug]/_components/countdown-banner.tsx`
- `apps/web/app/collections/[slug]/_components/promo-banner.tsx`
- `apps/web/app/collections/[slug]/_components/related-collections.tsx`
- `apps/web/app/collections/[slug]/_components/sticky-filter-bar.tsx`
- `apps/web/app/collections/[slug]/teaser/page.tsx` — pre-launch teaser route (uses redirect from main page)
- `apps/web/components/home/drops-carousel.tsx`
- `apps/web/components/nav/collections-megamenu.tsx`
- `apps/web/components/products/part-of-collection-badge.tsx`
- `apps/web/lib/collections.ts` — shared fetchers (getCollection, getActiveCollections, getCollectionBySlug)

### Modified files

**Database**
- `packages/database/prisma/schema.prisma` — extend `Collection` model + add `CollectionLookbook` + `CollectionType` enum

**API**
- `apps/api/src/modules/collections/collections.dto.ts` — extend DTOs with new fields
- `apps/api/src/modules/collections/collections.service.ts` — handle new fields, add reorder + lookbook + auto-resolve
- `apps/api/src/modules/collections/collections.controller.ts` — add `PATCH /:id/products/reorder`, `GET /:slug/resolved`, `POST/DELETE /:id/lookbook`
- `apps/api/src/modules/collections/collections.module.ts` — register CollectionsAutoService
- `apps/api/src/modules/collections/collections.service.spec.ts` — extend tests
- `apps/api/src/modules/collections/collections.controller.spec.ts` — extend tests

**Admin**
- `apps/admin/app/(dashboard)/catalog/collections/page.tsx` — list view: add Type badge column, thumbnail, schedule indicator, "View" link, replace edit-modal trigger with navigation to `[id]/page.tsx`
- `apps/admin/app/(dashboard)/catalog/collections/manage-collection-modal.tsx` — slim to a tiny **Create-only** modal (Name + Slug + Type → redirect to editor)
- Rename file to `create-collection-modal.tsx` to reflect new purpose

**Web (storefront)**
- `apps/web/app/collections/[slug]/page.tsx` — orchestrate new components; handle pre-launch/post-end states
- `apps/web/lib/homepage-sections.ts` — read AUTO collections by slug for Bestsellers / New Arrivals rails
- `apps/web/components/home/best-sellers.tsx` — pull from `useCollection('bestsellers')` rather than ad-hoc fetch
- `apps/web/app/page.tsx` — register `DropsCarousel` section
- `apps/web/lib/seo/collection.ts` — extend metadata builder with new fields (OG image override, dynamic descriptions)
- `apps/web/app/sitemap-pages.xml/route.ts` — only emit active + within-date collections

---

## Phases (ordered execution)

Each phase produces working, testable software. Commit at the end of every task.

- **Phase 0** — Schema + migration (1–2h) → DB ready
- **Phase 1** — API extension (4–6h) → backend serves new fields, AUTO resolution works
- **Phase 2** — Admin editor shell + Basics tab (3h) → can navigate to full editor, save name/slug/type/description
- **Phase 3** — Admin tabs: Visuals → Products → Layout → Schedule → SEO (1.5 days) → full edit flow
- **Phase 4** — Admin list page upgrades (3h) → thumbnails + type badges + schedule info
- **Phase 5** — Storefront landing rewrite + hero variants (1 day) → typed collection pages render
- **Phase 6** — Lookbook + sticky filter + countdown + promo banner (6–8h)
- **Phase 7** — Homepage AUTO + drops carousel (4–6h) → Bestsellers / New Arrivals rails go live
- **Phase 8** — Mega-menu + PDP badge + footer edits list (4–6h)
- **Phase 9** — SEO + sitemap + OG images (3–4h)
- **Phase 10** — E2E test journey + handoff/docs (2h)

---

# PHASE 0 — Schema + Migration

### Task 0.1: Extend Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma:219-248` (Collection + CollectionProduct)
- Add: new `CollectionType` enum, new `CollectionLookbook` model, new fields on `Collection`

- [ ] **Step 1: Add `CollectionType` enum**

Insert above `model Collection`:

```prisma
enum CollectionType {
  DROP   // time-bound campaign
  EDIT   // evergreen style edit
  AUTO   // rule-driven (bestsellers, new arrivals)
  PROMO  // discount-linked
}

enum HeroLayout {
  FULL_BLEED
  SPLIT
  VIDEO
  MINIMAL
}

enum CollectionSort {
  MANUAL
  NEWEST
  PRICE_ASC
  PRICE_DESC
  BESTSELLING
}
```

- [ ] **Step 2: Replace the `Collection` model with the extended version**

```prisma
model Collection {
  id                String              @id @default(cuid())
  // BASICS
  name              String
  slug              String              @unique
  subtitle          String?             // hero overlay tagline
  description       String?             // rich text (markdown)
  internalNote      String?             // admin-only
  type              CollectionType      @default(EDIT)

  // VISUALS
  image             String?             // thumbnail (used in cards, mega-menu, kept name for back-compat)
  heroImageDesktop  String?
  heroImageMobile   String?
  heroVideo         String?             // optional autoplay muted
  heroTextColor     String              @default("light") // "light" | "dark"
  heroOverlay       Int                 @default(30)     // 0-100 opacity
  heroAlign         String              @default("left") // "left" | "center" | "right"
  backgroundColor   String?             // hex

  // LAYOUT
  heroLayout        HeroLayout          @default(FULL_BLEED)
  gridColumnsDesktop Int                @default(3)
  gridColumnsMobile  Int                @default(2)
  defaultSort       CollectionSort      @default(MANUAL)
  showFilters       Boolean             @default(true)
  filterConfig      Json?               // {size: true, color: true, price: true, fit: true}
  showCountdown     Boolean             @default(false)
  showSocialProof   Boolean             @default(false)
  showRelated       Boolean             @default(true)

  // SCHEDULE & VISIBILITY
  isActive          Boolean             @default(true)
  startDate         DateTime?
  endDate           DateTime?
  timezone          String              @default("Asia/Dhaka")
  prelaunchTeaser   Boolean             @default(false)
  postEndBehavior   String              @default("hide") // "hide" | "redirect" | "archive"
  postEndRedirect   String?             // slug to redirect to
  visibility        String              @default("public") // "public" | "direct" | "members"
  passwordHash      String?             // optional gate (not enforced in v1)

  // PRODUCTS
  products          CollectionProduct[]
  autoRules         Json?               // {includeCategories: [], includeTags: [], includeIfBestseller: true, includeIfNewArrival: false, newArrivalDays: 14, onSaleOnly: false, inStockOnly: true, excludeProductIds: [], maxProducts: 24}

  // MARKETING / SEO
  seoTitle          String?
  seoDescription    String?
  ogImage           String?
  showInNav         Boolean             @default(false)
  navOrder          Int                 @default(0)
  isFeaturedHome    Boolean             @default(false)
  homepageSlot      Int?                // 1-5 priority on homepage
  showAsRail        Boolean             @default(false)
  railTitle         String?             // override of name on homepage rail
  promoCode         String?             // links to promotion (PROMO type only)
  utmSource         String?

  // METADATA
  sectionCurations  SectionCuration[]
  lookbook          CollectionLookbook[]
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  deletedAt         DateTime?

  @@index([deletedAt])
  @@index([isActive])
  @@index([type])
  @@index([showInNav])
  @@index([isFeaturedHome])
}

model CollectionLookbook {
  id           String     @id @default(cuid())
  collectionId String
  collection   Collection @relation(fields: [collectionId], references: [id], onDelete: Cascade)
  imageUrl     String
  caption      String?
  altText      String?
  position     Int        @default(0)
  // hotspot product references (optional shop-the-look)
  hotspots     Json?      // [{x: 0.4, y: 0.6, productId: "..."}]
  createdAt    DateTime   @default(now())

  @@index([collectionId])
}
```

- [ ] **Step 3: Generate Prisma client**

Run: `pnpm --filter @denimisia/database prisma generate`
Expected: `✔ Generated Prisma Client (5.x.x)`

- [ ] **Step 4: Commit schema change**

```powershell
git add packages/database/prisma/schema.prisma
git commit -m "feat(collections): extend schema with type, hero, layout, SEO, lookbook"
```

### Task 0.2: Write raw SQL migration

Live DB has no `_prisma_migrations` table — use `prisma db execute` per memory `project_register_phone`.

**Files:**
- Create: `packages/database/prisma/manual-migrations/2026-05-26-collections-full-build.sql`

- [ ] **Step 1: Write the SQL**

```sql
-- Add enums
DO $$ BEGIN
  CREATE TYPE "CollectionType" AS ENUM ('DROP', 'EDIT', 'AUTO', 'PROMO');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "HeroLayout" AS ENUM ('FULL_BLEED', 'SPLIT', 'VIDEO', 'MINIMAL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "CollectionSort" AS ENUM ('MANUAL', 'NEWEST', 'PRICE_ASC', 'PRICE_DESC', 'BESTSELLING');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Extend Collection
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

-- New indexes
CREATE INDEX IF NOT EXISTS "Collection_type_idx" ON "Collection"("type");
CREATE INDEX IF NOT EXISTS "Collection_showInNav_idx" ON "Collection"("showInNav");
CREATE INDEX IF NOT EXISTS "Collection_isFeaturedHome_idx" ON "Collection"("isFeaturedHome");

-- Lookbook table
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

-- Seed: assign types to existing 5 collections so nothing breaks
UPDATE "Collection" SET "type" = 'AUTO' WHERE "slug" IN ('bestsellers', 'new-arrivals');
UPDATE "Collection" SET "type" = 'EDIT' WHERE "slug" IN ('baggy', 'wide-leg');
UPDATE "Collection" SET "type" = 'PROMO' WHERE "slug" = 'b2g1';

-- Wire AUTO rules for bestsellers / new-arrivals
UPDATE "Collection"
  SET "autoRules" = '{"includeIfBestseller": true, "maxProducts": 24, "inStockOnly": true}'::jsonb,
      "showAsRail" = true,
      "railTitle" = 'Bestsellers'
  WHERE "slug" = 'bestsellers';

UPDATE "Collection"
  SET "autoRules" = '{"includeIfNewArrival": true, "newArrivalDays": 14, "maxProducts": 24, "inStockOnly": true}'::jsonb,
      "showAsRail" = true,
      "railTitle" = 'New Arrivals'
  WHERE "slug" = 'new-arrivals';
```

- [ ] **Step 2: Run migration against LOCAL DB first**

Run: `pnpm --filter @denimisia/database exec prisma db execute --file prisma/manual-migrations/2026-05-26-collections-full-build.sql --schema prisma/schema.prisma`
Expected: `Script executed successfully.`

- [ ] **Step 3: Smoke-test that local API still boots**

Run: `pnpm --filter @denimisia/api dev` (run_in_background)
Expected: API listens on :3001 with no schema errors. Stop after smoke.

- [ ] **Step 4: Apply to live Supabase**

Use Supabase MCP `mcp__supabase__apply_migration` with the SQL above (name: `collections_full_build`).
Verify with `mcp__supabase__list_tables` that `CollectionLookbook` exists and new columns are visible.

- [ ] **Step 5: Commit migration file**

```powershell
git add packages/database/prisma/manual-migrations/2026-05-26-collections-full-build.sql
git commit -m "feat(db): collections schema migration (types, hero, layout, lookbook)"
```

---

# PHASE 1 — API Extension

### Task 1.1: Extend DTOs

**Files:**
- Modify: `apps/api/src/modules/collections/collections.dto.ts`

- [ ] **Step 1: Add enums + Update DTOs**

Replace the entire DTO file with:

```typescript
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsObject, IsOptional, IsString,
  Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CollectionTypeDto {
  DROP = 'DROP', EDIT = 'EDIT', AUTO = 'AUTO', PROMO = 'PROMO',
}
export enum HeroLayoutDto {
  FULL_BLEED = 'FULL_BLEED', SPLIT = 'SPLIT', VIDEO = 'VIDEO', MINIMAL = 'MINIMAL',
}
export enum CollectionSortDto {
  MANUAL = 'MANUAL', NEWEST = 'NEWEST', PRICE_ASC = 'PRICE_ASC',
  PRICE_DESC = 'PRICE_DESC', BESTSELLING = 'BESTSELLING',
}

export class AutoRulesDto {
  @IsOptional() @IsArray() includeCategoryIds?: string[];
  @IsOptional() @IsArray() includeTags?: string[];
  @IsOptional() @IsBoolean() includeIfBestseller?: boolean;
  @IsOptional() @IsBoolean() includeIfNewArrival?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(365) newArrivalDays?: number;
  @IsOptional() @IsBoolean() onSaleOnly?: boolean;
  @IsOptional() @IsBoolean() inStockOnly?: boolean;
  @IsOptional() @IsArray() excludeProductIds?: string[];
  @IsOptional() @IsInt() @Min(1) @Max(200) maxProducts?: number;
}

export class FilterConfigDto {
  @IsOptional() @IsBoolean() size?: boolean;
  @IsOptional() @IsBoolean() color?: boolean;
  @IsOptional() @IsBoolean() price?: boolean;
  @IsOptional() @IsBoolean() fit?: boolean;
}

export class CreateCollectionDto {
  @IsString() @Length(2, 80) name!: string;
  @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase, alphanumeric, hyphens' })
  slug!: string;
  @IsEnum(CollectionTypeDto) type!: CollectionTypeDto;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdateCollectionDto {
  // BASICS
  @IsOptional() @IsString() @Length(2, 80) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/) slug?: string;
  @IsOptional() @IsString() subtitle?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() internalNote?: string;
  @IsOptional() @IsEnum(CollectionTypeDto) type?: CollectionTypeDto;

  // VISUALS
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() heroImageDesktop?: string;
  @IsOptional() @IsString() heroImageMobile?: string;
  @IsOptional() @IsString() heroVideo?: string;
  @IsOptional() @IsString() heroTextColor?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) heroOverlay?: number;
  @IsOptional() @IsString() heroAlign?: string;
  @IsOptional() @IsString() backgroundColor?: string;

  // LAYOUT
  @IsOptional() @IsEnum(HeroLayoutDto) heroLayout?: HeroLayoutDto;
  @IsOptional() @IsInt() @Min(1) @Max(6) gridColumnsDesktop?: number;
  @IsOptional() @IsInt() @Min(1) @Max(3) gridColumnsMobile?: number;
  @IsOptional() @IsEnum(CollectionSortDto) defaultSort?: CollectionSortDto;
  @IsOptional() @IsBoolean() showFilters?: boolean;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => FilterConfigDto) filterConfig?: FilterConfigDto;
  @IsOptional() @IsBoolean() showCountdown?: boolean;
  @IsOptional() @IsBoolean() showSocialProof?: boolean;
  @IsOptional() @IsBoolean() showRelated?: boolean;

  // SCHEDULE
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() startDate?: string;
  @IsOptional() @IsString() endDate?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsBoolean() prelaunchTeaser?: boolean;
  @IsOptional() @IsString() postEndBehavior?: string;
  @IsOptional() @IsString() postEndRedirect?: string;
  @IsOptional() @IsString() visibility?: string;

  // PRODUCTS
  @IsOptional() @IsObject() @ValidateNested() @Type(() => AutoRulesDto) autoRules?: AutoRulesDto;

  // SEO
  @IsOptional() @IsString() seoTitle?: string;
  @IsOptional() @IsString() seoDescription?: string;
  @IsOptional() @IsString() ogImage?: string;
  @IsOptional() @IsBoolean() showInNav?: boolean;
  @IsOptional() @IsInt() navOrder?: number;
  @IsOptional() @IsBoolean() isFeaturedHome?: boolean;
  @IsOptional() @IsInt() @Min(1) @Max(5) homepageSlot?: number;
  @IsOptional() @IsBoolean() showAsRail?: boolean;
  @IsOptional() @IsString() railTitle?: string;
  @IsOptional() @IsString() promoCode?: string;
  @IsOptional() @IsString() utmSource?: string;
}

export class AddProductsToCollectionDto {
  @IsArray() @IsString({ each: true }) productIds!: string[];
}

export class ReorderProductsDto {
  @IsArray() productIds!: string[]; // new order, top→bottom
}

export class UpsertLookbookItemDto {
  @IsString() imageUrl!: string;
  @IsOptional() @IsString() caption?: string;
  @IsOptional() @IsString() altText?: string;
  @IsOptional() @IsInt() position?: number;
  @IsOptional() @IsArray() hotspots?: Array<{ x: number; y: number; productId: string }>;
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/api/src/modules/collections/collections.dto.ts
git commit -m "feat(api): extend collections DTOs with type/visuals/layout/seo/autoRules"
```

### Task 1.2: Extend `CollectionsService`

**Files:**
- Modify: `apps/api/src/modules/collections/collections.service.ts`

- [ ] **Step 1: Write failing service test**

Append to `collections.service.spec.ts`:

```typescript
describe('reorderProducts', () => {
  it('updates position based on array index', async () => {
    prismaMock.collectionProduct.update.mockResolvedValue({} as any);
    await service.reorderProducts('c1', ['pA', 'pB', 'pC']);
    expect(prismaMock.collectionProduct.update).toHaveBeenCalledWith({
      where: { collectionId_productId: { collectionId: 'c1', productId: 'pA' } },
      data: { position: 0 },
    });
    expect(prismaMock.collectionProduct.update).toHaveBeenCalledWith({
      where: { collectionId_productId: { collectionId: 'c1', productId: 'pC' } },
      data: { position: 2 },
    });
  });
});

describe('upsertLookbookItem / removeLookbookItem', () => {
  it('creates a lookbook item', async () => {
    prismaMock.collectionLookbook.create.mockResolvedValue({ id: 'lb1' } as any);
    await service.upsertLookbookItem('c1', { imageUrl: 'x', position: 0 });
    expect(prismaMock.collectionLookbook.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (RED)**

Run: `pnpm --filter @denimisia/api test -- collections.service`
Expected: FAIL — service methods not defined.

- [ ] **Step 3: Implement methods in `collections.service.ts`**

Add to the class:

```typescript
async update(id: string, dto: UpdateCollectionDto) {
  const data: Prisma.CollectionUpdateInput = {
    ...dto,
    startDate: dto.startDate ? new Date(dto.startDate) : undefined,
    endDate:   dto.endDate   ? new Date(dto.endDate)   : undefined,
  };
  return this.prisma.collection.update({ where: { id }, data });
}

async reorderProducts(id: string, productIds: string[]) {
  await this.prisma.$transaction(
    productIds.map((productId, index) =>
      this.prisma.collectionProduct.update({
        where: { collectionId_productId: { collectionId: id, productId } },
        data:  { position: index },
      })
    )
  );
  return this.findById(id);
}

async upsertLookbookItem(collectionId: string, dto: UpsertLookbookItemDto) {
  return this.prisma.collectionLookbook.create({
    data: {
      collectionId,
      imageUrl: dto.imageUrl,
      caption: dto.caption,
      altText: dto.altText,
      position: dto.position ?? 0,
      hotspots: dto.hotspots ?? undefined,
    },
  });
}

async removeLookbookItem(id: string) {
  await this.prisma.collectionLookbook.delete({ where: { id } });
}

async findBySlugResolved(slug: string) {
  const collection = await this.prisma.collection.findUnique({
    where: { slug, deletedAt: null },
    include: {
      lookbook: { orderBy: { position: 'asc' } },
      products: {
        orderBy: { position: 'asc' },
        include: { product: { include: { variants: true, category: true } } },
      },
    },
  });
  if (!collection) throw new NotFoundException('Collection not found');
  if (collection.type === 'AUTO') {
    const auto = await this.auto.resolve(collection);
    return { ...collection, products: auto };
  }
  return collection;
}
```

(Update imports: `import { Prisma } from '@prisma/client'`, `import { CollectionsAutoService } from './collections.auto.service'`, inject `private readonly auto: CollectionsAutoService` in constructor.)

- [ ] **Step 4: Run test (GREEN)**

Run: `pnpm --filter @denimisia/api test -- collections.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/collections/collections.service.ts apps/api/src/modules/collections/collections.service.spec.ts
git commit -m "feat(api): collection update/reorder/lookbook/resolve methods"
```

### Task 1.3: Build `CollectionsAutoService`

**Files:**
- Create: `apps/api/src/modules/collections/collections.auto.service.ts`
- Create: `apps/api/src/modules/collections/collections.auto.service.spec.ts`

- [ ] **Step 1: Write failing spec**

```typescript
import { Test } from '@nestjs/testing';
import { CollectionsAutoService } from './collections.auto.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CollectionsAutoService', () => {
  let svc: CollectionsAutoService;
  const prismaMock = { product: { findMany: jest.fn() } };

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      providers: [
        CollectionsAutoService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    svc = mod.get(CollectionsAutoService);
  });

  it('returns products marked isTrending when includeIfBestseller', async () => {
    prismaMock.product.findMany.mockResolvedValue([{ id: 'p1' }]);
    const out = await svc.resolve({
      autoRules: { includeIfBestseller: true, maxProducts: 5 },
    } as any);
    expect(prismaMock.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ isTrending: true, isActive: true }),
      take: 5,
    }));
    expect(out).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AutoRules {
  includeCategoryIds?: string[];
  includeTags?: string[];
  includeIfBestseller?: boolean;
  includeIfNewArrival?: boolean;
  newArrivalDays?: number;
  onSaleOnly?: boolean;
  inStockOnly?: boolean;
  excludeProductIds?: string[];
  maxProducts?: number;
}

@Injectable()
export class CollectionsAutoService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(collection: { autoRules: AutoRules | null }) {
    const rules = collection.autoRules ?? {};
    const where: any = { isActive: true, deletedAt: null };
    if (rules.includeCategoryIds?.length) where.categoryId = { in: rules.includeCategoryIds };
    if (rules.includeTags?.length)        where.tags = { hasSome: rules.includeTags };
    if (rules.includeIfBestseller)        where.isTrending = true;
    if (rules.includeIfNewArrival) {
      const days = rules.newArrivalDays ?? 14;
      where.createdAt = { gte: new Date(Date.now() - days * 86400_000) };
    }
    if (rules.onSaleOnly)                 where.compareAtPrice = { not: null };
    if (rules.excludeProductIds?.length)  where.id = { notIn: rules.excludeProductIds };
    if (rules.inStockOnly) {
      where.variants = { some: { stock: { gt: 0 } } };
    }
    const products = await this.prisma.product.findMany({
      where,
      include: { variants: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: rules.maxProducts ?? 24,
    });
    return products.map((p, position) => ({ position, product: p }));
  }
}
```

- [ ] **Step 3: Register in module**

Edit `collections.module.ts`:

```typescript
import { CollectionsAutoService } from './collections.auto.service';

@Module({
  controllers: [CollectionsController],
  providers: [CollectionsService, CollectionsAutoService],
  exports: [CollectionsService, CollectionsAutoService],
})
export class CollectionsModule {}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @denimisia/api test -- collections`
Expected: all green.

- [ ] **Step 5: Commit**

```powershell
git add apps/api/src/modules/collections/collections.auto.service.ts apps/api/src/modules/collections/collections.auto.service.spec.ts apps/api/src/modules/collections/collections.module.ts
git commit -m "feat(api): AUTO collection resolver"
```

### Task 1.4: Add controller endpoints

**Files:**
- Modify: `apps/api/src/modules/collections/collections.controller.ts`
- Modify: `apps/api/src/modules/collections/collections.controller.spec.ts`

- [ ] **Step 1: Write failing controller test**

Append:

```typescript
describe('PATCH /:id/products/reorder', () => {
  it('calls service.reorderProducts', async () => {
    const spy = jest.spyOn(service, 'reorderProducts').mockResolvedValue({} as any);
    await controller.reorderProducts('c1', { productIds: ['a', 'b'] });
    expect(spy).toHaveBeenCalledWith('c1', ['a', 'b']);
  });
});

describe('GET /:slug/resolved', () => {
  it('returns AUTO-resolved products', async () => {
    const spy = jest.spyOn(service, 'findBySlugResolved').mockResolvedValue({ products: [] } as any);
    await controller.findResolved('bestsellers');
    expect(spy).toHaveBeenCalledWith('bestsellers');
  });
});
```

- [ ] **Step 2: Add controller methods**

```typescript
@Get(':slug/resolved')
@PublicCache(60, 300)
findResolved(@Param('slug') slug: string) {
  return this.service.findBySlugResolved(slug);
}

@Patch(':id/products/reorder')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
reorderProducts(@Param('id') id: string, @Body() dto: ReorderProductsDto) {
  return this.service.reorderProducts(id, dto.productIds);
}

@Post(':id/lookbook')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
addLookbookItem(@Param('id') id: string, @Body() dto: UpsertLookbookItemDto) {
  return this.service.upsertLookbookItem(id, dto);
}

@Delete('lookbook/:lookbookId')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@HttpCode(HttpStatus.NO_CONTENT)
removeLookbookItem(@Param('lookbookId') lookbookId: string) {
  return this.service.removeLookbookItem(lookbookId);
}
```

Update imports for `ReorderProductsDto`, `UpsertLookbookItemDto`.

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @denimisia/api test -- collections.controller`
Expected: all pass.

- [ ] **Step 4: Commit + push**

```powershell
git add apps/api/src/modules/collections/collections.controller.ts apps/api/src/modules/collections/collections.controller.spec.ts
git commit -m "feat(api): collection reorder + resolved + lookbook endpoints"
git push
```

- [ ] **Step 5: Deploy API to Render**

Either wait for autodeploy on `main` or trigger via Render API.
Verify: `curl https://denimisia-api.onrender.com/api/v1/collections/bestsellers/resolved` returns JSON with `products` array.

---

# PHASE 2 — Admin Editor Shell + Basics Tab

### Task 2.1: Replace big modal with tiny create-only modal

**Files:**
- Modify: `apps/admin/app/(dashboard)/catalog/collections/page.tsx`
- Rename + slim: `manage-collection-modal.tsx` → `create-collection-modal.tsx`

- [ ] **Step 1: Update page.tsx to navigate to editor on edit**

In the row click / pencil button handler:

```typescript
import { useRouter } from 'next/navigation';

const router = useRouter();

// replace setManageId(collection.id) with:
router.push(`/catalog/collections/${collection.id}`);
```

In `CreateCollectionModal` callback `onCreated`, redirect to editor too:

```typescript
onCreated={(id) => {
  router.push(`/catalog/collections/${id}`);
}}
```

- [ ] **Step 2: Slim modal to 3 fields**

`create-collection-modal.tsx` body:

```typescript
'use client';
import { useState } from 'react';
import { adminFetch } from '@/lib/api';
import { Modal } from '@/components/modal';
import { Field, TextInput, slugify } from '@/components/form';
import { PrimaryButton } from '@/components/admin-ui';

type CollectionType = 'DROP' | 'EDIT' | 'AUTO' | 'PROMO';

export function CreateCollectionModal({
  open, onClose, onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<CollectionType>('EDIT');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setSaving(true); setErr(null);
    try {
      const res = await adminFetch('/collections', {
        method: 'POST',
        body: JSON.stringify({ name, slug: slug || slugify(name), type }),
      });
      const created = res.data ?? res;
      onCreated(created.id);
    } catch (e: any) {
      setErr(e?.message ?? 'Failed to create');
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Collection"
           subtitle="Pick a name and type. You'll edit everything else on the next screen.">
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Spring '26" />
        </Field>
        <Field label="Slug" required>
          <TextInput value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="spring-26" />
        </Field>
        <Field label="Type" required>
          <select value={type} onChange={(e) => setType(e.target.value as CollectionType)}
                  className="w-full bg-neutral-900 text-white border border-neutral-700 px-3 py-2">
            <option value="DROP">DROP — time-bound campaign (Spring '26, Eid)</option>
            <option value="EDIT">EDIT — evergreen style (Baggy Fit, Wide Leg)</option>
            <option value="AUTO">AUTO — rule-driven (Bestsellers, New Arrivals)</option>
            <option value="PROMO">PROMO — discount-linked (B2G1, Flash Sale)</option>
          </select>
        </Field>
        {err && <p className="text-red-400 text-sm">{err}</p>}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="text-neutral-400">Cancel</button>
          <PrimaryButton onClick={submit} disabled={saving || !name || !slug}>
            {saving ? 'Creating…' : 'Create & Configure'}
          </PrimaryButton>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/admin/app/(dashboard)/catalog/collections/
git commit -m "refactor(admin/collections): tiny create modal redirects to full editor"
```

### Task 2.2: Editor page shell

**Files:**
- Create: `apps/admin/app/(dashboard)/catalog/collections/[id]/page.tsx`
- Create: `apps/admin/app/(dashboard)/catalog/collections/[id]/editor-shell.tsx`

- [ ] **Step 1: Server page fetches collection**

```typescript
// page.tsx
import { EditorShell } from './editor-shell';

export default function Page({ params }: { params: { id: string } }) {
  return <EditorShell collectionId={params.id} />;
}
```

- [ ] **Step 2: Editor shell with tabs**

```typescript
// editor-shell.tsx
'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/api';
import { BasicsTab } from './tabs/basics-tab';
import { VisualsTab } from './tabs/visuals-tab';
import { ProductsTab } from './tabs/products-tab';
import { LayoutTab } from './tabs/layout-tab';
import { ScheduleTab } from './tabs/schedule-tab';
import { SeoTab } from './tabs/seo-tab';

const TABS = [
  { key: 'basics',   label: 'Basics' },
  { key: 'visuals',  label: 'Visuals' },
  { key: 'products', label: 'Products' },
  { key: 'layout',   label: 'Layout' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'seo',      label: 'SEO' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export function EditorShell({ collectionId }: { collectionId: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>('basics');
  const [collection, setCollection] = useState<any>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const load = async () => {
    const res = await adminFetch(`/admin/collections/${collectionId}`);
    setCollection(res.data ?? res);
  };
  useEffect(() => { load(); }, [collectionId]);

  const onSaved = (updated: any) => { setCollection(updated); setSavedAt(new Date()); };

  if (!collection) return <div className="p-6 text-neutral-500">Loading…</div>;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex items-center justify-between px-8 py-4 border-b border-neutral-800">
        <div>
          <button onClick={() => router.push('/catalog/collections')} className="text-xs uppercase text-neutral-500 mb-1">← Collections</button>
          <h1 className="text-2xl font-light">{collection.name}</h1>
          <p className="text-xs uppercase text-neutral-500">/{collection.slug} · {collection.type}</p>
        </div>
        <div className="text-xs text-neutral-500">{savedAt && `Saved ${savedAt.toLocaleTimeString()}`}</div>
      </header>
      <nav className="flex gap-1 px-8 border-b border-neutral-800">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-3 text-xs uppercase tracking-wider ${tab === t.key ? 'text-white border-b-2 border-white' : 'text-neutral-500'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="px-8 py-8 max-w-5xl">
        {tab === 'basics'   && <BasicsTab   collection={collection} onSaved={onSaved} />}
        {tab === 'visuals'  && <VisualsTab  collection={collection} onSaved={onSaved} />}
        {tab === 'products' && <ProductsTab collection={collection} onSaved={onSaved} />}
        {tab === 'layout'   && <LayoutTab   collection={collection} onSaved={onSaved} />}
        {tab === 'schedule' && <ScheduleTab collection={collection} onSaved={onSaved} />}
        {tab === 'seo'      && <SeoTab      collection={collection} onSaved={onSaved} />}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```powershell
git add apps/admin/app/(dashboard)/catalog/collections/[id]/
git commit -m "feat(admin/collections): editor shell with 6-tab navigation"
```

### Task 2.3: Basics tab

**Files:**
- Create: `apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/basics-tab.tsx`

- [ ] **Step 1: Form**

```typescript
'use client';
import { useState } from 'react';
import { adminFetch } from '@/lib/api';
import { Field, TextInput, TextArea, slugify } from '@/components/form';
import { PrimaryButton, Banner } from '@/components/admin-ui';

export function BasicsTab({ collection, onSaved }: { collection: any; onSaved: (c: any) => void }) {
  const [form, setForm] = useState({
    name: collection.name ?? '',
    slug: collection.slug ?? '',
    subtitle: collection.subtitle ?? '',
    description: collection.description ?? '',
    internalNote: collection.internalNote ?? '',
    type: collection.type ?? 'EDIT',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true); setErr(null);
    try {
      const res = await adminFetch(`/collections/${collection.id}`, { method: 'PATCH', body: JSON.stringify(form) });
      onSaved(res.data ?? res);
    } catch (e: any) { setErr(e?.message ?? 'Save failed'); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Field label="Name" required>
        <TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Slug" required hint="lowercase letters, numbers, hyphens. Changing this breaks old links.">
        <TextInput value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} />
      </Field>
      <Field label="Type">
        <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full bg-neutral-900 border border-neutral-700 px-3 py-2 text-white">
          <option value="DROP">DROP — time-bound campaign</option>
          <option value="EDIT">EDIT — evergreen style</option>
          <option value="AUTO">AUTO — rule-driven</option>
          <option value="PROMO">PROMO — discount-linked</option>
        </select>
      </Field>
      <Field label="Subtitle / tagline" hint="Shows over hero image, 1 line">
        <TextInput value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Lightweight denim for warmer days" />
      </Field>
      <Field label="Description" hint="Markdown allowed. Shown on collection landing.">
        <TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={6} />
      </Field>
      <Field label="Internal note" hint="Admin-only. Never shown to customers.">
        <TextArea value={form.internalNote} onChange={(e) => setForm({ ...form, internalNote: e.target.value })} rows={2} />
      </Field>
      {err && <Banner tone="error">{err}</Banner>}
      <PrimaryButton onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Basics'}</PrimaryButton>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add apps/admin/app/(dashboard)/catalog/collections/[id]/tabs/basics-tab.tsx
git commit -m "feat(admin/collections): basics tab"
```

---

# PHASE 3 — Admin: Visuals, Products, Layout, Schedule, SEO tabs

Each tab follows the same pattern: local form state, PATCH on save, `onSaved` callback. Implement in this order:

### Task 3.1: Visuals tab

**Files:** Create `tabs/visuals-tab.tsx`, `_components/lookbook-uploader.tsx`

Fields: heroImageDesktop, heroImageMobile, heroVideo (URL), heroTextColor (light/dark radio), heroOverlay (0–100 slider), heroAlign (left/center/right radio), backgroundColor (hex picker), image (thumbnail), lookbook (upload list using ImageUploader + caption + delete; uses `POST /collections/:id/lookbook` and `DELETE /collections/lookbook/:id`).

- [ ] Use existing `<ImageUploader />` component for each image field
- [ ] LookbookUploader: stack of items, each `imageUrl` (uploader) + `caption` (text) + position (auto from index) + delete button
- [ ] Add Lookbook list re-fetch after add/delete
- [ ] Commit per tab

### Task 3.2: Products tab

**Files:** Create `tabs/products-tab.tsx`, `_components/sortable-product-list.tsx`, `_components/auto-rules-form.tsx`

- [ ] **For DROP / EDIT / PROMO types**: render `<SortableProductList>` (use `@dnd-kit/sortable`) with product search field at top. Add adds via `POST /collections/:id/products`. Remove via `DELETE /collections/:id/products/:productId`. Reorder calls `PATCH /collections/:id/products/reorder` with new productIds array.
- [ ] **For AUTO type**: render `<AutoRulesForm>` (no manual product list). Form fields: include categories multi-select, include tags multi-select, checkboxes for bestseller / new-arrival (with newArrivalDays number input), onSaleOnly, inStockOnly, exclude products multi-select, maxProducts. Preview button shows resolved products from `GET /collections/:slug/resolved`.
- [ ] **For Hybrid (PROMO or DROP with autoRules)**: render BOTH — pinned manual products on top, AUTO-resolved below.
- [ ] Install `@dnd-kit/sortable` if missing: `pnpm --filter @denimisia/admin add @dnd-kit/core @dnd-kit/sortable`
- [ ] Commit

### Task 3.3: Layout tab

**Files:** Create `tabs/layout-tab.tsx`

Fields:
- heroLayout: radio with previews (FULL_BLEED / SPLIT / VIDEO / MINIMAL)
- gridColumnsDesktop: 2/3/4 segmented
- gridColumnsMobile: 1/2 segmented
- defaultSort: dropdown
- showFilters: checkbox + nested filterConfig checkboxes (size, color, price, fit) — disabled if showFilters false
- showCountdown: checkbox (only meaningful if endDate set; show warning if no endDate)
- showSocialProof: checkbox
- showRelated: checkbox

- [ ] Build form
- [ ] Commit

### Task 3.4: Schedule tab

**Files:** Create `tabs/schedule-tab.tsx`

Fields:
- isActive (master toggle, prominent at top)
- startDate + time (datetime-local)
- endDate + time
- timezone (dropdown, default Asia/Dhaka)
- prelaunchTeaser checkbox (only shows if startDate in future)
- postEndBehavior radio: hide / redirect / archive
- postEndRedirect (text input for slug, only if redirect chosen)
- visibility: public / direct / members (radio)

Compute live status badge at top: "Live now" / "Starts in 5d 3h" / "Ended 2d ago" / "Hidden".

- [ ] Build form + status calculation
- [ ] Commit

### Task 3.5: SEO tab

**Files:** Create `tabs/seo-tab.tsx`

Fields:
- seoTitle (with char counter, recommend ≤60)
- seoDescription (textarea, char counter, recommend ≤160)
- ogImage (uploader, defaults to hero if blank)
- showInNav (checkbox)
- navOrder (number input)
- isFeaturedHome (checkbox)
- homepageSlot (1–5 dropdown, only if isFeaturedHome)
- showAsRail (checkbox)
- railTitle (text input, defaults to name)
- promoCode (text input, only shown for PROMO type)
- utmSource (text input, defaults to `collection-{slug}`)

Live preview: render Google SERP snippet + OG card.

- [ ] Build form + previews
- [ ] Commit + push everything from Phase 3

---

# PHASE 4 — Admin List Page Upgrades

### Task 4.1: List page with thumbnails, type, schedule, view link

**Files:** Modify `apps/admin/app/(dashboard)/catalog/collections/page.tsx`

- [ ] Add `image` thumbnail (use `next/image`) — fallback to placeholder square if null
- [ ] Add `Type` badge column: colored chip per type (DROP=indigo, EDIT=neutral, AUTO=emerald, PROMO=amber)
- [ ] Add `Status` column computed from `isActive` + `startDate` + `endDate`:
  - `Live` (green) — active & in window
  - `Scheduled` (blue) — active but startDate in future
  - `Ended` (gray) — endDate in past
  - `Hidden` (red) — !isActive
- [ ] Add `View on storefront` icon link → opens `https://denimisiabd.com/collections/<slug>` in new tab
- [ ] Search bar at top: filter rows by name/slug client-side
- [ ] Sort rows by `navOrder` then `name`
- [ ] Commit + push

---

# PHASE 5 — Storefront: Collection Landing Rewrite

### Task 5.1: Shared collections fetcher

**Files:** Create `apps/web/lib/collections.ts`

- [ ] Functions: `getCollectionBySlug(slug)`, `getActiveCollections()`, `getCollectionsByType(type)`, `getCollectionsForNav()`, `getCollectionsForRails()`, `getFeaturedHomeCollections()`. All use `/api/v1/collections/<slug>/resolved` (resolved endpoint already handles AUTO).
- [ ] Each wrapped with `cache()` from React for request deduplication.
- [ ] Commit

### Task 5.2: Hero variant component

**Files:** Create `apps/web/app/collections/[slug]/_components/collection-hero.tsx`

- [ ] Switch on `collection.heroLayout`:
  - `FULL_BLEED`: full-width image, title overlaid, subtitle below
  - `SPLIT`: 50/50 image-text split (image left or right based on heroAlign)
  - `VIDEO`: full-width muted autoplay loop
  - `MINIMAL`: no image, just typography on solid background (uses `backgroundColor`)
- [ ] Respect `heroTextColor` (white/black text), `heroOverlay` (gradient strength), `heroAlign` (text alignment)
- [ ] Mobile uses `heroImageMobile` if set, else `heroImageDesktop`
- [ ] Commit

### Task 5.3: Collection grid

**Files:** Create `apps/web/app/collections/[slug]/_components/collection-grid.tsx`

- [ ] Render products in grid using existing `<ProductCard>`
- [ ] Respect `gridColumnsDesktop` and `gridColumnsMobile` via Tailwind classes (cn helper)
- [ ] Apply `defaultSort` (sort the array)
- [ ] Commit

### Task 5.4: Rewrite landing page orchestration

**Files:** Modify `apps/web/app/collections/[slug]/page.tsx`

- [ ] Fetch via `getCollectionBySlug(slug)` → handle:
  - Not found → `notFound()`
  - Pre-launch (startDate > now && prelaunchTeaser) → render teaser
  - Ended (endDate < now) → behavior switch (hide=404 / redirect / archive banner)
  - Hidden (!isActive && not super_admin) → 404
- [ ] Render: `<CollectionHero>` + description block + lookbook-aware grid (interspersed) + related at bottom
- [ ] Commit + push, deploy web

---

# PHASE 6 — Lookbook, Sticky Filter, Countdown, Promo

### Task 6.1: Sticky filter bar

**Files:** Create `_components/sticky-filter-bar.tsx`

- [ ] Sticky bar with: sort dropdown, filter pills (size/color/price/fit) based on `filterConfig`
- [ ] State drives client-side filter of products array
- [ ] Visible only if `showFilters`
- [ ] Commit

### Task 6.2: Lookbook break

**Files:** Create `_components/lookbook-break.tsx`

- [ ] Renders an editorial image + caption between product rows
- [ ] Optional hotspots (small circles on x/y with product preview on hover) — defer hotspot click linking to phase later if scope tight
- [ ] Grid orchestrator inserts a `<LookbookBreak>` every 6 products (configurable later)
- [ ] Commit

### Task 6.3: Countdown banner

**Files:** Create `_components/countdown-banner.tsx`

- [ ] Renders only if `showCountdown && endDate`
- [ ] Live countdown ticking in client (Days / Hours / Mins / Secs)
- [ ] Auto-hides at endDate
- [ ] Commit

### Task 6.4: Promo banner

**Files:** Create `_components/promo-banner.tsx`

- [ ] Renders if `collection.type === 'PROMO' && collection.promoCode`
- [ ] Shows "{Discount} — auto-applies at checkout" (lookup discount from promo controller if available; otherwise just static text from `subtitle`)
- [ ] Commit + push, deploy

---

# PHASE 7 — Homepage AUTO + Drops Carousel

### Task 7.1: Wire Bestsellers / New Arrivals to AUTO collections

**Files:** Modify `apps/web/lib/homepage-sections.ts`, `apps/web/components/home/best-sellers.tsx`

- [ ] Bestsellers section reads from `getCollectionBySlug('bestsellers')` (which auto-resolves via API)
- [ ] New Arrivals section reads from `getCollectionBySlug('new-arrivals')`
- [ ] Rail title comes from `collection.railTitle ?? collection.name`
- [ ] If collection inactive / no products → return null (existing pattern from memory)
- [ ] Commit

### Task 7.2: Drops carousel

**Files:** Create `apps/web/components/home/drops-carousel.tsx`, modify `apps/web/app/page.tsx`

- [ ] Fetch `getFeaturedHomeCollections()` (returns isFeaturedHome=true, ordered by homepageSlot)
- [ ] Render horizontal carousel of full-width cards, each card has hero image + name + subtitle + "Shop the Drop" CTA
- [ ] Auto-rotate every 6s with manual nav
- [ ] Register section in page.tsx after hero, before bestsellers
- [ ] Commit + push, deploy

---

# PHASE 8 — Mega-menu, PDP Badge, Footer

### Task 8.1: Collections mega-menu

**Files:** Create `apps/web/components/nav/collections-megamenu.tsx`, integrate into main nav file

- [ ] On nav hover/click "Collections", dropdown shows all `showInNav=true` collections ordered by `navOrder`
- [ ] Each item: thumbnail + name + subtitle (truncated) + countdown chip if endDate within 7 days
- [ ] Click navigates to `/collections/<slug>`
- [ ] Commit

### Task 8.2: PDP "Part of" badge

**Files:** Create `apps/web/components/products/part-of-collection-badge.tsx`, integrate in `apps/web/app/products/[slug]/product-detail.tsx`

- [ ] On product detail, query backend for collections containing this product (add small endpoint or reuse existing `product.collections` if returned)
- [ ] Render small badge under product title: "Part of [Spring '26] →" linking to collection
- [ ] If multiple, show comma-separated
- [ ] Commit

### Task 8.3: Footer active edits list

**Files:** Find footer component, add a column

- [ ] Fetch `getActiveCollections()` and render top 5 in a column titled "Edits"
- [ ] Commit + push, deploy

---

# PHASE 9 — SEO + Sitemap + OG

### Task 9.1: Metadata builder

**Files:** Modify `apps/web/lib/seo/collection.ts`

- [ ] Use `seoTitle` if set else `${collection.name} — Denimisia`
- [ ] Use `seoDescription` if set else first 160 chars of `description`
- [ ] OG image: `collection.ogImage ?? heroImageDesktop ?? image`
- [ ] Add `prelaunchTeaser` aware: pre-launch uses different title "Coming MM/DD"
- [ ] Commit

### Task 9.2: Sitemap pruning

**Files:** Modify `apps/web/app/sitemap-pages.xml/route.ts`

- [ ] Only emit collections where `isActive=true AND (startDate <= now OR startDate IS NULL) AND (endDate IS NULL OR endDate > now)`
- [ ] Commit + push, deploy

---

# PHASE 10 — E2E + Docs

### Task 10.1: E2E smoke for collection editor

**Files:** New playwright spec in `apps/admin/tests/e2e/collections.spec.ts` (or wherever existing E2E lives)

- [ ] Login as admin
- [ ] Create collection "Test Drop" (DROP)
- [ ] Open editor, hop tabs, save each tab
- [ ] Attach 3 products
- [ ] Open storefront URL → assert hero + grid + 3 products visible
- [ ] Cleanup

### Task 10.2: Update HANDOFF.md and ClaudeXDenim.md

- [ ] Add session entry to `ClaudeXDenim.md` summarizing build (per memory `reference_work_reports`)
- [ ] Add Arena entry with A-NNN code
- [ ] Update HANDOFF.md current-state section: Collections feature is full
- [ ] Final commit

### Task 10.3: Final push + verify production

- [ ] `git push`
- [ ] Wait for Vercel + Render auto-deploys
- [ ] Hit live URLs:
  - https://admin.denimisiabd.com/catalog/collections (list)
  - https://admin.denimisiabd.com/catalog/collections/<id> (editor)
  - https://denimisiabd.com/collections/bestsellers (AUTO live)
  - https://denimisiabd.com/collections/spring-26 (DROP example)
- [ ] Smoke: AUTO bestsellers rail on homepage shows real products

---

## Self-Review

- ✅ Spec coverage: Every section of the design proposal maps to a phase/task — 4 types, 6 tabs, all storefront surfaces, AUTO logic, SEO, scheduling, mega-menu, PDP badge.
- ✅ Placeholder scan: No TBD/TODO. Each code block is concrete.
- ✅ Type consistency: `CollectionType` enum reused via DTO mirror enums; field names match across schema → DTO → service → admin → storefront.
- ⚠️ Open items deliberately deferred (documented above as out-of-scope): hotspot click navigation, password gating enforcement, A/B tests, promo rule engine integration.
- ⚠️ Phase 3 tabs use compressed per-tab task summaries (not full step-by-step) — this is intentional given the symmetric pattern. Each tab follows the Basics-tab template: local state → PATCH → onSaved.

---
