# Returns & Refunds System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full returns/refunds workflow with customer-facing request submission, admin review/approval/inspection/refund states, inventory restoration on inspection pass, and a manual return-entry path for walk-in customers.

**Architecture:** Adds a first-class `Return` aggregate (header + line items) alongside the existing `Order` model. A finite state machine drives status transitions with side effects (email, audit log, inventory restock, refund ledger). Customer flow lives at `/returns/*` on the web app; admin flow at `/orders/returns` on the admin app. Refunds are tracked as immutable ledger entries so original sales totals remain intact for reporting.

**Tech Stack:** NestJS 10 (API), Prisma 5 + Postgres, Next.js 14 App Router (admin + web), Zod for validation, BullMQ-style event listeners for email, existing R2 uploads module for photos.

---

## File Structure

### New backend files
```
apps/api/src/modules/returns/
  returns.module.ts                  -- module wiring
  returns.controller.ts              -- customer endpoints
  returns-admin.controller.ts        -- admin endpoints
  returns.service.ts                 -- core CRUD + state transitions
  returns.refund.service.ts          -- refund calculation + inventory restore
  returns.metrics.service.ts         -- dashboard aggregates
  returns.state-machine.ts           -- transition table + fault mapping
  returns.eligibility.ts             -- pure eligibility checks
  rtn-id.service.ts                  -- atomic RTN-YYYY-NNNNNN generation
  dto/
    create-return.dto.ts             -- customer submission
    cancel-return.dto.ts
    review-return.dto.ts
    approve-return.dto.ts
    reject-return.dto.ts
    mark-received.dto.ts
    inspect-return.dto.ts
    issue-refund.dto.ts
    manual-return.dto.ts
    list-returns.dto.ts
  returns.service.spec.ts
  returns.refund.service.spec.ts
  returns.state-machine.spec.ts
  returns.eligibility.spec.ts
  returns.controller.spec.ts

apps/api/src/common/listeners/
  return-email.listener.ts           -- emits on state changes
  return-email.listener.spec.ts
```

### New admin pages
```
apps/admin/app/(dashboard)/returns/
  page.tsx                           -- list with status tabs + SLA red flag
  [id]/page.tsx                      -- detail with transition action buttons
  manual/page.tsx                    -- walk-in / phone return entry form
  metrics/page.tsx                   -- dashboard (rate, top reasons, etc.)

apps/admin/lib/
  api-returns.ts                     -- admin API client helpers
```

### New web (customer) pages
```
apps/web/app/returns/
  page.tsx                           -- replace static page: policy info + "Start a Return" CTA
  new/page.tsx                       -- submission form
  [rtnNumber]/page.tsx               -- tracking page (auth or guest lookup)

apps/web/app/account/returns/
  page.tsx                           -- logged-in user's returns history
```

### Web shared lib additions
```
apps/web/lib/
  api.ts                             -- ADD: Return type, getMyReturns(), getReturnByRtn(), createReturn(), cancelReturn()
  returns-eligibility.ts             -- ADD: client-side eligibility helper
```

### Schema changes
```
packages/database/prisma/schema.prisma
  -- ADD enums: ReturnStatus, ReturnReason, ReturnFault, RefundMethod, InspectionResult
  -- ADD models: Return, ReturnItem, RefundTransaction
  -- MODIFY Product: + returnable Boolean @default(true)
  -- MODIFY Order: + returns Return[] relation
  -- MODIFY OrderItem: + returnItems ReturnItem[] relation
```

### Email templates
```
apps/api/src/modules/email/email-templates.ts
  -- ADD: returnSubmitted, returnApproved, returnRejected, returnReceived, returnRefunded
```

### Documentation
```
docs/RETURNS.md                       -- policy spec + state machine diagram + operator runbook
```

---

## Spec Recap (locked decisions)

| Decision | Value |
|---|---|
| Eligibility | `DELIVERED` order, within **7 days of delivery**, `product.returnable = true`, item not already returned |
| Granularity | Per-item OR whole-order |
| Reasons | `DEFECTIVE`, `DAMAGED_IN_TRANSIT`, `NOT_AS_DESCRIBED`, `WRONG_ITEM_SENT`, `WRONG_SIZE`, `CHANGED_MIND` |
| Fault | First 4 = `US`; last 2 = `CUSTOMER` (overridable by admin) |
| Photos | Required for US-fault reasons; max 5 × 10MB; JPEG/PNG/WebP |
| Return shipping | Customer ships back if their fault; we arrange pickup if our fault |
| Refund methods | `CASH` or `BANK_TRANSFER` |
| Refund timing | On `INSPECTED_PASS` only |
| Inspection fail | Ship back to customer, OR admin override → refund anyway |
| Bundle refund math | Discounted bundle price ÷ item count |
| Original shipping refund | No |
| Restocking fee | None for v1 |
| SLA | 48h from `REQUESTED`; past-SLA flagged red |
| Multiple returns per order | Yes, each gets unique `RTN-YYYY-NNNNNN` ID |
| Manual entry | Walk-in / phone / in-person; links to order if known, standalone otherwise |
| Notifications | Email v1 |
| Permissions | Admin-only v1 |

---

## State Machine

```
REQUESTED
  ├→ UNDER_REVIEW
  │    ├→ APPROVED → IN_TRANSIT → RECEIVED → INSPECTING
  │    │                                       ├→ INSPECTED_PASS → REFUNDED → CLOSED
  │    │                                       └→ INSPECTED_FAIL → RETURNED_TO_CUSTOMER → CLOSED
  │    │                                                          └→ (override) REFUNDED → CLOSED
  │    └→ REJECTED → CLOSED
  └→ CANCELLED → CLOSED  (customer-withdrawn before review)
```

Side effects per transition:
- `REQUESTED` → email customer (submission ack with RTN ID + 48h SLA)
- `UNDER_REVIEW` → no email; admin started working
- `APPROVED` → email customer (shipping instructions or pickup window)
- `REJECTED` → email customer (reason)
- `RECEIVED` → no email; admin marks package arrived
- `INSPECTED_PASS` → restore inventory + create `RefundTransaction` + email customer (refund amount + method + ref)
- `INSPECTED_FAIL` → email customer (fail reason + return-ship plan)
- `RETURNED_TO_CUSTOMER` → no email (already informed at fail)
- Override `INSPECTED_FAIL` → `REFUNDED`: restore inventory if admin marked restockable + refund + email
- `CANCELLED` → no email
- `CLOSED` → terminal

Every transition writes to `AuditLog`.

---

## Task Breakdown

### Task 1: Schema + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_returns_system/migration.sql` (via `prisma migrate dev`)

- [ ] **Step 1.1: Add enums + new fields to schema.prisma**

Append after the existing enums (after `InventoryType` around line 50):

```prisma
enum ReturnStatus {
  REQUESTED
  UNDER_REVIEW
  APPROVED
  REJECTED
  IN_TRANSIT
  RECEIVED
  INSPECTING
  INSPECTED_PASS
  INSPECTED_FAIL
  RETURNED_TO_CUSTOMER
  REFUNDED
  CLOSED
  CANCELLED
}

enum ReturnReason {
  DEFECTIVE
  DAMAGED_IN_TRANSIT
  NOT_AS_DESCRIBED
  WRONG_ITEM_SENT
  WRONG_SIZE
  CHANGED_MIND
}

enum ReturnFault {
  US
  CUSTOMER
}

enum RefundMethod {
  CASH
  BANK_TRANSFER
}

enum InspectionResult {
  PASS
  FAIL
}
```

Add to `Product` model (after `tags String[]`):

```prisma
  returnable     Boolean            @default(true)
```

Add to `Order` model relations (after `statusHistory`):

```prisma
  returns         Return[]
```

Add to `OrderItem` model (after `snapshot`):

```prisma
  returnItems ReturnItem[]
```

Append new models at the end of the file (before final brace if any):

