# Fit Silhouette Engine — Design Spec

**Date:** 2026-05-21
**Author:** Brainstorm session
**Status:** Draft (pending review)
**Phase:** 1 of 2 — engine + admin entry + per-PDP display + Find My Size enrichment. Phase 2 (multi-garment outfit builder) is out of scope here and gets its own spec later.

---

## 1. Problem

The storefront currently shows fit/size information in two disconnected places:

- A "Size Guide" button → modal with a per-variant size chart and (for some categories) a hand-coded SVG diagram.
- A "Find My Size" button → chat bot that compares the customer's measurements against the size chart.

The customer-facing visual cues for "where on the body does this garment sit?" exist only as static, hand-drawn diagrams under `apps/web/components/product/size-diagrams/`, and they aren't driven by per-product data — every cropped tee shows the same diagram. There's no system-level way for admin to communicate fit characteristics (cropped vs full length, high-waisted vs mid-rise, sleeve length, etc.) visually.

Admin side: the product editor captures categorical attributes (rise, length, silhouette, sleeve, neckline) and a per-variant size chart with 4 dimensions per type. There's no place to enter the more detailed measurements (front/back rise, hem opening, cuff opening, etc.) that premium denim/apparel customers expect, and no way to visually verify how a garment will appear on a customer's body before publishing.

## 2. Goals

1. Render a per-product visual showing **where** the garment sits on a human body — driven by data the admin enters, not hand-coded per product.
2. Capture the data the visual needs through a single consolidated admin surface that also expands per-variant size capture beyond what's stored today.
3. Replace the existing Size Guide and Find My Size PDP buttons with a single unified "Size & Fit" entry point.
4. Feed the new fit data into the Find My Size chat bot for style-aware recommendations.
5. Backfill all existing products as part of rollout so customers don't see degraded UX on any product.

## 3. Non-Goals

- Multi-garment outfit builder (Phase 2).
- Customer-facing body-type personalisation ("show me on a body like mine").
- Replacing the general `/size-guide` page or its hand-coded category diagrams (`size-diagrams/denim.tsx` etc.) — these can be retired later.
- Bot rewrite. Bot logic gets minimal additive changes.
- 3D rendering, body scanning, AR try-on.

## 4. High-Level Architecture

Three concerns separated cleanly:

1. **Body data** — two SVG silhouettes (men + women) stored in a new `Silhouette` DB table, each with anatomical landmark Y-positions. Editable in a dedicated admin tool.
2. **Garment fit data** — categorical fit presets + optional drag offsets, stored as JSON on each product. Edited via the consolidated "Size & Fit" admin section.
3. **Rendering engine** — a shared package (`packages/fit-engine`) that both the storefront modal and the admin live preview consume. Same renderer → admins see exactly what customers will see.

## 5. Data Model

### 5.1 `Silhouette` table (new)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `gender` | enum `'MALE' \| 'FEMALE'` | Unique |
| `svgPath` | text | The body outline as SVG path commands |
| `viewBox` | text | e.g. `"0 0 200 320"` |
| `landmarks` | jsonb | `{ collar: { y: number }, shoulder: { y, x? }, armpit, naturalWaist, highWaist, lowWaist, hip, knee, midCalf, ankle, bicep, elbow, midForearm, wrist }` |
| `version` | int | Bump on every update for cache busting |
| `createdAt`, `updatedAt` | timestamps | |

Seeded on migration with two rows (men + women) using well-drawn starter SVGs.

### 5.2 `Product.fitLandmarks` JSON column (new, nullable)

Discriminated union by product type:

```ts
type FitLandmarks =
  | { kind: 'PANTS';
      rise: 'low' | 'mid' | 'high';
      hem: 'above-knee' | 'mid-calf' | 'ankle' | 'floor';
      legShape: 'skinny' | 'slim' | 'straight' | 'wide' | 'flared' | 'bootcut';
      silhouetteGender: 'MALE' | 'FEMALE' | 'BOTH';
      offsets?: GarmentOffsets;
    }
  | { kind: 'SHIRTS';
      hem: 'cropped' | 'waist' | 'hip' | 'tunic';
      sleeve: 'sleeveless' | 'short' | 'three-quarter' | 'long';
      neckline: 'crew' | 'v-neck' | 'polo' | 'henley' | 'mock-neck' | 'button-up';
      bodyFit: 'slim' | 'fitted' | 'regular' | 'relaxed' | 'oversized';
      silhouetteGender: 'MALE' | 'FEMALE' | 'BOTH';
      offsets?: GarmentOffsets;
    }
  | { kind: 'JACKETS';
      hem: 'cropped' | 'hip' | 'mid' | 'long';
      sleeve: 'short' | 'three-quarter' | 'long';
      closure: 'zip' | 'button' | 'snap' | 'drape';
      bodyFit: 'fitted' | 'regular' | 'oversized';
      silhouetteGender: 'MALE' | 'FEMALE' | 'BOTH';
      offsets?: GarmentOffsets;
    };

type GarmentOffsets = {
  hemY?: number;          // pixel offset from preset hem position
  topY?: number;          // pixel offset from preset top position
  sleeveEndY?: number;    // pixel offset from preset sleeve end
  bodyWidthScale?: number; // 0.85–1.20 multiplier on default body width
};
```

