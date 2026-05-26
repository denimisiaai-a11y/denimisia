# Shadow Customer Records — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Use `superpowers:test-driven-development` discipline within each task.

**Goal:** Let admin create customer records directly (no password, no email sent), import customers in bulk via CSV, and automatically match/create customer records from guest checkouts — so the customer DB grows with every order and imported customers can self-claim by signing up.

**Architecture:** Schema-level: User.passwordHash becomes nullable; User.claimedAt tracks "real vs. shadow"; User.phone (singular) becomes phones (array). API-level: refactor POST /users (no password/email), add POST /users/bulk (CSV upload, two-pass), modify auth to handle shadow accounts, modify OrdersService to match-or-create on guest checkout. UI-level: refresh Add Customer modal, add Import CSV modal, surface phone history on account page, autofill phones[0] at checkout.

**Tech Stack:** Prisma + PostgreSQL (Supabase), NestJS API (apps/api), Next.js 15 admin (apps/admin), Next.js 15 storefront (apps/web), Jest for API tests, manual browser testing for frontend.

**Spec:** [`docs/superpowers/specs/2026-05-26-shadow-customer-records-design.md`](../specs/2026-05-26-shadow-customer-records-design.md)

---

## File Structure

### New files
- `packages/database/prisma/migrations/<timestamp>_shadow_customers_and_phones/migration.sql` — schema migration
- `apps/api/src/common/phone.util.ts` — phone normalize + validate utility
- `apps/api/src/common/phone.util.spec.ts` — phone utility tests
- `apps/api/src/modules/users/bulk-import.parser.ts` — CSV parser + within-file dedupe
- `apps/api/src/modules/users/bulk-import.parser.spec.ts` — parser tests
- `apps/admin/components/customers/import-csv-modal.tsx` — Import CSV modal component
- `apps/web/components/account/phone-history.tsx` — phone-list display component

### Modified files
- `packages/database/prisma/schema.prisma` — User model (phones array, claimedAt, createdBy)
- `apps/api/src/modules/users/users.dto.ts` — refactor CreateCustomerByAdminDto, add BulkImportResultDto
- `apps/api/src/modules/users/users.service.ts` — refactor createCustomerAsAdmin, add bulkImport, helpers
- `apps/api/src/modules/users/users.service.spec.ts` — update for new shape
- `apps/api/src/modules/users/users.controller.ts` — refactor POST /users, add POST /users/bulk
- `apps/api/src/modules/users/users.module.ts` — already imports EmailModule (drop now-unused?), add MulterModule for upload
- `apps/api/src/modules/auth/auth.service.ts` — shadow-aware login + forgot-password + auto-claim register
- `apps/api/src/modules/auth/auth.service.spec.ts` — update for new behavior
- `apps/api/src/modules/orders/orders.service.ts` — guest checkout match-or-create
- `apps/api/src/modules/orders/orders.service.spec.ts` — update for new behavior
- `apps/api/src/modules/orders/orders.service.ts` (existing tests touched)
- All consumers of `user.phone`: `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/orders/orders.service.ts`, `apps/admin/app/(dashboard)/orders/page.tsx`, `apps/admin/app/(dashboard)/customers/page.tsx`, `apps/web/app/account/...`, `apps/web/app/checkout/...`
- `apps/admin/app/(dashboard)/customers/page.tsx` — Add Customer modal copy + Import CSV button + use new modal
- `apps/web/app/account/page.tsx` (or profile page) — phone history display + edit
- `apps/web/app/checkout/...` — autofill phones[0]

### Out of scope (deferred per spec §13)
- Order history import (separate spec)
- Manual customer merge tool
- International phone normalization
- Phone history management UI (rename, set primary)

---

## Pre-flight: Create feature branch

- [ ] **Step 0.1: Create branch from main**

```bash
cd /c/Users/joycg/denimisia
git checkout main && git pull
git checkout -b feat/shadow-customer-records
```

This plan ships as a single PR per the spec's "Approach B" decision. The branch isolates work-in-progress commits from main while implementation is underway.

---

## Task 1: Prisma schema + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (User model)
- Create: `packages/database/prisma/migrations/<timestamp>_shadow_customers_and_phones/migration.sql`

- [ ] **Step 1.1: Edit schema.prisma — change User model**

Open `packages/database/prisma/schema.prisma`. Find the `model User` block (around line 136). Make these exact changes:

```prisma
model User {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String?               // CHANGED: was required
  firstName    String
  lastName     String
  phones       String[]  @default([]) // CHANGED: was `phone String?`
  role         Role      @default(CUSTOMER)
  isVerified   Boolean   @default(false)
  isActive     Boolean   @default(true)
  tokenVersion Int       @default(0)
  claimedAt    DateTime?              // NEW: null = shadow, set = real user
  createdBy    String?                // NEW: admin user.id (null = auto from guest checkout)
  fitProfile   Json?
  // ... rest of relations unchanged ...
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  deletedAt    DateTime?
  // ... existing @@index lines + ADD the following:
  @@index([phones])
}
```

The `phone String?` line is REMOVED. `phones String[]` replaces it. `claimedAt` and `createdBy` are NEW. The `@@index([phones])` enables fast `WHERE 'X' = ANY(phones)` lookups via Postgres GIN.

- [ ] **Step 1.2: Generate migration**

Run:
```bash
pnpm --filter database exec prisma migrate dev --name shadow_customers_and_phones --create-only
```

This creates a migration folder under `packages/database/prisma/migrations/` with the SQL. Prisma will infer most of it but the index will be a B-tree default — we need GIN. Open the generated `migration.sql` and replace its contents with:

- [ ] **Step 1.3: Write the migration SQL**

```sql
-- 1. Add new nullable columns
ALTER TABLE "User" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "User" ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2. Backfill: existing users with passwordHash are "claimed" (self-registered)
UPDATE "User"
  SET "claimedAt" = "createdAt"
  WHERE "claimedAt" IS NULL AND "passwordHash" IS NOT NULL;

-- 3. Backfill: copy phone -> phones[]
UPDATE "User"
  SET "phones" = ARRAY["phone"]
  WHERE "phone" IS NOT NULL AND cardinality("phones") = 0;

-- 4. Relax passwordHash, drop old phone column
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" DROP COLUMN "phone";

-- 5. GIN index for phone-array lookups
CREATE INDEX "User_phones_gin_idx" ON "User" USING GIN ("phones");
```

- [ ] **Step 1.4: Apply migration locally**

```bash
pnpm --filter database exec prisma migrate dev
pnpm --filter database exec prisma generate
```

Expected: migration applies cleanly, Prisma Client regenerates. No errors.

- [ ] **Step 1.5: Verify backfill manually**

```bash
pnpm --filter database exec prisma studio
```

Open the User table. Confirm:
- `phones` column exists and contains the prior `phone` value for any user that had one
- `claimedAt` is populated for all existing users (they're real registered users)
- `passwordHash` accepts null but existing values are preserved
- `phone` column is gone

Close Prisma Studio.

- [ ] **Step 1.6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): shadow customer records + multi-phone schema

- passwordHash nullable (null = shadow account, no login)
- claimedAt timestamp (null = shadow, set = real user)
- createdBy admin user.id (null = auto-created from guest checkout)
- phone (singular) replaced by phones (array, newest-first)
- GIN index on phones for fast ANY-element matching

Backfill: existing users get claimedAt=createdAt and phones=[phone]."
```

---

## Task 2: Phone normalize + validate utility

**Files:**
- Create: `apps/api/src/common/phone.util.ts`
- Create: `apps/api/src/common/phone.util.spec.ts`

- [ ] **Step 2.1: Write the failing tests first**

Create `apps/api/src/common/phone.util.spec.ts`:

```ts
import { normalizePhone, isValidBdPhone, normalizeAndValidate } from './phone.util';

describe('normalizePhone', () => {
  it('strips spaces and dashes', () => {
    expect(normalizePhone('01776-902-711')).toBe('01776902711');
    expect(normalizePhone('01776 902 711')).toBe('01776902711');
  });

  it('strips leading +880 country code when present', () => {
    expect(normalizePhone('+880 1776 902711')).toBe('01776902711');
    expect(normalizePhone('+8801776902711')).toBe('01776902711');
  });

  it('preserves a leading 0', () => {
    expect(normalizePhone('01776902711')).toBe('01776902711');
  });

  it('returns empty string for null / undefined / empty input', () => {
    expect(normalizePhone('')).toBe('');
    expect(normalizePhone(null as unknown as string)).toBe('');
    expect(normalizePhone(undefined as unknown as string)).toBe('');
  });

  it('strips all non-digit characters', () => {
    expect(normalizePhone('abc01776x902y711')).toBe('01776902711');
  });
});

describe('isValidBdPhone', () => {
  it('accepts 10-digit phone', () => {
    expect(isValidBdPhone('1776902711')).toBe(true);
  });

  it('accepts 11-digit phone (with leading 0)', () => {
    expect(isValidBdPhone('01776902711')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(isValidBdPhone('')).toBe(false);
  });

  it('rejects 9-digit phone (too short)', () => {
    expect(isValidBdPhone('177690271')).toBe(false);
  });

  it('rejects 12-digit phone (too long)', () => {
    expect(isValidBdPhone('017769027110')).toBe(false);
  });

  it('rejects phone with non-digit characters', () => {
    expect(isValidBdPhone('0177abc')).toBe(false);
  });
});

describe('normalizeAndValidate', () => {
  it('returns normalized phone when valid', () => {
    expect(normalizeAndValidate('+880 1776-902-711')).toEqual({
      ok: true,
      phone: '01776902711',
    });
  });

  it('returns error when invalid after normalize', () => {
    expect(normalizeAndValidate('abc')).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });

  it('returns error for too-short phone', () => {
    expect(normalizeAndValidate('123')).toEqual({
      ok: false,
      reason: 'invalid_length',
    });
  });
});
```

- [ ] **Step 2.2: Run tests, expect them to fail**

```bash
cd apps/api && pnpm test src/common/phone.util.spec.ts
```

Expected: tests fail because `phone.util.ts` doesn't exist yet.

- [ ] **Step 2.3: Implement the utility**

Create `apps/api/src/common/phone.util.ts`:

```ts
/**
 * Phone utilities — BD-strict normalization and validation.
 *
 * normalizePhone: strips non-digit characters and optional leading "+880"
 *   country code. Returns the local-form digit string.
 *
 * isValidBdPhone: accepts 10-11 digit strings of pure digits. Caller is
 *   expected to have normalized first.
 *
 * normalizeAndValidate: convenience wrapper returning a discriminated
 *   union { ok: true, phone } | { ok: false, reason }.
 */

export function normalizePhone(input: string | null | undefined): string {
  if (!input) return '';
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length > 11) {
    return digits.slice(3);
  }
  return digits;
}