```prisma
model Return {
  id              String       @id @default(cuid())
  rtnNumber       String       @unique
  orderId         String?
  order           Order?       @relation(fields: [orderId], references: [id], onDelete: Restrict)
  userId          String?
  user            User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  guestEmail      String?
  guestName       String?
  guestPhone      String?
  status          ReturnStatus @default(REQUESTED)
  reason          ReturnReason
  fault           ReturnFault
  description     String?
  photos          String[]     @default([])
  isManual        Boolean      @default(false)
  customerShipsBack Boolean
  pickupAddress   Json?
  carrier         String?
  trackingNumber  String?
  refundAmount    Decimal?     @db.Decimal(10, 2)
  refundMethod    RefundMethod?
  refundReference String?
  reviewerId      String?
  reviewer        User?        @relation("ReturnReviewer", fields: [reviewerId], references: [id], onDelete: SetNull)
  reviewerNotes   String?
  inspectionNotes String?
  rejectionReason String?
  slaDeadline     DateTime
  requestedAt     DateTime     @default(now())
  reviewedAt      DateTime?
  approvedAt      DateTime?
  receivedAt      DateTime?
  inspectedAt     DateTime?
  refundedAt      DateTime?
  closedAt        DateTime?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  items           ReturnItem[]
  refundTxn       RefundTransaction?

  @@index([orderId])
  @@index([userId])
  @@index([status])
  @@index([status, slaDeadline])
  @@index([guestEmail])
  @@index([requestedAt])
}

model ReturnItem {
  id                String           @id @default(cuid())
  returnId          String
  return            Return           @relation(fields: [returnId], references: [id], onDelete: Cascade)
  orderItemId       String?
  orderItem         OrderItem?       @relation(fields: [orderItemId], references: [id], onDelete: SetNull)
  manualProductName String?
  manualSku         String?
  manualSize        String?
  manualColor       String?
  manualUnitPrice   Decimal?         @db.Decimal(10, 2)
  quantity          Int
  inspectionResult  InspectionResult?
  restock           Boolean          @default(false)
  itemRefundAmount  Decimal          @default(0) @db.Decimal(10, 2)
  createdAt         DateTime         @default(now())

  @@index([returnId])
  @@index([orderItemId])
}

model RefundTransaction {
  id          String       @id @default(cuid())
  returnId    String       @unique
  return      Return       @relation(fields: [returnId], references: [id], onDelete: Restrict)
  amount      Decimal      @db.Decimal(10, 2)
  method      RefundMethod
  reference   String
  issuedById  String?
  issuedBy    User?        @relation("RefundIssuer", fields: [issuedById], references: [id], onDelete: SetNull)
  issuedAt    DateTime     @default(now())
  notes       String?

  @@index([issuedAt])
}
```

Add to `User` model the reverse relations (find the existing User model and add):

```prisma
  reviewedReturns Return[]            @relation("ReturnReviewer")
  issuedRefunds   RefundTransaction[] @relation("RefundIssuer")
```

- [ ] **Step 1.2: Generate migration**

Run from `packages/database`:

```
pnpm prisma migrate dev --name returns_system
```

Expected: migration file created at `packages/database/prisma/migrations/<timestamp>_returns_system/migration.sql`. Postgres applies enums and tables.

- [ ] **Step 1.3: Generate Prisma client**

Run:
```
pnpm prisma generate
```

Expected: `node_modules/.pnpm/.prisma/client/index.d.ts` now includes `Return`, `ReturnItem`, `RefundTransaction`, and new enums.

- [ ] **Step 1.4: Verify typecheck across workspace**

Run from repo root:
```
pnpm -w typecheck
```

Expected: no errors. If existing code complains about the new relations being missing on `Order` / `Product`, only Step 1.1 was incomplete.

- [ ] **Step 1.5: Commit**

```
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add Return, ReturnItem, RefundTransaction models"
```

---

### Task 2: RTN ID generator + state machine table

**Files:**
- Create: `apps/api/src/modules/returns/rtn-id.service.ts`
- Create: `apps/api/src/modules/returns/returns.state-machine.ts`
- Create: `apps/api/src/modules/returns/returns.state-machine.spec.ts`
- Create: `apps/api/src/modules/returns/returns.eligibility.ts`
- Create: `apps/api/src/modules/returns/returns.eligibility.spec.ts`

- [ ] **Step 2.1: Write state machine table + transition validator**

Create `apps/api/src/modules/returns/returns.state-machine.ts`:

```typescript
import { ReturnStatus, ReturnReason, ReturnFault } from '@prisma/client';

export const ALLOWED_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: ['UNDER_REVIEW', 'CANCELLED'],
  UNDER_REVIEW: ['APPROVED', 'REJECTED'],
  APPROVED: ['IN_TRANSIT', 'RECEIVED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['INSPECTING'],
  INSPECTING: ['INSPECTED_PASS', 'INSPECTED_FAIL'],
  INSPECTED_PASS: ['REFUNDED'],
  INSPECTED_FAIL: ['RETURNED_TO_CUSTOMER', 'REFUNDED'],
  RETURNED_TO_CUSTOMER: ['CLOSED'],
  REFUNDED: ['CLOSED'],
  REJECTED: ['CLOSED'],
  CANCELLED: ['CLOSED'],
  CLOSED: [],
};

export function canTransition(from: ReturnStatus, to: ReturnStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export const REASON_FAULT: Record<ReturnReason, ReturnFault> = {
  DEFECTIVE: 'US',
  DAMAGED_IN_TRANSIT: 'US',
  NOT_AS_DESCRIBED: 'US',
  WRONG_ITEM_SENT: 'US',
  WRONG_SIZE: 'CUSTOMER',
  CHANGED_MIND: 'CUSTOMER',
};

export const PHOTOS_REQUIRED_REASONS: ReadonlySet<ReturnReason> = new Set([
  'DEFECTIVE',
  'DAMAGED_IN_TRANSIT',
  'WRONG_ITEM_SENT',
  'NOT_AS_DESCRIBED',
]);

export function defaultFault(reason: ReturnReason): ReturnFault {
  return REASON_FAULT[reason];
}

export function requiresPhotos(reason: ReturnReason): boolean {
  return PHOTOS_REQUIRED_REASONS.has(reason);
}
```

- [ ] **Step 2.2: Write tests**

Create `apps/api/src/modules/returns/returns.state-machine.spec.ts`:

```typescript
import { canTransition, defaultFault, requiresPhotos } from './returns.state-machine';

describe('returns state machine', () => {
  it('allows REQUESTED -> UNDER_REVIEW', () => {
    expect(canTransition('REQUESTED', 'UNDER_REVIEW')).toBe(true);
  });

  it('rejects REQUESTED -> REFUNDED', () => {
    expect(canTransition('REQUESTED', 'REFUNDED')).toBe(false);
  });

  it('treats CLOSED as terminal', () => {
    expect(canTransition('CLOSED', 'REFUNDED')).toBe(false);
  });

  it('maps DEFECTIVE to US fault', () => {
    expect(defaultFault('DEFECTIVE')).toBe('US');
  });

  it('maps CHANGED_MIND to CUSTOMER fault', () => {
    expect(defaultFault('CHANGED_MIND')).toBe('CUSTOMER');
  });

  it('requires photos for DAMAGED_IN_TRANSIT', () => {
    expect(requiresPhotos('DAMAGED_IN_TRANSIT')).toBe(true);
  });

  it('does not require photos for CHANGED_MIND', () => {
    expect(requiresPhotos('CHANGED_MIND')).toBe(false);
  });
});
```

Run: `pnpm -F api test returns.state-machine.spec`. Expected: all pass.

- [ ] **Step 2.3: Write eligibility checker**

Create `apps/api/src/modules/returns/returns.eligibility.ts`:

```typescript
import { Order, OrderItem, Product, ReturnItem } from '@prisma/client';

export type EligibilityFailure =
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_DELIVERED'
  | 'WINDOW_EXPIRED'
  | 'PRODUCT_NOT_RETURNABLE'
  | 'ITEM_ALREADY_RETURNED'
  | 'QUANTITY_EXCEEDS_ORDERED';

export const RETURN_WINDOW_DAYS = 7;

type DeliveryTimestamp = Date | null;

export function isWithinWindow(deliveredAt: DeliveryTimestamp, now: Date = new Date()): boolean {
  if (!deliveredAt) return false;
  const diffMs = now.getTime() - deliveredAt.getTime();
  const maxMs = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return diffMs <= maxMs;
}

export interface ItemEligibilityInput {
  orderItem: OrderItem & { product: Product | null };
  requestedQty: number;
  alreadyReturnedQty: number;
}

export function checkItemEligibility(input: ItemEligibilityInput): EligibilityFailure | null {
  if (input.orderItem.product && !input.orderItem.product.returnable) {
    return 'PRODUCT_NOT_RETURNABLE';
  }
  const remaining = input.orderItem.quantity - input.alreadyReturnedQty;
  if (remaining <= 0) return 'ITEM_ALREADY_RETURNED';
  if (input.requestedQty > remaining) return 'QUANTITY_EXCEEDS_ORDERED';
  return null;
}
```

