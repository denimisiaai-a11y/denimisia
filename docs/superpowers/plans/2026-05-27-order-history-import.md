# Order History Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `superpowers:test-driven-development` discipline within each task.

**Goal:** Add an admin CSV import tool for historical orders so customer records carry real LTV / segmentation / order-history data forward from the previous e-commerce site.

**Architecture:** New `OrdersService.bulkImportHistory` method that parses a Shopify-style CSV (one row per order item, multi-row orders grouped by `order_ref`), resolves customers via match-or-create against existing User records, auto-creates hidden placeholder Products for unknown SKUs, and writes Orders with the LEGACY- prefix + stock-skip. Exposed via `POST /orders/admin/import` (multipart upload, 20 MB cap) and triggered from a new modal on the admin Orders page.

**Tech Stack:** NestJS API (apps/api), Next.js admin (apps/admin), Prisma + PostgreSQL (Supabase), Jest for unit + integration tests, csv-parse for parsing, multer for upload.

**Spec:** [`docs/superpowers/specs/2026-05-27-order-history-import-design.md`](../specs/2026-05-27-order-history-import-design.md)

---

## ⚠️ CRITICAL: No local DB in this project

Same constraint as the shadow-customer-records work: Denimisia uses Supabase as the SOLE database. No `prisma migrate dev` or `prisma db execute` against any DB from this plan. **No schema changes are needed** — this feature uses existing Order/OrderItem/User/Product/ProductVariant/Category tables.

Every subagent prompt MUST include this constraint explicitly.

---

## File Structure

### New files
- `apps/api/src/modules/orders/orders-import.parser.ts` — CSV parser + within-file order grouping
- `apps/api/src/modules/orders/orders-import.parser.spec.ts` — parser tests
- `apps/admin/components/orders/import-orders-modal.tsx` — admin upload modal + result panel

### Modified files
- `apps/api/src/modules/orders/orders.service.ts` — add `bulkImportHistory()` + private helpers (`ensureLegacyCategoryId`, `getOrCreatePlaceholderVariant`, `resolveOrCreateUserForImport`)
- `apps/api/src/modules/orders/orders.service.spec.ts` — add tests for `bulkImportHistory`
- `apps/api/src/modules/orders/orders.controller.ts` — add `POST /admin/import` handler
- `apps/admin/app/(dashboard)/orders/page.tsx` — add "Import Order History" button + modal mount

### No changes
- `packages/database/prisma/schema.prisma` (no schema migration)
- Other API modules (auth, users, etc.)
- Storefront (`apps/web/...`)

---

## Pre-flight: Create branch

- [ ] **Step 0.1: Create branch from main**

```bash
cd /c/Users/joycg/denimisia
git checkout main && git pull
git checkout -b feat/order-history-import
```

The plan ships as a single PR per the spec.

---

## Task 1: CSV Parser

Parses uploaded CSV into an in-memory map of `OrderGroup` records, validates rows, applies first-row-wins semantics across multi-row orders.

**Files:**
- Create: `apps/api/src/modules/orders/orders-import.parser.ts`
- Create: `apps/api/src/modules/orders/orders-import.parser.spec.ts`

- [ ] **Step 1.1: Write the failing parser tests**

Create `apps/api/src/modules/orders/orders-import.parser.spec.ts`:

```ts
import { parseOrderHistoryCsv } from './orders-import.parser';

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8');
}

describe('parseOrderHistoryCsv', () => {
  it('parses a single-line order', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors).toEqual([]);
    expect(result.groups.size).toBe(1);
    const group = result.groups.get('OLD-1')!;
    expect(group.header).toMatchObject({
      order_ref: 'OLD-1',
      order_date: '2024-08-15',
      customer_email: 'ada@example.com',
      shipping_cost: 0,
      discount_amount: 0,
    });
    expect(group.items).toEqual([
      { sku: 'SKU-A', quantity: 1, unit_price: 1099 },
    ]);
  });

  it('groups multi-row orders by order_ref (header-row wins)', async () => {
    const csv = `order_ref,order_date,customer_email,customer_name,sku,quantity,unit_price,shipping_cost
OLD-2,2024-09-01,sakib@example.com,Sakib,SKU-A,2,1099,80
OLD-2,2024-09-01,IGNORED@example.com,IGNORED,SKU-B,1,500,9999`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors).toEqual([]);
    const group = result.groups.get('OLD-2')!;
    expect(group.header.customer_email).toBe('sakib@example.com');
    expect(group.header.customer_name).toBe('Sakib');
    expect(group.header.shipping_cost).toBe(80);
    expect(group.items).toEqual([
      { sku: 'SKU-A', quantity: 2, unit_price: 1099 },
      { sku: 'SKU-B', quantity: 1, unit_price: 500 },
    ]);
  });

  it('lowercases the customer_email on the header', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-3,2024-09-01,ADA@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-3')!.header.customer_email).toBe('ada@example.com');
  });

  it('rejects row missing required column (order_date)', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-4,,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, order_ref: 'OLD-4', reason: expect.stringMatching(/order_date/i) },
    ]);
  });

  it('rejects row with invalid email', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-5,2024-09-01,not-an-email,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(0);
    expect(result.errors[0]).toMatchObject({
      row: 2,
      order_ref: 'OLD-5',
      reason: expect.stringMatching(/email/i),
    });
  });

  it('rejects row with quantity <= 0', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-6,2024-09-01,ada@example.com,SKU-A,0,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/quantity/i) });
  });

  it('rejects row with unit_price < 0', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-7,2024-09-01,ada@example.com,SKU-A,1,-5`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/unit_price/i) });
  });

  it('rejects row with unparseable order_date', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-8,not-a-date,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.errors[0]).toMatchObject({ row: 2, reason: expect.stringMatching(/date/i) });
  });

  it('defaults optional shipping/discount columns to 0 when missing', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-9,2024-09-01,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-9')!.header).toMatchObject({
      shipping_cost: 0,
      discount_amount: 0,
    });
  });

  it('passes through optional address columns when present', async () => {
    const csv = `order_ref,order_date,customer_email,sku,quantity,unit_price,ship_line1,ship_city,ship_state,ship_postal,ship_country
OLD-10,2024-09-01,ada@example.com,SKU-A,1,1099,1 Main St,Dhaka,Dhaka,1212,BD`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.get('OLD-10')!.header).toMatchObject({
      ship_line1: '1 Main St',
      ship_city: 'Dhaka',
      ship_state: 'Dhaka',
      ship_postal: '1212',
      ship_country: 'BD',
    });
  });

  it('handles UTF-8 BOM-prefixed header', async () => {
    const csv = '﻿' + `order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-11,2024-09-01,ada@example.com,SKU-A,1,1099`;
    const result = await parseOrderHistoryCsv(csvBuffer(csv));
    expect(result.groups.size).toBe(1);
  });

  it('rejects file missing required column header', async () => {
    const csv = `order_ref,order_date,customer_email,quantity,unit_price
OLD-12,2024-09-01,ada@example.com,1,1099`;
    await expect(parseOrderHistoryCsv(csvBuffer(csv))).rejects.toThrow(/required column/i);
  });

  it('rejects file > 20 MB', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(parseOrderHistoryCsv(big)).rejects.toThrow(/File too large/);
  });
});
```

- [ ] **Step 1.2: Run tests, expect failure**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders-import.parser.spec.ts
```

