# Shadow Customer Records — Design Spec

**Status:** Draft, awaiting user review
**Author:** Claude (brainstormed with joycg, 2026-05-26)
**Decision:** Single PR (Approach B), implementation skill = `writing-plans` next

---

## 1. Motivation

Today's admin "Add Participant" form posts to `POST /api/v1/users`, but that endpoint doesn't exist yet (a previous shipment in this session added one that creates the user with a random password and sends a reset email — that flow is wrong for this use case).

The actual use case is **customer data migration from a previous website**: the admin needs to import existing customers as records, *without* sending them anything, *without* requiring them to do anything. Those imported records should then:

- Match incoming guest orders by email or phone (silent attach to the record)
- Be claimable by the customer if they later sign up
- Coexist with auto-created records from any guest checkout (so the customer DB grows from all orders, not just admin imports)

Additionally:
- Multiple admins will work in the panel (`createdBy` audit field useful)
- Customers commonly change phone numbers; the old number should be preserved so a future guest checkout from the old number still matches

## 2. Goals

- Admin creates a customer record in one click; no password, no email sent.
- Admin can bulk-import customers via CSV upload (scales to large CSVs).
- Guest checkouts auto-attach to an existing customer record on email or phone match (regardless of whether the record is shadow or claimed).
- Guest checkouts without a matching record auto-create a new shadow record (so every customer who ever orders has a CRM presence).
- Imported customers can self-register with the same email and have their record auto-claimed (password set, profile updated, prior orders inherited).
- Login attempts on a shadow record get a clear "please sign up" message.
- Customer phone history is preserved when a user provides a new phone at checkout — old phones stay searchable for matching.

## 3. Non-Goals (Deferred to Follow-up Specs)

- **Order history import**: bringing along the customer's past order data from the old site (CSV columns for order refs, items, dates, totals, status mapping, product-by-SKU resolution). This is a substantial second system and deserves its own design conversation.
- **Manual customer merge tool**: admin-initiated merge of two existing customer records. Not in scope; admin works around by deleting one and importing the other.
- **Phone normalization across countries**: design assumes Bangladesh phone numbers only (BD-only commerce). `+880` prefix stripping is sufficient.
- **Possible-match review queue with phone-only candidates**: user decision is "match if email OR phone alone; name is informational" — no review UI needed.

## 4. Data Model

### 4.1 User schema changes

```prisma
model User {
  // ... existing fields preserved ...

  passwordHash  String?       // CHANGED: was required. null = shadow account.
  claimedAt     DateTime?     // NEW. null = shadow. set = real user (registered/claimed).
  createdBy     String?       // NEW. admin user.id (null = auto-created from guest checkout).
  phones        String[]      // CHANGED: was `phone String?`. Always an array. phones[0] = newest.
  // phone        String?     // DROPPED — migration moves the value to phones[0].

  // ... rest preserved ...

}
```