- [ ] **Step 2.4: Write eligibility tests**

Create `apps/api/src/modules/returns/returns.eligibility.spec.ts`:

```typescript
import { isWithinWindow, checkItemEligibility } from './returns.eligibility';

describe('returns eligibility', () => {
  it('accepts a delivery from 3 days ago', () => {
    const delivered = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(isWithinWindow(delivered)).toBe(true);
  });

  it('rejects a delivery from 8 days ago', () => {
    const delivered = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    expect(isWithinWindow(delivered)).toBe(false);
  });

  it('rejects null delivery timestamp', () => {
    expect(isWithinWindow(null)).toBe(false);
  });

  it('blocks non-returnable products', () => {
    const result = checkItemEligibility({
      orderItem: { quantity: 1, product: { returnable: false } } as any,
      requestedQty: 1,
      alreadyReturnedQty: 0,
    });
    expect(result).toBe('PRODUCT_NOT_RETURNABLE');
  });

  it('blocks over-quantity requests', () => {
    const result = checkItemEligibility({
      orderItem: { quantity: 2, product: { returnable: true } } as any,
      requestedQty: 3,
      alreadyReturnedQty: 0,
    });
    expect(result).toBe('QUANTITY_EXCEEDS_ORDERED');
  });

  it('blocks already-returned items', () => {
    const result = checkItemEligibility({
      orderItem: { quantity: 2, product: { returnable: true } } as any,
      requestedQty: 1,
      alreadyReturnedQty: 2,
    });
    expect(result).toBe('ITEM_ALREADY_RETURNED');
  });
});
```

Run: `pnpm -F api test returns.eligibility.spec`. Expected: all pass.

- [ ] **Step 2.5: Write RTN ID generator**

Create `apps/api/src/modules/returns/rtn-id.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RtnIdService {
  constructor(private readonly prisma: PrismaService) {}

  async generate(year: number = new Date().getUTCFullYear()): Promise<string> {
    const prefix = `RTN-${year}-`;
    const latest = await this.prisma.return.findFirst({
      where: { rtnNumber: { startsWith: prefix } },
      orderBy: { rtnNumber: 'desc' },
      select: { rtnNumber: true },
    });
    const next = latest
      ? parseInt(latest.rtnNumber.slice(prefix.length), 10) + 1
      : 1;
    return `${prefix}${String(next).padStart(6, '0')}`;
  }
}
```

Note: monotonic-but-racy on concurrent inserts. The `@unique` constraint catches duplicates — the service catches `P2002` and retries up to 3 times. Add that wrapper in Task 3 inside `createReturn`.

- [ ] **Step 2.6: Commit**

```
git add apps/api/src/modules/returns/
git commit -m "feat(returns): state machine, eligibility, and RTN ID generator"
```

---

### Task 3: Returns module + customer create endpoint

**Files:**
- Create: `apps/api/src/modules/returns/returns.module.ts`
- Create: `apps/api/src/modules/returns/dto/create-return.dto.ts`
- Create: `apps/api/src/modules/returns/dto/cancel-return.dto.ts`
- Create: `apps/api/src/modules/returns/returns.service.ts`
- Create: `apps/api/src/modules/returns/returns.controller.ts`
- Create: `apps/api/src/modules/returns/returns.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` — import `ReturnsModule`

- [ ] **Step 3.1: DTOs**

Create `apps/api/src/modules/returns/dto/create-return.dto.ts`:

```typescript
import { z } from 'zod';

export const createReturnSchema = z.object({
  orderId: z.string().cuid(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().min(6).optional(),
  reason: z.enum([
    'DEFECTIVE',
    'DAMAGED_IN_TRANSIT',
    'NOT_AS_DESCRIBED',
    'WRONG_ITEM_SENT',
    'WRONG_SIZE',
    'CHANGED_MIND',
  ]),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(5).default([]),
  items: z
    .array(
      z.object({
        orderItemId: z.string().cuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
});

export type CreateReturnDto = z.infer<typeof createReturnSchema>;
```

Create `apps/api/src/modules/returns/dto/cancel-return.dto.ts`:

```typescript
import { z } from 'zod';
export const cancelReturnSchema = z.object({
  reason: z.string().max(500).optional(),
});
export type CancelReturnDto = z.infer<typeof cancelReturnSchema>;
```

- [ ] **Step 3.2: Service — createReturn with eligibility + RTN ID retry**

Create `apps/api/src/modules/returns/returns.service.ts`:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma, ReturnStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';
import { RtnIdService } from './rtn-id.service';
import { CreateReturnDto } from './dto/create-return.dto';
import {
  isWithinWindow,
  checkItemEligibility,
  RETURN_WINDOW_DAYS,
} from './returns.eligibility';
import {
  defaultFault,
  requiresPhotos,
  canTransition,
} from './returns.state-machine';