export function isValidBdPhone(normalized: string): boolean {
  if (!/^\d+$/.test(normalized)) return false;
  const len = normalized.length;
  return len >= 10 && len <= 11;
}

export type NormalizeResult =
  | { ok: true; phone: string }
  | { ok: false; reason: 'invalid_length' | 'invalid_chars' };

export function normalizeAndValidate(input: string | null | undefined): NormalizeResult {
  const normalized = normalizePhone(input);
  if (!isValidBdPhone(normalized)) {
    return { ok: false, reason: 'invalid_length' };
  }
  return { ok: true, phone: normalized };
}
```

- [ ] **Step 2.4: Run tests, expect them to pass**

```bash
cd apps/api && pnpm test src/common/phone.util.spec.ts
```

Expected: all 14 tests pass.

- [ ] **Step 2.5: Commit**

```bash
git add apps/api/src/common/phone.util.ts apps/api/src/common/phone.util.spec.ts
git commit -m "feat(api): BD-strict phone normalize + validate utility

- normalizePhone: strips non-digits + optional leading +880
- isValidBdPhone: 10-11 digit pure-digit check
- normalizeAndValidate: convenience wrapper for callers"
```

---

## Task 3: Phone array helpers (prepend, dedup, cap)

**Files:**
- Modify: `apps/api/src/common/phone.util.ts` (add helpers)
- Modify: `apps/api/src/common/phone.util.spec.ts` (add tests)

- [ ] **Step 3.1: Write failing tests for prepend/dedup/cap**

Append to `apps/api/src/common/phone.util.spec.ts`:

```ts
import { prependPhoneToArray } from './phone.util';

describe('prependPhoneToArray', () => {
  it('prepends a new phone to empty array', () => {
    expect(prependPhoneToArray([], '01776902711')).toEqual(['01776902711']);
  });

  it('prepends new phone to front, keeps existing', () => {
    expect(prependPhoneToArray(['01700000000'], '01776902711'))
      .toEqual(['01776902711', '01700000000']);
  });

  it('moves duplicate to front without growing array', () => {
    expect(prependPhoneToArray(['01700000000', '01776902711'], '01776902711'))
      .toEqual(['01776902711', '01700000000']);
  });

  it('caps array at 20 entries when prepending new phone', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => String(i).padStart(11, '0'));
    const result = prependPhoneToArray(twenty, '01776902711');
    expect(result.length).toBe(20);
    expect(result[0]).toBe('01776902711');
    // The 20th original phone (index 19) should have been dropped
    expect(result).not.toContain(twenty[19]);
  });

  it('does not grow when prepending a duplicate even at cap', () => {
    const twenty = Array.from({ length: 20 }, (_, i) => String(i).padStart(11, '0'));
    const result = prependPhoneToArray(twenty, twenty[10]);
    expect(result.length).toBe(20);
    expect(result[0]).toBe(twenty[10]);
  });

  it('returns existing array unchanged when input phone is empty', () => {
    const existing = ['01776902711'];
    expect(prependPhoneToArray(existing, '')).toEqual(existing);
  });
});
```

- [ ] **Step 3.2: Run tests, expect them to fail**

```bash
cd apps/api && pnpm test src/common/phone.util.spec.ts
```

Expected: 6 new tests fail with "prependPhoneToArray is not defined".

- [ ] **Step 3.3: Implement prependPhoneToArray**

Append to `apps/api/src/common/phone.util.ts`:

```ts
const PHONE_CAP = 20;

/**
 * Prepend `phone` to the front of `existing`, de-duplicating and capping
 * the array at PHONE_CAP entries. Returns a new array (immutable input).
 *
 * - If phone is empty/falsy, returns existing unchanged.
 * - If phone is already at any position, moves it to position 0 (no growth).
 * - If new and array is full (length == PHONE_CAP), drops the oldest
 *   (last) entry.
 */
export function prependPhoneToArray(
  existing: readonly string[],
  phone: string,
): string[] {
  if (!phone) return [...existing];

  const dedupedTail = existing.filter((p) => p !== phone);
  const result = [phone, ...dedupedTail];
  if (result.length > PHONE_CAP) {
    return result.slice(0, PHONE_CAP);
  }
  return result;
}
```

- [ ] **Step 3.4: Run tests, expect them to pass**

```bash
cd apps/api && pnpm test src/common/phone.util.spec.ts
```

Expected: all 20 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add apps/api/src/common/phone.util.ts apps/api/src/common/phone.util.spec.ts
git commit -m "feat(api): prependPhoneToArray helper

Dedup-prepends a phone into the array, caps at 20 entries, drops
oldest on overflow. Used by checkout, register-claim, and guest-match
flows to maintain phone history without unbounded growth."
```

---

## Task 4: Refactor POST /users — drop password/email path, support claim-aware fill-blanks

**Files:**
- Modify: `apps/api/src/modules/users/users.dto.ts` (no schema change needed but reread for context)
- Modify: `apps/api/src/modules/users/users.service.ts` (refactor createCustomerAsAdmin)
- Modify: `apps/api/src/modules/users/users.controller.ts` (pass adminId)
- Modify: `apps/api/src/modules/users/users.service.spec.ts`
- Modify: `apps/api/src/modules/users/users.module.ts` (drop EmailModule import if no longer used)

- [ ] **Step 4.1: Write failing tests for refactored createCustomerAsAdmin**

Open `apps/api/src/modules/users/users.service.spec.ts`. Add a new describe block:

```ts
describe('createCustomerAsAdmin (refactored — no password, no email)', () => {
  const adminId = 'admin-1';

  it('creates a shadow user with null passwordHash and createdBy=adminId', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'new-1',
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'User',
      phones: ['01776902711'],
      role: 'CUSTOMER',
      isActive: true,
      isVerified: true,
      claimedAt: null,
      createdBy: adminId,
      createdAt: new Date(),
    });

    const result = await service.createCustomerAsAdmin(
      {
        email: 'NEW@example.com',
        firstName: 'New',
        lastName: 'User',
        phone: '+880 1776-902-711',
      },
      adminId,
    );

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.com',                  // lowercased
          phones: ['01776902711'],                   // normalized
          passwordHash: null,
          claimedAt: null,
          createdBy: adminId,
          isVerified: true,
        }),
      }),
    );
    expect(result.id).toBe('new-1');
  });

  it('returns 409 when email matches a CLAIMED user', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'existing-1',
      email: 'taken@example.com',
      claimedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.createCustomerAsAdmin(
        { email: 'taken@example.com', firstName: 'X' },
        adminId,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('fills blanks on existing SHADOW user without overwriting non-empty fields', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'shadow-1',
      email: 'shadow@example.com',
      firstName: 'Existing',
      lastName: '',
      phones: ['01700000000'],
      claimedAt: null,
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValue({
      id: 'shadow-1',
      email: 'shadow@example.com',
      firstName: 'Existing',           // preserved (non-empty)
      lastName: 'Filled',              // filled from request (was empty)
      phones: ['01776902711', '01700000000'], // dedup-prepended
      claimedAt: null,
      createdBy: 'old-admin',
    });

    await service.createCustomerAsAdmin(
      {
        email: 'shadow@example.com',
        firstName: 'New',              // ignored (existing is non-empty)
        lastName: 'Filled',
        phone: '01776902711',
      },
      adminId,
    );

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'shadow-1' },
      data: expect.objectContaining({
        lastName: 'Filled',
        phones: ['01776902711', '01700000000'],
      }),
    });
    // firstName NOT in the update payload (existing was non-empty)
    const updateArg = (prisma.user.update.mock.calls[0]?.[0] ?? {}) as {
      data: Record<string, unknown>;
    };
    expect(updateArg.data.firstName).toBeUndefined();
  });

  it('rejects invalid phone format', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.createCustomerAsAdmin(
        { email: 'a@b.com', firstName: 'A', phone: 'not-a-phone' },
        adminId,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
```

Also update the import at the top of the file to include `BadRequestException`:

```ts
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
```

- [ ] **Step 4.2: Run tests, expect them to fail**

```bash
cd apps/api && pnpm test src/modules/users/users.service.spec.ts -- -t "createCustomerAsAdmin"
```