Categorical fields are the source of truth. `offsets` is fine-tuning produced by the drag editor, applied additively on top of the preset positions.

### 5.3 `ProductSizeChart` extension (no schema change)

Existing schema is already normalised (`(productId, sizeKey, dimension) → (bodyValueIn, garmentValueIn)`). The change is **taxonomy only** — `SIZE_CHART_DIMENSIONS` in `product-taxonomy.ts` gains new entries:

| Type | Existing dimensions | NEW dimensions |
|---|---|---|
| PANTS | waist, hip, inseam, thigh | front rise, back rise, hem opening, waistband height |
| SHIRTS | chest, shoulder, length, sleeve | bicep, hem opening, neck/collar width, cuff opening, armhole depth |
| JACKETS | chest, shoulder, length, sleeve | bicep, hem opening, cuff opening, back length, armhole depth |

Existing product rows are untouched. Cells for new dimensions simply start empty and admin fills them during backfill.

## 6. Storefront UX

### 6.1 PDP entry point

The PDP gets **one button** — "Size & Fit" — replacing both the current "Size Guide" and "Find My Size" buttons.

### 6.2 Unified "Size & Fit" modal

| Region | Content |
|---|---|
| Header | Title "Size & Fit", in/cm toggle, close |
| Left column (desktop) | Men/Women toggle (shown only if `silhouetteGender === 'BOTH'`); silhouette + garment overlay rendered by the engine; up to two minimal red anatomical callouts ("high waist", "ankle") — NO numeric measurements drawn on the image; one-line product summary below ("High-waisted skinny jeans — sit at natural waist, end at ankle") |
| Right column (desktop) | Per-variant size chart table including all existing + new dimensions for the product type; in/cm toggle synced with header; "Help me pick →" CTA at bottom; copy "Opens chat for personalised sizing" |
| Mobile layout | Stacks vertically: silhouette → size chart → CTA |

The silhouette stays visually clean. Numbers live in the chart. The customer reads the chart to find numeric data; they read the silhouette to understand the *style* of fit.

### 6.3 "Help me pick" CTA

Triggers the existing Find My Size chat flow. The bot is enriched (Section 9) to include landmark style context in its replies. Otherwise the chat flow is unchanged.

### 6.4 Graceful degradation

If `fitLandmarks === null`:
- Silhouette renders with a neutral, type-appropriate placeholder overlay (e.g., generic mid-rise straight pants).
- No fit summary line.
- Size chart still shows whatever per-variant data exists.

This is the rollout safety net; admins backfill these products to clear the placeholder.

## 7. Admin UX

### 7.1 Consolidated "Size & Fit" section

The product editor's existing separate "Size Chart" section is replaced by a single **"Size & Fit"** section appearing between "Variants" and "Media" in the form flow.

The section has three vertically stacked blocks:

**Block 1 — Live Preview (visual anchor, top)**
- Silhouette + garment overlay rendered live by the same engine the storefront uses.
- Men/Women toggle at top of preview.
- "Edit overlay" button → enters drag mode; red handles appear on the garment edges. Admin drags to fine-tune; changes write to `fitLandmarks.offsets`.
- "Reset tweaks" button → clears `offsets`, returns to preset-only rendering.

**Block 2 — Fit Presets (right of preview, top-right)**
- Categorical dropdowns per product type (rise, hem, leg shape for pants; hem, sleeve, neckline, body fit for shirts; etc.).
- Auto-prefilled from the existing Attributes section — no double entry. Changes propagate back to Attributes when edited here.
- "Default silhouette gender" selector — `Women`, `Men`, or `Show toggle to customer` (= `BOTH`).
- Yellow tip: "Categorical picks are the source of truth. Drag tweaks are visual polish on top."

**Block 3 — Detailed Size Chart (below)**
- Table of variant size × (body, garment) values × all dimensions for the product type (existing + new).
- New dimensions visually distinguished (subtle green tint in header).
- In/cm toggle; blank-cell-omit semantics carried over from existing editor.

### 7.2 Silhouette editor (new admin page)

Path: `apps/admin/app/(dashboard)/settings/silhouettes/page.tsx`