const SLA_HOURS = 48;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rtnIds: RtnIdService,
    private readonly events: EventEmitter2,
  ) {}

  async createReturn(input: {
    userId: string | null;
    dto: CreateReturnDto;
  }): Promise<{ id: string; rtnNumber: string }> {
    const { userId, dto } = input;

    if (requiresPhotos(dto.reason) && dto.photos.length === 0) {
      throw new BadRequestException(
        `Photos are required for reason ${dto.reason}`,
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: {
        items: { include: { product: true } },
        statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const isOwner =
      (userId && order.userId === userId) ||
      (!userId &&
        order.guestEmail &&
        dto.guestEmail &&
        order.guestEmail.toLowerCase() === dto.guestEmail.toLowerCase() &&
        order.guestPhone === dto.guestPhone);
    if (!isOwner) {
      throw new ForbiddenException(
        'Order does not match the provided credentials',
      );
    }

    if (order.status !== 'DELIVERED') {
      throw new BadRequestException(
        'Returns can only be requested for DELIVERED orders',
      );
    }

    const deliveredEntry = order.statusHistory.find(
      (h) => h.toStatus === 'DELIVERED',
    );
    if (!isWithinWindow(deliveredEntry?.createdAt ?? null)) {
      throw new BadRequestException(
        `Return window of ${RETURN_WINDOW_DAYS} days has expired`,
      );
    }

    const existingReturnedQuantities = await this.prisma.returnItem.groupBy({
      by: ['orderItemId'],
      where: {
        orderItem: { orderId: order.id },
        return: { status: { notIn: ['REJECTED', 'CANCELLED', 'CLOSED'] } },
      },
      _sum: { quantity: true },
    });
    const alreadyReturnedMap = new Map(
      existingReturnedQuantities.map((row) => [
        row.orderItemId,
        row._sum.quantity ?? 0,
      ]),
    );

    for (const item of dto.items) {
      const orderItem = order.items.find((oi) => oi.id === item.orderItemId);
      if (!orderItem) {
        throw new BadRequestException(
          `Order item ${item.orderItemId} not in order`,
        );
      }
      const failure = checkItemEligibility({
        orderItem,
        requestedQty: item.quantity,
        alreadyReturnedQty: alreadyReturnedMap.get(orderItem.id) ?? 0,
      });
      if (failure) {
        throw new BadRequestException(
          `Item ${orderItem.id} ineligible: ${failure}`,
        );
      }
    }

    const fault = defaultFault(dto.reason);
    const customerShipsBack = fault === 'CUSTOMER';
    const slaDeadline = new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000);

    const created = await this.tryCreateWithRtnRetry(async (rtnNumber) => {
      return this.prisma.return.create({
        data: {
          rtnNumber,
          orderId: order.id,
          userId: order.userId,
          guestEmail: order.guestEmail,
          guestName: order.guestName,
          guestPhone: order.guestPhone,
          reason: dto.reason,
          fault,
          description: dto.description,
          photos: dto.photos,
          customerShipsBack,
          slaDeadline,
          items: {
            create: dto.items.map((i) => ({
              orderItemId: i.orderItemId,
              quantity: i.quantity,
            })),
          },
        },
        select: { id: true, rtnNumber: true },
      });
    });

    this.events.emit('return.requested', {
      returnId: created.id,
      rtnNumber: created.rtnNumber,
    });
    return created;
  }

  private async tryCreateWithRtnRetry<T>(
    fn: (rtnNumber: string) => Promise<T>,
    attempts = 3,
  ): Promise<T> {
    let lastError: unknown;
    for (let i = 0; i < attempts; i++) {
      const rtnNumber = await this.rtnIds.generate();
      try {
        return await fn(rtnNumber);
      } catch (err) {
        lastError = err;
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === 'P2002'
        ) {
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  async cancelReturn(input: {
    userId: string | null;
    rtnNumber: string;
    guestEmail?: string;
    guestPhone?: string;
  }): Promise<void> {
    const ret = await this.prisma.return.findUnique({
      where: { rtnNumber: input.rtnNumber },
    });
    if (!ret) throw new NotFoundException('Return not found');

    const isOwner =
      (input.userId && ret.userId === input.userId) ||
      (!input.userId &&
        ret.guestEmail &&
        input.guestEmail &&
        ret.guestEmail.toLowerCase() === input.guestEmail.toLowerCase() &&
        ret.guestPhone === input.guestPhone);
    if (!isOwner) throw new ForbiddenException();

    if (!canTransition(ret.status, 'CANCELLED')) {
      throw new BadRequestException(
        `Cannot cancel a return in status ${ret.status}`,
      );
    }

    await this.prisma.return.update({
      where: { id: ret.id },
      data: { status: 'CANCELLED', closedAt: new Date() },
    });
  }

  async getMyReturns(userId: string) {
    return this.prisma.return.findMany({
      where: { userId },
      orderBy: { requestedAt: 'desc' },
      include: { items: true },
    });
  }

  async getByRtnNumber(args: {
    rtnNumber: string;
    userId?: string;
    guestEmail?: string;
    guestPhone?: string;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { rtnNumber: args.rtnNumber },
      include: {
        items: { include: { orderItem: { include: { product: true } } } },
        order: { select: { id: true, total: true, status: true } },
      },
    });
    if (!ret) throw new NotFoundException();
    const isOwner =
      (args.userId && ret.userId === args.userId) ||
      (!args.userId &&
        ret.guestEmail &&
        args.guestEmail &&
        ret.guestEmail.toLowerCase() === args.guestEmail.toLowerCase() &&
        ret.guestPhone === args.guestPhone);
    if (!isOwner) throw new ForbiddenException();
    return ret;
  }
}
```

- [ ] **Step 3.3: Controller (customer endpoints)**

Create `apps/api/src/modules/returns/returns.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReturnsService } from './returns.service';
import {
  createReturnSchema,
  CreateReturnDto,
} from './dto/create-return.dto';

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returns: ReturnsService) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  @UsePipes(new ZodValidationPipe(createReturnSchema))
  async create(
    @CurrentUser() user: { id: string } | null,
    @Body() dto: CreateReturnDto,
  ) {
    return this.returns.createReturn({ userId: user?.id ?? null, dto });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async myReturns(@CurrentUser() user: { id: string }) {
    return this.returns.getMyReturns(user.id);
  }

  @Get(':rtnNumber')
  @UseGuards(OptionalJwtAuthGuard)
  async lookup(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string } | null,
    @Query('email') email?: string,
    @Query('phone') phone?: string,
  ) {
    return this.returns.getByRtnNumber({
      rtnNumber,
      userId: user?.id,
      guestEmail: email,
      guestPhone: phone,
    });
  }

  @Post(':rtnNumber/cancel')
  @UseGuards(OptionalJwtAuthGuard)
  async cancel(
    @Param('rtnNumber') rtnNumber: string,
    @CurrentUser() user: { id: string } | null,
    @Body() body: { email?: string; phone?: string },
  ) {
    await this.returns.cancelReturn({
      userId: user?.id ?? null,
      rtnNumber,
      guestEmail: body.email,
      guestPhone: body.phone,
    });
    return { success: true };
  }
}
```

- [ ] **Step 3.4: Module wiring**

Create `apps/api/src/modules/returns/returns.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';
import { RtnIdService } from './rtn-id.service';

@Module({
  controllers: [ReturnsController],
  providers: [ReturnsService, RtnIdService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
```

Modify `apps/api/src/app.module.ts` — locate the `imports:` array and add `ReturnsModule`.

- [ ] **Step 3.5: Service tests**

Create `apps/api/src/modules/returns/returns.service.spec.ts` with at minimum these specs (use existing testing patterns from `orders.service.spec.ts`):

```typescript
import { ReturnsService } from './returns.service';

describe('ReturnsService.createReturn', () => {
  let service: ReturnsService;
  let prisma: any;
  let rtnIds: any;
  let events: any;

  beforeEach(() => {
    prisma = {
      order: { findUnique: jest.fn() },
      returnItem: { groupBy: jest.fn().mockResolvedValue([]) },
      return: { create: jest.fn() },
    };
    rtnIds = { generate: jest.fn().mockResolvedValue('RTN-2026-000001') };
    events = { emit: jest.fn() };
    service = new ReturnsService(prisma, rtnIds, events);
  });

  it('rejects when order not DELIVERED', async () => {
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: 'SHIPPED',
      items: [],
      statusHistory: [],
    });
    await expect(
      service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o1',
          reason: 'DEFECTIVE',
          photos: ['https://r2/p.jpg'],
          items: [{ orderItemId: 'oi1', quantity: 1 }],
        } as any,
      }),
    ).rejects.toThrow(/DELIVERED/);
  });

  it('rejects when photos missing for fault reason', async () => {
    await expect(
      service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o1',
          reason: 'DEFECTIVE',
          photos: [],
          items: [{ orderItemId: 'oi1', quantity: 1 }],
        } as any,
      }),
    ).rejects.toThrow(/Photos are required/);
  });

  it('rejects when 7-day window expired', async () => {
    const stale = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: 'DELIVERED',
      items: [
        { id: 'oi1', quantity: 1, product: { returnable: true } },
      ],
      statusHistory: [{ toStatus: 'DELIVERED', createdAt: stale }],
    });
    await expect(
      service.createReturn({
        userId: 'u1',
        dto: {
          orderId: 'o1',
          reason: 'CHANGED_MIND',
          photos: [],
          items: [{ orderItemId: 'oi1', quantity: 1 }],
        } as any,
      }),
    ).rejects.toThrow(/window/);
  });

  it('creates return with auto-fault and emits event', async () => {
    const fresh = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    prisma.order.findUnique.mockResolvedValue({
      id: 'o1',
      userId: 'u1',
      status: 'DELIVERED',
      items: [
        { id: 'oi1', quantity: 2, product: { returnable: true } },
      ],
      statusHistory: [{ toStatus: 'DELIVERED', createdAt: fresh }],
    });
    prisma.return.create.mockResolvedValue({
      id: 'r1',
      rtnNumber: 'RTN-2026-000001',
    });

    const out = await service.createReturn({
      userId: 'u1',
      dto: {
        orderId: 'o1',
        reason: 'CHANGED_MIND',
        photos: [],
        items: [{ orderItemId: 'oi1', quantity: 1 }],
      } as any,
    });

    expect(out.rtnNumber).toBe('RTN-2026-000001');
    expect(prisma.return.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fault: 'CUSTOMER',
          customerShipsBack: true,
        }),
      }),
    );
    expect(events.emit).toHaveBeenCalledWith(
      'return.requested',
      expect.objectContaining({ rtnNumber: 'RTN-2026-000001' }),
    );
  });
});
```

Run: `pnpm -F api test returns.service.spec`. Expected: all pass.

- [ ] **Step 3.6: Commit**

```
git add apps/api/src/modules/returns apps/api/src/app.module.ts
git commit -m "feat(returns): customer create/cancel/lookup endpoints"
```

---

### Task 4: Admin endpoints — list, detail, transitions

**Files:**
- Create: `apps/api/src/modules/returns/returns-admin.controller.ts`
- Create: `apps/api/src/modules/returns/dto/review-return.dto.ts`
- Create: `apps/api/src/modules/returns/dto/approve-return.dto.ts`
- Create: `apps/api/src/modules/returns/dto/reject-return.dto.ts`
- Create: `apps/api/src/modules/returns/dto/mark-received.dto.ts`
- Create: `apps/api/src/modules/returns/dto/inspect-return.dto.ts`
- Create: `apps/api/src/modules/returns/dto/issue-refund.dto.ts`
- Create: `apps/api/src/modules/returns/dto/list-returns.dto.ts`
- Modify: `apps/api/src/modules/returns/returns.service.ts` — add admin methods
- Modify: `apps/api/src/modules/returns/returns.module.ts` — register controller

- [ ] **Step 4.1: DTOs**

Create one DTO per action — example for `inspect-return.dto.ts`:

```typescript
import { z } from 'zod';