Expected: 4 tests fail (current implementation doesn't accept adminId, doesn't return on conflict, doesn't fill-blanks).

- [ ] **Step 4.3: Refactor `createCustomerAsAdmin` in users.service.ts**

Open `apps/api/src/modules/users/users.service.ts`. Replace the entire `createCustomerAsAdmin` method (and remove the EmailService injection, since we're no longer sending emails from this path) with:

```ts
import { normalizeAndValidate, prependPhoneToArray } from '../../common/phone.util';
import { BadRequestException } from '@nestjs/common';

// ... in the service class:

/**
 * Admin-only customer creation.
 *
 * Three cases:
 *   1. Email is new → create a shadow record (no password, no email sent).
 *   2. Email belongs to a CLAIMED user → 409 Conflict.
 *   3. Email belongs to an existing SHADOW → fill-blanks update (no
 *      overwrite of non-empty fields). Phone array is dedup-prepended.
 *
 * The caller's admin id (`adminUserId`) is captured as `createdBy` on
 * new shadows. For fill-blanks updates we do not change createdBy.
 */
async createCustomerAsAdmin(
  dto: CreateCustomerByAdminDto,
  adminUserId: string,
) {
  const email = dto.email.trim().toLowerCase();

  let normalizedPhone = '';
  if (dto.phone && dto.phone.trim()) {
    const phoneResult = normalizeAndValidate(dto.phone);
    if (!phoneResult.ok) {
      throw new BadRequestException(
        'Phone must be a valid Bangladesh number (10-11 digits)',
      );
    }
    normalizedPhone = phoneResult.phone;
  }

  const existing = await this.prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: true,
      claimedAt: true,
      deletedAt: true,
    },
  });

  if (existing) {
    if (existing.deletedAt !== null) {
      throw new ConflictException('A user with this email previously existed and was deactivated');
    }
    if (existing.claimedAt !== null) {
      throw new ConflictException('A user with this email already exists');
    }
    // Existing SHADOW: fill-blanks update.
    const updates: Record<string, unknown> = {};
    if (!existing.firstName && dto.firstName) updates.firstName = dto.firstName;
    if (!existing.lastName && dto.lastName) updates.lastName = dto.lastName;
    if (normalizedPhone) {
      const newPhones = prependPhoneToArray(existing.phones, normalizedPhone);
      if (newPhones.length !== existing.phones.length ||
          newPhones[0] !== existing.phones[0]) {
        updates.phones = newPhones;
      }
    }
    if (Object.keys(updates).length === 0) {
      return existing;  // Nothing to update — return existing record as-is.
    }
    return this.prisma.user.update({
      where: { id: existing.id },
      data: updates,
      select: this.publicUserSelect(),
    });
  }

  // No existing user: create new shadow.
  return this.prisma.user.create({
    data: {
      email,
      firstName: dto.firstName,
      lastName: dto.lastName ?? '',
      phones: normalizedPhone ? [normalizedPhone] : [],
      passwordHash: null,
      role: Role.CUSTOMER,
      isVerified: true,
      claimedAt: null,
      createdBy: adminUserId,
    },
    select: this.publicUserSelect(),
  });
}

private publicUserSelect() {
  return {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phones: true,
    role: true,
    isActive: true,
    isVerified: true,
    claimedAt: true,
    createdBy: true,
    createdAt: true,
  };
}
```

Also REMOVE the EmailService injection from the constructor since this method no longer sends email:

```ts
constructor(
  private prisma: PrismaService,
  @InjectRedis() private redis: Redis,
  // private readonly email: EmailService,  ← DROP THIS LINE
) {}
```

And remove the now-unused imports at the top:
- `import { EmailService } from '../email/email.service';` — DROP
- `import { buildPasswordResetEmail } from '../email/email-templates';` — DROP
- `import { env } from '../../common/env';` — DROP if no longer used
- `import * as bcrypt from 'bcrypt';` — DROP (no password creation here)
- `import { randomBytes } from 'crypto';` — DROP

Keep: `import { Prisma, Role } from '@prisma/client';`, `Logger`, `ConflictException`.

- [ ] **Step 4.4: Update users.module.ts to drop EmailModule**

Open `apps/api/src/modules/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 4.5: Update users.controller.ts to pass adminId**

Open `apps/api/src/modules/users/users.controller.ts`. Find the `createCustomer` method and change it to:

```ts
@Post()
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
createCustomer(
  @Body() dto: CreateCustomerByAdminDto,
  @CurrentUser() admin: { id: string },
) {
  return this.usersService.createCustomerAsAdmin(dto, admin.id);
}
```

- [ ] **Step 4.6: Update users.service.spec.ts test-module providers**

Find the `Test.createTestingModule` block in the spec. Remove the EmailService provider (we no longer inject it):

```ts
const module: TestingModule = await Test.createTestingModule({
  providers: [
    UsersService,
    { provide: PrismaService, useValue: prisma },
    { provide: REDIS_CLIENT, useValue: redis },
    // Drop EmailService mock - service no longer needs it
  ],
}).compile();
```

Also remove the `import { EmailService } from '../email/email.service';` at the top.

Update the `prisma` mock setup to include `phones` and `claimedAt` fields:

```ts
prisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  // ... rest unchanged ...
};
```

And update the `mockUser` constant to use `phones`:

```ts
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  phones: [],
  role: 'CUSTOMER',
  isVerified: true,
  claimedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
};
```

Also fix the `getProfile` test (the one I patched earlier) — replace its expected select to include `phones`, `claimedAt`:

```ts
expect(prisma.user.findFirst).toHaveBeenCalledWith({
  where: { id: 'user-1', deletedAt: null },
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phones: true,
    role: true,
    isVerified: true,
    claimedAt: true,
    createdAt: true,
  },
});
```

- [ ] **Step 4.7: Update users.service.ts getProfile to return phones + claimedAt**

In `users.service.ts`, find `getProfile`:

```ts
async getProfile(userId: string) {
  const user = await this.prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: true,         // CHANGED from phone
      role: true,
      isVerified: true,
      claimedAt: true,      // NEW
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundException('User not found');
  return user;
}
```

Same change for `updateProfile`, `getAllUsers`, `getUserById` (anywhere `phone` is selected, replace with `phones`).

- [ ] **Step 4.8: Run all users tests, expect them to pass**

```bash
cd apps/api && pnpm test src/modules/users
```

Expected: all tests pass (including the 4 new createCustomerAsAdmin tests).

- [ ] **Step 4.9: Commit**

```bash
git add apps/api/src/modules/users/ apps/api/src/common/phone.util.ts
git commit -m "fix(api): refactor POST /users to shadow-record semantics

- No password generation, no email sent (was previous behavior).
- Email conflict on CLAIMED user → 409.
- Existing SHADOW match → fill-blanks update (preserves non-empty fields).
- New phone is dedup-prepended to phones[] array (capped at 20).
- createdBy now captures the authenticated admin's id.
- Drop EmailService from UsersService dependencies (no longer used)."
```

---

## Task 5: CSV bulk-import parser

**Files:**
- Create: `apps/api/src/modules/users/bulk-import.parser.ts`
- Create: `apps/api/src/modules/users/bulk-import.parser.spec.ts`

- [ ] **Step 5.1: Add csv-parse dependency**

```bash
cd apps/api && pnpm add csv-parse
```

Expected: `csv-parse` appears in `apps/api/package.json` dependencies.

- [ ] **Step 5.2: Write failing parser tests**

Create `apps/api/src/modules/users/bulk-import.parser.spec.ts`:

```ts
import { parseAndDedupeCsv, type ParsedRow } from './bulk-import.parser';

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf-8');
}

describe('parseAndDedupeCsv', () => {
  it('parses a basic CSV with header row', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01776902711
grace@example.com,Grace,Hopper,`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(2);
    expect(result.errors).toEqual([]);
    expect(result.rows.get('ada@example.com')).toMatchObject({
      email: 'ada@example.com',
      firstName: 'Ada',
      lastName: 'Lovelace',
      phone: '01776902711',
    });
    expect(result.rows.get('grace@example.com')).toMatchObject({
      email: 'grace@example.com',
      firstName: 'Grace',
      lastName: 'Hopper',
      phone: '',
    });
  });

  it('lowercases emails in the map key', async () => {
    const csv = `email,firstName,lastName,phone
ADA@EXAMPLE.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.get('ada@example.com')).toBeDefined();
    expect(result.rows.size).toBe(1);
  });

  it('first row wins on duplicate email; later rows fill blanks only', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,,01776902711
ada@example.com,IGNORE,Lovelace,02000000000`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    const ada = result.rows.get('ada@example.com');
    expect(ada).toMatchObject({
      firstName: 'Ada',           // first wins
      lastName: 'Lovelace',       // second filled blank
      phone: '01776902711',       // first wins
    });
    expect(result.duplicates).toEqual([{ row: 3, email: 'ada@example.com' }]);
  });

  it('reports invalid email as error and skips row', async () => {
    const csv = `email,firstName,lastName,phone
not-an-email,X,Y,
ada@example.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('Invalid email') },
    ]);
  });

  it('reports missing firstName as error', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,,Lovelace,`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('firstName') },
    ]);
  });

  it('reports invalid phone as error and skips row', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,abc123`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(0);
    expect(result.errors).toEqual([
      { row: 2, reason: expect.stringContaining('phone') },
    ]);
  });

  it('handles BOM-prefixed UTF-8 CSV', async () => {
    const csv = '﻿' + `email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01776902711`;
    const result = await parseAndDedupeCsv(csvBuffer(csv));
    expect(result.rows.size).toBe(1);
    expect(result.errors).toEqual([]);
  });

  it('rejects file with no header row', async () => {
    const csv = `not,a,real,header
ada@example.com,Ada,Lovelace,01776902711`;
    await expect(parseAndDedupeCsv(csvBuffer(csv))).rejects.toThrow(
      /Missing required column/,
    );
  });

  it('rejects file exceeding 20 MB', async () => {
    const big = Buffer.alloc(20 * 1024 * 1024 + 1);
    await expect(parseAndDedupeCsv(big)).rejects.toThrow(/File too large/);
  });
});
```

- [ ] **Step 5.3: Run tests, expect them to fail**

```bash
cd apps/api && pnpm test src/modules/users/bulk-import.parser.spec.ts
```

Expected: tests fail because parser file doesn't exist.

- [ ] **Step 5.4: Implement the parser**

Create `apps/api/src/modules/users/bulk-import.parser.ts`:

```ts
import { parse } from 'csv-parse';
import { normalizeAndValidate } from '../../common/phone.util';

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB
const REQUIRED_COLUMNS = ['email', 'firstName'] as const;
const ALL_COLUMNS = ['email', 'firstName', 'lastName', 'phone'] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface ParsedRow {
  email: string;       // lowercased + trimmed
  firstName: string;
  lastName: string;
  phone: string;       // normalized; '' if not provided
}

