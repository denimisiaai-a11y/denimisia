# Denimisia Catalog — Cleaned Output

Generated from `products_details.csv` (78 flat rows).

## Shape
- **27 parent products** (grouped by style model)
- **78 variants** (one per wash/color)
- **570 inventory rows** (variant × size)
- **14,193 total units** in stock
- **75** enabled variants / **3** disabled

## Cleanup Applied
- [x] Schema normalization → parent/variant split
- [x] Encoding fixed → all output is clean UTF-8 (mojibake stripped; Bengali was destroyed at source and cannot be recovered)
- [x] Category taxonomy deduped → 3 groups (shop, collections, series) with 21 leaves total
- [x] SEO regenerated → real meta titles + descriptions (≤160 chars), per parent AND per variant
- [x] Cost prices backfilled → **40% of retail** as placeholder. REPLACE with real cost before launch.
- [x] Size stock matrix → exploded into flat inventory table (sku, model, wash, size, qty)
- [x] Image manifest built → R2 target paths reserved with gallery slots (front/back/detail/model)

## Files
| File | Purpose |
|------|---------|
| `output/products.json`    | Parent products with nested variants (27 parents) |
| `output/categories.json`  | Clean taxonomy + model-to-category memberships |
| `output/inventory.json`   | Flat variant × size stock rows |
| `output/seo.json`         | Meta titles/descriptions per parent + variant |
| `output/images.json`      | Source URLs + R2 target paths (migration pending) |
| `output/prisma_seed.ts`   | TS constants ready to import into a Prisma seed |

## Known Data Quality Flags (require human action)
- **Cost prices**: 40% ratio is a guess. Boss needs to provide real cost.
- **Images**: only one thumbnail per variant. Gallery slots are reserved but empty. Need photo shoot or vendor assets before launch.
- **Disabled variants** (3): [('21003', 'ASH'), ('41011', 'DTN'), ('41011', 'MBA')]
- **Enabled but zero-stock** (1): [('2116', 'MBA')]
- **Bengali tags**: source had mojibake (`à¦­à¦¾à¦à¦°à¦¾à¦²` style). Tags with corrupted Bengali were dropped — re-source if Bangla SEO is needed.
- **Related products**: source stored name strings, not IDs. Intentionally skipped — will be rebuilt from model family + tag overlap at query time.
- **Size Chart column**: 100% empty in source. Add a per-fit size chart (at parent level) before launch.

## Suggested Next Step
Generate the Prisma schema migration from `output/products.json` + `output/inventory.json`, then
import `prisma_seed.ts` into `packages/database/prisma/seed.ts` for a one-shot catalog load.