export const inspectReturnSchema = z.object({
  itemResults: z.array(
    z.object({
      returnItemId: z.string().cuid(),
      inspectionResult: z.enum(['PASS', 'FAIL']),
      restock: z.boolean().default(false),
    }),
  ).min(1),
  inspectionNotes: z.string().max(2000).optional(),
});
export type InspectReturnDto = z.infer<typeof inspectReturnSchema>;
```

Use identical shape pattern for: `approveReturnSchema` (carrier? pickupAddress? Json), `rejectReturnSchema` (rejectionReason required), `markReceivedSchema` (trackingNumber optional), `issueRefundSchema` (amount Decimal, method enum, reference required, notes optional), `reviewReturnSchema` (reviewerNotes optional), `listReturnsSchema` (status[], fault?, slaOverdue?, page, limit).

- [ ] **Step 4.2: Service — admin transition methods**

Append to `apps/api/src/modules/returns/returns.service.ts`:

```typescript
  async listForAdmin(args: {
    status?: ReturnStatus[];
    slaOverdue?: boolean;
    page: number;
    limit: number;
  }) {
    const where: Prisma.ReturnWhereInput = {};
    if (args.status?.length) where.status = { in: args.status };
    if (args.slaOverdue) {
      where.slaDeadline = { lt: new Date() };
      where.status = { in: ['REQUESTED', 'UNDER_REVIEW'] };
    }
    const [items, total] = await Promise.all([
      this.prisma.return.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
        include: { items: true, order: { select: { id: true, total: true } } },
      }),
      this.prisma.return.count({ where }),
    ]);
    return { items, total, page: args.page, limit: args.limit };
  }

  async getForAdmin(id: string) {
    const ret = await this.prisma.return.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            orderItem: { include: { product: true, variant: true } },
          },
        },
        order: { include: { items: true } },
        refundTxn: true,
      },
    });
    if (!ret) throw new NotFoundException();
    return ret;
  }

  async transition(args: {
    id: string;
    to: ReturnStatus;
    adminId: string;
    patch?: Prisma.ReturnUpdateInput;
  }) {
    const current = await this.prisma.return.findUnique({
      where: { id: args.id },
      select: { status: true },
    });
    if (!current) throw new NotFoundException();
    if (!canTransition(current.status, args.to)) {
      throw new BadRequestException(
        `Cannot transition ${current.status} -> ${args.to}`,
      );
    }
    const now = new Date();
    const timestampField = this.timestampForStatus(args.to);
    const updated = await this.prisma.return.update({
      where: { id: args.id },
      data: {
        status: args.to,
        ...(timestampField ? { [timestampField]: now } : {}),
        ...(args.patch ?? {}),
      },
    });
    this.events.emit(`return.${args.to.toLowerCase()}`, {
      returnId: updated.id,
      rtnNumber: updated.rtnNumber,
      adminId: args.adminId,
    });
    return updated;
  }

  private timestampForStatus(status: ReturnStatus): string | null {
    switch (status) {
      case 'UNDER_REVIEW': return 'reviewedAt';
      case 'APPROVED': return 'approvedAt';
      case 'RECEIVED': return 'receivedAt';
      case 'INSPECTED_PASS':
      case 'INSPECTED_FAIL':
        return 'inspectedAt';
      case 'REFUNDED': return 'refundedAt';
      case 'CLOSED':
      case 'CANCELLED':
      case 'RETURNED_TO_CUSTOMER':
      case 'REJECTED':
        return 'closedAt';
      default: return null;
    }
  }

  async recordInspection(args: {
    id: string;
    adminId: string;
    itemResults: { returnItemId: string; inspectionResult: 'PASS' | 'FAIL'; restock: boolean }[];
    inspectionNotes?: string;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { id: args.id },
      include: { items: true },
    });
    if (!ret) throw new NotFoundException();
    if (ret.status !== 'INSPECTING') {
      throw new BadRequestException('Return is not in INSPECTING state');
    }

    const allPass = args.itemResults.every((r) => r.inspectionResult === 'PASS');
    const nextStatus: ReturnStatus = allPass ? 'INSPECTED_PASS' : 'INSPECTED_FAIL';

    await this.prisma.$transaction([
      ...args.itemResults.map((r) =>
        this.prisma.returnItem.update({
          where: { id: r.returnItemId },
          data: { inspectionResult: r.inspectionResult, restock: r.restock },
        }),
      ),
      this.prisma.return.update({
        where: { id: args.id },
        data: {
          status: nextStatus,
          inspectedAt: new Date(),
          inspectionNotes: args.inspectionNotes,
        },
      }),
    ]);
    this.events.emit(`return.${nextStatus.toLowerCase()}`, {
      returnId: ret.id,
      rtnNumber: ret.rtnNumber,
      adminId: args.adminId,
    });
  }
```

- [ ] **Step 4.3: Admin controller**

Create `apps/api/src/modules/returns/returns-admin.controller.ts`:

```typescript
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ReturnsService } from './returns.service';
import { ReturnsRefundService } from './returns.refund.service';
import { reviewReturnSchema, ReviewReturnDto } from './dto/review-return.dto';
import { approveReturnSchema, ApproveReturnDto } from './dto/approve-return.dto';
import { rejectReturnSchema, RejectReturnDto } from './dto/reject-return.dto';
import { markReceivedSchema, MarkReceivedDto } from './dto/mark-received.dto';
import { inspectReturnSchema, InspectReturnDto } from './dto/inspect-return.dto';
import { issueRefundSchema, IssueRefundDto } from './dto/issue-refund.dto';

@Controller('admin/returns')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
export class ReturnsAdminController {
  constructor(
    private readonly returns: ReturnsService,
    private readonly refunds: ReturnsRefundService,
  ) {}

  @Get()
  async list(
    @Query('status') statusCsv?: string,
    @Query('slaOverdue') slaOverdue?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.returns.listForAdmin({
      status: statusCsv ? (statusCsv.split(',') as any) : undefined,
      slaOverdue: slaOverdue === 'true',
      page: Number(page),
      limit: Math.min(Number(limit), 100),
    });
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.returns.getForAdmin(id);
  }

  @Patch(':id/review')
  @UsePipes(new ZodValidationPipe(reviewReturnSchema))
  async review(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ReviewReturnDto,
  ) {
    return this.returns.transition({
      id,
      to: 'UNDER_REVIEW',
      adminId: user.id,
      patch: { reviewerId: user.id, reviewerNotes: dto.reviewerNotes },
    });
  }

  @Patch(':id/approve')
  @UsePipes(new ZodValidationPipe(approveReturnSchema))
  async approve(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: ApproveReturnDto,
  ) {
    return this.returns.transition({
      id,
      to: 'APPROVED',
      adminId: user.id,
      patch: { pickupAddress: dto.pickupAddress, carrier: dto.carrier },
    });
  }

  @Patch(':id/reject')
  @UsePipes(new ZodValidationPipe(rejectReturnSchema))
  async reject(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: RejectReturnDto,
  ) {
    return this.returns.transition({
      id,
      to: 'REJECTED',
      adminId: user.id,
      patch: { rejectionReason: dto.rejectionReason, closedAt: new Date() },
    });
  }

  @Patch(':id/mark-received')
  @UsePipes(new ZodValidationPipe(markReceivedSchema))
  async markReceived(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: MarkReceivedDto,
  ) {
    return this.returns.transition({
      id,
      to: 'RECEIVED',
      adminId: user.id,
      patch: { trackingNumber: dto.trackingNumber },
    });
  }

  @Patch(':id/start-inspection')
  async startInspection(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.returns.transition({
      id,
      to: 'INSPECTING',
      adminId: user.id,
    });
  }

