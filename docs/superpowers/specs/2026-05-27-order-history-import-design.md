# Order History Import — Design Spec

**Status:** Draft, awaiting user review
**Author:** Claude (brainstormed with joycg, 2026-05-27)
**Builds on:** [shadow customer records spec](2026-05-26-shadow-customer-records-design.md) (shipped 2026-05-27)
**Decision:** Single PR (admin UI + backend), terminal state → `writing-plans`

---

## 1. Motivation

The shadow-customer-records feature (just shipped) lets admin import contact info via CSV. But a customer record with no order history is much less useful for migration — without LTV / segmentation / repeat-purchase data, the admin can't act on the customer at all. Real value of migration depends on bringing the *whole customer relationship* forward, not just name+phone.

This spec adds **historical order import** — a one-time (occasionally re-runnable) admin tool to bulk-import past orders from the user's previous e-commerce site into Denimisia's `Order` + `OrderItem` tables. Customers attach to those orders via the existing shadow-record + match-or-create logic.

## 2. Goals

- Admin can upload a CSV of historical orders via an Admin UI modal (matching the Customer Import CSV pattern).
- Importer creates real `Order` + `OrderItem` rows attached to the right `User` (existing claimed, existing shadow, or auto-created shadow).
- Unknown SKUs become hidden placeholder products so no order is blocked.
- Existing stock counts are NOT decremented for historical orders.
- Re-running the same CSV is idempotent (skip already-imported orders by `orderNumber` dedup).
- Result panel shows admin exactly what happened: imported / skipped / errored / placeholders created.
- Historical orders show in customer accounts after they self-register, sorted naturally by original date.

## 3. Non-Goals (Deferred)