export interface ParseError {
  row: number;         // 1-based, header is row 1
  reason: string;
}

export interface ParseDuplicate {
  row: number;
  email: string;
}

export interface ParseResult {
  rows: Map<string, ParsedRow>;     // keyed by lowercased email
  errors: ParseError[];
  duplicates: ParseDuplicate[];
}

/**
 * Two-pass CSV ingestion:
 *  - Pass 1: parse entire file in memory, apply first-row-wins fill-blanks
 *    merging within the file, accumulate per-row errors.
 *  - Caller is responsible for the per-row DB insert (Pass 2).
 *
 * File-size hard cap: 20 MB. Rejects unparseable / missing-header files.
 */
export async function parseAndDedupeCsv(buffer: Buffer): Promise<ParseResult> {
  if (buffer.length > MAX_FILE_BYTES) {
    throw new Error(`File too large (max 20 MB, got ${buffer.length} bytes)`);
  }

  return new Promise((resolve, reject) => {
    const rows = new Map<string, ParsedRow>();
    const errors: ParseError[] = [];
    const duplicates: ParseDuplicate[] = [];
    let lineNum = 1; // header is row 1; data starts at row 2

    const parser = parse({
      columns: (header: string[]) => {
        // Strip BOM from first header if present
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
      const email = (record.email ?? '').trim().toLowerCase();
      const firstName = (record.firstName ?? '').trim();
      const lastName = (record.lastName ?? '').trim();
      const rawPhone = (record.phone ?? '').trim();

      if (!email || !EMAIL_RE.test(email)) {
        errors.push({ row: lineNum, reason: `Invalid email: "${email}"` });
        return;
      }
      if (!firstName) {
        errors.push({ row: lineNum, reason: 'Missing firstName' });
        return;
      }

      let phone = '';
      if (rawPhone) {
        const phoneResult = normalizeAndValidate(rawPhone);
        if (!phoneResult.ok) {
          errors.push({
            row: lineNum,
            reason: `Invalid phone: "${rawPhone}" (must be 10-11 digit BD number)`,
          });
          return;
        }
        phone = phoneResult.phone;
      }

      const existing = rows.get(email);
      if (existing) {
        duplicates.push({ row: lineNum, email });
        // First-row-wins fill-blanks: only fill blanks on the existing record.
        if (!existing.firstName && firstName) existing.firstName = firstName;
        if (!existing.lastName && lastName) existing.lastName = lastName;
        if (!existing.phone && phone) existing.phone = phone;
        return;
      }

      rows.set(email, { email, firstName, lastName, phone });
    });

    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve({ rows, errors, duplicates }));

    parser.write(buffer);
    parser.end();
  });
}
```

- [ ] **Step 5.5: Run tests, expect them to pass**

```bash
cd apps/api && pnpm test src/modules/users/bulk-import.parser.spec.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5.6: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/modules/users/bulk-import.parser.ts apps/api/src/modules/users/bulk-import.parser.spec.ts
git commit -m "feat(api): CSV bulk-import parser with two-pass dedupe

- Parses CSV with required email, firstName columns + optional lastName, phone
- Normalizes + lowercases emails (map key)
- First-row-wins fill-blanks merging on duplicates within the file
- Validates phone via BD-strict normalize+validate
- Caps file size at 20 MB
- Handles UTF-8 BOM"
```

---

## Task 6: POST /users/bulk endpoint

**Files:**
- Modify: `apps/api/src/modules/users/users.controller.ts` (add Post('bulk') handler)
- Modify: `apps/api/src/modules/users/users.service.ts` (add bulkImport method)
- Modify: `apps/api/src/modules/users/users.service.spec.ts` (test bulkImport)

- [ ] **Step 6.1: Write failing service test for bulkImport**

Append to `apps/api/src/modules/users/users.service.spec.ts`:

```ts
describe('bulkImport', () => {
  const adminId = 'admin-1';

  it('creates new users from parsed rows + skips existing emails', async () => {
    const csv = `email,firstName,lastName,phone
new1@example.com,New,One,01776902711
existing@example.com,Existing,User,01700000000
new2@example.com,New,Two,`;
    const buffer = Buffer.from(csv, 'utf-8');

    prisma.user.findMany.mockResolvedValue([
      { email: 'existing@example.com' },  // already in DB
    ]);
    prisma.user.createMany.mockResolvedValue({ count: 2 });

    const result = await service.bulkImport(buffer, adminId);

    expect(result).toEqual({
      created: 2,
      skipped_existing: 1,
      skipped_duplicate_within_upload: 0,
      errors: [],
    });
    expect(prisma.user.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            email: 'new1@example.com',
            firstName: 'New',
            phones: ['01776902711'],
            passwordHash: null,
            claimedAt: null,
            createdBy: adminId,
          }),
          expect.objectContaining({
            email: 'new2@example.com',
            firstName: 'New',
            lastName: 'Two',
            phones: [],
          }),
        ]),
      }),
    );
    // existing@example.com NOT in createMany data
    const createArg = (prisma.user.createMany.mock.calls[0]?.[0] ?? {
      data: [],
    }) as { data: Array<{ email: string }> };
    expect(createArg.data.find((d) => d.email === 'existing@example.com')).toBeUndefined();
  });

  it('reports parse errors in the result', async () => {
    const csv = `email,firstName,lastName,phone
bad-email,X,Y,
ok@example.com,OK,User,01776902711`;
    const buffer = Buffer.from(csv, 'utf-8');
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.createMany.mockResolvedValue({ count: 1 });

    const result = await service.bulkImport(buffer, adminId);

    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      row: 2,
      reason: expect.stringContaining('email'),
    });
  });

  it('reports within-file duplicates separately', async () => {
    const csv = `email,firstName,lastName,phone
ada@example.com,Ada,,01776902711
ada@example.com,IGNORE,Lovelace,02000000000`;
    const buffer = Buffer.from(csv, 'utf-8');
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.createMany.mockResolvedValue({ count: 1 });

    const result = await service.bulkImport(buffer, adminId);

    expect(result.created).toBe(1);
    expect(result.skipped_duplicate_within_upload).toBe(1);
  });
});
```

- [ ] **Step 6.2: Run test, expect to fail**

```bash
cd apps/api && pnpm test src/modules/users/users.service.spec.ts -- -t "bulkImport"
```

Expected: tests fail with `service.bulkImport is not a function`.

- [ ] **Step 6.3: Add bulkImport method to UsersService**

In `apps/api/src/modules/users/users.service.ts`, add this method (after `createCustomerAsAdmin`):

```ts
import { parseAndDedupeCsv, type ParseError } from './bulk-import.parser';

// ... in the class:

async bulkImport(buffer: Buffer, adminUserId: string) {
  const parsed = await parseAndDedupeCsv(buffer);

  // Find which emails already exist in DB.
  const emails = Array.from(parsed.rows.keys());
  const existing = await this.prisma.user.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const existingEmails = new Set(existing.map((u) => u.email));

  // Filter parsed rows to those that don't already exist.
  const toInsert = Array.from(parsed.rows.values())
    .filter((r) => !existingEmails.has(r.email))
    .map((r) => ({
      email: r.email,
      firstName: r.firstName,
      lastName: r.lastName,
      phones: r.phone ? [r.phone] : [],
      passwordHash: null,
      role: Role.CUSTOMER,
      isVerified: true,
      claimedAt: null,
      createdBy: adminUserId,
    }));

  // Batched inserts (size 100) so a partial failure doesn't lose earlier batches.
  let createdCount = 0;
  for (let i = 0; i < toInsert.length; i += 100) {
    const chunk = toInsert.slice(i, i + 100);
    const result = await this.prisma.user.createMany({
      data: chunk,
      skipDuplicates: true, // belt-and-suspenders against race with concurrent admin
    });
    createdCount += result.count;
  }

  return {
    created: createdCount,
    skipped_existing: existingEmails.size,
    skipped_duplicate_within_upload: parsed.duplicates.length,
    errors: parsed.errors,
  };
}
```

- [ ] **Step 6.4: Run service tests, expect them to pass**

```bash
cd apps/api && pnpm test src/modules/users/users.service.spec.ts
```

Expected: all tests pass.

- [ ] **Step 6.5: Add @nestjs/platform-express + multer for file upload**

```bash
cd apps/api && pnpm add multer && pnpm add -D @types/multer
```

`@nestjs/platform-express` is already a dependency of NestJS — verify by checking package.json. Multer is the underlying upload handler.

- [ ] **Step 6.6: Add controller endpoint for POST /users/bulk**

In `apps/api/src/modules/users/users.controller.ts`, add to the imports:

```ts
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile, UseInterceptors } from '@nestjs/common';
import type { Express } from 'express';
```

Add this method after `createCustomer`:

```ts
@Post('bulk')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
@UseInterceptors(
  FileInterceptor('file', {
    limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB, matches parser cap
  }),
)
bulkImport(
  @UploadedFile() file: Express.Multer.File,
  @CurrentUser() admin: { id: string },
) {
  if (!file || !file.buffer) {
    throw new BadRequestException('No file uploaded; expected multipart field "file"');
  }
  return this.usersService.bulkImport(file.buffer, admin.id);
}
```

Add `BadRequestException` to the `@nestjs/common` import line.

- [ ] **Step 6.7: Verify endpoint typechecks**

```bash
cd apps/api && pnpm exec tsc --noEmit 2>&1 | grep -E "users\." | head
```

Expected: no errors in users module files. Pre-existing errors in unrelated specs are fine.

- [ ] **Step 6.8: Commit**

```bash
git add apps/api/package.json apps/api/pnpm-lock.yaml apps/api/src/modules/users/users.controller.ts apps/api/src/modules/users/users.service.ts apps/api/src/modules/users/users.service.spec.ts
git commit -m "feat(api): POST /users/bulk — CSV bulk import for shadow customers