The required GIN index on `phones` is created in §4.3 via raw SQL (Prisma's array-index DSL varies by version; raw SQL in the migration is the reliable path). The performance requirement is that `WHERE phones && ARRAY[...]` and `WHERE 'X' = ANY(phones)` queries use the index.

### 4.2 User state matrix

| `passwordHash` | `claimedAt` | `createdBy` | Meaning |
|---|---|---|---|
| `null` | `null` | non-null | Admin-imported shadow record |
| `null` | `null` | `null` | Auto-created from a guest checkout |
| set | set | non-null | Admin-imported, claimed by self-register |
| set | set | `null` | Standard self-registered customer |

### 4.3 Migration plan (single Prisma migration)

```sql
-- 1. Add new nullable columns
ALTER TABLE "User" ADD COLUMN "claimedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "User" ADD COLUMN "phones" TEXT[] NOT NULL DEFAULT '{}';

-- 2. Backfill: existing users are all "claimed" (they have passwords); copy phone → phones[]
UPDATE "User"
  SET "claimedAt" = COALESCE("createdAt", NOW())
  WHERE "claimedAt" IS NULL AND "passwordHash" IS NOT NULL;

UPDATE "User"
  SET "phones" = ARRAY["phone"]
  WHERE "phone" IS NOT NULL AND "phones" = '{}';

-- 3. Relax passwordHash, drop old phone column
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
ALTER TABLE "User" DROP COLUMN "phone";

-- 4. Index for phone-array lookups
CREATE INDEX "User_phones_gin_idx" ON "User" USING GIN ("phones");
```

Migration is additive + value-preserving — zero data loss. The `passwordHash IS NULL` state will only exist for new shadow records going forward.

## 5. API Changes

### 5.1 `POST /users` (refactor existing)

**Auth**: Admin only (`RolesGuard` + `Roles(ADMIN, SUPER_ADMIN)`)

**Request**:
```json
{
  "email": "ada@example.com",
  "firstName": "Ada",
  "lastName": "Lovelace",
  "phone": "01776902711"
}
```
`email` and `firstName` required; `lastName` and `phone` optional.

**Behavior**:
- Normalize email (lowercase, trim) and phone (digit-only, strip leading `880`).
- Check for existing user with that email:
  - **Shadow exists**: update the shadow with any non-empty values from the request (fill-blanks semantics; admin-provided fields override only empty existing fields). Return updated record. (This is rare — admin re-adding an unclaimed email.)
  - **Claimed user exists**: return `409 Conflict` `"A user with this email already exists."` — do not modify.
  - **No existing user**: create new shadow with `passwordHash = null`, `claimedAt = null`, `createdBy = currentAdmin.id`, `phones = [normalizedPhone]` (or `[]` if no phone).
- Returns the user record (without passwordHash).

### 5.2 `POST /users/bulk` (new)

**Auth**: Admin only.

**Request**: `multipart/form-data` with one field `file` (CSV).

**Expected CSV format**:
```
email,firstName,lastName,phone
ada@example.com,Ada,Lovelace,01700000000
grace@example.com,Grace,Hopper,
```
- Header row required.
- Columns matched by header name (order in file doesn't matter).
- `email` and `firstName` required per row.
- BOM and common encodings (UTF-8, UTF-16) auto-detected.

**Behavior**:
- **Two-pass strategy** (resolved during audit):
  - **Pass 1**: read entire file into memory; build a `Map<emailLower, RowRecord>` applying first-row-wins fill-blanks merging within the file. Reject the upload entirely if file size > 20 MB (caps practical row count around 100k).
  - **Pass 2**: bulk-insert the deduped map in batches of 100 via `prisma.user.createMany({ skipDuplicates: true })`. Per-batch transactions so a mid-import failure doesn't lose earlier batches.
- For each row, normalize email + phone.
- Per-row outcome: `created` / `skipped_existing` / `skipped_duplicate_within_upload` / `error`.
- Multipart upload limit raised to 20 MB on this endpoint specifically (default body limit is 1 MB and applies to JSON only).

**Response**:
```json
{
  "created": 47,
  "skipped_existing": 3,
  "skipped_duplicate_within_upload": 1,
  "errors": [
    { "row": 12, "reason": "Invalid email: 'ada@'" },
    { "row": 24, "reason": "Missing firstName" }
  ]
}
```

### 5.3 `POST /auth/register` (modify)

When the submitted email matches an existing **unclaimed** User (`claimedAt IS NULL`, `deletedAt IS NULL`):

- Update the existing record:
  - `passwordHash = bcrypt(dto.password)`
  - `claimedAt = NOW()`
  - `firstName` and `lastName` overwritten by request values (customer's own input wins over admin-imported data)
  - `phones[]` updated by **prepending the new phone** if it's not already present in the array; existing imported phones are preserved (dedup-prepend semantics)
  - `tokenVersion` incremented defensively
- Trigger normal verification email
- Return the same shape as a fresh registration

When the email matches an existing **claimed** User: return current behavior (`409 Conflict`).

### 5.4 `POST /auth/login` (modify)

If the matched user has `passwordHash IS NULL`, return `401 Unauthorized` with body:
```json
{ "message": "This account hasn't been set up yet. Please sign up with this email to set your password." }
```
(Email enumeration risk accepted per user decision — UX clarity wins.)

### 5.5 `POST /auth/forgot-password` (modify)

If the matched user is a shadow (`passwordHash IS NULL`), return:
```json
{ "message": "This email isn't fully registered yet. Please sign up to complete your account." }
```
Do NOT send a reset email. (Replaces my originally-shipped behavior of silently doing nothing — user wants a clear signal.)

For real claimed accounts, behavior is unchanged.

### 5.6 Removed: my previously shipped onboarding-email flow

The `createCustomerAsAdmin` method in `users.service.ts` that generates a random password and triggers `forgotPassword`-style email is **removed** as part of this change. The endpoint stays at `POST /users` but the body becomes the simpler "create record, no email" version above.

## 6. Guest Checkout Match-or-Create

`OrdersService.createOrder(userId=null, dto)` — modified flow when the caller is anonymous:

```
1. normalize guestEmail → emailLower
   normalize guestPhone → phoneNormalized

2. Find candidate User:
     candidate = User.findFirst({
       where: {
         deletedAt: null,
         OR: [
           { email: emailLower },
           { phones: { has: phoneNormalized } }
         ]
       },
       orderBy: { createdAt: 'asc' }  // oldest wins on ties
     })

3. If candidate found:
     - `order.userId = candidate.id`
     - If candidate is **CLAIMED** (claimedAt IS NOT NULL):
         - Attach order ONLY. Do NOT modify the candidate user's profile.
         - This prevents spoofers from injecting their phone/name into a real user's account via fake guest checkout.
     - If candidate is **SHADOW** (claimedAt IS NULL):
         - Attach order.
         - Fill-blanks update: any empty profile fields on the shadow get filled by the guest's input (firstName, lastName, phones[]).
         - Phone append: if guestPhone is not already in `phones[]`, prepend it (dedup-prepend, respecting 20-phone cap).
     - Log via Pino: `logger.info({ orderId, candidateId, matchedOn: 'email' | 'phone' | 'both', nameMatched: bool, candidateState: 'shadow' | 'claimed' }, 'guest-checkout matched user')`

4. If no candidate:
     - Create new shadow User in the same transaction:
         - `email = emailLower`
         - `firstName = guestName.trim()` (full name goes into firstName, no auto-splitting)
         - `lastName = ''`
         - `phones = [phoneNormalized]`
         - `passwordHash = null`
         - `claimedAt = null`
         - `createdBy = null`
     - **Address is NOT copied** to the User's addresses table — the order's `shippingAddress` snapshot is sufficient. The user can save addresses later when they claim and use the account UI.
     - `order.userId = newShadow.id`

5. Create order + items as today (with userId now always set)
```

**Race handling**: wrap the lookup + insert in `prisma.user.upsert({ where: { email }, ... })`. If two simultaneous guest checkouts both miss and try to insert, the unique constraint serializes them; the loser falls through to step 3.

**Claimed-account matching IS performed** (the order attaches), but the profile is read-only from the guest checkout's perspective. This decouples "convenience of attaching forgot-to-login orders" from "risk of mutating spoofed accounts." Reversible by removing the claimed-match arm of step 3 if abuse appears.

## 7. Phone Storage & Multi-Phone

### 7.1 Schema
`phones: String[]` — array, ordered newest-first. `phones[0]` is the "current" phone for any UI that needs a single value.

**Cap: max 20 phones per user.** When prepending the 21st phone, drop `phones[20]` (oldest). Prevents unbounded growth from churn or abuse.

### 7.2 Normalization & validation

```
normalize(phone):
  strip every non-digit
  if result starts with "880" AND length > 11: drop the "880"
  return result

validate(normalizedPhone):
  reject if length not in [10, 11]
  reject if any non-digit character (defensive — should never happen after normalize)
  accept
```

Validation is **BD-strict**: accepts only 10-11 digit numbers. `+880 1776 902711`, `01776-902-711`, and `01776902711` all pass. Foreign phones rejected (when international expansion happens, this validator is the single point to update).

Storage: normalized form. Display: storage value (no fancy formatting). Future enhancement could format for display.

### 7.3 Checkout autofill (web + admin order placement)

- If signed in and `user.phones.length > 0`: pre-fill the checkout phone input with `user.phones[0]`.
- Input is editable. If the customer submits a phone that doesn't match `user.phones[0]`:
  - Normalize the input. Validate (BD-strict 10-11 digits). Reject with inline error if invalid.
  - If normalized form is NOT already in `user.phones`: prepend it (becomes new `phones[0]`), drop `phones[20]` if cap exceeded.
  - If it IS already present (anywhere in the array): move it to position 0, no length change (avoid duplicates while still updating recency).
- If signed in and `user.phones.length === 0`: input is blank but required.

### 7.4 Codebase migration

Every read of `user.phone` needs to become `user.phones[0]`. Known locations (non-exhaustive — implementation plan will be authoritative):

- `apps/api/src/modules/auth/auth.service.ts` (register, register response, getProfile response)
- `apps/api/src/modules/users/users.service.ts` (getProfile, updateProfile, getAllUsers select)
- `apps/api/src/modules/orders/orders.service.ts` (getAllOrders user select — recently changed)
- `apps/api/src/modules/users/users.dto.ts` (`UpdateProfileDto.phone` → `UpdateProfileDto.phones?: string[]` or keep single-string semantics with server-side append)
- `apps/admin/app/(dashboard)/orders/page.tsx` (export columns — recently changed)
- `apps/admin/app/(dashboard)/customers/page.tsx` (display + Add Participant form)
- `apps/web/app/account/**` (account profile UI)
- `apps/web/app/checkout/**` (checkout form)

`UpdateProfileDto` design choice: keep accepting a single `phone: string` field (admin/UI keeps the simple input); server-side appends to `phones[]` on save. This avoids needing the storefront to manage array semantics.

## 8. Admin UI Changes

### 8.1 Customers page

**"Add Customer" modal** (renamed from "Add Participant"):
- Form fields unchanged: First Name, Last Name, Email, Phone (Optional)
- Helper text: *"Creates a customer record immediately. No password or email is set — the customer can later sign up with this email to claim the account."*
- Submit button: "Add Customer"
- On 409 (claimed user exists): show inline error *"This email is already registered. The customer can update their own profile by signing in."*

**"Import CSV" button** (new, in toolbar):
- Opens a modal with file picker, CSV format example, and required-columns documentation.
- After upload, displays a result panel:
  - `✓ Imported N new customers`
  - `⚠ Skipped M (already in your system)`
  - `⚠ Skipped K (duplicate within upload)`
  - `✗ J errors:` per-row reasons
  - `[Download error report]` button — downloads a CSV of just the error rows for the admin to fix and re-upload

**Customer rows in table**: NO visible distinction between shadow and claimed (per user decision). Same row treatment.

### 8.2 Order page (admin)

No changes from this spec. The previously shipped order export (`2bddc60`) already shows customer/email/phone for orders — those now naturally show data for the auto-attached shadow customers too.

## 9. Web (Storefront) Changes

### 9.1 Checkout

- Phone field: pre-fill `user.phones[0]` if signed in. Required field for all checkout flows (guest and signed-in). Confirm guest checkout already requires phone (it does per current API — `guestPhone` required).
- Address: already required for both flows; no change.
- On submit (signed-in user): if phone changed, append to `phones[]` server-side (handled in `UpdateProfileDto` save path or directly in order create).

### 9.2 Account page

- Phone field displays `user.phones[0]` with an editable input.
- "Previous numbers" small disclosure section showing `user.phones.slice(1)` read-only — so the customer can see what's been retained.
- Edit + save updates `phones[0]` (server prepends, keeps the prior value as `phones[1]` and so on).
- "Remove" link next to each prior phone (deletes from array) — optional v1 feature, can defer.

### 9.3 Register page

No UI changes — auto-claim happens server-side transparently. Customer registers normally with their email; if it matches a shadow, they get claimed seamlessly.

### 9.4 Login page

If login fails with the "account not set up" message (HTTP 401 with the specific shadow message), show a friendly inline message: *"This email isn't fully registered yet. Please sign up to complete your account."* with a link to `/register`.

## 10. Edge Cases & Guards

| # | Scenario | Handling |
|---|---|---|
| 1 | Two simultaneous guest checkouts, same email | `prisma.user.upsert` serializes; second one falls through to attach. |
| 2 | Dup email within same CSV upload | First row wins. Later rows with same email fill blanks only. Reported as `skipped_duplicate_within_upload`. |
| 3 | Admin adds email that already has a claimed account | 409 Conflict, skip silently in CSV results as `skipped_existing`. |
| 4 | Guest checkout email/phone matches a claimed account | Attach the order; do NOT modify the claimed user's profile. Spoofer can produce a phantom order in someone else's account history but cannot inject contact info. Support workflow: admin sets `order.userId = null` to revert to guest order. |
| 5 | Login attempt on shadow | 401 with helpful message (per user decision). Mild email enumeration accepted. |
| 6 | Forgot-password on shadow | Friendly "please sign up" message; no email sent (per user decision, reversing earlier silent behavior). |
| 7 | Self-register matches shadow | Auto-claim: set password, claimedAt, overwrite firstName/lastName/phones[0], increment tokenVersion, send verification email. |
| 8 | Admin deactivates a shadow | Existing soft-delete via `deletedAt`. No change. |
| 9 | Phone normalization: international or BD prefix | Strip non-digits + strip leading `880`. BD-only assumption documented. |
| 10 | CSV with weird encoding | Auto-detect BOM/UTF-8/UTF-16 via robust parser; reject with clear error if unparseable. |
| 11 | Bulk import partial failure | Per-batch transactions (size 100). Earlier batches persist; admin re-uploads with skip-duplicates. |
| 12 | Phone collision (two unrelated people, same phone) | First user with that phone in the array wins on lookup (`orderBy createdAt asc` in match query). Rare in BD-only context; acceptable risk per user direction. |
| 13 | Guest checkout phone matches multiple shadow records | First (oldest) matching record wins per `orderBy: { createdAt: 'asc' }`. Logged for ops visibility. |

## 11. Testing Strategy

### 11.1 Backend unit tests (Jest)

- `UsersService.createCustomerAsAdmin`:
  - Creates shadow with null password
  - Returns 409 on claimed-email duplicate
  - Fill-blanks update on shadow-email re-add
  - Sets `createdBy` from authenticated admin context
- `UsersService.bulkImport`:
  - Parses standard CSV
  - Handles BOM/UTF-16
  - First-row-wins on within-CSV duplicates
  - Reports skipped vs created vs errored correctly
  - Stream-parses (test with large file fixture, assert memory bound)
- `AuthService.register`:
  - Auto-claim path: matching shadow → updates passwordHash + claimedAt
  - Email overwrite on register: incoming firstName/lastName/phones[0] override shadow values
  - Verification email triggered post-claim
- `AuthService.login`:
  - Shadow account → 401 with helpful message
  - Claimed account → existing behavior
- `AuthService.forgotPassword`:
  - Shadow account → returns "please sign up" message; no email send (assert email mock not called)
- `OrdersService.createOrder` (guest path):
  - Email match (shadow candidate) → attach + fill-blanks update
  - Phone match (shadow candidate, different email) → attach + fill-blanks update
  - Email match (CLAIMED candidate) → attach ONLY; assert profile (firstName, phones, etc.) NOT mutated
  - Phone match (CLAIMED candidate, different email) → attach ONLY; assert profile NOT mutated
  - No match → create new shadow + attach; assert no Address row created (only order.shippingAddress snapshot)
  - guestName "Sakib Al Sajid" on new shadow → assert firstName == "Sakib Al Sajid", lastName == ""
  - New phone on signed-in user → prepended to phones[]; existing phones preserved
  - 21st phone appended → assert phones[20] dropped (cap enforcement)
  - Same phone re-submitted at checkout → assert deduped; position 0 only
- Phone normalization & validation:
  - "+880 1776 902711" → "01776902711"
  - "01776-902-711" → "01776902711"
  - "abc" → reject (invalid)
  - "01" (length 2) → reject (length out of bounds)
  - "12345678901234567" → reject (length > 11)

### 11.2 Backend integration tests

- Full flow: admin POSTs `/users` → guest places order with matching email → assert `order.userId == created user id`.
- Full flow: admin imports CSV with N rows → guest places order → matches → customer self-registers → all orders show in their `/users/me/orders`.

### 11.3 Frontend tests

- Admin Add Customer modal: submits and shows new row.
- Admin Import CSV modal: uploads a fixture CSV, asserts result panel renders all four buckets correctly.
- Account page: phones display correctly when array has 0, 1, or 2+ entries.
- Checkout: pre-fill works; editing phone and submitting appends to array (assertion via API mock).

### 11.4 Migration tests

- Local: run migration against a seeded DB with mixed users (some with phone, some without). Assert all existing users get `claimedAt` set, `phones` populated, no rows lost.
- Production prep: take a snapshot of the live DB schema and run the migration in a Render preview branch before applying to production.

## 12. Migration & Rollout

**Deploy strategy: single atomic deploy + brief downtime accepted.** Resolved during audit. Denimisia's traffic level (low, BD-only e-commerce) makes the proper three-step zero-downtime rollout overkill. The Render rolling restart window (~30-60s) is acceptable.

1. **Local-only first**: implement schema migration + backend changes, run full test suite, verify locally with seeded data.
2. **Vercel preview deploy of admin**: lets reviewer test the Add Customer / Import CSV / Account page UI before production.
3. **Render preview branch for API**: applies the migration to a copy of production data via Render's preview branch feature; verify against a real data snapshot.
4. **Production**: merge to main. Render auto-deploys API (runs migration). Vercel auto-deploys admin + web. During Render's rolling restart, some requests may 502 — acceptable for current traffic level.
5. **Rollback plan**: schema migration drops the `phone` column (destructive). To rollback after deploy, we'd need to re-add `phone String?` and backfill from `phones[0]`. Recoverable but requires a manual SQL step. Keep a snapshot of the DB taken just before migration for ~24h post-deploy in case rollback is needed.
6. **Critical**: the schema change is NOT backward-compatible (drops `phone`). Older code reading `user.phone` will get errors. This means admin/web frontends MUST be updated to consume `phones[]` from API responses before/during the same deploy window — not after. Since they reach data via API endpoints that we control, the actual coupling is at the API service boundary, which is handled by deploying together.

## 12.5 Risks (documented, accepted)

These are risks we knowingly accept rather than block on:

1. **Phone number reassignment**: BD telcos recycle phone numbers when customers churn. A new customer with a recycled number would auto-match to the previous holder's record. Worst case: stranger's order shows in old customer's account when they eventually claim it. Mitigation: admin can manually detach via the support workflow noted in §10 row 4. Future enhancement: a "reassign / disown phone" admin action.

2. **Long-lived shadow records**: shadows created from guest checkouts may accumulate over years. Storage cost is negligible; pagination on `/users` listing handles UI scale. GDPR right-to-be-forgotten requests work via existing `DELETE /users/:id` soft-delete. No additional cleanup needed for v1.

3. **Email spoofing of claimed accounts**: a malicious guest could enter someone else's email at checkout; the order attaches to the victim's account (showing a phantom order in their history). Mitigations: the spoofer pays for the order (no benefit to attacker), the victim can contact support, admin detaches via the support workflow. Accepted because the convenience of attaching forgot-to-login orders is judged more valuable than the rare abuse case.

4. **Phone-only matching false positives**: families share phones, especially household landlines. Two unrelated people on the same phone would match each other's records. Mitigation: name is logged at match time so audit-trail analysis can spot suspicious matches; phone-only matches are flagged in Pino logs for ops visibility.

5. **Email enumeration via shadow login error**: the helpful "this account hasn't been set up yet" message reveals shadow account existence. Accepted because the UX win (clear "please register" guidance) is judged more valuable than enumeration-resistance for a small BD e-commerce site.

## 13. Deferred Work

The following are EXPLICITLY out of scope for this spec, will get their own design conversation:

- **Order history import (LR-IMP-001)** — bringing the customer's past order data from the old site. Requires its own CSV/JSON shape design, product mapping strategy, status translation, currency/date handling. Attach point: this spec's shadow records.
- **Manual customer merge** — admin selects two existing records, picks which fields win, merges orders + addresses. Useful when two shadows turn out to be the same person.
- **Multi-country phone normalization** — when Denimisia expands beyond BD.
- **Phone history management UI on account page** — v1 just displays prior phones; v2 could add labels ("home", "work") and primary selection.
- **Audit trail for shadow merges** — when guest checkout attaches/updates a claimed user, log it for traceability. Possible follow-up.

## 14. Open Questions for Reviewer

(To be resolved before implementation plan is written.)

- None — all open items resolved during the brainstorm and the subsequent audit pass (2026-05-26).

## 15. Changelog

- **2026-05-26 21:30 BDT** — Initial draft committed (`28e438e`).
- **2026-05-26 22:00 BDT** — Audit pass: resolved critical issues 1-3 (claimed-account profile protection; CSV two-pass strategy; deploy ordering) and gaps 4-9 (no address copy on shadow create, full guestName in firstName, 20-phone cap, BD-strict phone validation, dedup-prepend on claim, Pino-only match logging). Added §12.5 Risks section.

---

**Approval gate:** Reviewer (joycg) please read this spec and either approve or request changes before I invoke the writing-plans skill to produce the implementation plan.