  @Patch(':id/inspect')
  @UsePipes(new ZodValidationPipe(inspectReturnSchema))
  async inspect(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: InspectReturnDto,
  ) {
    await this.returns.recordInspection({
      id,
      adminId: user.id,
      itemResults: dto.itemResults,
      inspectionNotes: dto.inspectionNotes,
    });
    return { success: true };
  }

  @Post(':id/issue-refund')
  @UsePipes(new ZodValidationPipe(issueRefundSchema))
  async refund(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: IssueRefundDto,
  ) {
    return this.refunds.issueRefund({
      returnId: id,
      adminId: user.id,
      amount: dto.amount,
      method: dto.method,
      reference: dto.reference,
      notes: dto.notes,
      overrideFromFail: dto.overrideFromFail ?? false,
    });
  }

  @Patch(':id/return-to-customer')
  async returnToCustomer(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.returns.transition({
      id,
      to: 'RETURNED_TO_CUSTOMER',
      adminId: user.id,
      patch: { closedAt: new Date() },
    });
  }
}
```

- [ ] **Step 4.4: Register admin controller in module**

Modify `apps/api/src/modules/returns/returns.module.ts`:

```typescript
controllers: [ReturnsController, ReturnsAdminController],
providers: [ReturnsService, RtnIdService, ReturnsRefundService],
```

- [ ] **Step 4.5: Commit**

```
git add apps/api/src/modules/returns
git commit -m "feat(returns): admin list/detail/transition endpoints"
```

---

### Task 5: Refund service + inventory restoration

**Files:**
- Create: `apps/api/src/modules/returns/returns.refund.service.ts`
- Create: `apps/api/src/modules/returns/returns.refund.service.spec.ts`

- [ ] **Step 5.1: Refund service**

Create `apps/api/src/modules/returns/returns.refund.service.ts`:

```typescript
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RefundMethod } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReturnsRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async issueRefund(args: {
    returnId: string;
    adminId: string;
    amount: Prisma.Decimal | number;
    method: RefundMethod;
    reference: string;
    notes?: string;
    overrideFromFail: boolean;
  }) {
    const ret = await this.prisma.return.findUnique({
      where: { id: args.returnId },
      include: { items: { include: { orderItem: { include: { variant: true } } } } },
    });
    if (!ret) throw new NotFoundException();

    const validFromState =
      ret.status === 'INSPECTED_PASS' ||
      (ret.status === 'INSPECTED_FAIL' && args.overrideFromFail);
    if (!validFromState) {
      throw new BadRequestException(
        `Cannot refund from status ${ret.status}`,
      );
    }

    const restockOps: Prisma.PrismaPromise<unknown>[] = [];
    for (const item of ret.items) {
      const shouldRestock =
        item.inspectionResult === 'PASS' &&
        item.restock &&
        item.orderItem?.variantId;
      if (!shouldRestock || !item.orderItem) continue;
      restockOps.push(
        this.prisma.productVariant.update({
          where: { id: item.orderItem.variantId! },
          data: { stock: { increment: item.quantity } },
        }),
      );
    }

    const [txn] = await this.prisma.$transaction([
      this.prisma.refundTransaction.create({
        data: {
          returnId: ret.id,
          amount: args.amount as any,
          method: args.method,
          reference: args.reference,
          notes: args.notes,
          issuedById: args.adminId,
        },
      }),
      this.prisma.return.update({
        where: { id: ret.id },
        data: {
          status: 'REFUNDED',
          refundAmount: args.amount as any,
          refundMethod: args.method,
          refundReference: args.reference,
          refundedAt: new Date(),
        },
      }),
      ...restockOps,
    ]);

    this.events.emit('return.refunded', {
      returnId: ret.id,
      rtnNumber: ret.rtnNumber,
      amount: args.amount,
      method: args.method,
      adminId: args.adminId,
    });

    return txn;
  }

  computeBundleItemRefund(args: {
    bundleDiscountedPrice: number;
    bundleItemCount: number;
  }): number {
    if (args.bundleItemCount <= 0) return 0;
    return Math.round((args.bundleDiscountedPrice / args.bundleItemCount) * 100) / 100;
  }
}
```

- [ ] **Step 5.2: Tests**

Create `apps/api/src/modules/returns/returns.refund.service.spec.ts` covering:
- Rejects refund when status not INSPECTED_PASS and override=false
- Allows refund when override=true and status=INSPECTED_FAIL
- Creates RefundTransaction row + updates return to REFUNDED
- Increments variant stock only for items where `restock=true && inspectionResult=PASS`
- `computeBundleItemRefund(300, 3)` returns 100
- `computeBundleItemRefund(305.25, 3)` returns 101.75

Run: `pnpm -F api test returns.refund.service.spec`. Expected: all pass.

- [ ] **Step 5.3: Commit**

```
git add apps/api/src/modules/returns/returns.refund.service.ts apps/api/src/modules/returns/returns.refund.service.spec.ts
git commit -m "feat(returns): refund service with inventory restock"
```

---

### Task 6: Manual admin return creation

**Files:**
- Create: `apps/api/src/modules/returns/dto/manual-return.dto.ts`
- Modify: `apps/api/src/modules/returns/returns.service.ts` — add `createManual`
- Modify: `apps/api/src/modules/returns/returns-admin.controller.ts` — `POST /admin/returns/manual`

- [ ] **Step 6.1: DTO**

```typescript
import { z } from 'zod';

export const manualReturnSchema = z.object({
  orderId: z.string().cuid().nullable(),
  customerName: z.string().min(1),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().min(6),
  reason: z.enum([
    'DEFECTIVE',
    'DAMAGED_IN_TRANSIT',
    'NOT_AS_DESCRIBED',
    'WRONG_ITEM_SENT',
    'WRONG_SIZE',
    'CHANGED_MIND',
  ]),
  faultOverride: z.enum(['US', 'CUSTOMER']).optional(),
  description: z.string().max(2000).optional(),
  photos: z.array(z.string().url()).max(5).default([]),
  items: z.array(
    z.object({
      orderItemId: z.string().cuid().nullable(),
      manualProductName: z.string().optional(),
      manualSku: z.string().optional(),
      manualSize: z.string().optional(),
      manualColor: z.string().optional(),
      manualUnitPrice: z.number().nonnegative().optional(),
      quantity: z.number().int().positive(),
    }),
  ).min(1),
});
export type ManualReturnDto = z.infer<typeof manualReturnSchema>;
```

- [ ] **Step 6.2: Service method**

Append `createManual(...)` to `ReturnsService`. Skips delivery-window and order-status eligibility checks (since admin entered it). Sets `isManual: true`, uses `faultOverride ?? defaultFault(reason)`, sets `customerShipsBack` from fault. For manual items without `orderItemId`, requires `manualProductName + manualUnitPrice + manualSize + manualColor + manualSku`.

- [ ] **Step 6.3: Controller route**

```typescript
  @Post('manual')
  @UsePipes(new ZodValidationPipe(manualReturnSchema))
  async createManual(
    @CurrentUser() user: { id: string },
    @Body() dto: ManualReturnDto,
  ) {
    return this.returns.createManual({ adminId: user.id, dto });
  }