Multipart upload (field 'file', max 20 MB) → two-pass parse →
batched 100-at-a-time createMany inserts. Returns { created,
skipped_existing, skipped_duplicate_within_upload, errors[] }.
Admin role enforced; createdBy captures authenticated admin id."
```

---

## Task 7: Auth — shadow-aware login error

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts` (login method)
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 7.1: Write failing test for shadow login error**

Open `apps/api/src/modules/auth/auth.service.spec.ts`. Add a new test inside the `describe('login', ...)` block (or create one if not present):

```ts
it('returns a shadow-specific message when user.passwordHash is null', async () => {
  prisma.user.findFirst.mockResolvedValue({
    id: 'shadow-1',
    email: 'shadow@example.com',
    passwordHash: null,
    isActive: true,
    deletedAt: null,
    isVerified: true,
    firstName: 'Shadow',
    lastName: 'User',
    role: 'CUSTOMER',
  });

  await expect(
    service.login({ email: 'shadow@example.com', password: 'anything' }),
  ).rejects.toThrow(
    /not been set up yet|please sign up/i,
  );
});
```

- [ ] **Step 7.2: Run test, expect to fail**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "shadow-specific message"
```

Expected: test fails (current login probably blows up on bcrypt compare against null).

- [ ] **Step 7.3: Modify login to check for shadow**

In `apps/api/src/modules/auth/auth.service.ts`, find the `login` method. After the user is fetched and validated (deletedAt, isActive checks), add this check BEFORE the bcrypt compare:

```ts
if (user.passwordHash === null) {
  throw new UnauthorizedException(
    "This account hasn't been set up yet. Please sign up with this email to set your password.",
  );
}
```

- [ ] **Step 7.4: Run test, expect to pass**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "shadow-specific message"
```

Expected: passes.

- [ ] **Step 7.5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): login returns shadow-specific message for unclaimed accounts

When a user attempts to log in with an email that matches a shadow
record (passwordHash IS NULL), respond with a clear 'please sign up'
message instead of failing on bcrypt compare. Mild email-enumeration
risk accepted in exchange for actionable UX."
```

---

## Task 8: Auth — shadow-aware forgot-password

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts` (forgotPassword)
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 8.1: Write failing test**

Append to the `describe('forgotPassword', ...)` block in auth.service.spec.ts (create if missing):

```ts
it('returns shadow-specific message and does NOT send email for unclaimed user', async () => {
  prisma.user.findFirst.mockResolvedValue({
    id: 'shadow-1',
    email: 'shadow@example.com',
    passwordHash: null,
    firstName: 'Shadow',
    deletedAt: null,
  });
  const emailSendSpy = jest.spyOn(emailMock, 'send');

  const result = await service.forgotPassword('shadow@example.com');

  expect(result.message).toMatch(/sign up|not fully registered/i);
  expect(emailSendSpy).not.toHaveBeenCalled();
});
```

(`emailMock` should be the EmailService mock used in the spec's TestingModule setup. If named differently in the existing spec, adjust accordingly.)

- [ ] **Step 8.2: Run test, expect to fail**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "shadow-specific message and does NOT send"
```

Expected: fail (current `forgotPassword` would send the reset email).

- [ ] **Step 8.3: Modify forgotPassword**

In auth.service.ts `forgotPassword`, after the user lookup, add:

```ts
if (user && user.passwordHash === null) {
  return {
    message: "This email isn't fully registered yet. Please sign up to complete your account.",
  };
}
```

Place this BEFORE the existing "if (!user) return success" line so shadows are short-circuited first.

- [ ] **Step 8.4: Run test, expect to pass**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "shadow-specific message and does NOT send"
```

Expected: pass.

- [ ] **Step 8.5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): forgot-password short-circuits shadow accounts

For an email matching an unclaimed (shadow) record, return a clear
'please sign up' message and skip the reset email entirely. Real
claimed users get the normal reset flow."
```

---

## Task 9: Auth — register auto-claims shadow

**Files:**
- Modify: `apps/api/src/modules/auth/auth.service.ts` (register)
- Modify: `apps/api/src/modules/auth/auth.service.spec.ts`

- [ ] **Step 9.1: Write failing test**

Append to the `describe('register', ...)` block in auth.service.spec.ts:

```ts
it('auto-claims an existing shadow account on register with matching email', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'shadow-1',
    email: 'shadow@example.com',
    passwordHash: null,
    claimedAt: null,
    firstName: 'Imported',
    lastName: '',
    phones: ['01700000000'],
    deletedAt: null,
    tokenVersion: 0,
    isActive: true,
  });
  prisma.user.update.mockResolvedValue({
    id: 'shadow-1',
    email: 'shadow@example.com',
    firstName: 'Real',
    lastName: 'User',
    phones: ['01776902711', '01700000000'],
    claimedAt: new Date(),
    tokenVersion: 1,
    role: 'CUSTOMER',
  });

  const result = await service.register({
    email: 'shadow@example.com',
    password: 'Secret123!',
    firstName: 'Real',
    lastName: 'User',
    phone: '01776902711',
  });

  expect(prisma.user.update).toHaveBeenCalledWith({
    where: { id: 'shadow-1' },
    data: expect.objectContaining({
      passwordHash: expect.any(String),
      claimedAt: expect.any(Date),
      firstName: 'Real',
      lastName: 'User',
      phones: ['01776902711', '01700000000'],   // dedup-prepend
      tokenVersion: { increment: 1 },
    }),
  });
  // Should NOT have called create — claim path uses update
  expect(prisma.user.create).not.toHaveBeenCalled();
  expect(result).toBeDefined();
});

it('returns 409 when register email matches a CLAIMED user', async () => {
  prisma.user.findUnique.mockResolvedValue({
    id: 'claimed-1',
    email: 'claimed@example.com',
    passwordHash: 'existing-hash',
    claimedAt: new Date(),
    deletedAt: null,
  });

  await expect(
    service.register({
      email: 'claimed@example.com',
      password: 'X',
      firstName: 'Y',
      lastName: 'Z',
    }),
  ).rejects.toThrow(ConflictException);
});
```

- [ ] **Step 9.2: Run test, expect to fail**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "auto-claims"
```

Expected: failures.

- [ ] **Step 9.3: Modify register to handle shadow claim**

In auth.service.ts `register`, near the top after parsing inputs but before creating the user, add the lookup + claim path:

```ts
import { prependPhoneToArray, normalizeAndValidate } from '../../common/phone.util';

// ... inside register method:

const emailLower = dto.email.trim().toLowerCase();

let normalizedPhone = '';
if (dto.phone) {
  const phoneResult = normalizeAndValidate(dto.phone);
  if (phoneResult.ok) normalizedPhone = phoneResult.phone;
  // else: ignore invalid phone for register — proceed without it
}

const existing = await this.prisma.user.findUnique({
  where: { email: emailLower },
});

if (existing && existing.deletedAt === null) {
  if (existing.claimedAt !== null) {
    throw new ConflictException('An account with this email already exists');
  }
  // Shadow → claim it.
  const passwordHash = await bcrypt.hash(dto.password, 10);
  const newPhones = prependPhoneToArray(existing.phones, normalizedPhone);
  const claimedUser = await this.prisma.user.update({
    where: { id: existing.id },
    data: {
      passwordHash,
      claimedAt: new Date(),
      firstName: dto.firstName,
      lastName: dto.lastName,
      phones: newPhones,
      tokenVersion: { increment: 1 },
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: true,
      role: true,
      tokenVersion: true,
    },
  });
  // Send verification email (same as fresh register)
  await this.sendVerificationEmail(claimedUser.id, claimedUser.email, claimedUser.firstName);
  // Issue tokens like a fresh register would
  return this.issueTokensForUser(claimedUser);
}

// ... existing fresh-register flow continues from here ...
```

`sendVerificationEmail` and `issueTokensForUser` should match the existing helper functions in auth.service. If they don't exist as separate helpers, inline the equivalent logic (token signing, etc.) that the existing register flow uses for fresh accounts.

- [ ] **Step 9.4: Run test, expect to pass**

```bash
cd apps/api && pnpm test src/modules/auth/auth.service.spec.ts -- -t "auto-claims"
```

Expected: pass.

- [ ] **Step 9.5: Commit**

```bash
git add apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/auth.service.spec.ts
git commit -m "feat(api): register auto-claims matching shadow records

When a customer registers with an email that matches an unclaimed
shadow User, the existing record is updated (password set, claimedAt
populated, firstName/lastName overwritten, new phone dedup-prepended,
tokenVersion incremented) and verification email sent. No 409.

Real claimed accounts still 409 as before."
```

---

## Task 10: Orders — guest checkout match-or-create

**Files:**
- Modify: `apps/api/src/modules/orders/orders.service.ts` (createOrder guest path)
- Modify: `apps/api/src/modules/orders/orders.service.spec.ts`

- [ ] **Step 10.1: Write failing tests for guest match-or-create**

Append to `apps/api/src/modules/orders/orders.service.spec.ts`:

