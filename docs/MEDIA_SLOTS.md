# Denimisia Media Slots — Source of Truth

Every image/video slot on the storefront. Registered in
[apps/api/src/modules/media/media.config.ts](../apps/api/src/modules/media/media.config.ts)
and seeded via `pnpm --filter database seed:media`.

The admin WYSIWYG editor at `/admin/media` renders a live iframe of the
storefront and overlays each slot for in-place editing.

## Upload Specs

All dimensions are the **target final display × 2 for retina**. Images should
be uploaded at these dimensions or larger — Supabase serves resized WebP via
transform URLs, so you never need to pre-scale. Videos are transcoded to
H.264 MP4 server-side.

### Homepage — `home`

| Slot | Type | Aspect | Recommended | Max |
|------|------|--------|-------------|-----|
| `hero_main` | image or video | 16:9 | 2560×1440 | 15 MB |
| `category_card_1..3` | image | 3:4 | 1200×1600 | 2 MB |
| `editorial_slide_1..4` | image or video | 16:9 | 2560×1440 | 3 MB |
| `brand_story_backdrop` | image or video | 16:9 | 2560×1440 | 4 MB |

### Collections

| Page | Slot | Type | Aspect | Recommended | Max |
|------|------|------|--------|-------------|-----|
| `collections-index` | `collections_hero` | image or video | 16:8.3 | 2560×1330 | 3 MB |
| `collection-bestsellers` | `bestsellers_parallax_hero` | image or video | 4:3 | 2560×1920 | 4 MB |

### Bundles

| Page | Slot | Type | Aspect | Recommended | Max |
|------|------|------|--------|-------------|-----|
| `bundles-index` | `bundles_hero` | image or video | 16:9 | 2560×1440 | 4 MB |

### Blog

| Page | Slot | Type | Aspect | Recommended | Max |
|------|------|------|--------|-------------|-----|
| `blog-index` | `blog_hero` | image | 16:9 | 2000×1125 | 2 MB |

### About

| Slot | Type | Aspect | Recommended | Max |
|------|------|--------|-------------|-----|
| `about_hero` | image or video | 16:8.3 | 2560×1330 | 3 MB |
| `about_story_image` | image | 4:5 | 1600×2000 | 2 MB |
| `about_body` | rich text | — | — | — |

### Auth (login / register / forgot / reset — shared panel)

| Slot | Type | Aspect | Recommended | Max |
|------|------|--------|-------------|-----|
| `auth_editorial_panel` | image | 2:3 | 1600×2400 | 3 MB |

### New slots added with this release

| Page | Slot | Type | Aspect | Recommended | Max |
|------|------|------|--------|-------------|-----|
| `career` | `career_hero` | image or video | 16:9 | 2560×1440 | 4 MB |
| `career` | `career_team_1..3` | image | 4:5 | 1200×1500 | 2 MB |
| `career` | `career_body` | rich text | — | — | — |
| `contact` | `contact_hero` | image or video | 16:8.3 | 2560×1330 | 3 MB |
| `contact` | `contact_side` | image | 4:5 | 1200×1500 | 2 MB |
| `returns` | `returns_hero` | image | 16:8.3 | 2560×1330 | 3 MB |
| `returns` | `returns_body` | rich text | — | — | — |
| `privacy` | `privacy_hero` | image | 16:8.3 | 2560×1330 | 3 MB |
| `privacy` | `privacy_body` | rich text | — | — | — |
| `size-guide` | `size_guide_chart_*` | image | 4:5 | 1600×2000 | 2 MB |
| `track-order` | `track_order_hero` | image | 16:8.3 | 2560×1330 | 3 MB |
| `outlets` | `outlet_card_1..2` | image | 16:10 | 1600×1000 | 2 MB |
| `not-found` | `not_found_illustration` | image or video | 4:3 | 1600×1200 | 3 MB |
| `search` | `search_empty_illustration` | image | 4:3 | 1600×1200 | 2 MB |

## Supported Formats

- **Images**: JPEG, PNG, WebP, AVIF. Served as WebP via Supabase transforms.
- **Videos**: MP4, WebM, MOV. Transcoded to H.264 MP4 (1080p max) with a JPEG
  poster frame. Hard cap of 40 MB on raw upload.

## Rules

- Content addressed — identical files dedupe via SHA-256 hash.
- Every change snapshots the previous state into `PageSlotHistory` (last 10 per slot).
- Rollback via `PUT /media/admin/rollback/:slotId/:historyId`.
- Slots marked `text-only` (body-copy slots) reject media uploads.
