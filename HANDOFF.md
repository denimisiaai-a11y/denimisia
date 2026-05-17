# HANDOFF — Admin Multi-Select & Marketing Ops System

**Date written:** 2026-05-09
**Last updated:** 2026-05-16 (Slice 0 shipped)
**Project:** Denimisia
**Operating mode:** Claude does ALL coding. No Kimi/Codex handoff for build work.
**Next action:** Start Slice 1 of Phase 1 (reusable primitives + first end-to-end vertical: POST /products/bulk/feature).

---

## Read these first (in order)

1. **This file** (current state, next action, hard rules)
2. **`ClaudeXDenim.md`** — scroll to last section `[2026-05-09] Admin Multi-Select & Marketing Operations System — DESIGN`. This is the full design with audit fixes applied.
3. **`Arena.md`** — scroll to entry `[A-046]`. This is the Kimi-style directive (now serves as design record since Claude builds, not Kimi).
4. **`packages/database/prisma/schema.prisma`** — actual Role enum + SectionCuration/SectionProduct (Phase 2 extends these).
5. **Auto-memory files** — `feedback_no_ai.md`, `feedback_modular_code.md`, `feedback_claude_builds.md`, `reference_work_reports.md` (under `~/.claude/projects/c--Users-joycg-denimisia/memory/`).

---

## Where we are

Long brainstorm + 3 audit rounds (architect agent + my own) on a 4-phase admin marketing system. All design + fixes locked in. Two files on disk hold the spec. Just told to switch from Kimi-as-builder to Claude-as-builder. Ready to start coding the foundation.

**Project shape:**

| Phase | Scope | Endpoints | Estimate |
|---|---|---|---|
| 1 | Multi-select foundation + 36 bulk actions across Products/Bundles/Collections/Categories/Reviews/Orders/Customers | 33 | ~2.5 weeks |
| 1.5 | 4 irreversible ops (refund / cancel / message / GDPR) + idempotency force-release | 5 | ~1 week |
| 2 | New-launches surface (extends existing curation module — DO NOT rename SectionCuration/SectionProduct) | 5 | ~5 days |
| 3 | Offers/Promotions hub with OfferTransitionOutbox saga | 8 | ~7 days |
| 4 | Ad creator (templates + manual copy ONLY, no AI) | 7 | ~10-12 days |
| **Total** | | **58 endpoints, 3 new pages, 4 page extensions** | **~6.5 weeks** |

---

## Hard rules (non-negotiable)

1. **No AI features in the product.** No LLMs, no embeddings, no AI-generated copy. Phase 4 is templates + manual copy only.
2. **No AI-stylistic markers** in code, comments, commits, docs (no "delve" / "leverage" / "robust" / "comprehensive" / em-dash sentence-joins / emoji sprinkling / "I've created" phrasing).
3. **Strict modular architecture.** Removing one folder + one registry line = capability gone, nothing else broken. No god-components, no god-endpoints.
4. **Every action is a visible button at all times.** Disabled-with-tooltip on RBAC denial or `isEnabled` false. Never vanishing. Never overflow dropdowns. Wraps on narrow viewports.
5. **English only.** No i18n.
6. **Existing 5-role RBAC** with explicit weights: `CUSTOMER=0, SUPPORT_STAFF=10, MANAGER=20, ADMIN=30, SUPER_ADMIN=40`. `hasRole(actor, required) = WEIGHTS[actor] >= WEIGHTS[required]`. Add the weight function in `apps/api/src/common/decorators/roles.decorator.ts`.
7. **Reports go in ClaudeXDenim.md + Arena.md** (NOT `docs/superpowers/specs/`). Future Arena entries are A-047+ and document what got built (not Kimi handoffs).

---

## Locked defaults