```ts
describe('createOrder — guest path match-or-create', () => {
  const baseDto = {
    items: [{ variantId: 'v-1', quantity: 1 }],
    shippingAddress: {
      line1: '1 Test St', city: 'Dhaka', state: 'Dhaka',
      postalCode: '1200', country: 'BD',
    },
    guestEmail: 'guest@example.com',
    guestName: 'Guest User',
    guestPhone: '01776902711',
  };

  it('attaches order to matched SHADOW user and fill-blanks updates', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'shadow-1',
      email: 'guest@example.com',
      firstName: '',
      lastName: '',
      phones: ['01700000000'],
      claimedAt: null,
      deletedAt: null,
    });
    prisma.user.update.mockResolvedValue({ id: 'shadow-1' });
    // ... existing order create mocks ...

    await service.createOrder(null, baseDto);

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'shadow-1' },
      data: expect.objectContaining({
        firstName: 'Guest User',
        phones: ['01776902711', '01700000000'],
      }),
    });
    // Order is created with userId set to the matched shadow
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'shadow-1' }),
      }),
    );
  });

  it('attaches order to matched CLAIMED user but does NOT mutate profile', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'real-1',
      email: 'guest@example.com',
      firstName: 'Real',
      lastName: 'User',
      phones: ['01700000000'],
      claimedAt: new Date('2026-01-01'),
      deletedAt: null,
    });

    await service.createOrder(null, baseDto);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'real-1' }),
      }),
    );
  });

  it('creates a new shadow when no match found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.upsert.mockResolvedValue({ id: 'new-shadow-1' });

    await service.createOrder(null, baseDto);

    expect(prisma.user.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'guest@example.com' },
        create: expect.objectContaining({
          email: 'guest@example.com',
          firstName: 'Guest User',
          lastName: '',
          phones: ['01776902711'],
          passwordHash: null,
          claimedAt: null,
          createdBy: null,
        }),
      }),
    );
    expect(prisma.order.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'new-shadow-1' }),
      }),
    );
  });
});
```

(Adjust mocks for existing order-create dependencies — variant lookup, inventory deduction, etc. — to match the existing spec's setup.)

- [ ] **Step 10.2: Run tests, expect to fail**

```bash
cd apps/api && pnpm test src/modules/orders/orders.service.spec.ts -- -t "match-or-create"
```

Expected: fail (current code doesn't lookup users).

- [ ] **Step 10.3: Modify createOrder guest path**

In `apps/api/src/modules/orders/orders.service.ts`, find `createOrder` and at the start of the `isGuest` (or `if (!userId)`) branch, add the match-or-create logic BEFORE the order is created. Effective userId is set from this resolution:

```ts
import { normalizeAndValidate, prependPhoneToArray } from '../../common/phone.util';
import { Role } from '@prisma/client';

// ... inside createOrder, after validating dto.guestEmail/guestName/guestPhone:

let effectiveUserId: string;

if (userId !== null) {
  // Already-logged-in user, current behavior
  effectiveUserId = userId;
} else {
  // Guest path: match-or-create
  const emailLower = dto.guestEmail.trim().toLowerCase();
  const phoneResult = normalizeAndValidate(dto.guestPhone);
  const normalizedPhone = phoneResult.ok ? phoneResult.phone : '';

  const candidate = await this.prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { email: emailLower },
        ...(normalizedPhone ? [{ phones: { has: normalizedPhone } }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phones: true,
      claimedAt: true,
    },
  });

  if (candidate) {
    effectiveUserId = candidate.id;
    if (candidate.claimedAt === null) {
      // SHADOW: fill-blanks update
      const updates: Record<string, unknown> = {};
      if (!candidate.firstName && dto.guestName) {
        updates.firstName = dto.guestName.trim();
      }
      if (normalizedPhone) {
        const newPhones = prependPhoneToArray(candidate.phones, normalizedPhone);
        if (
          newPhones.length !== candidate.phones.length ||
          newPhones[0] !== candidate.phones[0]
        ) {
          updates.phones = newPhones;
        }
      }
      if (Object.keys(updates).length > 0) {
        await this.prisma.user.update({
          where: { id: candidate.id },
          data: updates,
        });
      }
    }
    // CLAIMED: attach only, never mutate profile (skipped intentionally)
    this.logger.log(
      `guest checkout matched user ${candidate.id} (state=${candidate.claimedAt ? 'claimed' : 'shadow'}, matchedOn=${candidate.email === emailLower ? 'email' : 'phone'})`,
    );
  } else {
    // No match: create new shadow
    const newShadow = await this.prisma.user.upsert({
      where: { email: emailLower },
      create: {
        email: emailLower,
        firstName: dto.guestName.trim(),
        lastName: '',
        phones: normalizedPhone ? [normalizedPhone] : [],
        passwordHash: null,
        role: Role.CUSTOMER,
        isVerified: true,
        claimedAt: null,
        createdBy: null,
      },
      update: {
        // Race: another guest checkout just created this. Re-fetch via update no-op
        // so we have the id.
        email: emailLower,
      },
      select: { id: true },
    });
    effectiveUserId = newShadow.id;
  }
}

// ... existing order creation uses `effectiveUserId` instead of `userId`
```

Adjust the rest of `createOrder` to use `effectiveUserId` everywhere it previously used `userId` for the database write. The DTO's guest fields (guestEmail, guestName, guestPhone) are still stored on the Order itself for receipt purposes — DON'T strip them.

Make sure the existing logger is available: `private readonly logger = new Logger(OrdersService.name);` (add if not present).

- [ ] **Step 10.4: Run order tests, expect them to pass**

```bash
cd apps/api && pnpm test src/modules/orders/orders.service.spec.ts
```

Expected: new match-or-create tests pass. Pre-existing tests may need updates to mock the new findFirst calls — fix them inline (they should expect `userId` to be the matched/created user id, not null).

- [ ] **Step 10.5: Commit**

```bash
git add apps/api/src/modules/orders/orders.service.ts apps/api/src/modules/orders/orders.service.spec.ts
git commit -m "feat(api): guest checkout match-or-create

Guest orders now attach to an existing User if email or phone matches.
SHADOW candidates get a fill-blanks profile update (firstName + dedup-
prepended phones). CLAIMED candidates are attached but profile is
read-only (prevents email/phone spoofing from injecting contact info).
If no match, a new shadow User is upserted (race-safe via email unique
constraint) and the order attaches to it. Every order now has a userId."
```

---

## Task 11: Migrate remaining `user.phone` consumers to `user.phones[0]`

**Files:** vary; this is a sweep across both apps.

- [ ] **Step 11.1: Find all references**

```bash
cd /c/Users/joycg/denimisia && grep -rn "user\.phone\b\|\.phone\b" --include="*.ts" --include="*.tsx" apps/api apps/admin apps/web | grep -v "\.spec\.\|/node_modules/\|/dist/\|/\.next/" | grep -v "phones\|phone:" | head -30
```

Make a list. Expected hits include:
- `apps/api/src/modules/orders/orders.service.ts` (recently added user select)
- `apps/admin/app/(dashboard)/orders/page.tsx` (export columns)
- `apps/admin/app/(dashboard)/customers/page.tsx` (display)
- `apps/web/app/account/*` (account page)
- `apps/web/app/checkout/*` (checkout form)

- [ ] **Step 11.2: Update each consumer to read phones[0]**

For each file in the list, change patterns like:
- `user.phone` → `user.phones?.[0] ?? ''`
- Type annotations like `phone?: string` on response shapes → `phones?: string[]`

For TypeScript interfaces on the admin/web side that describe User-shaped objects from API responses, update the `phone?: string` field to `phones?: string[]`.

Specifically for `apps/admin/app/(dashboard)/orders/page.tsx`:
- The `Order` interface's `user.phone` → `user.phones?: string[]`
- In `handleExport`, `o.user?.phone ?? o.guestPhone ?? ''` → `o.user?.phones?.[0] ?? o.guestPhone ?? ''`

For `apps/api/src/modules/orders/orders.service.ts` `getAllOrders` user select:
```ts
user: {
  select: {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    phones: true,    // CHANGED from phone
  },
},
```

For `apps/api/src/modules/auth/auth.service.ts`: any responses returning `phone` to clients should now return `phones`. Update accordingly.

- [ ] **Step 11.3: Run API typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: no new errors. Pre-existing errors in unrelated specs still present but unchanged.

- [ ] **Step 11.4: Run admin typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: clean.

- [ ] **Step 11.5: Run web typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/web && pnpm exec tsc --noEmit 2>&1 | head -30
```

Expected: clean.

- [ ] **Step 11.6: Run all API tests**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm test 2>&1 | tail -10
```

Expected: all green. Fix any test files where `mockUser.phone` was hardcoded — replace with `phones: []` or `phones: ['01...']` as appropriate.

- [ ] **Step 11.7: Commit**

```bash
git add apps/api apps/admin apps/web
git commit -m "refactor(*): migrate user.phone → user.phones[0] across all consumers

Backend selects, admin response types, admin exports, web account
page, web checkout form. Always reads phones[0] with empty-string
fallback. Interfaces describing User-shaped API responses now have
phones: string[] instead of phone: string."
```

---

## Task 12: Admin — refactor Add Customer modal

**Files:**
- Modify: `apps/admin/app/(dashboard)/customers/page.tsx`

- [ ] **Step 12.1: Locate the Add Participant modal**

Open `apps/admin/app/(dashboard)/customers/page.tsx`. Find the JSX block with `title="Add Participant"` and the surrounding form (handleAddSubmit, addForm state).

- [ ] **Step 12.2: Update the copy and button text**

Replace:
- `title="Add Participant"` → `title="Add Customer"`
- `description="Create a new customer record. They will receive an onboarding email if configured."` → `description="Creates a customer record immediately. No password or email is sent — the customer can later sign up with this email to claim the account."`
- Submit button text `Add Participant` → `Add Customer`

Update `handleAddSubmit` to handle the 409 conflict from the API with a clear inline error message:

```ts
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : 'Failed to add customer';
  if (message.includes('already exists')) {
    setAddError(
      'This email is already registered. The customer can update their own profile by signing in.',
    );
  } else {
    setAddError(message);
  }
}
```

The body sent to `POST /users` stays the same — server already accepts the same shape. Do not send `role` (server ignores anyway).

- [ ] **Step 12.3: Verify typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head
```

Expected: clean.

- [ ] **Step 12.4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/customers/page.tsx
git commit -m "feat(admin): refresh Add Customer modal copy for shadow-record semantics

- Title: 'Add Customer' (was 'Add Participant')
- Description clarifies no email is sent
- 409 conflict renders a friendly inline error pointing to customer self-service"
```

---

## Task 13: Admin — Import CSV modal

**Files:**
- Create: `apps/admin/components/customers/import-csv-modal.tsx`
- Modify: `apps/admin/app/(dashboard)/customers/page.tsx` (add Import CSV button + modal mount)

- [ ] **Step 13.1: Create the modal component**

Create `apps/admin/components/customers/import-csv-modal.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';

interface ImportResult {
  readonly created: number;
  readonly skipped_existing: number;
  readonly skipped_duplicate_within_upload: number;
  readonly errors: ReadonlyArray<{ row: number; reason: string }>;
}

interface ImportCsvModalProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  apiBase: string;        // e.g. process.env.NEXT_PUBLIC_API_URL
  token: string | undefined;
}

export function ImportCsvModal({
  open,
  onClose,
  onImported,
  apiBase,
  token,
}: ImportCsvModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
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
      const res = await fetch(`${apiBase}/users/bulk`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? `Upload failed (${res.status})`);
      }
      const data = (body.data ?? body) as ImportResult;
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

  const downloadErrorReport = () => {
    if (!result || result.errors.length === 0) return;
    const csv =
      'row,reason\n' +
      result.errors
        .map((e) => `${e.row},"${e.reason.replace(/"/g, '""')}"`)
        .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `import-errors-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-lg rounded bg-surface-container-lowest p-6">
        <div className="mb-4 flex items-start justify-between">
          <h2 className="font-headline text-xl font-semibold">Import Customers from CSV</h2>
          <button onClick={handleClose} className="text-secondary hover:text-on-surface" aria-label="Close">
            ✕
          </button>
        </div>

        {result ? (
          <div className="space-y-3 text-sm">
            <p>✓ Imported <strong>{result.created}</strong> new customers</p>
            {result.skipped_existing > 0 && (
              <p>⚠ Skipped <strong>{result.skipped_existing}</strong> (already in your system)</p>
            )}
            {result.skipped_duplicate_within_upload > 0 && (
              <p>⚠ Skipped <strong>{result.skipped_duplicate_within_upload}</strong> duplicate rows within this file</p>
            )}
            {result.errors.length > 0 && (
              <div>
                <p>✗ <strong>{result.errors.length}</strong> rows had errors:</p>
                <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-outline-variant/20 bg-surface-container p-2 text-xs">
                  {result.errors.slice(0, 10).map((e) => (
                    <li key={e.row}>Row {e.row}: {e.reason}</li>
                  ))}
                  {result.errors.length > 10 && (
                    <li className="text-secondary">…and {result.errors.length - 10} more</li>
                  )}
                </ul>
                <button
                  onClick={downloadErrorReport}
                  className="mt-2 text-xs underline text-primary"
                >
                  Download error report
                </button>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button
                onClick={handleClose}
                className="rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 rounded bg-surface-container p-3 text-xs text-secondary">
              <p className="mb-1">Upload a CSV with these columns:</p>
              <pre className="font-mono text-[10px]">email,firstName,lastName,phone</pre>
              <ul className="mt-2 list-disc pl-4">
                <li>email and firstName are required</li>
                <li>lastName and phone are optional</li>
                <li>Existing emails will be skipped (no overwrite)</li>
                <li>Maximum file size: 20 MB</li>
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
              <p className="mt-3 rounded bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={handleClose}
                disabled={uploading}
                className="rounded px-4 py-2 text-sm text-secondary"
              >
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

- [ ] **Step 13.2: Add the button + modal mount to customers/page.tsx**

In `apps/admin/app/(dashboard)/customers/page.tsx`:

Add the import at top:
```tsx
import { ImportCsvModal } from '@/components/customers/import-csv-modal';
```

Add state near the other modal state:
```tsx
const [importOpen, setImportOpen] = useState(false);
```

In the toolbar JSX (next to the existing Add Customer button), add:
```tsx
<button
  type="button"
  onClick={() => setImportOpen(true)}
  className="rounded border border-outline-variant/30 px-4 py-2 text-sm font-semibold"