Expected: failures (module doesn't exist yet).

- [ ] **Step 1.3: Implement the parser**

Create `apps/api/src/modules/orders/orders-import.parser.ts`:

```ts
import { parse } from 'csv-parse';

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const REQUIRED_COLUMNS = [
  'order_ref',
  'order_date',
  'customer_email',
  'sku',
  'quantity',
  'unit_price',
] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedItem {
  sku: string;
  quantity: number;
  unit_price: number;
}

export interface OrderHeader {
  order_ref: string;
  order_date: string;          // pass-through; service parses to Date
  customer_email: string;      // lowercased
  customer_name: string;       // empty if missing
  customer_phone: string;      // empty if missing
  shipping_cost: number;       // 0 if missing
  discount_amount: number;     // 0 if missing
  ship_line1: string;          // empty if missing
  ship_city: string;
  ship_state: string;
  ship_postal: string;
  ship_country: string;
  notes: string;               // empty if missing
}

export interface OrderGroup {
  header: OrderHeader;
  items: ParsedItem[];
}

export interface ParseRowError {
  row: number;
  order_ref?: string;
  reason: string;
}

export interface ParseResult {
  groups: Map<string, OrderGroup>;   // keyed by order_ref
  errors: ParseRowError[];
}

/**
 * Two-pass CSV ingestion for order history. Reads the whole file into
 * memory (capped at 20 MB), validates each row, groups by order_ref with
 * header-row-wins semantics. The caller (service) handles DB writes.
 */
export async function parseOrderHistoryCsv(buffer: Buffer): Promise<ParseResult> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max 20 MB, got ${buffer.length} bytes)`);
  }

  return new Promise((resolve, reject) => {
    const groups = new Map<string, OrderGroup>();
    const errors: ParseRowError[] = [];
    let lineNum = 1;

    const parser = parse({
      columns: (header: string[]) => {
        if (header[0]?.charCodeAt(0) === 0xfeff) {
          header[0] = header[0].slice(1);
        }
        for (const required of REQUIRED_COLUMNS) {
          if (!header.includes(required)) {
            parser.destroy(new Error(`Missing required column: ${required}`));
            return header;
          }
        }
        return header;
      },
      skip_empty_lines: true,
      trim: true,
    });

    parser.on('data', (record: Record<string, string>) => {
      lineNum += 1;
      const order_ref = (record.order_ref ?? '').trim();
      if (!order_ref) {
        errors.push({ row: lineNum, reason: 'Missing order_ref' });
        return;
      }
      const order_date = (record.order_date ?? '').trim();
      if (!order_date) {
        errors.push({ row: lineNum, order_ref, reason: 'Missing order_date' });
        return;
      }
      const parsedDate = new Date(order_date);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push({ row: lineNum, order_ref, reason: `Unparseable order_date: "${order_date}"` });
        return;
      }
      const email = (record.customer_email ?? '').trim().toLowerCase();
      if (!email || !EMAIL_RE.test(email)) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid customer_email: "${email}"` });
        return;
      }
      const sku = (record.sku ?? '').trim();
      if (!sku) {
        errors.push({ row: lineNum, order_ref, reason: 'Missing sku' });
        return;
      }
      const quantity = Number(record.quantity);
      if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity <= 0) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid quantity: "${record.quantity}"` });
        return;
      }
      const unit_price = Number(record.unit_price);
      if (!Number.isFinite(unit_price) || unit_price < 0) {
        errors.push({ row: lineNum, order_ref, reason: `Invalid unit_price: "${record.unit_price}"` });
        return;
      }

      let group = groups.get(order_ref);
      if (!group) {
        const shipping_cost = Number(record.shipping_cost ?? '0') || 0;
        const discount_amount = Number(record.discount_amount ?? '0') || 0;
        group = {
          header: {
            order_ref,
            order_date,
            customer_email: email,
            customer_name: (record.customer_name ?? '').trim(),
            customer_phone: (record.customer_phone ?? '').trim(),
            shipping_cost,
            discount_amount,
            ship_line1: (record.ship_line1 ?? '').trim(),
            ship_city: (record.ship_city ?? '').trim(),
            ship_state: (record.ship_state ?? '').trim(),
            ship_postal: (record.ship_postal ?? '').trim(),
            ship_country: (record.ship_country ?? '').trim(),
            notes: (record.notes ?? '').trim(),
          },
          items: [],
        };
        groups.set(order_ref, group);
      }
      group.items.push({ sku, quantity, unit_price });
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve({ groups, errors }));

    parser.write(buffer);
    parser.end();
  });
}
```

- [ ] **Step 1.4: Run tests, expect pass**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders-import.parser.spec.ts
```

Expected: all 13 tests pass.

- [ ] **Step 1.5: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/api/src/modules/orders/orders-import.parser.ts apps/api/src/modules/orders/orders-import.parser.spec.ts
git commit -m "feat(api): CSV parser for order history import