| # | Decision | Behavior |
|---|---|---|
| 1 | Selection across filter changes | Survives — pill shows "X of Y selected (Z hidden by filter)" |
| 2 | Undo on destructive actions | 30s undo on soft-delete + status-archive; immediate for others |
| 3 | Concurrent admin protection | Optimistic via versionMap watermarks → 409 with diff on conflict |
| 4 | Cascading delete | Soft-delete product, leave order/cart/wishlist refs intact |
| 5 | Cross-page bulk | Selection persists across pagination; "Select all matching filter" freezes the ID set at click time, survives subsequent filter changes |
| 6 | Idempotency concurrent replay | Second caller blocks until first completes, receives cached result |
| 7 | Undo semantics | Immediate commit + restore from soft-delete (NOT delayed execution) |
| 8 | Auto-escalation at sel≥250 | Modal flow escalates; button itself stays static |

---

## What was JUST decided (this session, the new things)

- **Claude builds everything.** No Kimi handoff. Arena A-046 is a design record now, not a build directive.
- **All 16 spec audit fixes applied:** Role weights table, canonical controller template inlined in both docs, decorator stack locked to 5 interceptors + inline MaxItems, endpoint count corrected to 58, send-tracking undo semantics clarified, GDPR cap 50/call, all `BST` replaced with `Asia/Dhaka (UTC+6)`, rate-limit table per endpoint family, test pyramid math fixed (262 unit / 70 integration / 18 E2E), outbox naming convention `{Domain}Outbox`, R2 `referenced` flag definition, ESP throttle constants extracted.
- **External dependencies** captured (boss owns these, start NOW in parallel with Phase 1 build): FB Business Manager verification (2-6 weeks), FB App Review for `ads_management`, System User token, Stripe/bKash/SSLCommerz credentials, SendGrid/SMS credentials, legal review of GDPR pseudonymization approach.

---

## Slice 0 — Foundation — SHIPPED 2026-05-16

See Arena A-047 and ClaudeXDenim section `[2026-05-16]` for the full
file-by-file report. Headline:

  - Prisma migration written at
    `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/`.
    **NOT yet applied to live DB** — apply via `pnpm prisma migrate dev`
    at the start of Slice 1 so the first endpoint can read/write the
    new BulkOperationOutbox table.
  - All cross-cutting infrastructure in place under
    `apps/api/src/common/` (decorators, guards, interceptors, pipes,
    DTO, BulkModule).
  - 59/59 Slice 0 unit tests passing. Matrix test locks the decorator
    stack order.
  - Type-check + lint clean on Slice 0 files.

What's still TODO from the original Slice 0 list:
  - Hand-crafted dummy controller smoke test (intent + outcome rows in
    AuditLog). Deferred to Slice 1 where the first real endpoint
    exercises the stack against live DB + Redis.

## Slice 0 — Foundation (original spec, kept for reference)

**Goal:** prove the cross-cutting framework end-to-end so subsequent slices are pure copy-paste.

### What ships in Slice 0

1. **Prisma migration** adding:
   - `deletedAt: DateTime?` on Product, Bundle, Collection, Category, Review (with partial indexes `WHERE deletedAt IS NULL`)
   - `BulkOperationOutbox` table (id, adminUserId, endpoint, action, payload JSONB, undoToken, state, expiresAt, createdAt; index on state+expiresAt)

2. **`apps/api/src/common/decorators/roles.decorator.ts`** — add the weight constants + `hasRole()` function.

3. **`apps/api/src/common/decorators/bulk-operation.decorator.ts`** — composite decorator applying `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(...)` + interceptor stack in locked order: `RateLimit → AuditIntent → Transaction → AuditOutcome`. Inline `maxItems` validation before any interceptor runs.

4. **Interceptors** under `apps/api/src/common/interceptors/`:
   - `rate-limit.interceptor.ts` — Redis-backed sliding window per `{adminUserId}:{endpoint}` with 429 + `Retry-After` headers
   - `audit-intent.interceptor.ts` — emits `<event>.intent` audit row before service runs
   - `transaction.interceptor.ts` — wraps Prisma in `$transaction` if `transactional: true`
   - `audit-outcome.interceptor.ts` — emits `<event>` audit row with success/failure breakdown after service returns

