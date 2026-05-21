# CMS Section Composer — Implementation Plan

**Date:** 2026-05-21
**Branch:** feat/returns-system (we'll likely split this into its own branch)
**Scope:** Replace the broken `/cms` hub stub with a real section composer that drives the storefront homepage.

## User decisions (locked in)

| Question | Choice |
|---|---|
| Instances | **Multiple per type** — you can place two EditorialBanners on the same homepage |
| Draft/publish | **Skip** — changes go live immediately |
| Global styles | **Wire to CSS variables** — Negative Space + Typography Flow control real layout |
| Recent history | **AuditLog-backed** — last 5 entries shown in the panel |

## Architectural overview

### Data model

Replace the existing unused `HomepageSection` table with a new shape. Each section is an **instance** of a section type with its own config blob.

```prisma
model HomepageSectionInstance {
  id         String   @id @default(cuid())
  type       HomepageSectionType
  position   Int                  // sort order on the page (0 = top)
  isActive   Boolean  @default(true)
  config     Json     @default("{}")   // type-specific config (see registry)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([position])
}

enum HomepageSectionType {
  HERO
  CATEGORY_CARDS
  NEW_ARRIVALS
  EDITORIAL_BANNER
  BUNDLE_DEALS
  TRENDING
  BESTSELLERS
  BRAND_STORY
}

model GlobalStorefrontStyles {
  id              String   @id @default(cuid())
  negativeSpace   Int      @default(1)   // 0=tight, 1=default, 2=airy
  typographyFlow  Int      @default(1)   // 0=tight, 1=default, 2=loose
  updatedAt       DateTime @updatedAt
}
```

The existing `HomepageSection` model gets dropped (it's unused).

### Section type registry

A single shared file declares the 8 types and what their config looks like:

```ts
// packages/types/src/sections.ts
export type SectionConfig =
  | { type: 'HERO'; heading?: string; }                       // mostly empty — slots drive content
  | { type: 'CATEGORY_CARDS'; }
  | { type: 'NEW_ARRIVALS'; title: string; limit: number; }
  | { type: 'EDITORIAL_BANNER'; slotGroupKey?: string; }      // override slot group for multi-instance
  | { type: 'BUNDLE_DEALS'; title: string; limit: number; }
  | { type: 'TRENDING'; title: string; limit: number; }
  | { type: 'BESTSELLERS'; collectionSlug?: string; title: string; }
  | { type: 'BRAND_STORY'; };

export const SECTION_TYPE_LABELS: Record<HomepageSectionType, string> = {
  HERO:             'Hero banner',
  CATEGORY_CARDS:   'Category cards',
  NEW_ARRIVALS:     'New arrivals',
  EDITORIAL_BANNER: 'Editorial carousel',
  BUNDLE_DEALS:     'Bundle deals',
  TRENDING:         'Trending',
  BESTSELLERS:      'Bestsellers',
  BRAND_STORY:      'Brand story',
};
```

### Storefront rendering

`apps/web/app/page.tsx` becomes data-driven:

```tsx
const sections = await fetchHomepageSections();      // active, ordered

return (
  <>
    {sections.map((section) => (
      <SectionRenderer key={section.id} section={section} />
    ))}
  </>
);
```

`SectionRenderer` is a switch that maps `section.type` → component, passing `section.config` as props. Components currently using slots keep working unchanged; non-slot components (NewArrivals, BundleDeals, Trending, Bestsellers) accept `title` and `limit` props.

### API endpoints

```
GET   /cms/homepage/sections             # admin: all sections, ordered
GET   /cms/homepage/sections/active      # storefront: active+ordered (revalidates every 60s)
POST  /cms/homepage/sections             # admin: add instance
PATCH /cms/homepage/sections/:id         # admin: update one (config, isActive)
DELETE /cms/homepage/sections/:id        # admin: remove instance
POST  /cms/homepage/sections/reorder     # admin: bulk reorder { id, position }[]

GET   /cms/homepage/styles               # global styles (no auth)
PATCH /cms/homepage/styles               # admin: update global styles
```

Every mutating endpoint writes an AuditLog entry tagged `cms.section.*` or `cms.styles.*`.

### Global styles wiring

CSS custom properties applied at root layout via the GlobalStorefrontStyles record:

| Setting | Var name | Values |
|---|---|---|
| Negative Space (0/1/2) | `--section-spacing-scale` | 0.75 / 1.0 / 1.4 |
| Typography Flow (0/1/2) | `--font-scale-ratio` | 1.15 / 1.25 / 1.333 |

Existing component spacing/typography needs to consume these vars (one global CSS update). Components that hardcode padding/margin in tailwind keep those values; the var multiplies them through a Tailwind config plugin.

## Phased delivery

Each phase is independently shippable and leaves the app in a working state.

### Phase 1 — Database + Backend (≈2.5 hrs)
- Drop `HomepageSection`, add `HomepageSectionInstance` + `GlobalStorefrontStyles`
- Migration: seed 8 default instances matching current homepage order
- Add the section type enum to `@repo/types`
- Implement all 7 endpoints on api with DTOs + validation + AuditLog writes
- Tests: unit tests for service, e2e for endpoints
- **Acceptance:** `GET /cms/homepage/sections/active` returns 8 default sections

### Phase 2 — Storefront refactor (≈2 hrs)
- Build `SectionRenderer` + section component wrappers that accept config
- Refactor `apps/web/app/page.tsx` to fetch + render dynamically
- Each of the 8 components accepts a `config` prop typed by the registry
- Storefront still looks identical to today (default config = current behaviour)
- **Acceptance:** Homepage renders unchanged but is now data-driven

### Phase 3 — Admin section composer UI (≈3 hrs)
- Rewrite `apps/admin/app/(dashboard)/cms/page.tsx`:
  - Section list shows actual rows from DB
  - Per-section row: toggle isActive, edit config (type-specific form), delete
  - "Insert new storytelling section" opens a modal: pick type → creates instance at bottom
  - Drag handles for reorder (use `@dnd-kit/sortable` if available, else simple ↑/↓ buttons)
- Wire Save Changes → no-op (since edits are immediate per user choice — repurpose as "Refresh from server")
- Wire Publish Storefront → no-op or remove (no draft state)
- **Acceptance:** Can add/edit/reorder/delete sections from admin; storefront reflects changes after revalidation

### Phase 4 — Global styles + Recent History (≈1.5 hrs)
- Add CSS variable injection in root layout reading from `/cms/homepage/styles`
- Wire the Negative Space and Typography Flow toggles to PATCH the styles record
- Implement Recent History panel reading from AuditLog (last 5 entries tagged `cms.*`)
- **Acceptance:** Changing Negative Space tightens/loosens storefront spacing; History panel lists actual edits

### Phase 5 — Polish + verification (≈1 hr)
- Type-check all apps
- Run unit + e2e tests
- Manual smoke: add 2 EditorialBanners with different slot group keys, verify both render
- Manual smoke: reorder sections, toggle one off, verify storefront

**Total estimate:** 9-10 hours focused work.

## Risks / open questions

1. **Slot group conflict for multi-instance.** Right now `home.editorial_*` is a fixed slot group. If you place TWO EditorialBanners, both currently read the same slots. Fix: each instance's `config.slotGroupKey` overrides which slot group it reads from. We pre-register a second group (`home.editorial_secondary_*`) so a second instance has somewhere to point. This is implicit in Phase 1.

2. **NEW_ARRIVALS / TRENDING data source.** These currently fetch products via specific API queries (`isNewArrival: true`, `isTrending: true`). Multi-instance support requires either letting each instance specify a query, or accepting they always show the same products. Plan assumes the latter for v1 — the only config is `title` and `limit`.

3. **`@dnd-kit/sortable`** may not be installed. If not, I'll either install it or fall back to ↑/↓ position buttons (less elegant but zero new deps).

4. **`Preview Store` button** currently does nothing. Plan repurposes it to `target="_blank"` link to `http://localhost:3000` (or production URL in prod).

5. **Existing curation system** (referenced via `fetchCuratedSection` in code) may overlap with what some sections do. I'll verify in Phase 1 and reconcile if needed.

## What gets deleted

- The `HomepageSection` Prisma model (replaced by `HomepageSectionInstance`)
- Whatever old endpoints exist for `/cms/sections` (currently `listSections`, `getSectionByKey`, etc. — replaced by new homepage endpoints)
- The placeholder `cms-draft-v1` / `cms-published-v1` localStorage logic in the admin page

## Sign-off needed before I start

1. Approve the data model (especially the section type enum — anything missing?)
2. Approve the global style values table (`--section-spacing-scale` 0.75/1.0/1.4, `--font-scale-ratio` 1.15/1.25/1.333) or tell me different values
3. Approve repurposing Save Changes → Refresh and Publish Storefront → no-op (no draft state)
4. Confirm splitting this off into its own branch (`feat/cms-section-composer`) or staying on `feat/returns-system`