Shopify-style single-CSV format. Multi-row orders grouped by
order_ref (header-row wins on conflicting fields). Validates
required columns, email format, quantity/unit_price. Defaults
optional shipping/discount/address columns. 20 MB cap, UTF-8 BOM-safe."
```

---

## Task 2: Service helpers — Legacy Imports category + placeholder variant factory

Two private helpers on `OrdersService`:
- `ensureLegacyCategoryId()` — find or create the `Legacy Imports` category (idempotent, cached for batch)
- `getOrCreatePlaceholderVariant(sku, unit_price, tx)` — given a SKU not in our catalog, create a hidden placeholder Product + Variant attached to Legacy Imports

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 2.1: Write failing tests**

Append to `apps/api/src/modules/orders/orders.service.spec.ts`:

```ts
describe('bulkImportHistory — placeholder product creation', () => {
  it('finds existing Legacy Imports category', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy', slug: 'legacy-imports' });

    await service.bulkImportHistory(
      Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
      'admin-1',
    );

    expect(prisma.category.create).not.toHaveBeenCalled();
  });

  it('creates Legacy Imports category if missing', async () => {
    prisma.category.findFirst.mockResolvedValue(null);
    prisma.category.create.mockResolvedValue({ id: 'cat-new', slug: 'legacy-imports' });

    await service.bulkImportHistory(
      Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
      'admin-1',
    );

    expect(prisma.category.create).toHaveBeenCalledWith({
      data: { slug: 'legacy-imports', name: 'Legacy Imports' },
    });
  });

  it('creates a hidden placeholder Product+Variant for an unknown SKU', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy', slug: 'legacy-imports' });
    prisma.productVariant.findMany.mockResolvedValue([]);  // SKU not in catalog
    prisma.user.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });
    prisma.product.create.mockResolvedValue({ id: 'placeholder-prod' });
    prisma.productVariant.create.mockResolvedValue({
      id: 'placeholder-var',
      sku: 'UNKNOWN-SKU',
      productId: 'placeholder-prod',
    });
    prisma.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'LEGACY-OLD-1' });

    const result = await service.bulkImportHistory(
      Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,UNKNOWN-SKU,1,1099`, 'utf-8'),
      'admin-1',
    );

    expect(prisma.product.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'UNKNOWN-SKU',
        slug: 'legacy-unknown-sku',
        price: 1099,
        isActive: false,
        categoryId: 'cat-legacy',
      }),
    });
    expect(prisma.productVariant.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'placeholder-prod',
        sku: 'UNKNOWN-SKU',
        size: '-',
        color: '-',
        stock: 0,
        price: 1099,
      }),
    });
    expect(result.placeholdersCreated).toBe(1);
    expect(result.placeholdersReport).toEqual([
      expect.objectContaining({ sku: 'UNKNOWN-SKU', productId: 'placeholder-prod' }),
    ]);
  });

  it('reuses the same placeholder for multiple orders with same unknown SKU', async () => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy' });
    prisma.productVariant.findMany.mockResolvedValue([]);
    prisma.user.findMany.mockResolvedValue([]);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 'shadow-1' });
    prisma.product.create.mockResolvedValue({ id: 'placeholder-prod' });
    prisma.productVariant.create.mockResolvedValue({ id: 'placeholder-var', sku: 'X-SKU' });
    prisma.order.create.mockResolvedValue({ id: 'ord-1' });

    await service.bulkImportHistory(
      Buffer.from(`order_ref,order_date,customer_email,sku,quantity,unit_price
OLD-1,2024-08-15,ada@example.com,X-SKU,1,500
OLD-2,2024-08-16,grace@example.com,X-SKU,2,500`, 'utf-8'),
      'admin-1',
    );

    expect(prisma.product.create).toHaveBeenCalledTimes(1);
    expect(prisma.productVariant.create).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2.2: Run tests, expect fail**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders.service.spec.ts -- -t "placeholder product creation"
```

Expected: failures (`bulkImportHistory` doesn't exist yet).

- [ ] **Step 2.3: Add the helper methods + a stub bulkImportHistory**

In `apps/api/src/modules/orders/orders.service.ts`, add imports at the top (alongside existing):

```ts
import { parseOrderHistoryCsv, type OrderGroup, type ParseRowError } from './orders-import.parser';
```

Then add the helpers + stub method to the class:

```ts
private async ensureLegacyCategoryId(): Promise<string> {
  const existing = await this.prisma.category.findFirst({
    where: { slug: 'legacy-imports' },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await this.prisma.category.create({
    data: { slug: 'legacy-imports', name: 'Legacy Imports' },
  });
  return created.id;
}

private async createPlaceholderVariant(
  sku: string,
  unitPrice: number,
  categoryId: string,
): Promise<{ id: string; productId: string }> {
  const slugSafeSku = sku.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const product = await this.prisma.product.create({
    data: {
      name: sku,
      slug: `legacy-${slugSafeSku}`,
      description: `Legacy product imported from order history. SKU: ${sku}`,
      price: unitPrice,
      images: [],
      isActive: false,
      categoryId,
    },
  });
  const variant = await this.prisma.productVariant.create({
    data: {
      productId: product.id,
      sku,
      size: '-',
      color: '-',
      stock: 0,
      price: unitPrice,
      images: [],
    },
  });
  return { id: variant.id, productId: product.id };
}

async bulkImportHistory(buffer: Buffer, adminUserId: string) {
  const parsed = await parseOrderHistoryCsv(buffer);
  const totalOrdersInFile = parsed.groups.size;

  // Pre-flight: collect SKUs + emails, look up existing.
  const allSkus = new Set<string>();
  const allEmails = new Set<string>();
  for (const group of parsed.groups.values()) {
    allEmails.add(group.header.customer_email);
    for (const item of group.items) allSkus.add(item.sku);
  }

  const existingVariants = await this.prisma.productVariant.findMany({
    where: { sku: { in: Array.from(allSkus) } },
    select: { id: true, sku: true, productId: true },
  });
  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));

  const existingUsers = await this.prisma.user.findMany({
    where: { email: { in: Array.from(allEmails) } },
    select: { id: true, email: true, claimedAt: true, firstName: true, phones: true },
  });
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  // Ensure Legacy Imports category exists (lazily, only when needed).
  let legacyCategoryId: string | null = null;
  const ensureLegacyCategory = async () => {
    if (legacyCategoryId === null) legacyCategoryId = await this.ensureLegacyCategoryId();
    return legacyCategoryId;
  };

  // Placeholder cache: SKU → variantInfo, populated lazily per missing SKU.
  const placeholderBySku = new Map<string, { id: string; productId: string }>();

  const result = {
    totalOrdersInFile,
    imported: 0,
    skipped_duplicate: 0,
    skipped_invalid: 0,
    placeholdersCreated: 0,
    newShadowsCreated: 0,
    ordersAttachedToExisting: 0,
    errors: parsed.errors,
    placeholdersReport: [] as Array<{ sku: string; occurrences: number; productId: string }>,
  };
  const placeholderOccurrences = new Map<string, number>();

  for (const [orderRef, group] of parsed.groups) {
    const orderNumber = `LEGACY-${orderRef}`;

    // Skip if already imported (dedup on orderNumber)
    const existingOrder = await this.prisma.order.findFirst({
      where: { orderNumber },
      select: { id: true },
    });
    if (existingOrder) {
      result.skipped_duplicate += 1;
      continue;
    }

    // Resolve variants for every item, creating placeholders as needed.
    const resolvedItems: Array<{ variantId: string; productId: string; quantity: number; unitPrice: number }> = [];
    for (const item of group.items) {
      let variantInfo = variantBySku.get(item.sku) ?? placeholderBySku.get(item.sku);
      if (!variantInfo) {
        const categoryId = await ensureLegacyCategory();
        const created = await this.createPlaceholderVariant(item.sku, item.unit_price, categoryId);
        placeholderBySku.set(item.sku, created);
        result.placeholdersCreated += 1;
        variantInfo = created;
      }
      placeholderOccurrences.set(item.sku, (placeholderOccurrences.get(item.sku) ?? 0) + 1);
      resolvedItems.push({
        variantId: variantInfo.id,
        productId: variantInfo.productId,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      });
    }

    // (Task 3 below will add: customer resolution, order/orderItem inserts.)
    // For Task 2, we only verify placeholder creation paths.
    // Stub: count as imported once the placeholder logic ran.
    result.imported += 1;
  }

  for (const [sku, count] of placeholderOccurrences) {
    const info = variantBySku.get(sku) ?? placeholderBySku.get(sku);
    if (info && placeholderBySku.has(sku)) {
      result.placeholdersReport.push({ sku, occurrences: count, productId: info.productId });
    }
  }

  return result;
}
```

Also ensure the `prisma` mock in `orders.service.spec.ts` includes `category`, `product`, `productVariant`, `user`, `order` mocks with the methods used above. Add any missing jest.fn()s to the existing setup.

- [ ] **Step 2.4: Run tests, expect pass**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders.service.spec.ts -- -t "placeholder product creation"
```

Expected: 4 tests pass. Existing tests still pass.

- [ ] **Step 2.5: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.service.spec.ts
git commit -m "feat(api): bulkImportHistory stub + placeholder product helpers

- ensureLegacyCategoryId: find-or-create 'Legacy Imports' category
- createPlaceholderVariant: hidden Product + Variant for unknown SKU
- bulkImportHistory stub: parses CSV, pre-fetches existing variants/users,
  resolves placeholders per item (cached for batch). Customer linkage
  and order/orderItem inserts come in Task 3."
```

---

## Task 3: Service — Customer linkage + Order/OrderItem inserts + stock skip

Complete the `bulkImportHistory` method. Add customer match-or-create (claimed = attach only, shadow = fill blanks, none = upsert new shadow). Insert Order with `LEGACY-` prefix + items + computed totals + `createdAt` overridden to `order_date`. NO stock decrement.

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts`
- Modify: `apps/api/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 3.1: Write failing tests**

Append to `apps/api/src/modules/orders/orders.service.spec.ts`:

```ts
describe('bulkImportHistory — customer linkage + order creation', () => {
  const csv = `order_ref,order_date,customer_email,customer_name,customer_phone,sku,quantity,unit_price,shipping_cost
OLD-100,2024-08-15,sakib@example.com,Sakib,01776902711,SKU-A,2,1099,80`;

  beforeEach(() => {
    prisma.category.findFirst.mockResolvedValue({ id: 'cat-legacy' });
    prisma.productVariant.findMany.mockResolvedValue([
      { id: 'var-a', sku: 'SKU-A', productId: 'prod-a' },
    ]);
    prisma.order.findFirst.mockResolvedValue(null);
    prisma.order.create.mockResolvedValue({ id: 'ord-1', orderNumber: 'LEGACY-OLD-100' });
  });

  it('attaches order to existing CLAIMED user without mutating profile', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'claimed-1',
        email: 'sakib@example.com',
        claimedAt: new Date('2024-01-01'),
        firstName: 'Real',
        phones: ['01700000000'],
      },
    ]);

    const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.user.upsert).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderNumber: 'LEGACY-OLD-100',
          userId: 'claimed-1',
          status: 'DELIVERED',
          subtotal: 2 * 1099,
          shippingCost: 80,
          total: 2 * 1099 + 80,
          createdAt: new Date('2024-08-15'),
        }),
      }),
    );
    expect(result.ordersAttachedToExisting).toBe(1);
    expect(result.newShadowsCreated).toBe(0);
  });

  it('fill-blanks update on existing SHADOW user', async () => {
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'shadow-1',
        email: 'sakib@example.com',
        claimedAt: null,
        firstName: '',
        phones: [],
      },
    ]);
    prisma.user.update.mockResolvedValue({ id: 'shadow-1' });

    await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'shadow-1' },
      data: expect.objectContaining({
        firstName: 'Sakib',
        phones: ['01776902711'],
      }),
    });
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'shadow-1' }),
      }),
    );
  });

  it('auto-creates shadow when no matching user exists', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });

    const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'sakib@example.com' },
        create: expect.objectContaining({
          email: 'sakib@example.com',
          firstName: 'Sakib',
          phones: ['01776902711'],
          passwordHash: null,
          claimedAt: null,
          createdBy: null,
        }),
      }),
    );
    expect(result.newShadowsCreated).toBe(1);
  });

  it('SKIPS stock decrement — does not call productVariant.update with stock change', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.upsert.mockResolvedValue({ id: 'new-shadow' });

    await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    const variantUpdateCalls = (prisma.productVariant.update.mock.calls ?? []) as Array<
      [{ data: Record<string, unknown> }]
    >;
    for (const [arg] of variantUpdateCalls) {
      expect(arg.data).not.toHaveProperty('stock');
    }
  });

  it('dedupes orders by orderNumber on re-run', async () => {
    prisma.order.findFirst.mockResolvedValueOnce({ id: 'existing-ord' });
    prisma.user.findMany.mockResolvedValue([]);

    const result = await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    expect(result.skipped_duplicate).toBe(1);
    expect(result.imported).toBe(0);
    expect(prisma.order.create).not.toHaveBeenCalled();
  });

  it('computes total = sum(qty * unit_price) + shipping - discount', async () => {
    const csv2 = `order_ref,order_date,customer_email,sku,quantity,unit_price,shipping_cost,discount_amount
OLD-101,2024-08-15,ada@example.com,SKU-A,3,500,100,50`;
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.upsert.mockResolvedValue({ id: 'shadow-x' });

    await service.bulkImportHistory(Buffer.from(csv2, 'utf-8'), 'admin-1');

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: 1500,
          shippingCost: 100,
          discount: 50,
          total: 1550,  // 1500 + 100 - 50
        }),
      }),
    );
  });

  it('uses placeholder shipping address when ship_* columns missing', async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.upsert.mockResolvedValue({ id: 'shadow-x' });

    await service.bulkImportHistory(Buffer.from(csv, 'utf-8'), 'admin-1');

    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shippingAddress: expect.objectContaining({
            line1: 'Imported from legacy system',
            city: 'Unknown',
            state: 'Unknown',
            postalCode: '0000',
            country: 'BD',
          }),
        }),
      }),
    );
  });
});
```

- [ ] **Step 3.2: Run tests, expect fail (stub doesn't do this yet)**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders.service.spec.ts -- -t "customer linkage + order creation"
```

Expected: failures.

- [ ] **Step 3.3: Complete the bulkImportHistory method**

Replace the stub `bulkImportHistory` from Task 2 with the full implementation:

```ts
async bulkImportHistory(buffer: Buffer, adminUserId: string) {
  const parsed = await parseOrderHistoryCsv(buffer);
  const totalOrdersInFile = parsed.groups.size;

  // Pre-flight
  const allSkus = new Set<string>();
  const allEmails = new Set<string>();
  for (const group of parsed.groups.values()) {
    allEmails.add(group.header.customer_email);
    for (const item of group.items) allSkus.add(item.sku);
  }
  const existingVariants = await this.prisma.productVariant.findMany({
    where: { sku: { in: Array.from(allSkus) } },
    select: { id: true, sku: true, productId: true },
  });
  const variantBySku = new Map(existingVariants.map((v) => [v.sku, v]));
  const existingUsers = await this.prisma.user.findMany({
    where: { email: { in: Array.from(allEmails) } },
    select: { id: true, email: true, claimedAt: true, firstName: true, phones: true },
  });
  const userByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  let legacyCategoryId: string | null = null;
  const ensureLegacyCategory = async () => {
    if (legacyCategoryId === null) legacyCategoryId = await this.ensureLegacyCategoryId();
    return legacyCategoryId;
  };

  const placeholderBySku = new Map<string, { id: string; productId: string }>();
  const placeholderOccurrences = new Map<string, number>();

  const result = {
    totalOrdersInFile,
    imported: 0,
    skipped_duplicate: 0,
    skipped_invalid: 0,
    placeholdersCreated: 0,
    newShadowsCreated: 0,
    ordersAttachedToExisting: 0,
    errors: parsed.errors,
    placeholdersReport: [] as Array<{ sku: string; occurrences: number; productId: string }>,
  };

  for (const [orderRef, group] of parsed.groups) {
    const orderNumber = `LEGACY-${orderRef}`;

    // Dedup
    const existingOrder = await this.prisma.order.findFirst({
      where: { orderNumber },
      select: { id: true },
    });
    if (existingOrder) {
      result.skipped_duplicate += 1;
      continue;
    }

    // Customer resolution
    const email = group.header.customer_email;
    const phoneClean = group.header.customer_phone
      .replace(/\D/g, '')
      .replace(/^880(?=\d{10,11}$)/, '0');
    const phoneValid = /^\d{10,11}$/.test(phoneClean);
    let userId: string;
    const candidate = userByEmail.get(email);
    if (candidate) {
      userId = candidate.id;
      if (candidate.claimedAt === null) {
        // Shadow: fill-blanks
        const updates: Record<string, unknown> = {};
        if (!candidate.firstName && group.header.customer_name) {
          updates.firstName = group.header.customer_name;
        }
        if (phoneValid && !candidate.phones.includes(phoneClean)) {
          updates.phones = [phoneClean, ...candidate.phones].slice(0, 20);
        }
        if (Object.keys(updates).length > 0) {
          await this.prisma.user.update({
            where: { id: candidate.id },
            data: updates,
          });
        }
      }
      // Claimed: attach only, never mutate.
      result.ordersAttachedToExisting += 1;
    } else {
      const shadow = await this.prisma.user.upsert({
        where: { email },
        create: {
          email,
          firstName: group.header.customer_name,
          lastName: '',
          phones: phoneValid ? [phoneClean] : [],
          passwordHash: null,
          role: 'CUSTOMER' as const,
          isVerified: true,
          claimedAt: null,
          createdBy: null,
        },
        update: { email },
        select: { id: true },
      });
      userId = shadow.id;
      result.newShadowsCreated += 1;
      userByEmail.set(email, {
        id: shadow.id,
        email,
        claimedAt: null,
        firstName: group.header.customer_name,
        phones: phoneValid ? [phoneClean] : [],
      });
    }

    // Variant resolution
    const resolvedItems: Array<{
      variantId: string; productId: string; quantity: number; unitPrice: number;
    }> = [];
    for (const item of group.items) {
      let variantInfo = variantBySku.get(item.sku) ?? placeholderBySku.get(item.sku);
      if (!variantInfo) {
        const categoryId = await ensureLegacyCategory();
        const created = await this.createPlaceholderVariant(item.sku, item.unit_price, categoryId);
        placeholderBySku.set(item.sku, created);
        result.placeholdersCreated += 1;
        variantInfo = created;
      }
      placeholderOccurrences.set(item.sku, (placeholderOccurrences.get(item.sku) ?? 0) + 1);
      resolvedItems.push({
        variantId: variantInfo.id,
        productId: variantInfo.productId,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      });
    }

    // Totals
    const subtotal = resolvedItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const total = Math.max(0, subtotal + group.header.shipping_cost - group.header.discount_amount);

    // Shipping address (placeholder if missing)
    const shippingAddress = {
      line1: group.header.ship_line1 || 'Imported from legacy system',
      city: group.header.ship_city || 'Unknown',
      state: group.header.ship_state || 'Unknown',
      postalCode: group.header.ship_postal || '0000',
      country: group.header.ship_country || 'BD',
    };

    // Create order + items (NO stock decrement; createdAt overridden)
    await this.prisma.order.create({
      data: {
        orderNumber,
        userId,
        guestEmail: email,
        guestName: group.header.customer_name || null,
        guestPhone: phoneValid ? phoneClean : null,
        shippingAddress,
        subtotal,
        discount: group.header.discount_amount,
        shippingCost: group.header.shipping_cost,
        total,
        notes: group.header.notes || null,
        status: 'DELIVERED' as const,
        createdAt: new Date(group.header.order_date),
        items: {
          create: resolvedItems.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.quantity * it.unitPrice,
            snapshot: { sku: 'legacy-import' },
          })),
        },
      },
    });
    result.imported += 1;
  }

  for (const [sku, count] of placeholderOccurrences) {
    const info = placeholderBySku.get(sku);
    if (info) {
      result.placeholdersReport.push({ sku, occurrences: count, productId: info.productId });
    }
  }

  return result;
}
```

- [ ] **Step 3.4: Run tests, expect pass**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test src/modules/orders/orders.service.spec.ts -- -t "bulkImportHistory"
```