- Lists both silhouettes (Women, Men) with thumbnails and version numbers.
- Click to edit: full-page view shows the silhouette with red landmark pins overlaid.
- Drag a pin vertically to adjust its Y position. Save persists landmark map + bumps `version`.
- "Upload new SVG" replaces the silhouette path entirely (rare action).
- Changes are immediately reflected in all product previews and storefront (cache invalidated by `version` bump).

### 7.3 Admin parity

The Size & Fit section behaves identically on both `/products/new` and `/products/[id]/edit`. Every field is editable on existing products. No "read-only after publish" restrictions.

### 7.4 Backfill tooling

The existing admin dashboard `fit-data-coverage-card.tsx` is extended:
- Counts products with `fitLandmarks === null`.
- Counts products with missing new dimensions in their size chart.
- Click-through → filtered product list view showing products needing attention.

## 8. Engine Architecture

### 8.1 Shared package: `packages/fit-engine/`

Newly created alongside `packages/database/`. Pure React + TypeScript, no env-specific deps.

```
packages/fit-engine/
├── package.json
├── src/
│   ├── index.ts
│   ├── types.ts                # FitLandmarks, SilhouetteData, LandmarkMap, GarmentOffsets
│   ├── silhouette-canvas.tsx   # <SilhouetteCanvas silhouette overlays editable />
│   ├── overlays/
│   │   ├── pants.tsx           # <PantsOverlay silhouette fit />
│   │   ├── shirt.tsx
│   │   └── jacket.tsx
│   ├── drag-handles.tsx        # admin-only edit handles
│   ├── presets/                # preset → landmark mapping per garment kind
│   │   ├── pants-presets.ts
│   │   ├── shirt-presets.ts
│   │   └── jacket-presets.ts
│   └── default-overlays.ts     # placeholder overlays for fitLandmarks=null
└── tsconfig.json
```

Imported by both `apps/web` (storefront modal) and `apps/admin` (live preview + drag editor).

### 8.2 Renderer contract

```ts
<SilhouetteCanvas
  silhouette={silhouetteData}        // SVG path + landmarks loaded from /silhouettes
  overlays={[                         // composable for Phase 2; today always length 0 or 1
    { kind: 'PANTS', fit: product.fitLandmarks }
  ]}
  callouts={['high-waist', 'ankle']} // optional storefront callouts
  editable={false}                    // true in admin drag mode
  onOffsetsChange={undefined}         // called when admin drags
/>
```

The renderer composes silhouette + overlays + optional callouts + optional drag handles into one SVG.