```

- [ ] **Step 6.4: Tests + commit**

Add unit test for `createManual`. Run, commit:
```
git commit -m "feat(returns): manual return creation for walk-ins"
```

---

### Task 7: Email templates + listener

**Files:**
- Modify: `apps/api/src/modules/email/email-templates.ts` — add 5 templates
- Create: `apps/api/src/common/listeners/return-email.listener.ts`
- Create: `apps/api/src/common/listeners/return-email.listener.spec.ts`

- [ ] **Step 7.1: Add 5 plain-HTML email templates**

Follow the pattern of existing order templates. Each function returns `{ subject, html }`. Templates:
- `returnSubmitted({ rtnNumber, slaDeadline })`
- `returnApproved({ rtnNumber, fault, pickupAddress?, shippingInstructions })`
- `returnRejected({ rtnNumber, reason })`
- `returnReceived({ rtnNumber })`
- `returnRefunded({ rtnNumber, amount, method, reference })`

Each body must include a link to `/returns/{rtnNumber}` for tracking and a copy line: "If you didn't request this return, reply to this email immediately."

- [ ] **Step 7.2: Listener**

Create `apps/api/src/common/listeners/return-email.listener.ts` modeled after `order-email.listener.ts`. Subscribes to:
- `return.requested` → `returnSubmitted`
- `return.approved` → `returnApproved`
- `return.rejected` → `returnRejected`
- `return.received` → `returnReceived`
- `return.refunded` → `returnRefunded`

Each handler loads the return + customer email (from `userId` or `guestEmail`) and dispatches via `EmailService.send`.

- [ ] **Step 7.3: Wire in app module**

Register `ReturnEmailListener` in `apps/api/src/app.module.ts` providers.

- [ ] **Step 7.4: Tests + commit**

Mirror `order-email.listener.spec.ts` for the new listener. Each handler test verifies `email.send` was called with the right template + recipient.

```
git commit -m "feat(returns): customer email notifications across state changes"
```

---

### Task 8: Metrics endpoint + service

**Files:**
- Create: `apps/api/src/modules/returns/returns.metrics.service.ts`
- Modify: `apps/api/src/modules/returns/returns-admin.controller.ts` — `GET /admin/returns/metrics`
- Modify: `apps/api/src/modules/returns/returns.module.ts` — register service

- [ ] **Step 8.1: Service**

Create `apps/api/src/modules/returns/returns.metrics.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReturnsMetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(rangeDays = 30) {
    const since = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    const [returnsCount, ordersCount, byReason, openValueAgg, resolution] =
      await Promise.all([
        this.prisma.return.count({ where: { requestedAt: { gte: since } } }),
        this.prisma.order.count({
          where: { status: 'DELIVERED', updatedAt: { gte: since } },
        }),
        this.prisma.return.groupBy({
          by: ['reason'],
          where: { requestedAt: { gte: since } },
          _count: { _all: true },
        }),
        this.prisma.return.aggregate({
          where: { status: { notIn: ['REFUNDED', 'CLOSED', 'REJECTED', 'CANCELLED', 'RETURNED_TO_CUSTOMER'] } },
          _sum: { refundAmount: true },
        }),
        this.prisma.$queryRaw<{ avg_hours: number | null }[]>`
          SELECT AVG(EXTRACT(EPOCH FROM ("closedAt" - "requestedAt")) / 3600)::float AS avg_hours
          FROM "Return"
          WHERE "closedAt" IS NOT NULL AND "requestedAt" >= ${since}
        `,
      ]);

    const returnRate = ordersCount > 0 ? returnsCount / ordersCount : 0;
    return {
      rangeDays,
      returnsCount,
      ordersCount,
      returnRate,
      topReasons: byReason
        .sort((a, b) => b._count._all - a._count._all)
        .map((r) => ({ reason: r.reason, count: r._count._all })),
      pendingRefundValue: openValueAgg._sum.refundAmount ?? 0,
      averageResolutionHours: resolution[0]?.avg_hours ?? null,
    };
  }
}
```

- [ ] **Step 8.2: Controller route**

Add to `ReturnsAdminController`:

```typescript
  @Get('metrics/dashboard')
  async metrics(@Query('rangeDays') rangeDays = '30') {
    return this.metrics.getDashboard(Number(rangeDays));
  }
```

Inject `ReturnsMetricsService` in the constructor.

- [ ] **Step 8.3: Commit**

```
git commit -m "feat(returns): dashboard metrics endpoint"
```

---

### Task 9: Admin frontend — list page

**Files:**
- Create: `apps/admin/lib/api-returns.ts`
- Create: `apps/admin/app/(dashboard)/returns/page.tsx`

- [ ] **Step 9.1: API client**

Create `apps/admin/lib/api-returns.ts`:

```typescript
import { adminApiFetch } from './admin-api';
import type { ReturnStatus, ReturnReason, ReturnFault, RefundMethod } from '@prisma/client';

export interface ReturnListItem {
  id: string;
  rtnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  fault: ReturnFault;
  slaDeadline: string;
  requestedAt: string;
  refundAmount: string | null;
  order: { id: string; total: string } | null;
  items: { id: string; quantity: number }[];
}

export async function listReturns(params: {
  status?: ReturnStatus[];
  slaOverdue?: boolean;
  page?: number;
  limit?: number;
}) {
  const q = new URLSearchParams();
  if (params.status?.length) q.set('status', params.status.join(','));
  if (params.slaOverdue) q.set('slaOverdue', 'true');
  if (params.page) q.set('page', String(params.page));
  if (params.limit) q.set('limit', String(params.limit));
  return adminApiFetch<{ items: ReturnListItem[]; total: number; page: number; limit: number }>(
    `/admin/returns?${q.toString()}`,
  );
}
```

- [ ] **Step 9.2: List page UI**

Create `apps/admin/app/(dashboard)/returns/page.tsx` — server component reading `searchParams` (`status`, `tab`, `page`).

Tab bar: All / REQUESTED / UNDER_REVIEW / APPROVED / RECEIVED / INSPECTING / REFUNDED / Past SLA.

Table columns: RTN #, Order #, Status (colored chip), Reason, Fault, Requested at, SLA (red if past), Items count, Refund amount.

Past-SLA detection: row is red-highlighted if `now > slaDeadline && status in [REQUESTED, UNDER_REVIEW]`.

Follow existing patterns from `apps/admin/app/(dashboard)/orders/page.tsx` for visual style.

- [ ] **Step 9.3: Commit**

```
git commit -m "feat(admin): returns list page with SLA red flag"
```

---

### Task 10: Admin frontend — detail page with transition buttons

**Files:**
- Create: `apps/admin/app/(dashboard)/returns/[id]/page.tsx`
- Create: `apps/admin/app/(dashboard)/returns/[id]/actions.ts` (server actions for transitions)

- [ ] **Step 10.1: Detail page UI**

Sections:
1. Header — RTN #, Status chip, SLA timer (red if past), customer + contact, reason, fault
2. Photos — gallery of `photos[]` URLs (lightbox on click)
3. Items table — order item link, qty, current restock decision, inspection result
4. Order link — link to the originating order detail page
5. Timeline — derived from timestamps (requested, reviewed, approved, received, inspected, refunded, closed)
6. Action panel — context-aware buttons by current status:
   - `REQUESTED` → "Start Review", "Reject", "Cancel"
   - `UNDER_REVIEW` → "Approve" (carrier/pickup form), "Reject" (reason form)
   - `APPROVED` → "Mark In Transit" (tracking #), "Mark Received"
   - `IN_TRANSIT` → "Mark Received"
   - `RECEIVED` → "Start Inspection"
   - `INSPECTING` → per-item PASS/FAIL + restock checkbox form, "Complete Inspection"
   - `INSPECTED_PASS` → "Issue Refund" (amount/method/reference form)
   - `INSPECTED_FAIL` → "Ship Back to Customer", "Override → Refund Anyway"

7. Refund panel — once issued, show RefundTransaction details (locked)

- [ ] **Step 10.2: Server actions**

Each action calls the corresponding admin endpoint and `revalidatePath('/returns/[id]')`.

- [ ] **Step 10.3: Commit**

```
git commit -m "feat(admin): returns detail page with state machine transitions"
```

---

### Task 11: Admin frontend — manual return entry + metrics

**Files:**
- Create: `apps/admin/app/(dashboard)/returns/manual/page.tsx`
- Create: `apps/admin/app/(dashboard)/returns/metrics/page.tsx`

- [ ] **Step 11.1: Manual entry form**

Form fields:
- Order # (optional, auto-fills items if entered & valid)
- Customer name (required)
- Customer phone (required)
- Customer email (optional)
- Reason (dropdown)
- Fault override (Auto / Force US / Force Customer)
- Description (textarea)
- Photos (upload to R2, reuse `apps/admin/lib/upload-image.ts` or equivalent)
- Items — repeating section:
  - "Pick from order" mode: select from order items
  - "Manual entry" mode: product name, SKU, size, color, unit price, qty
- Submit → calls `POST /admin/returns/manual`

- [ ] **Step 11.2: Metrics dashboard**

Cards: Return Rate (%), Total Returns (last 30d), Avg Resolution (hours), Pending Refund Value (BDT).

Chart: Top reasons (bar chart, reuse existing chart component or render with simple flex bars if none).

- [ ] **Step 11.3: Commit**

```
git commit -m "feat(admin): manual return entry + metrics dashboard"
```

---

### Task 12: Web frontend — submission flow

**Files:**
- Modify: `apps/web/lib/api.ts` — add `Return` types and helpers
- Replace: `apps/web/app/returns/page.tsx` — split static policy info + "Start a Return" CTA
- Create: `apps/web/app/returns/new/page.tsx` — submission form
- Create: `apps/web/app/returns/[rtnNumber]/page.tsx` — tracking page
- Create: `apps/web/app/account/returns/page.tsx` — logged-in history

- [ ] **Step 12.1: Add types + API helpers to `apps/web/lib/api.ts`**

```typescript
export interface Return {
  id: string;
  rtnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  fault: 'US' | 'CUSTOMER';
  photos: string[];
  description: string | null;
  refundAmount: string | null;
  refundMethod: 'CASH' | 'BANK_TRANSFER' | null;
  slaDeadline: string;
  requestedAt: string;
  approvedAt: string | null;
  receivedAt: string | null;
  refundedAt: string | null;
  customerShipsBack: boolean;
  items: ReturnLineItem[];
  order: { id: string; total: string; status: string } | null;
}