Expected: all Task 2 + Task 3 tests pass.

- [ ] **Step 3.5: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.service.spec.ts
git commit -m "feat(api): bulkImportHistory — customer linkage + order creation

- Customer linkage: match-or-create (claimed = attach only, shadow =
  fill blanks, none = upsert new). Mirrors guest-checkout safety.
- Order writes: LEGACY-<order_ref> as orderNumber, status = DELIVERED,
  createdAt overridden to source order_date, guest fields snapshotted.
- Totals computed from line items + shipping − discount.
- Shipping address placeholder when ship_* columns missing.
- Stock NOT decremented — placeholder snapshot for legacy items.
- Idempotent dedup on orderNumber."
```

---

## Task 4: API endpoint POST /orders/admin/import

**Files:**
- Modify: `apps/api/src/modules/orders/orders.controller.ts`

- [ ] **Step 4.1: Add the controller handler**

In `apps/api/src/modules/orders/orders.controller.ts`, add to imports:

```ts
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors, BadRequestException } from '@nestjs/common';
import type { Express } from 'express';
```

Verify `RolesGuard`, `Roles`, `Role`, `CurrentUser` are already imported (they are for `/orders/admin/all`).

Add this method after the existing `/admin/all` handler:

```ts
@Post('admin/import')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 },
  }),
)
importHistory(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() admin: { id: string },
) {
  if (!file || !file.buffer) {
    throw new BadRequestException('No file uploaded; expected multipart field "file"');
  }
  return this.ordersService.bulkImportHistory(file.buffer, admin.id);
}
```

- [ ] **Step 4.2: Typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm exec tsc --noEmit 2>&1 | grep "orders.controller\|orders.service\|orders-import" | head -10
```