### 8.3 API endpoints

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/silhouettes` | GET | public | Returns both silhouettes (men + women). Cached via Next.js ISR + API response cache. Cache key includes `version`. |
| `/admin/silhouettes/:gender` | PUT | admin | Updates landmark positions or replaces `svgPath`. Bumps `version`. |
| `/products/:id` | GET | public | Existing endpoint. Response extended to include `fitLandmarks`. |
| `/admin/products/:id` | PUT | admin | Existing endpoint. Payload extended to accept `fitLandmarks`. |
| `/admin/products` | POST | admin | Existing endpoint. Payload extended to accept `fitLandmarks`. |

### 8.4 Caching

- Silhouettes: long-lived public cache, invalidated by `version` change. The client fetches `/silhouettes` once per session; the server returns 304 thereafter.
- Per-product fit data: lives inside the existing product fetch, no extra round-trip.
- Admin live preview: skips cache; always reflects current form state.

## 9. Find My Size Bot Integration

Minimal, additive changes to `apps/api/src/modules/bot/`.

### 9.1 Loader extended

`bot.sizing.service.ts` already loads product sizing context. Extension: include `product.fitLandmarks` and `product.type` in the loaded context.

### 9.2 Style-context output

A new `formatFitStyleNote(fit: FitLandmarks): string | null` function returns a short human-readable summary, e.g.:

- PANTS high + ankle + skinny → *"High-waisted skinny — sits at natural waist, ends at ankle."*
- SHIRTS cropped + short + crew + relaxed → *"Cropped relaxed tee — ends above natural waist."*
- JACKETS hip-length + long + zip + regular → *"Hip-length zip-up — ends at hip line, full-length sleeves."*

The bot appends this note to its size recommendation: *"Size M fits your measurements. {style-note}"*

### 9.3 New dimensions available but not yet used

The expanded per-variant dimensions (bicep, front rise, etc.) become available in the bot's loaded context but are not used in scoring logic in Phase 1. They're plumbing for future tuning.

### 9.4 Files touched

- `apps/api/src/modules/bot/bot.sizing.service.ts` — loader extension, style-note generation
- `apps/api/src/modules/bot/bot.constants.ts` — style-note templates per attribute
- `apps/api/src/modules/bot/bot.parser.service.ts` — pass-through change so style notes survive response parsing

## 10. Files Touched Summary

**New files:**
- `packages/fit-engine/` (full new package — see 8.1)
- `packages/database/prisma/migrations/<timestamp>_add_fit_silhouette/` — adds `Silhouette` table + `Product.fitLandmarks` column + seed
- `apps/api/src/modules/silhouettes/` — controller, service, DTOs
- `apps/admin/app/(dashboard)/settings/silhouettes/page.tsx` + supporting components
- `apps/web/components/products/size-and-fit-modal.tsx` — replaces `size-chart-modal.tsx`
- `apps/admin/components/products/size-and-fit-editor.tsx` — replaces `size-chart-editor.tsx`

**Modified files:**
- `apps/web/lib/product-taxonomy.ts` — extend `SIZE_CHART_DIMENSIONS` per type
- `apps/admin/lib/product-taxonomy.ts` — mirror taxonomy extension
- `apps/web/app/products/[slug]/product-detail.tsx` — replace two PDP buttons with one "Size & Fit"
- `apps/admin/app/(dashboard)/products/new/page.tsx` — use new `SizeAndFitEditor`
- `apps/admin/app/(dashboard)/products/[id]/page.tsx` — same change for edit flow
- `apps/admin/app/(dashboard)/_components/dashboard/fit-data-coverage-card.tsx` — extend coverage stats to include new fit fields
- `apps/web/lib/api.ts` — extend `getProductSizeChart` / product fetch shapes
- `apps/api/src/modules/products/products.dto.ts` — accept `fitLandmarks` on create/update
- `apps/api/src/modules/products/products.service.ts` — persist `fitLandmarks`
- `apps/api/src/modules/products/products.controller.ts` — surface `fitLandmarks` on read
- `apps/api/src/modules/bot/bot.sizing.service.ts` + `.constants.ts` + `.parser.service.ts` — Section 9 changes

**Removed files:**
- `apps/web/components/products/size-chart-modal.tsx`
- `apps/admin/components/products/size-chart-editor.tsx`

**Untouched in Phase 1 (kept):**
- `apps/web/components/product/size-diagrams/*` (denim/tshirt/sweater/outerwear) — these serve the general `/size-guide` page.
- `apps/web/components/product/size-guide-modal.tsx` — general size guide modal stays.

## 11. Rollout

1. **Migration deploys first** — adds `Silhouette` table (seeded with starter SVGs) and `Product.fitLandmarks` column (nullable). Safe — no data is altered.
2. **API + engine code deploys** — endpoints surface the new data; storefront and admin import the new package.
3. **Storefront switches to unified modal** — old buttons removed, new "Size & Fit" button live. Graceful degradation handles products without fit data.
4. **Admin tooling live** — silhouette editor at `/settings/silhouettes`, product editor uses the new consolidated section.
5. **Backfill window** — coverage dashboard surfaces gaps; admin team re-edits products to populate fit data. Aim for 100% before announcing the feature externally.
6. **Bot enrichment ships** — once backfill ≥ 90%, deploy the bot style-note output.

Rollback plan: each deploy step is independently revertable. The unified modal change can be reverted to the old size guide + find my size buttons with one commit; the migration can be rolled forward but doesn't strictly need to be rolled back (nullable column is harmless if unused).

## 12. Acceptance Criteria

- [ ] On any PDP, clicking "Size & Fit" opens the unified modal.
- [ ] Modal shows a silhouette with the correct overlay for the product's type and fit data.
- [ ] Modal shows the per-variant size chart including all new dimensions for the product type.
- [ ] "Help me pick" opens the existing chat flow.
- [ ] If `silhouetteGender === 'BOTH'`, customer can toggle men/women in the modal.
- [ ] If `fitLandmarks === null`, the silhouette still renders with a sensible placeholder.
- [ ] In admin, creating a new product surfaces the "Size & Fit" section with all blocks (preview, presets, chart).
- [ ] Editing an existing product surfaces the same section with full edit access.
- [ ] Drag handles in admin write to `offsets` and the live preview updates immediately.
- [ ] "Reset tweaks" clears `offsets`.
- [ ] The silhouette editor at `/settings/silhouettes` allows dragging landmark pins and saving.
- [ ] The silhouette editor accepts an SVG upload that replaces `svgPath` and re-renders all dependent previews.
- [ ] The Find My Size bot includes a style note in its size recommendation when `fitLandmarks` is present.
- [ ] The admin dashboard's fit data coverage widget reflects new fit fields and links to a filtered product list.
- [ ] All admin endpoints have a working admin UI; no API capabilities exist without a UI counterpart.
- [ ] All admin saves round-trip to the storefront within one cache TTL.

## 13. Open Questions

None at design lock. Phase 2 (multi-garment outfit builder) gets its own spec.