export interface ReturnLineItem {
  id: string;
  quantity: number;
  inspectionResult: 'PASS' | 'FAIL' | null;
  orderItem: {
    id: string;
    snapshot: Record<string, unknown>;
    product: { name: string; slug: string; images: string[] } | null;
  } | null;
}

export type ReturnReason = 'DEFECTIVE' | 'DAMAGED_IN_TRANSIT' | 'NOT_AS_DESCRIBED' | 'WRONG_ITEM_SENT' | 'WRONG_SIZE' | 'CHANGED_MIND';
export type ReturnStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IN_TRANSIT' | 'RECEIVED' | 'INSPECTING' | 'INSPECTED_PASS' | 'INSPECTED_FAIL' | 'RETURNED_TO_CUSTOMER' | 'REFUNDED' | 'CLOSED' | 'CANCELLED';

export interface CreateReturnPayload {
  orderId: string;
  guestEmail?: string;
  guestPhone?: string;
  reason: ReturnReason;
  description?: string;
  photos: string[];
  items: { orderItemId: string; quantity: number }[];
}

export async function createReturn(payload: CreateReturnPayload) {
  return apiFetch<{ id: string; rtnNumber: string }>('/returns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getMyReturns() {
  return apiFetch<Return[]>('/returns/me');
}

export async function getReturnByRtn(rtnNumber: string, opts?: { email?: string; phone?: string }) {
  const q = new URLSearchParams();
  if (opts?.email) q.set('email', opts.email);
  if (opts?.phone) q.set('phone', opts.phone);
  return apiFetch<Return>(`/returns/${rtnNumber}?${q.toString()}`);
}

export async function cancelReturn(rtnNumber: string, opts?: { email?: string; phone?: string }) {
  return apiFetch(`/returns/${rtnNumber}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ email: opts?.email, phone: opts?.phone }),
  });
}
```

- [ ] **Step 12.2: Replace `/returns` page (info + CTA)**

The existing page is static policy info — keep that content but add a hero CTA: "Start a Return" (`/returns/new`) and "Track a Return" (`/returns/lookup` form: RTN # + email/phone). Also link to FAQ items.

- [ ] **Step 12.3: Create `/returns/new` submission form**

Two flows on this page:

**Flow A — Logged in:** auto-load eligible orders (DELIVERED + within window) via `getMyOrders()`. Customer picks an order, picks items + qty, picks reason from dropdown, writes optional description, uploads photos (R2 presigned upload from existing uploads module), submits.

**Flow B — Guest:** Enter Order # + email + phone, then GET `/orders/lookup-guest` (existing endpoint). On success, render the same item/reason/photos form.

Client-side validation:
- Photos required when reason is DEFECTIVE / DAMAGED_IN_TRANSIT / NOT_AS_DESCRIBED / WRONG_ITEM_SENT
- At least 1 item selected with qty >= 1
- File type/size enforced on photo upload (JPEG/PNG/WebP, 10MB max, 5 files max)

On submit success → redirect to `/returns/[rtnNumber]` with a flash banner showing T&Cs and "Under review, contact within 48h."

- [ ] **Step 12.4: Create `/returns/[rtnNumber]` tracking page**

Server component reading `params.rtnNumber`. If logged in, fetch with auth. If not, render guest lookup form (RTN already in URL, ask for email or phone), then fetch.

Show:
- Status timeline (REQUESTED → … → CLOSED) with completed steps highlighted
- Reason, fault, items (with images), photos
- Refund details once issued
- "Cancel Request" button if status is `REQUESTED`

- [ ] **Step 12.5: Create `/account/returns` history list**

Server component (auth-gated). Lists all returns for logged-in user, each row linking to `/returns/[rtnNumber]`. Status chip, requested date, items count, refund amount.

Add link from `/account` dashboard sidebar.

- [ ] **Step 12.6: Commit**

```
git commit -m "feat(web): customer returns submission + tracking + history"
```

---

### Task 13: Documentation + runbook

**Files:**
- Create: `docs/RETURNS.md`

- [ ] **Step 13.1: Write operator runbook**

Sections:
1. Customer-facing policy (eligibility, window, photos, refund methods, who pays shipping by reason)
2. Admin workflow — for each state, what to do and click
3. Manual return entry — when to use, what to fill
4. Refund procedure (cash vs bank transfer) — including how to record the bank txn reference
5. State machine diagram (ASCII)
6. Email template list
7. Troubleshooting (SLA-overdue, stuck inspections, override-refund scenarios)

- [ ] **Step 13.2: Commit**

```
git commit -m "docs: returns system runbook and policy"
```

---

### Task 14: End-to-end smoke test

**Files:**
- Create: `apps/api/test/returns.e2e-spec.ts`

- [ ] **Step 14.1: Write the full happy-path E2E test**

Set up a test order in DELIVERED status with a recent statusHistory entry. Then:
1. POST `/returns` with valid payload → assert 201 + rtnNumber
2. PATCH `/admin/returns/:id/review` → assert UNDER_REVIEW
3. PATCH `/admin/returns/:id/approve` → assert APPROVED
4. PATCH `/admin/returns/:id/mark-received` → assert RECEIVED
5. PATCH `/admin/returns/:id/start-inspection` → assert INSPECTING
6. PATCH `/admin/returns/:id/inspect` with PASS + restock → assert INSPECTED_PASS
7. Read variant stock before vs after → assert incremented
8. POST `/admin/returns/:id/issue-refund` → assert REFUNDED + RefundTransaction exists

Run: `pnpm -F api test:e2e returns.e2e-spec`. Expected: pass.

- [ ] **Step 14.2: Commit**

```
git commit -m "test(returns): end-to-end happy path"
```

---

## Self-Review

**Spec coverage check:**

| Spec item | Task |
|---|---|
| 7-day delivery window | T2 (eligibility), T3 (service) |
| Per-item + whole-order | T3 (items[] in DTO) |
| 6 reasons | T2 (state-machine), T3 (DTO) |
| Fault mapping (4 US / 2 Customer) | T2 (REASON_FAULT) |
| Photos required for fault reasons | T2 (PHOTOS_REQUIRED_REASONS), T3 (validation), T12 (UI) |
| Cash / bank refund | T1 (enum), T5 (service) |
| Customer-ships-back / we-pickup by fault | T3 (customerShipsBack derived) |
| Refund on INSPECTED_PASS only | T5 (validFromState check) |
| Inspection fail → ship back OR override refund | T4 (returnToCustomer route), T5 (overrideFromFail) |
| Bundle refund math | T5 (computeBundleItemRefund) |
| No original shipping refund | T5 (refund amount is admin-entered, not auto-computed; UI doesn't include shipping) |
| No restocking fee | T5 (no fee deduction logic) |
| 48h SLA + red flag | T3 (slaDeadline), T4 (slaOverdue filter), T9 (red row) |
| Multiple returns per order | T1 (no unique constraint on orderId), T3 (alreadyReturned check by quantity) |
| Manual admin entry | T6 (full slice) |
| Dashboard metrics | T8 (service), T11 (UI) |
| Admin-only permissions | T4 (RolesGuard on admin controller) |
| Email v1 | T7 (5 templates + listener) |
| RTN-YYYY-NNNNNN ID | T2 (RtnIdService), T3 (retry-on-collision) |

All spec items covered. Plan ready.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-20-returns-system.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?