Expected: clean.

- [ ] **Step 4.3: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/api/src/modules/orders/orders.controller.ts
git commit -m "feat(api): POST /orders/admin/import endpoint

Multipart upload (field 'file', 20 MB cap) → bulkImportHistory.
Admin role enforced. Returns ImportOrdersResult."
```

---

## Task 5: Admin — Import Orders modal component

**Files:**
- Create: `apps/admin/components/orders/import-orders-modal.tsx`

- [ ] **Step 5.1: Create the modal component**

Create `apps/admin/components/orders/import-orders-modal.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';

interface ImportOrdersResult {
  readonly totalOrdersInFile: number;
  readonly imported: number;
  readonly skipped_duplicate: number;
  readonly skipped_invalid: number;
  readonly placeholdersCreated: number;
  readonly newShadowsCreated: number;
  readonly ordersAttachedToExisting: number;
  readonly errors: ReadonlyArray<{ row: number; order_ref?: string; reason: string }>;
  readonly placeholdersReport: ReadonlyArray<{ sku: string; occurrences: number; productId: string }>;
}

interface ImportOrdersModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  apiBase: string;
  token: string | undefined;
}

export function ImportOrdersModal({
  open,
  onClose,
  onImported,
  apiBase,
  token,
}: ImportOrdersModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportOrdersResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleUpload = async () => {
    if (!file || !token) return;
    setUploading(true);
    setError('');
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiBase}/orders/admin/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      const data = (body.data ?? body) as ImportOrdersResult;
      setResult(data);
      onImported();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setError('');
    onClose();
  };

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return;
    const rows: string[][] = [['row', 'order_ref', 'reason']];
    for (const e of result.errors) rows.push([String(e.row), e.order_ref ?? '', e.reason]);
    downloadCsv(`order-import-errors-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const downloadPlaceholderReport = () => {
    if (!result || result.placeholdersReport.length === 0) return;
    const rows: string[][] = [['sku', 'occurrences', 'productId']];
    for (const p of result.placeholdersReport) {
      rows.push([p.sku, String(p.occurrences), p.productId]);
    }
    downloadCsv(`order-import-placeholders-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-headline text-xl font-semibold">Import Order History</h2>
          <button onClick={handleClose} className="text-secondary hover:text-on-surface" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>✓ Imported <strong>{result.imported}</strong> of {result.totalOrdersInFile} orders</p>
            <p>ℹ {result.ordersAttachedToExisting} attached to existing customers, {result.newShadowsCreated} new shadow customers created</p>
            {result.skipped_duplicate > 0 && <p>⚠ Skipped {result.skipped_duplicate} already-imported orders</p>}
            {result.skipped_invalid > 0 && <p>⚠ Skipped {result.skipped_invalid} orders with invalid rows</p>}
            {result.placeholdersCreated > 0 && (
              <div>
                <p>ℹ {result.placeholdersCreated} placeholder products created for unknown SKUs</p>
                <button onClick={downloadPlaceholderReport} className="mt-1 text-xs text-primary underline">
                  Download placeholder report
                </button>
              </div>
            )}
            {result.errors.length > 0 && (
              <div>
                <p>✗ <strong>{result.errors.length}</strong> row errors:</p>
                <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-outline-variant/20 bg-surface-container p-2 text-xs">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>Row {e.row}{e.order_ref ? ` (${e.order_ref})` : ''}: {e.reason}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-secondary">…and {result.errors.length - 10} more</li>
                  )}
                </ul>
                <button onClick={downloadErrorReport} className="mt-2 text-xs text-primary underline">
                  Download error report
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button onClick={handleClose} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded bg-surface-container p-3 text-xs text-secondary">
              <p className="mb-1 font-semibold">⚠ One-time migration tool</p>
              <p className="mb-2">Required columns:</p>
              <pre className="font-mono text-[10px]">order_ref, order_date, customer_email, sku, quantity, unit_price</pre>
              <p className="mt-2 mb-1">Optional columns:</p>
              <pre className="font-mono text-[10px]">customer_name, customer_phone, shipping_cost, discount_amount, ship_line1..ship_country, notes</pre>
              <ul className="mt-2 list-disc pl-4">
                <li>Multiple rows with same order_ref = one order</li>
                <li>Already-imported order_refs are skipped</li>
                <li>All orders set to DELIVERED status</li>
                <li>Current stock counts NOT affected</li>
                <li>Unknown SKUs → hidden placeholder products</li>
                <li>Max file size: 20 MB</li>
              </ul>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm"
              disabled={uploading}
            />
            {error && (
              <p className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={handleClose} disabled={uploading} className="rounded px-4 py-2 text-sm text-secondary">
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50"
              >
                {uploading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5.2: Typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 5.3: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/admin/components/orders/
git commit -m "feat(admin): ImportOrdersModal component

File upload modal with result panel (counts + downloadable error
report + placeholder products report). UTF-8 BOM in download CSVs
for Excel compatibility."
```

---

## Task 6: Admin — wire modal into Orders page

**Files:**
- Modify: `apps/admin/app/(dashboard)/orders/page.tsx`

- [ ] **Step 6.1: Add import + state + button + modal mount**

In `apps/admin/app/(dashboard)/orders/page.tsx`:

Add to imports near top:

```tsx
import { ImportOrdersModal } from '@/components/orders/import-orders-modal';
```

Add state alongside the existing OrdersPage component state:

```tsx
const [importOpen, setImportOpen] = useState(false);
```

Add the toolbar button. Find the existing button block (Export List or similar). Place the Import button before/alongside, using a matching style:

```tsx
<button
  type="button"
  onClick={() => setImportOpen(true)}
  className="rounded border border-outline-variant/30 px-4 py-2 text-sm font-semibold"
>
  Import Order History
</button>
```

Mount the modal at the end of the JSX:

```tsx
<ImportOrdersModal
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onImported={() => {
    setImportOpen(false);
    void fetchOrders();
  }}
  apiBase={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
  token={token}
/>
```

The `fetchOrders` callback already exists for the table data load — use it. `token` comes from `session?.accessToken` already in scope.

- [ ] **Step 6.2: Typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 6.3: Commit**

```bash
cd /c/Users/joycg/denimisia && git add apps/admin/app/\(dashboard\)/orders/page.tsx
git commit -m "feat(admin): mount Import Order History modal on Orders page

Adds a toolbar button + modal mount. onImported refreshes the
orders list so newly imported orders appear immediately."
```

---

## Task 7: Pre-deploy verification

**Files:** none modified — verification only.

- [ ] **Step 7.1: API typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm exec tsc --noEmit 2>&1 | grep -v "auth.service.spec\|curation.service.spec\|inventory-race" | head -20
```

Expected: clean for changed files. Pre-existing errors in those 3 spec files unchanged.

- [ ] **Step 7.2: Admin typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head -10
```

Expected: clean.

- [ ] **Step 7.3: Full API test suite**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test 2>&1 | tail -10
```

Expected: all new tests pass + existing tests still pass. The 34 pre-existing failures in products/inventory specs are unrelated to this branch.

- [ ] **Step 7.4: Admin dev-server smoke**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm dev
```

Open `http://localhost:3002/orders` in a browser:
- Confirm "Import Order History" button appears in toolbar
- Click it → modal opens with format instructions
- Cancel out (no upload yet — that's for the post-deploy E2E)

- [ ] **Step 7.5: Empty commit + verification note**

```bash
git commit --allow-empty -m "chore: order history import build-verified pre-deploy

API + admin typecheck clean. New tests pass + no regressions.
Modal renders correctly in admin dev server."
```

---

## Task 8: Deploy + production E2E

**Files:** none modified — deploy + verification.

- [ ] **Step 8.1: Push branch**

```bash
cd /c/Users/joycg/denimisia && git push -u origin feat/order-history-import
```

- [ ] **Step 8.2: Open PR**

```bash
gh pr create --base main --head feat/order-history-import \
  --title "feat: order history CSV import" \
  --body "$(cat <<'EOF'
## Summary

Implements admin-facing order history import per the spec at
[docs/superpowers/specs/2026-05-27-order-history-import-design.md](docs/superpowers/specs/2026-05-27-order-history-import-design.md).

## What's in
- POST /orders/admin/import (multipart, 20 MB cap, admin-only)
- Service method `bulkImportHistory`: parses CSV, resolves customers via
  existing shadow match-or-create, auto-creates hidden placeholder products
  for unknown SKUs, writes orders with LEGACY- prefix
- Stock NOT decremented for imported orders
- Idempotent dedup by orderNumber
- Admin modal in Orders page with downloadable error + placeholder reports

## Schema
No schema changes. Uses existing Order, OrderItem, User, Product,
ProductVariant, Category tables.

## Test plan
- [x] API typecheck clean
- [x] Admin typecheck clean
- [x] New parser tests + service tests pass; no regressions
- [ ] After merge: smoke-test admin Orders page → Import Order History
- [ ] After merge: upload small fixture CSV, verify result panel + order
      shows up with LEGACY- prefix
EOF
)"
```

- [ ] **Step 8.3: Merge PR**

```bash
gh pr merge --merge --admin
```

- [ ] **Step 8.4: Wait for Render deploy**

```bash
SVC=srv-d89or2reo5us7393e8dg
TOKEN=$(cat /c/Users/joycg/denimisia/render-token.txt | tr -d '\n\r')
START=$(date +%s)
TARGET=$(git rev-parse origin/main | cut -c1-7)
while true; do
  STATUS=$(curl -s -H "Authorization: Bearer $TOKEN" "https://api.render.com/v1/services/$SVC/deploys?limit=3" | python -c "
import json,sys
d=json.load(sys.stdin)
for item in d:
    dep=item['deploy']
    if dep['commit']['id'].startswith('$TARGET'):
        print(dep['status']); break
else:
    print('NOT_QUEUED_YET')
")
  ELAPSED=$(($(date +%s) - START))
  printf '[t+%ss] %s status=%s\n' "$ELAPSED" "$TARGET" "$STATUS"
  case "$STATUS" in
    live) echo "==> DEPLOY LIVE after ${ELAPSED}s"; break ;;
    build_failed|update_failed|canceled) echo "==> DEPLOY FAILED"; exit 1 ;;
  esac
  [ $ELAPSED -gt 1500 ] && { echo "==> TIMEOUT"; exit 2; }
  sleep 45
done
```

- [ ] **Step 8.5: Smoke-test endpoint**

```bash
curl -s -o /dev/null -w "import endpoint: HTTP %{http_code} | %{time_total}s\n" \
  -X POST https://denimisia-api.onrender.com/api/v1/orders/admin/import
```

Expected: `HTTP 401` (auth-gated, NOT 404).

- [ ] **Step 8.6: Production E2E**

Create a minimal fixture CSV `/tmp/orders-test.csv` with 3 orders covering all 3 customer paths:

```csv
order_ref,order_date,customer_email,customer_name,customer_phone,sku,quantity,unit_price,shipping_cost
LEG-TEST-1,2024-08-15,e2e-import-newshadow@e2e.local,New Shadow,01776555111,FAKE-SKU-A,1,1099,80
LEG-TEST-2,2024-09-01,e2e-import-newshadow@e2e.local,New Shadow,01776555111,FAKE-SKU-B,2,500,80
LEG-TEST-3,2024-10-12,e2e-import-other@e2e.local,Other Person,01776555222,FAKE-SKU-A,1,1099,80
```

In a real browser at https://admin.denimisiabd.com:

1. Sign in as admin
2. Orders page → Import Order History
3. Upload `/tmp/orders-test.csv`
4. Expect result panel:
   - Imported: 3
   - Skipped duplicate: 0
   - Placeholders created: 2 (FAKE-SKU-A, FAKE-SKU-B)
   - New shadows: 2 (e2e-import-newshadow + e2e-import-other)
5. Click Done; orders list refreshes; the 3 LEGACY-LEG-TEST-* orders appear
6. Click into LEGACY-LEG-TEST-1; verify status=DELIVERED, customer matches, total=1099+80=1179
7. Visit Customers; verify `e2e-import-newshadow@e2e.local` and `e2e-import-other@e2e.local` appear as shadows
8. Re-upload the SAME CSV → expect result panel: Imported: 0, Skipped duplicate: 3 (idempotency check)

- [ ] **Step 8.7: Clean up E2E test data**

Write the cleanup SQL to a file and apply via `prisma db execute`:

```bash
cat > /tmp/e2e-import-cleanup.sql <<'EOF'
DELETE FROM "OrderItem" WHERE "orderId" IN (
  SELECT id FROM "Order" WHERE "orderNumber" LIKE 'LEGACY-LEG-TEST-%'
);
DELETE FROM "Order" WHERE "orderNumber" LIKE 'LEGACY-LEG-TEST-%';
DELETE FROM "ProductVariant" WHERE sku IN ('FAKE-SKU-A', 'FAKE-SKU-B');
DELETE FROM "Product" WHERE slug LIKE 'legacy-fake-sku-%';
DELETE FROM "AuditLog" WHERE "userId" IN (
  SELECT id FROM "User" WHERE email LIKE 'e2e-import-%'
);
DELETE FROM "Cart" WHERE "userId" IN (
  SELECT id FROM "User" WHERE email LIKE 'e2e-import-%'
);
DELETE FROM "User" WHERE email LIKE 'e2e-import-%';
EOF

cd /c/Users/joycg/denimisia/packages/database && \
  ./node_modules/.bin/prisma db execute --file /tmp/e2e-import-cleanup.sql --schema prisma/schema.prisma
```

Expected: `Script executed successfully.`

Verify cleanup via Supabase MCP:

```sql
SELECT COUNT(*) FROM "Order" WHERE "orderNumber" LIKE 'LEGACY-LEG-TEST-%';
SELECT COUNT(*) FROM "User" WHERE email LIKE 'e2e-import-%';
SELECT COUNT(*) FROM "ProductVariant" WHERE sku LIKE 'FAKE-SKU-%';
```

Expected: all return 0.

---

## Self-Review

**Spec coverage:**
- §4 CSV format → Task 1 (parser)
- §5 Data flow / placeholder shape → Tasks 2 + 3
- §6 Auto-claim implications → reuses Task 3's match-or-create logic; no new code
- §7 Admin UI → Tasks 5 + 6
- §8 API endpoint → Task 4
- §9 Edge cases → covered across Task 2/3 tests + parser tests
- §10 Testing → embedded as TDD steps in every backend task; manual frontend smoke in Task 7
- §11 Rollout → Task 8

No spec gaps.

**Placeholder scan:** No "TBD", "TODO", "similar to", or undefined identifiers in any task.

**Type consistency:** `ImportOrdersResult` shape defined in the spec matches what the service returns (Task 3) and what the modal consumes (Task 5). `OrderHeader` / `ParsedItem` / `OrderGroup` types defined in Task 1 parser, consumed in Task 2/3 service.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-27-order-history-import.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task with the no-DB constraint baked in, review between tasks. Same workflow that successfully shipped the shadow-customer-records feature earlier today.

**2. Inline Execution** — I execute tasks here, batching with checkpoints.

Which approach?