>
  Import CSV
</button>
```

Mount the modal at the end of the JSX (alongside other modals):
```tsx
<ImportCsvModal
  open={importOpen}
  onClose={() => setImportOpen(false)}
  onImported={() => {
    setImportOpen(false);
    void loadCustomers();
  }}
  apiBase={process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1'}
  token={token}
/>
```

- [ ] **Step 13.3: Typecheck**

```bash
cd /c/Users/joycg/denimisia/apps/admin && pnpm exec tsc --noEmit 2>&1 | head
```

Expected: clean.

- [ ] **Step 13.4: Commit**

```bash
git add apps/admin/components/customers/ apps/admin/app/\(dashboard\)/customers/page.tsx
git commit -m "feat(admin): Import CSV modal for bulk customer import

- New ImportCsvModal component with file picker, progress, and
  result panel showing created/skipped/error counts.
- 'Download error report' button generates a CSV of just the error
  rows for admin to fix and re-upload.
- Customers page gets an 'Import CSV' button in the toolbar."
```

---

## Task 14: Web — account page phone history

**Files:**
- Modify: `apps/web/app/account/page.tsx` (or whatever the account profile route is)

- [ ] **Step 14.1: Locate account page phone field**

```bash
grep -rn "user\.phone\|profile\.phone\|phones" apps/web/app/account --include="*.tsx" | head
```

Find the file showing the user's phone. Likely `apps/web/app/account/page.tsx` or a sub-page like `account/profile/page.tsx`.

- [ ] **Step 14.2: Update phone display + add history**

Replace the single phone field display with `phones[0]` and add a small disclosure for prior phones:

```tsx
<section>
  <label className="text-xs font-bold uppercase tracking-[0.2em] text-secondary">
    Phone
  </label>
  <input
    type="tel"
    value={phoneDraft}
    onChange={(e) => setPhoneDraft(e.target.value)}
    className="..."
  />
  {profile.phones.length > 1 && (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-secondary">
        Previous numbers ({profile.phones.length - 1})
      </summary>
      <ul className="mt-2 space-y-1 text-xs font-mono text-secondary">
        {profile.phones.slice(1).map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </details>
  )}
</section>
```

Adapt to whatever component library / styling the existing account page uses. The state `phoneDraft` is initialized from `profile.phones[0] ?? ''`.

The save flow remains using `PATCH /users/me`. The DTO accepts `phone: string` (the admin and web UIs stay single-field); server-side `updateProfile` should dedup-prepend the new phone into `phones[]`.

- [ ] **Step 14.3: Update updateProfile on the API to dedup-prepend**

In `apps/api/src/modules/users/users.service.ts`, find `updateProfile`. Modify the phone-handling branch:

```ts
import { normalizeAndValidate, prependPhoneToArray } from '../../common/phone.util';

// ... inside updateProfile:

if (dto.phone !== undefined) {
  if (dto.phone === null || dto.phone === '') {
    // Explicit clear — drop phones[0] but keep history
    // (Skip if no current phones, no-op)
    updates.phones = currentUser.phones.slice(1);
  } else {
    const phoneResult = normalizeAndValidate(dto.phone);
    if (!phoneResult.ok) {
      throw new BadRequestException('Invalid phone — must be a 10-11 digit BD number');
    }
    updates.phones = prependPhoneToArray(currentUser.phones, phoneResult.phone);
  }
}
```

You'll need to fetch `currentUser.phones` at the top of `updateProfile` if not already done (add to the existing select).

- [ ] **Step 14.4: Typecheck both apps**

```bash
cd /c/Users/joycg/denimisia/apps/api && pnpm exec tsc --noEmit 2>&1 | grep users && echo --- && cd ../web && pnpm exec tsc --noEmit 2>&1 | head
```

Expected: clean (no errors in users module or web app).

- [ ] **Step 14.5: Commit**

```bash
git add apps/api/src/modules/users/users.service.ts apps/web/app/account/
git commit -m "feat(web,api): phone history on account profile

Account page shows phones[0] as the current phone and discloses
previous numbers in a collapsible section. updateProfile on the API
dedup-prepends the submitted phone to the user's phones[] array
(BD-strict validation, 20-phone cap). Explicit clear removes phones[0]
but preserves history."
```

---

## Task 15: Web — checkout phone autofill + multi-phone save

**Files:**
- Modify: `apps/web/app/checkout/...` (find the checkout component)

- [ ] **Step 15.1: Locate checkout phone field**

```bash
grep -rn "phone\|guestPhone" apps/web/app/checkout --include="*.tsx" | head -20
```

Find the file rendering the phone input.

- [ ] **Step 15.2: Autofill phones[0] when logged in**

In the checkout component, when a logged-in user's profile is fetched, initialize the phone field with `profile?.phones?.[0] ?? ''`. Keep the input editable. On submit, send the (possibly-edited) phone value; the order creation flow on the API will dedup-prepend it into phones[] via the existing updateProfile or via the new order-create logic (Task 10 handles this for guest path; for logged-in checkout, do it via updateProfile after order placement OR inline in the order endpoint).

For simplicity: at checkout submit (logged-in), if the typed phone differs from `profile.phones[0]`, call `PATCH /users/me` with `{ phone: typedPhone }` BEFORE the order create. This reuses the existing flow added in Task 14.

- [ ] **Step 15.3: Validate phone in the UI before submit**

Add a lightweight client-side regex check `^\d{10,11}$` after stripping non-digits, so the user gets immediate feedback. Server is still authoritative — this is just UX.

- [ ] **Step 15.4: Manual test on dev server**

```bash
# Terminal 1: API
cd /c/Users/joycg/denimisia/apps/api && pnpm dev

# Terminal 2: Web
cd /c/Users/joycg/denimisia/apps/web && pnpm dev
```

In a browser:
1. Sign in as a test customer who has a phone in their profile.
2. Go to checkout, add an item, proceed to checkout.
3. Verify the phone input is pre-filled with the current phone.
4. Change it to a new (valid BD) number, place the order.
5. Visit the account page, confirm the new phone is at position 0 and the old one is in "Previous numbers".

- [ ] **Step 15.5: Commit**

```bash
git add apps/web/app/checkout/
git commit -m "feat(web): checkout autofills phones[0] and preserves phone history

Logged-in users see their current phone pre-filled. Editing it and
checking out triggers a PATCH /users/me with the new phone, which
dedup-prepends it into phones[] (preserving the prior value)."
```

---

## Task 16: Full-stack manual verification

**Files:** none modified — pure verification.

- [ ] **Step 16.1: Reset local DB and re-seed**

```bash
cd /c/Users/joycg/denimisia
pnpm --filter database exec prisma migrate reset --skip-seed
pnpm --filter database exec prisma migrate dev
# Optional: seed a few users via the existing seed script
pnpm --filter database exec ts-node prisma/seed.ts
```

Confirm DB has at least a few existing users and that they get `claimedAt = createdAt`, `phones = [phone]` after migration.

- [ ] **Step 16.2: Start all dev servers**

```bash
# Terminal 1
cd /c/Users/joycg/denimisia/apps/api && pnpm dev
# Terminal 2
cd /c/Users/joycg/denimisia/apps/admin && pnpm dev
# Terminal 3
cd /c/Users/joycg/denimisia/apps/web && pnpm dev
```

- [ ] **Step 16.3: E2E happy path — admin imports, customer claims**

In admin UI (`http://localhost:3002`):
1. Sign in as admin.
2. Customers page → Add Customer → `e2e-test@example.com`, `Test`, `User`, `01776902711`. Save.
3. Verify the row appears in the customers table.

In storefront (`http://localhost:3000`):
4. Go to /register. Enter the same email + new password.
5. Verify register succeeds (no 409). Check that you can log in immediately afterward with the chosen password.
6. Account page → verify the imported phone `01776902711` is shown.

- [ ] **Step 16.4: E2E — guest checkout auto-creates shadow**

1. Open storefront in an incognito window (no login).
2. Add a product, proceed to guest checkout with `auto-shadow@example.com`, `Auto Shadow`, `01700000000`. Complete order.
3. In admin UI, refresh Customers — verify `auto-shadow@example.com` now appears as a customer.

- [ ] **Step 16.5: E2E — guest checkout matches existing shadow**

1. Repeat guest checkout with the same `auto-shadow@example.com` email but different name `Different Name` and a different phone `01800000000`.
2. In admin UI, check the customer record:
   - firstName should still be `Auto Shadow` (existing non-empty preserved)
   - phones should be `['01800000000', '01700000000']` (dedup-prepended)
   - Both orders should appear in the customer's order history.

- [ ] **Step 16.6: E2E — CSV bulk import**

1. Create a test CSV:
```csv
email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01776902701
grace@example.com,Grace,Hopper,01776902702
auto-shadow@example.com,Already,Exists,01776902703
invalid-row,X,Y,not-a-phone
ada@example.com,Ada,DUP,01776902704
```

2. Admin → Import CSV → upload this file.
3. Verify result panel shows:
   - Created: 2 (ada + grace)
   - Skipped existing: 1 (auto-shadow already in DB)
   - Skipped duplicate within upload: 1 (the second ada row)
   - Errors: 1 (invalid-row with phone error OR email error)

- [ ] **Step 16.7: E2E — shadow login attempt**

1. In storefront, try to log in with `ada@example.com` (just imported, never claimed).
2. Verify error message: "This account hasn't been set up yet. Please sign up to complete your account."

- [ ] **Step 16.8: E2E — shadow forgot password**

1. In storefront, click "Forgot password" with `ada@example.com`.
2. Verify the response message says to sign up instead.
3. Check API logs — confirm no reset email was actually sent.

- [ ] **Step 16.9: Mark verification complete**

If all 7 E2E checks above pass, the implementation is feature-complete locally.

- [ ] **Step 16.10: Commit a verification note**

```bash
git commit --allow-empty -m "chore: shadow-customer feature manually verified locally

Verified E2E paths:
- Admin import (single) → customer claims via register
- Guest checkout auto-creates shadow
- Repeat guest checkout matches + appends phone
- CSV bulk import (created/skipped/duplicate/error counts)
- Shadow login → friendly error
- Shadow forgot-pw → friendly message, no email sent"
```

---

## Task 17: Open PR + production deploy

**Files:** none modified.

- [ ] **Step 17.1: Push branch and open PR**

```bash
git push -u origin feat/shadow-customer-records
gh pr create --base main --title "feat: shadow customer records + multi-phone storage" \
  --body "$(cat <<'EOF'
## Summary

Implements shadow customer records, bulk CSV import, multi-phone storage,
and guest-checkout match-or-create per the spec at
[docs/superpowers/specs/2026-05-26-shadow-customer-records-design.md](docs/superpowers/specs/2026-05-26-shadow-customer-records-design.md).

## What's in
- Admin POST /users refactored: no password, no email; just creates a record
- Admin POST /users/bulk: CSV bulk import (20MB cap, two-pass dedupe)
- Guest checkouts auto-attach or auto-create User records
- Self-register auto-claims shadow accounts
- Login + forgot-password handle shadow accounts with friendly messages
- User.phone (singular) → User.phones (array, dedup-prepended, capped at 20)
- All API + admin + web consumers migrated to read phones[0]

## Migration
- Single Prisma migration, additive + value-preserving:
  - Adds claimedAt, createdBy, phones[]
  - Backfills phones from phone, claimedAt from createdAt for existing users
  - Drops phone column, GIN-indexes phones
- Brief Render rolling-restart downtime acceptable (per spec §12)

## Test plan
- [ ] API: all Jest tests pass (\`pnpm --filter api test\`)
- [ ] API + admin + web: typecheck clean
- [ ] Manual E2E checks per plan Task 16 all pass
- [ ] After merge: smoke-check admin.denimisiabd.com Add Customer modal
- [ ] After merge: smoke-check storefront register + login flows

## Out of scope (separate specs)
- Order history import (the "everything comes along" CSV columns)
- Manual customer merge tool
- International phone normalization
EOF
)"
```

- [ ] **Step 17.2: Wait for PR checks, merge to main**

If CI is configured, wait for green. If approval is needed from a reviewer, request it. Once merged, Render and Vercel will auto-deploy.

- [ ] **Step 17.3: Monitor deploy**

Use the Render API token saved at `render-token.txt` to poll the deploy:

```bash
TOKEN=$(cat /c/Users/joycg/denimisia/render-token.txt | tr -d '\n\r')
SVC=srv-d89or2reo5us7393e8dg
curl -s -H "Authorization: Bearer $TOKEN" "https://api.render.com/v1/services/$SVC/deploys?limit=1" | python -c "import json,sys; d=json.load(sys.stdin); print(d[0]['deploy']['status'])"
```

Poll until status is `live`. Then smoke-test:

```bash
curl -s -o /dev/null -w "users:    HTTP %{http_code}\n" -X POST https://denimisia-api.onrender.com/api/v1/users
curl -s -o /dev/null -w "bulk:     HTTP %{http_code}\n" -X POST https://denimisia-api.onrender.com/api/v1/users/bulk
```

Expected: both 401 (unauthenticated). Confirms endpoints exist (not 404). If 404, the deploy didn't include the new code — re-investigate.

- [ ] **Step 17.4: Production smoke test**

In a real browser:
1. Sign in to admin.denimisiabd.com.
2. Customers → Add Customer → create a test record.
3. Verify it appears in the table.
4. Customers → Import CSV → upload a minimal 2-row CSV.
5. Verify the result panel shows correct counts.
6. Delete the test customers via the admin UI before signing out.

If any step fails, open an issue and possibly roll back.

---

## Self-Review

The spec covers shadow customer records (admin + auto), bulk CSV import, auth changes (login, register, forgot-password), guest-checkout match-or-create, multi-phone storage, and full UI changes. Spot-check:

- **Spec §4 Data model** → Task 1 (schema migration)
- **Spec §5.1 POST /users** → Task 4
- **Spec §5.2 POST /users/bulk** → Tasks 5 (parser) + 6 (endpoint)
- **Spec §5.3 register auto-claim** → Task 9
- **Spec §5.4 login shadow message** → Task 7
- **Spec §5.5 forgot-pw shadow message** → Task 8
- **Spec §5.6 removed previous email-send code** → Task 4 step 4.3 (drops EmailService)
- **Spec §6 guest match-or-create** → Task 10
- **Spec §7 multi-phone storage** → Tasks 2, 3, 11, 14, 15
- **Spec §8 Admin UI** → Tasks 12, 13
- **Spec §9 Web UI** → Tasks 14, 15
- **Spec §10 edge cases** → covered across the task tests
- **Spec §11 testing** → embedded as TDD steps in every backend task
- **Spec §12 rollout** → Task 17

No spec gaps. No "TBD", "TODO", "similar to". Each task has runnable code or commands.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-26-shadow-customer-records.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task. I review between tasks. Fast iteration, isolated context per task, easier to catch regressions early.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`. Batch execution with checkpoints for review. All work happens in this conversation; you watch live but the context window can fill quickly given the plan's size.

Which approach?