- **Multi-source import** — only one CSV format supported; users with multiple legacy systems shape data into our format separately.
- **CLI-only mode** — admin UI is the surface; no shell-only path.
- **Automated catalog merging** — admin manually decides what to do with placeholder products via existing product-edit/delete admin pages.
- **Status detail beyond DELIVERED** — every imported order is `DELIVERED`. Admin can manually change status afterward if needed.
- **Email notification on import** — no transactional emails fire during/after import (would spam customers about old orders they don't remember).
- **Refund / return history** — imports treat all orders as fulfilled-and-done. RETURNED/REFUNDED status is not modelled.
- **Inventory adjustment for imported orders** — stock counts assume current-state, ignore historical sales.

## 4. CSV Format

### Required columns

| Column | Type | Notes |
|---|---|---|
| `order_ref` | string | Old-system order identifier. Becomes `LEGACY-<order_ref>` in our DB. Used for dedup. |
| `order_date` | ISO date or datetime | `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM:SSZ`. Written to `Order.createdAt`. |
| `customer_email` | email | Lowercased before lookup. Used by match-or-create. |
| `sku` | string | One row per line item. Resolves to `ProductVariant.sku`. Unknown → auto-create placeholder. |
| `quantity` | int > 0 | Quantity for this line item. |
| `unit_price` | decimal ≥ 0 | Whole taka. Stored as-is. |

### Optional columns

| Column | Default if missing |
|---|---|
| `customer_name` | empty (only used for new shadow creation) |
| `customer_phone` | empty (passes through `normalizeAndValidate`; ignored if invalid) |
| `status` | accepted but ignored — every import is `DELIVERED` |
| `shipping_cost` | 0 |
| `discount_amount` | 0 |
| `ship_line1` | `"Imported from legacy system"` |
| `ship_city` | `"Unknown"` |
| `ship_state` | `"Unknown"` |
| `ship_postal` | `"0000"` |
| `ship_country` | `"BD"` |
| `notes` | null |

### Multi-row order grouping

Multiple rows with the same `order_ref` are grouped into one Order with multiple OrderItems:

- Row 1 of an order_ref is the "header row" — its order-level columns (order_date, customer_email/name/phone, ship_*, notes, shipping_cost, discount_amount) are authoritative.
- Subsequent rows for the same order_ref contribute their item-level columns (sku, quantity, unit_price). Order-level columns on follow-up rows are IGNORED (no checking for consistency — first row wins).

### File constraints

- Max file size: 20 MB (mirrors the customer importer).
- UTF-8 with optional BOM (auto-stripped).
- Header row required.
- Reject upload with clear error if any required column is missing or file is unparseable.

## 5. Data Flow

```
Parse phase (in-memory, no DB):
  - Read CSV stream → list of typed rows
  - Per-row validation (required columns, types, formats)
  - Group rows by order_ref → Map<order_ref, OrderGroup>
  - Each OrderGroup = { header: {…}, items: ParsedItem[] }
  - Collect per-row errors

Pre-flight phase (DB reads):
  - Find existing Users by email (set-membership query)
  - Find existing ProductVariants by SKU (set-membership query)

Import phase (one transaction per OrderGroup):
  - Skip-if-exists: SELECT Order WHERE orderNumber = 'LEGACY-' + order_ref
    → if found, mark as skipped_duplicate, continue
  - Customer linkage:
    - If User exists CLAIMED → use userId; DO NOT mutate profile
    - If User exists SHADOW → use userId; fill-blanks update (firstName, phones[])
    - Otherwise → upsert new shadow with email/name/phone (race-safe)
  - Per-item: resolve sku → variantId
    - SKU known → use existing variantId
    - SKU unknown → auto-create placeholder Product + Variant (cached for batch)
  - Compute: subtotal = Σ(qty × unit_price), total = subtotal + shipping_cost − discount_amount
  - INSERT Order with:
      orderNumber = 'LEGACY-' + order_ref
      userId      = resolved
      guestEmail/Name/Phone = passed through (snapshot for traceability)
      shippingAddress = parsed-or-placeholder JSON
      subtotal/discount/shippingCost/total = computed
      status = 'DELIVERED'
      notes  = csv_notes
      createdAt = order_date (overrides default NOW() — preserves historical date)
  - INSERT OrderItems for each line, with snapshot JSON populated from variant info
  - **SKIP stock decrement** — bypass the normal stock-op path
```

### Placeholder product shape

When a SKU isn't found in the current catalog:

```ts
const placeholderProduct = await tx.product.create({
  data: {
    name: sku,                                           // raw sku as name
    slug: `legacy-${sku.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
    description: `Legacy product imported from order history. SKU: ${sku}`,
    price: unit_price,
    images: [],
    isActive: false,                                     // hidden from storefront
    categoryId: legacyImportsCategoryId,                 // find-or-create on first use
  },
});
const placeholderVariant = await tx.productVariant.create({
  data: {
    productId: placeholderProduct.id,
    sku: sku,
    size: '-',
    color: '-',
    stock: 0,
    price: unit_price,
    images: [],
  },
});
```

A single `"Legacy Imports"` category is upserted at the start of the import (slug `legacy-imports`, name `Legacy Imports`). All placeholder products attach to it so admin can browse them as a group in Categories.

### Result panel (returned from endpoint)

```ts
interface ImportOrdersResult {
  totalOrdersInFile: number;
  imported: number;
  skipped_duplicate: number;
  skipped_invalid: number;
  placeholdersCreated: number;
  newShadowsCreated: number;
  ordersAttachedToExisting: number;
  errors: Array<{ row: number; order_ref?: string; reason: string }>;
  placeholdersReport: Array<{ sku: string; occurrences: number; productId: string }>;
}
```

`errors` lists row-level rejections (max 100; rest truncated with "…and N more"). `placeholdersReport` lists every placeholder product created so admin knows what needs catalog cleanup.

## 6. Auto-Claim Implications

The order import interacts with the shadow-customer system already shipped. Three edge cases:

| Scenario | Behavior |
|---|---|
| **Import-then-register** (Day 1 import → Day 30 customer signs up) | Auto-claim already wired (shadow-records Task 9). Customer's imported orders appear in their account on first login. Zero new code. |
| **Register-then-import** (real claimed customer pre-exists, import targets their email) | Import attaches old orders to the claimed account. Does NOT mutate profile (mirrors guest-checkout attach-on-claimed safety). Customer sees more orders next time they log in. |
| **Import → later guest checkout** (shadow created by import, customer later orders as guest with same email) | Existing match-or-create (shadow-records Task 10) attaches new guest order + fills blanks on the shadow. Both old and new orders coexist on the same User. |

## 7. Admin UI

### Trigger

`apps/admin/app/(dashboard)/orders/page.tsx` — new "Import Order History" button in the toolbar (alongside existing actions like Export).

### Modal — initial state

```
┌─ Import Order History ───────────────────────── × ┐
│  ⚠ One-time migration tool                        │
│                                                   │
│  Upload a CSV with these columns:                 │
│      Required: order_ref, order_date,             │
│                customer_email, sku, quantity,     │
│                unit_price                         │
│      Optional: customer_name, customer_phone,     │
│                shipping_cost, discount_amount,    │
│                ship_line1..ship_country, notes    │
│                                                   │
│  - Multiple rows with same order_ref = one order  │
│  - Already-imported order_refs are skipped        │
│  - All orders set to DELIVERED status             │
│  - Current stock counts NOT affected              │
│  - Unknown SKUs → hidden placeholder products     │
│  - Maximum file size: 20 MB                       │
│                                                   │
│   [ Choose File ]                                 │
│                                                   │
│                          [Cancel]   [Import]      │
└───────────────────────────────────────────────────┘
```

### Modal — result state

Replaces the form with a result summary (counts + truncated error list + downloadable reports). "Done" button closes the modal and refreshes the orders list.

Two `[Download report]` buttons:
- Row errors → CSV of (row, order_ref, reason) for fixing source data
- Placeholder products → CSV of (sku, occurrences, productId) for catalog cleanup

### Where customers see old orders

No storefront changes needed. The existing `/account/orders` page reads `Order WHERE userId = me ORDER BY createdAt DESC`. Imported orders sort by their original `order_date` value (since the importer overrides `createdAt`).

## 8. API

### POST `/orders/admin/import`

| | |
|---|---|
| **Auth** | Admin only (RolesGuard + Roles(ADMIN, SUPER_ADMIN)) |
| **Body** | `multipart/form-data` with field `file` (CSV, max 20 MB) |
| **Response** | `ImportOrdersResult` (shape above) |

Uses `FileInterceptor` with 20 MB limit (mirrors the customer bulk import). Returns 400 if no file uploaded or file unparseable. Returns 200 with full result on success.

### Internal service method

`OrdersService.bulkImportHistory(buffer: Buffer, adminUserId: string): Promise<ImportOrdersResult>`

The service method does the parse → preflight → per-order transactional import flow described in §5.

## 9. Edge Cases & Guards

| # | Scenario | Handling |
|---|---|---|
| 1 | Two CSV rows with same order_ref but different emails | First-row email wins. Subsequent rows' email/customer columns ignored (header-row authoritative rule). |
| 2 | Same SKU appears in different orders | Variant lookup map cached across the batch. One DB query for new placeholder per unique unknown SKU, not per row. |
| 3 | Unknown SKU referenced by 1000 rows | Placeholder created once on first occurrence, reused for the rest. `occurrences` count in placeholdersReport reflects total. |
| 4 | Customer email matches an existing claimed (real) user | Attach orders to that user. Do NOT mutate profile (security: prevents legacy data injection into a real account). |
| 5 | order_date is in the future or wildly old | Accepted as-is — no sanity bounds. Admin's responsibility to clean source data. |
| 6 | order_date missing | Row rejected (required column). |
| 7 | Total mismatch (sum of items ≠ stated total in CSV) | We don't accept a stated total column. Compute always from line items + shipping − discount. |
| 8 | Phone in `customer_phone` fails BD-strict validation | Silently ignored (matches register flow). Customer record created with empty phones[] if otherwise new. |
| 9 | Massive CSV (10k+ orders, 30k+ rows) | Parse phase loads to memory (cap 20 MB). Import phase wraps each order in its own transaction so a mid-import failure preserves earlier orders. Reasonable for ≤ ~50k rows. |
| 10 | Duplicate placeholder products from concurrent imports | Slug uniqueness on Product prevents true duplicates. Race between two admins importing simultaneously: second admin's placeholder upsert merges into first's. Acceptable. |
| 11 | order_ref collision with native order | `LEGACY-` prefix prevents collision with native `DEN-NNNNNN` format. Admin discipline assumed (no LEGACY- in DEN range). |
| 12 | Customer self-registers AFTER import → auto-claim fires | Existing behavior. Imported orders become visible in customer's account on first login. |

## 10. Testing

### Backend unit tests (Jest)

- `orders-import.parser.spec.ts` (new file)
  - Parses Shopify-style CSV with multi-row orders
  - Groups by order_ref, header-row wins on conflicting fields
  - Validates required columns (rejects rows missing email/sku/qty/date)
  - Date format acceptance (`YYYY-MM-DD` and ISO datetime)
  - Optional columns default correctly (status ignored, address placeholder)
  - File size cap (20 MB)
  - BOM handling
- `orders.service.spec.ts` (extend)
  - `bulkImportHistory`:
    - Imports new orders attached to existing claimed user → no profile mutation
    - Imports orders attached to existing shadow → fill-blanks update
    - Imports orders with new email → auto-creates shadow
    - Unknown SKU → creates placeholder Product + Variant (verify shape: isActive=false, category=legacy)
    - Duplicate placeholder SKUs in same batch → one creation, reused
    - Dedup by orderNumber → re-running same CSV skips already-imported orders
    - Stock NOT decremented — assert via mocked ProductVariant.update never called for stock field
    - Computed total = sum(qty × unit_price) + shipping − discount
    - createdAt set to order_date, not NOW()

### Integration test

One end-to-end test: 10-order fixture CSV with deliberate mix:
- 3 orders for existing claimed users
- 4 orders for existing shadows
- 3 orders for new shadows
- 2 unknown SKUs (each referenced by 2-3 orders)
- 1 duplicate order_ref (already in DB from a prior run)
- 2 rows with validation errors (one missing email, one bad date)

Assert the full result panel matches expectations.

### Frontend manual verification

Admin dev server → Orders page → Import Order History → upload the fixture above → confirm modal result matches expectations → confirm orders show up in the orders list with the LEGACY- prefix → confirm 2 placeholder products appear in catalog (marked isActive=false).

## 11. Migration & Rollout

**Single PR, single deploy** — no schema change. Uses existing Order, OrderItem, User, Product, ProductVariant, Category tables.

1. **Local-only first**: implement parser + service method + endpoint + admin modal. Run full test suite.
2. **Vercel admin preview deploy**: lets reviewer click through the modal UX.
3. **Production merge** → Render auto-deploys API, Vercel auto-deploys admin.
4. **Smoke test**: admin uploads a 3-order test CSV → confirm result panel + orders appear.
5. **Real migration**: admin uploads the actual legacy CSV. Run the result reports. Manually merge/delete placeholder products as needed.

**Rollback:**
- Code: revert the merge commit.
- Data: rows already inserted stay (intentional — undoing would lose imported business data). Admin can soft-delete via SQL using the `LEGACY-` prefix filter if necessary.

## 12. Estimated Effort

- Backend parser + service method + endpoint + unit tests: ~1.5 days
- Admin modal + result panel + download reports: ~0.5 days
- Integration test + end-to-end manual verification: ~0.5 days
- **Total: ~2.5 days focused work**

## 13. Open Questions for Reviewer

(To be resolved before implementation plan is written.)

- None at present — all design decisions are locked per the brainstorming conversation above.

## 14. Changelog

- **2026-05-27** — Initial draft.

---

**Approval gate:** Reviewer (joycg) please read this spec and either approve or request changes before I invoke the writing-plans skill to produce the implementation plan.