5. **`apps/api/src/common/dto/bulk-operation.dto.ts`** — `BulkBaseSchema` (Zod) + `BulkOperationResult` envelope type.

6. **`apps/api/src/common/pipes/zod-validation.pipe.ts`** — generic Zod validation pipe used by all bulk controllers.

7. **Tests:**
   - `bulk-operation.decorator.matrix.test.ts` — the matrix test asserting interceptor order via failure-mode assertions (each failure: auth missing / role wrong / rate-limited / maxItems exceeded / validation fails / tx rolls back → which downstream interceptors did or did not run)
   - `roles.decorator.test.ts` — `hasRole` weight comparisons
   - Each interceptor's own unit test

### What does NOT ship in Slice 0

- No actual bulk endpoint yet (that's Slice 1)
- No frontend primitives yet (Slice 1)
- No action files yet (Slice 1)

### Slice 0 exit criteria

- All new tests pass
- Type-check clean
- Lint clean
- Decorator stack ordering verified by matrix test
- Migration runs forward and rollback cleanly against existing dev DB
- Audit log shows intent + outcome events for a hand-crafted dummy controller stub (you can delete the stub after verification)

### Files Kimi/Claude should NOT touch in Slice 0

- `apps/api/src/modules/auth/` — auth stack stays as-is
- `apps/api/src/modules/users/` — staff/user management out of scope
- `apps/admin/app/(dashboard)/settings/` and `system/` — settings stays manual
- Any existing module's service or controller — Slice 0 is pure common-infrastructure addition

---

## After Slice 0 ships

Build order for remaining Phase 1 slices:

- **Slice 1** — Reusable primitives (`useBulkSelection`, `MultiSelectTable` adapter, `BulkActionBar`, `confirmDialog`, `showToast`, dispatcher) + ONE end-to-end vertical: `POST /products/bulk/feature` + `bulk-feature-toggle/action.ts` wired into Products page. Proves the full stack.
- **Slice 2** — Reversible writes: `POST /products/bulk/price` + `POST /products/bulk/status` + their modals.
- **Slice 3** — Destructive: soft-delete + outbox + 30s undo toast end-to-end.
- **Slice 4** — Remaining Products actions (tags, stock, export, discount-from-selection, bundle-from-selection, banner-from-selection, add-to-featured).
- **Slice 5** — Fan out to other pages: Bundles → Collections → Categories → Reviews → Orders → Customers.
- **Slice 6** — Cross-cutting: Pending Ops page, audit log viewer extensions, e2e + a11y test suite.

Then Phase 1.5 → 2 → 3 → 4 in order.

---

## To resume next session

Open this file first. Read:
  1. The `Slice 0 — Foundation — SHIPPED` section above (what landed)
  2. `Arena.md` entry `[A-047]` for the file-by-file detail
  3. `ClaudeXDenim.md` section `[2026-05-09] Admin Multi-Select…` for
     the full Phase 1 design (Slice 1 follows the same controller
     template documented there)

Then say: **"Continue Slice 1 of Phase 1."**

The new session should:

  1. Apply the Slice 0 migration: `cd packages/database && pnpm prisma migrate dev`
     (the migration file `20260516120000_bulk_operations_foundation` is
     waiting in `packages/database/prisma/migrations/`).
  2. Re-run `pnpm prisma generate` if Windows had the DLL locked last
     time.
  3. Build Slice 1: reusable frontend primitives (`useBulkSelection`,
     `MultiSelectTable` adapter, `BulkActionBar`, `confirmDialog`,
     `showToast`, dispatcher) + ONE end-to-end vertical:
     `POST /products/bulk/feature` + `bulk-feature-toggle/action.ts`
     wired into the admin Products page. This proves the full stack
     against live DB + Redis.

If anything in this handoff is unclear, re-run the brainstorm flow
(Skill: `superpowers:brainstorming`) but bias toward "we already
designed this, just verify the design holds" — don't re-litigate
decisions already locked.
