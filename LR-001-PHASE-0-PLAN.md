# LR-001 Phase 0 — Plumbing — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Take Denimisia from "code mostly exists, ~50 files dirty in working tree, schema migration unapplied" to "every app boots clean, migration applied, plumbing in place" so Phase 1 (API hardening) can start against a known-good baseline.

**Architecture:** Sequential, mostly-mechanical work. No new business logic. The plan reads the working tree, commits it as a checkpoint, applies a Prisma migration to live Supabase (with snapshot + rollback prep), wires three plumbing concerns (`@nestjs/swagger`, image pipeline domains, Resend), and verifies all three apps boot cleanly.

**Tech Stack:** pnpm workspaces + Turborepo, NestJS 11 + Prisma 5 (apps/api), Next.js (apps/web, apps/admin), Postgres on Supabase, Redis, Cloudflare R2 via `@aws-sdk/client-s3`, Resend (to be wired), Playwright at root.

**Source of truth:** `ClaudeXDenim.md` section `[2026-05-17] LR-001 — Launch Readiness Operational Sweep — DESIGN` (including its `Amendments after plan-eng-review` subsection) and `Arena.md` entry `[A-048]`. Phase 0 exit criteria from those docs:

> Every app boots without error; migration applied; Resend test email received; R2 round-trip works.

---

## File structure

This plan touches the following files. Each is listed with its responsibility.

**Modified:**
- `apps/api/src/main.ts` — wire `@nestjs/swagger` for `/api/docs`.
- `apps/web/next.config.js` — add R2 + Supabase image hosts to `images.remotePatterns`.
- `apps/admin/next.config.js` — same.
- `apps/api/.env.example` — extend with Resend + image pipeline keys.
- `apps/api/src/app.module.ts` — register `EmailModule`.

**Created:**
- `apps/web/.env.example` — public + private env contract.
- `apps/admin/.env.example` — public + private env contract.
- `apps/api/src/modules/email/email.module.ts` — module shell.
- `apps/api/src/modules/email/email.service.ts` — Resend send wrapper + verification template hook.
- `apps/api/src/modules/email/email.service.spec.ts` — unit test for the wrapper.
- `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql` — rollback for the bulk-operations migration.

**Read-only references** (do not modify in Phase 0):
- `packages/database/prisma/schema.prisma` — variant model verification (Task 5).
- All ~50 WIP-modified files — AI-stylistic-marker scan (Task 2).
- `apps/api/src/modules/uploads/` — used for R2 round-trip test (Task 16).

---

## Pre-flight

The pre-flight ritual from `Arena.md A-048`. Run before Task 1.

```powershell
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*denimisia*' -or ($_.CommandLine -like '*pnpm*' -and ($_.CommandLine -like '*dev*' -or $_.CommandLine -like '*start:dev*')) } | Select-Object ProcessId, CommandLine | Format-List
```

If more than one nest watcher per running dev session shows up, kill them all with `Stop-Process -Id <pid> -Force`. Project memory: `project_dev_server_zombies`.

---

## Task 1: Establish test + lint baseline

**Files:**
- Read: `apps/api/src/**/*.spec.ts` (no modifications)

Why first: we need to know which tests fail BEFORE the WIP commit so we don't accidentally take credit for breakages we introduced or miss new ones we created.

- [ ] **Step 1: Capture current branch + WIP state**

```bash
git status --short > /tmp/lr001-phase0-wip-baseline.txt
git rev-parse HEAD > /tmp/lr001-phase0-head-before.txt
```

Expected: ~50 modified files listed, HEAD sha captured.

- [ ] **Step 2: Run API test suite, capture pass/fail counts**

```bash
cd apps/api
pnpm test 2>&1 | tee /tmp/lr001-phase0-test-baseline.log
cd ../..
```

Expected: some failures (Slice 0 audit listed 11 pre-existing failing suites). Record the exact failing-suite list — it's the input to Phase 1's triage step S6.

- [ ] **Step 3: Run typecheck + lint, capture errors**

```bash
pnpm check-types 2>&1 | tee /tmp/lr001-phase0-typecheck-baseline.log
pnpm lint 2>&1 | tee /tmp/lr001-phase0-lint-baseline.log
```

Expected: may have errors. Captured for comparison after WIP commit.

- [ ] **Step 4: Sanity-check the WIP file count**

```bash
git diff --name-only | wc -l
```

Expected: ~50. If wildly different from the design's "~50 files," investigate before continuing — the working tree may have drifted from when the design was written.

No commit in this task. The baseline files in `/tmp/` are inputs to Tasks 2 and 17.

---

## Task 2: WIP audit — AI-stylistic-marker scan

**Files:**
- Read: every file in `git diff --name-only` output from Task 1.

Why: the design's code quality bar forbids AI-stylistic markers ("delve", "leverage", "robust", "comprehensive", "streamlined", "seamless", "elevate", "unlock", "harness", "unleash", "supercharge"), em-dash sentence joins, "I've created" phrasing, emoji sprinkling. Memory rule: `feedback_no_ai`. Better to clean this in the WIP commit than discover it in code review later.

- [ ] **Step 1: Grep for banned words in WIP files**

```bash
git diff --name-only -z | xargs -0 grep -n -i -E "\\b(delve|leverage|robust|comprehensive|streamlined|seamless|elevate|unlock|harness|unleash|supercharge)\\b" > /tmp/lr001-phase0-marker-hits.txt 2>&1 || true
```

Expected: file may be empty (no hits) or have lines like `apps/api/.../foo.ts:42:  // ... robust handling of ...`.

- [ ] **Step 2: Grep for "I've created" / "I've added" / "I've updated" phrasing in WIP files**

```bash
git diff --name-only -z | xargs -0 grep -n -E "I('ve|'ll| have| will) (created|added|updated|implemented)" >> /tmp/lr001-phase0-marker-hits.txt 2>&1 || true
```

- [ ] **Step 3: Inspect the marker-hits file**

```bash
cat /tmp/lr001-phase0-marker-hits.txt
```

Expected: a list of file:line:context entries. For each entry, you'll either edit the file (Task 3) or accept that the word's usage is legitimate (e.g. `lever` in a UI label is fine; "leverage" used technically with no replacement is fine if rare).

Decision rule:
- Comment / docstring with banned marker -> rewrite the comment, or delete if the comment was explaining WHAT (per code quality bar, only WHY-non-obvious comments allowed).
- Commit message body draft / string literal with banned marker -> rewrite.
- Variable / function name with banned marker -> leave alone (rename is too risky for Phase 0).

No commit in this task.

---

## Task 3: WIP cleanup — apply marker fixes

**Files:**
- Modify: whichever files Task 2 surfaced.

Skip this task entirely if Task 2 found zero meaningful hits.

- [ ] **Step 1: For each marker hit, Edit the file**

For each `path:line:context` from `/tmp/lr001-phase0-marker-hits.txt`, use the Edit tool to rewrite the line. Replacement rules:

| Banned word | Replacement strategy |
|---|---|
| "robust" | delete the word (`robust handling` -> `handling`) or rewrite the phrase |
| "comprehensive" | delete or use specific count ("all 23 endpoints", not "comprehensive endpoint coverage") |
| "leverage" (verb) | replace with "use" |
| "streamline" / "streamlined" | replace with "simplify" / "simplified" |
| "seamless" | delete or rewrite (usually a meaningless intensifier) |
| "elevate" | replace with "improve" or rewrite |
| "unlock" | replace with "enable" |
| "delve" | replace with "look into" or "examine" |
| "harness" | replace with "use" |
| "unleash" / "supercharge" | rewrite the whole sentence |
| "I've created..." | rewrite as imperative ("Add the foo helper") |

- [ ] **Step 2: Re-grep to confirm clean**

```bash
git diff --name-only -z | xargs -0 grep -n -i -E "\\b(delve|leverage|robust|comprehensive|streamlined|seamless|elevate|unlock|harness|unleash|supercharge)\\b" || echo "CLEAN"
```

Expected: `CLEAN` (or only legitimate remaining usages you decided to keep).

No commit in this task. The cleanup goes into the WIP commit in Task 6.

---

## Task 4: WIP audit — dead-code scan (lightweight)

**Files:**
- Read: WIP files.

Why: per the code quality bar, no commented-out blocks, no orphan files. A full dead-code analysis (`knip`, `ts-prune`) is too heavy for Phase 0; this task does the quick visible pass.

- [ ] **Step 1: Grep WIP files for large commented-out blocks**

```bash
git diff --name-only -z | xargs -0 grep -l -E "^\\s*//\\s*[A-Za-z].*$" | head -20
```

Then for each file, use Grep tool to look for 3+ consecutive `//` lines starting with code-like content (not `// SECTION:` or `// TODO:`).

- [ ] **Step 2: For each block found, decide**

- If the block is genuinely dead code: delete via Edit.
- If the block is a temporarily-disabled feature: leave alone but note in commit message.
- If the block is a SECTION marker / divider comment: leave alone.

- [ ] **Step 3: Quick scan for orphan files**

```bash
git status --short | grep "^??" || echo "NO_UNTRACKED"
```

Expected: `NO_UNTRACKED` or a small list. If untracked files appear in WIP-related directories, decide per-file: add to commit (Task 6), or delete.

No commit in this task.

---

## Task 5: Variant image model verification (amendment S2)

**Files:**
- Read: `packages/database/prisma/schema.prisma` lines 165-221 (Product + ProductVariant).
- Modify (optional): nothing in Phase 0. Decision documented in commit message of Task 6.

Why: amendment S2 requires verifying the schema models "size x color x per-color image sets" before any Phase 2 work lands. The current schema:

```prisma
model Product {
  ...
  images String[]   // product-level images (gallery)
  variants ProductVariant[]
  ...
}

model ProductVariant {
  ...
  sku    String @unique
  size   String
  color  String
  images String[]   // variant-level images (per size+color row)
  ...
}
```

This is the "flat" model: each size+color combo carries its own image URL array. For a denim brand where every size of "Indigo Slim" shares the same product photos, this means the same 6-8 URLs duplicate across all sizes of the same color (S/M/L/XL = same images x 4).

- [ ] **Step 1: Count current variant-image duplication in dev DB**

```sql
-- run via the supabase MCP execute_sql tool, or via:
-- pnpm --filter database prisma studio (visual)
-- This query: for each (productId, color), do all variants share the exact same images array?
SELECT
  "productId", color,
  COUNT(*) as variant_count,
  COUNT(DISTINCT images::text) as distinct_image_arrays
FROM "ProductVariant"
WHERE "deletedAt" IS NULL
GROUP BY "productId", color
HAVING COUNT(*) > 1
ORDER BY distinct_image_arrays DESC, variant_count DESC
LIMIT 20;
```

Expected: rows where `distinct_image_arrays > 1` indicate inconsistency (sizes of same color have different images — likely a bug). Rows where `distinct_image_arrays = 1` confirm the convention works in the existing data.

- [ ] **Step 2: Document the decision in `LR-001-PHASE-0-PLAN.md`**

Add the following block to this file under a new section `## Decisions made during Phase 0` at the bottom (Edit tool):

```markdown
## Decisions made during Phase 0

### D1. Variant image model: keep flat, enforce per-color convention in admin UI

Decision: keep `ProductVariant.images String[]` as-is. The admin product-create UI (Phase 2B) will collect images PER COLOR (not per variant), then duplicate the same array across every variant of that color on save. The API write path will validate that all variants of the same (productId, color) have identical `images` arrays and reject mismatched writes with 409 (post-launch enhancement; for Phase 0 we trust the admin UI).

Rationale:
- No schema migration in Phase 0 (lowest blast radius).
- Existing seed data already follows this convention (verified in Task 5 step 1).
- Refactor to a separate `ProductColor` entity is on the table for v2 if the duplication becomes painful.

Risk accepted: admin scripts that bypass the UI can write inconsistent variant images. Mitigation deferred to Phase 1 (add a check constraint or trigger).
```

- [ ] **Step 3: Verify the decision section was added**

```bash
grep -n "## Decisions made during Phase 0" LR-001-PHASE-0-PLAN.md
```

Expected: a line number near the bottom.

No commit in this task; the decision goes into the WIP commit message in Task 6.

---

## Task 6: Commit WIP as Phase 0 checkpoint

**Files:**
- Modified: all WIP files plus any cleanup from Tasks 3 + 4.

- [ ] **Step 1: Re-check git status**

```bash
git status --short
```

Expected: still ~50 files. If Task 3/4 added or removed anything, the count may have shifted slightly.

- [ ] **Step 2: Stage everything currently dirty**

```bash
git add -A
```

Then:

```bash
git status --short
```

Expected: all entries now show `M` / `A` / `D` in the left column (staged).

- [ ] **Step 3: Commit with the full message body**

Use the commit message HEREDOC pattern from CLAUDE.md / global git rules:

```bash
git commit -m "chore(repo): checkpoint WIP before LR-001 Phase 0 work" -m "API auth/cart/discounts/uploads hardening + admin login fixes captured ahead of LR-001 Phase 0 plumbing tasks. Also includes AI-stylistic-marker cleanup pass per code quality bar.

Source of truth for LR-001: ClaudeXDenim.md section [2026-05-17] LR-001 - Launch Readiness Operational Sweep - DESIGN, including its Amendments after plan-eng-review subsection. Per-phase directive: Arena.md A-048.

Variant image model decision: keep flat ProductVariant.images, enforce per-color uniformity in admin UI (Phase 2B). See LR-001-PHASE-0-PLAN.md Decisions section."
```

- [ ] **Step 4: Verify the commit landed**

```bash
git log -1 --stat | head -30
```

Expected: the commit shows ~50 file changes and the multi-line message.

---

## Task 7: Migration rollback prep — write `down.sql`

**Files:**
- Create: `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql`
- Read: `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/migration.sql`

Why: amendment C1. Live Supabase migration with no rollback = a support ticket waiting to happen. Prisma doesn't auto-generate down migrations, so we write it.

- [ ] **Step 1: Read the forward migration**

```bash
cat packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/migration.sql
```

Expected: SQL adding `deletedAt: DateTime?` columns to Product / Bundle / Collection / Category / Review tables (with partial `WHERE deletedAt IS NULL` indexes), plus a `BulkOperationOutbox` table creation. (Per `HANDOFF.md` description of Slice 0 migration.)

- [ ] **Step 2: Author the rollback**

Create the file `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql` with content that exactly reverses every statement in the forward migration. Template (adapt to what the forward migration actually contains):

```sql
-- Rollback for 20260516120000_bulk_operations_foundation
-- Reverses every statement in migration.sql in reverse order.

BEGIN;

-- 1. Drop the BulkOperationOutbox table (and any indexes on it).
DROP TABLE IF EXISTS "BulkOperationOutbox";

-- 2. Drop the partial indexes on deletedAt.
DROP INDEX IF EXISTS "Product_deletedAt_idx";
DROP INDEX IF EXISTS "ProductBundle_deletedAt_idx";
DROP INDEX IF EXISTS "Collection_deletedAt_idx";
DROP INDEX IF EXISTS "Category_deletedAt_idx";
DROP INDEX IF EXISTS "Review_deletedAt_idx";

-- 3. Drop the deletedAt columns.
ALTER TABLE "Product"       DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "ProductBundle" DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Collection"    DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Category"      DROP COLUMN IF EXISTS "deletedAt";
ALTER TABLE "Review"        DROP COLUMN IF EXISTS "deletedAt";

COMMIT;
```

Adjust the table names + index names to match exactly what the forward migration writes. If the forward migration touches different tables or names indexes differently, update the rollback accordingly.

- [ ] **Step 3: Lint the SQL by eye**

Re-read your down.sql side-by-side with the forward migration. Every `CREATE TABLE` should have a `DROP TABLE`. Every `ALTER TABLE ADD COLUMN` should have a `ALTER TABLE DROP COLUMN`. Every `CREATE INDEX` should have a `DROP INDEX`. Order: drop indexes first, then columns, then tables (reverse of creation order).

- [ ] **Step 4: Commit the rollback file**

```bash
git add packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql
git commit -m "chore(db): add rollback SQL for bulk_operations_foundation migration" -m "Per LR-001 amendment C1: every migration applied to live Supabase must ship with an explicit rollback. Tested in Task 8 against a local Postgres reset before live apply in Task 9."
```

---

## Task 8: Migration forward + rollback test against local Postgres

**Files:**
- Read-only against a temporary local DB.

Why: amendment C1 requires testing forward + rollback before touching prod. Doing this against the live Supabase is unsafe; doing it against a Supabase branch is ideal but boss may not have that on their plan. Local Postgres via Docker is the universal fallback.

- [ ] **Step 1: Spin up a local Postgres**

Check whether `docker-compose.yml` at project root already declares one:

```bash
grep -A 5 "postgres" docker-compose.yml || echo "NO_PG_IN_COMPOSE"
```

If present:

```bash
docker compose up -d postgres
```

If absent (NO_PG_IN_COMPOSE), start an ephemeral one:

```bash
docker run --rm -d --name lr001-pg-test -p 55432:5432 -e POSTGRES_PASSWORD=test -e POSTGRES_DB=denimisia postgres:16
```

Expected: container running. Verify:

```bash
docker ps | grep postgres
```

- [ ] **Step 2: Apply the forward migration manually**

Use psql or the Supabase CLI:

```bash
docker exec -i $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1) psql -U postgres -d denimisia < packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/migration.sql
```

Expected: no errors. The new tables and columns exist.

- [ ] **Step 3: Verify forward state**

```bash
docker exec -i $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1) psql -U postgres -d denimisia -c "\d \"BulkOperationOutbox\""
```

Expected: table description with the expected columns.

- [ ] **Step 4: Apply the rollback**

```bash
docker exec -i $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1) psql -U postgres -d denimisia < packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql
```

Expected: no errors.

- [ ] **Step 5: Verify rollback state**

```bash
docker exec -i $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1) psql -U postgres -d denimisia -c "\d \"BulkOperationOutbox\""
```

Expected: error `Did not find any relation named "BulkOperationOutbox"` — the table is gone.

```bash
docker exec -i $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1) psql -U postgres -d denimisia -c "\d \"Product\"" | grep -i deletedAt || echo "DELETEDAT_GONE"
```

Expected: `DELETEDAT_GONE` — the column is removed from Product.

- [ ] **Step 6: Tear down the local DB**

```bash
docker stop $(docker ps --filter 'name=pg' --format '{{.Names}}' | head -1)
```

(If using `docker compose up -d postgres`, use `docker compose down` instead.)

No commit in this task — the rollback file is already committed in Task 7. This task is verification only.

---

## Task 9: Apply migration to live Supabase

**Files:**
- Live database write.

Why: design requires the bulk-operations migration applied so Phase 1 / 2 / 3 can build on top of the `deletedAt` column (used for soft delete throughout).

- [ ] **Step 1: STOP. Confirm with user that snapshot is taken**

This is the high-blast-radius moment. Show the user this exact message:

> "Ready to apply migration `20260516120000_bulk_operations_foundation` to live Supabase. Before I run it: please go to the Supabase dashboard and take a manual snapshot of the database. Reply 'snapshot taken' when done, or 'skip' if you accept the risk and want me to proceed without one. The rollback SQL is at `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql` and was tested against a local Postgres in Task 8."

Wait for explicit user confirmation. Do NOT proceed without it.

- [ ] **Step 2: Apply via Prisma**

```bash
cd packages/database
pnpm prisma migrate deploy
cd ../..
```

`migrate deploy` (not `migrate dev`) is the right command against a non-shadow DB — it applies pending migrations without trying to detect drift.

Expected: `1 migration(s) applied: 20260516120000_bulk_operations_foundation`.

- [ ] **Step 3: Regenerate Prisma client**

```bash
cd packages/database
pnpm prisma generate
cd ../..
```

Expected: client written to `node_modules/.prisma/client`. If the Windows DLL is locked (a Slice 0 known issue per `ClaudeXDenim` Session 2026-05-16 audit), close any process holding it (editor, dev server) and retry.

- [ ] **Step 4: Sanity-check live state via MCP**

If the Supabase MCP is available in this session, use `mcp__supabase__list_tables` and confirm `BulkOperationOutbox` is present. Otherwise skip and rely on Phase 1's first endpoint test to surface any issue.

- [ ] **Step 5: Commit any client regeneration artifacts**

```bash
git status --short
```

Expected: probably no changes (Prisma client lives in node_modules). If anything tracked changed, commit:

```bash
git add -A
git commit -m "chore(db): apply bulk_operations_foundation migration to live DB"
```

If nothing changed, skip the commit.

---

## Task 10: pnpm install + boot smoke test

**Files:**
- None modified. Verification only.

- [ ] **Step 1: Install from clean lockfile**

```bash
pnpm install --frozen-lockfile
```

Expected: completes without warnings about peer-dep conflicts or missing packages. If lockfile is out-of-sync with package.json, this command fails; in that case use `pnpm install` (without frozen) and commit the lockfile update separately.

- [ ] **Step 2: Try the API solo, 10-second smoke**

Use `run_in_background: true` on the Bash call to start the API in dev mode, then sleep 10s and check the output.

```bash
cd apps/api && pnpm dev
```

Expected within 10 seconds of output: `Nest application successfully started` (or equivalent NestJS bootstrap log). If you see "EADDRINUSE on port 3001," apply the pre-flight zombie kill again.

Kill the background process after the smoke check.

- [ ] **Step 3: Try the admin solo, 10-second smoke**

```bash
cd apps/admin && pnpm dev
```

Expected within 10 seconds: `ready - started server on 0.0.0.0:3002` (or whatever port admin uses). Look for hydration or compile errors.

Kill background.

- [ ] **Step 4: Try the web solo, 10-second smoke**

```bash
cd apps/web && pnpm dev
```

Expected within 10 seconds: `ready - started server on 0.0.0.0:3000`.

Kill background.

- [ ] **Step 5: Try all three from root via Turborepo**

```bash
pnpm dev
```

Expected: all three boot in parallel. If any fail, the error scrolls past — scroll back and capture. This is the real test of "boots cleanly."

Kill background. No commit in this task.

If any of the three apps fail to boot, STOP the plan and treat the boot failure as a P0 bug. Add an entry to the `LR-001 BUG LOG` in `ClaudeXDenim.md`, diagnose, fix, then resume from this task.

---

## Task 11: Env-var catalog + `.env.example` for web + admin

**Files:**
- Read: `apps/web/.env`, `apps/admin/.env`, all source files for `process.env.X` references.
- Create: `apps/web/.env.example`, `apps/admin/.env.example`.
- Modify: `apps/api/.env.example` (extend with new keys).

Why: API has an `.env.example` but web + admin don't. Anyone setting up the project after Phase 0 needs the contract.

- [ ] **Step 1: Enumerate `process.env.X` in `apps/web/`**

Use Grep tool:
- pattern: `process\.env\.[A-Z_]+`
- path: `c:\Users\joycg\denimisia\apps\web`
- output_mode: content
- -n: true

Collect every distinct `process.env.X` reference. Same for `apps/web/next.config.js`.

- [ ] **Step 2: Enumerate `process.env.X` in `apps/admin/`**

Same Grep against `apps/admin`.

- [ ] **Step 3: Build the `apps/web/.env.example`**

Create the file with the contract. Example shape (fill in keys actually found in Step 1):

```bash
# apps/web/.env.example
# Public (NEXT_PUBLIC_*) values are bundled into the client — never put secrets here.

# API base URL (server-side fetches)
NEXT_PUBLIC_API_URL=http://localhost:3001

# NextAuth (if web uses it)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace-me-with-openssl-rand-base64-32

# Cloudflare R2 CDN host (for next/image remotePatterns)
NEXT_PUBLIC_R2_PUBLIC_HOST=cdn.denimisia.example

# Plausible analytics (Phase 5 - optional in Phase 0)
# NEXT_PUBLIC_PLAUSIBLE_DOMAIN=denimisia.example

# Sentry (Phase 5 - optional in Phase 0)
# NEXT_PUBLIC_SENTRY_DSN=

# Any additional keys found in Step 1...
```

Update the keys list to match Step 1 reality.

- [ ] **Step 4: Build the `apps/admin/.env.example`**

Same shape, with whatever Step 2 found. Admin typically has:
- `NEXT_PUBLIC_API_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- Maybe `NEXT_PUBLIC_R2_PUBLIC_HOST` for image previews

- [ ] **Step 5: Extend `apps/api/.env.example`**

Read the current file:

```bash
cat apps/api/.env.example
```

Append (using Edit tool) any keys for plumbing concerns coming in later tasks:

```
# Resend (Task 14)
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@denimisia.example
RESEND_FROM_NAME=Denimisia

# Image pipeline (Task 13 - if Cloudflare Image Resizing is chosen)
# CF_IMAGE_RESIZE_BASE_URL=https://denimisia.example/cdn-cgi/image
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/.env.example apps/admin/.env.example apps/api/.env.example
git commit -m "chore(env): add .env.example for web + admin, extend api .env.example for Resend"
```

---

## Task 12: Wire `@nestjs/swagger` for `/api/docs` (amendment S1)

**Files:**
- Modify: `apps/api/src/main.ts`

Why: amendment S1. `@nestjs/swagger` is already a dependency (v11.2.6 in `apps/api/package.json`). Five lines of wiring gives a `/api/docs` route used by Phase 1 to enumerate every endpoint.

- [ ] **Step 1: Read `main.ts`**

Read `apps/api/src/main.ts` to know the current bootstrap shape.

- [ ] **Step 2: Add swagger setup before `app.listen()`**

Use Edit tool. Add at the top (after the other imports):

```typescript
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
```

Then inside `bootstrap()` (or whatever the bootstrap function is named), AFTER all the `app.use(...)` / `app.useGlobalPipes(...)` calls but BEFORE `await app.listen(...)`, add:

```typescript
const swaggerConfig = new DocumentBuilder()
  .setTitle('Denimisia API')
  .setDescription('Internal API for the Denimisia e-commerce platform.')
  .setVersion('0.1.0')
  .addBearerAuth()
  .build();
const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup('api/docs', app, swaggerDoc);
```

- [ ] **Step 3: Boot the API and hit `/api/docs`**

Background-start the API:

```bash
cd apps/api && pnpm dev
```

Wait for the bootstrap log, then:

```bash
curl -sf http://localhost:3001/api/docs > /dev/null && echo "DOCS_OK" || echo "DOCS_FAIL"
```

Expected: `DOCS_OK`.

Bonus: `curl -s http://localhost:3001/api/docs-json | head -50` shows the OpenAPI JSON Phase 1 will use to enumerate endpoints.

Kill the background API.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/main.ts
git commit -m "feat(api): mount @nestjs/swagger at /api/docs" -m "Required by LR-001 amendment S1 so Phase 1 can enumerate every endpoint against an OpenAPI spec. Bearer-auth security scheme registered; per-route @ApiOperation decorators arrive in Phase 1 as endpoints are audited."
```

---

## Task 13: Image pipeline decision + `next.config.js` updates (amendment S4)

**Files:**
- Modify: `apps/web/next.config.js`
- Modify: `apps/admin/next.config.js`

Why: amendment S4. `next/image` won't render R2-hosted images without the R2 host listed in `images.remotePatterns`. Phase 3 tests will break if this isn't done in Phase 0.

Decision (per amendment): default to Cloudflare Image Resizing on top of R2. For Phase 0 we just need the remote-pattern wiring; the actual resize URL strategy is documented in the Phase 5 deploy checklist.

- [ ] **Step 1: Read both next.config.js files**

Read `apps/web/next.config.js` and `apps/admin/next.config.js` to know the current shape.

- [ ] **Step 2: Identify the R2 public host**

Ask the user:

> "What is the production R2 public host (the domain customers' browsers will load images from)? Example: `cdn.denimisia.com`. If you don't have one yet, I'll use a placeholder `cdn.denimisia.example` and you can swap it in Phase 5."

Wait for the answer. If user says "use placeholder," use `cdn.denimisia.example`.

- [ ] **Step 3: Add `images.remotePatterns` entry in `apps/web/next.config.js`**

Use Edit tool. If `next.config.js` doesn't already have an `images` key, add it. If it does, extend `remotePatterns`. Resulting shape:

```javascript
const nextConfig = {
  // ...existing config
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: process.env.NEXT_PUBLIC_R2_PUBLIC_HOST || 'cdn.denimisia.example',
      },
      // Add the Supabase storage host if used:
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
};
```

- [ ] **Step 4: Same change in `apps/admin/next.config.js`**

Mirror the change. Admin shows image previews of products + media, so it needs the same `remotePatterns`.

- [ ] **Step 5: Verify the configs parse**

```bash
cd apps/web && node -e "require('./next.config.js')" && echo "WEB_OK"
cd ../admin && node -e "require('./next.config.js')" && echo "ADMIN_OK"
cd ../..
```

Expected: `WEB_OK` and `ADMIN_OK`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/next.config.js apps/admin/next.config.js
git commit -m "feat(images): allow R2 + Supabase hosts in next/image remotePatterns" -m "Per LR-001 amendment S4. Defaults the R2 host to NEXT_PUBLIC_R2_PUBLIC_HOST env (or cdn.denimisia.example placeholder); Phase 5 deploy checklist locks the production hostname."
```

---

## Task 14: Wire Resend — install + service + module

**Files:**
- Create: `apps/api/src/modules/email/email.module.ts`
- Create: `apps/api/src/modules/email/email.service.ts`
- Create: `apps/api/src/modules/email/email.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/package.json` (add `resend` dep)

Why: Phase 0 exit criteria require "Resend sends a verified test email." First wire it, then test it (Task 15).

TDD: write the spec first, watch it fail, implement, watch it pass.

- [ ] **Step 1: Install the Resend SDK**

```bash
cd apps/api && pnpm add resend && cd ../..
```

Expected: `resend` appears in `apps/api/package.json` dependencies.

- [ ] **Step 2: Write the failing test**

Create `apps/api/src/modules/email/email.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const mockSend = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    mockSend.mockReset();
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true })],
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const values: Record<string, string> = {
                RESEND_API_KEY: 'test-key',
                RESEND_FROM_EMAIL: 'noreply@test.example',
                RESEND_FROM_NAME: 'Test',
              };
              if (!(key in values)) throw new Error(`Missing config: ${key}`);
              return values[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it('sends a plain-text email through the Resend SDK', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg_123' }, error: null });

    const result = await service.send({
      to: 'customer@example.com',
      subject: 'Test',
      text: 'Hello',
    });

    expect(mockSend).toHaveBeenCalledWith({
      from: 'Test <noreply@test.example>',
      to: 'customer@example.com',
      subject: 'Test',
      text: 'Hello',
    });
    expect(result.id).toBe('msg_123');
  });

  it('throws when Resend returns an error envelope', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'rate_limited' } });

    await expect(
      service.send({ to: 'x@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow(/rate_limited/);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
cd apps/api && pnpm test -- email.service.spec.ts
```

Expected: FAIL with "Cannot find module './email.service'" or similar.

- [ ] **Step 4: Implement the service**

Create `apps/api/src/modules/email/email.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface SendEmailResult {
  id: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly client: Resend;
  private readonly fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.getOrThrow<string>('RESEND_API_KEY');
    const fromEmail = this.config.getOrThrow<string>('RESEND_FROM_EMAIL');
    const fromName = this.config.getOrThrow<string>('RESEND_FROM_NAME');
    this.client = new Resend(apiKey);
    this.fromAddress = `${fromName} <${fromEmail}>`;
  }

  async send(input: SendEmailInput): Promise<SendEmailResult> {
    const payload = {
      from: this.fromAddress,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    };

    const { data, error } = await this.client.emails.send(payload);

    if (error || !data) {
      this.logger.error({ error, to: input.to }, 'Resend send failed');
      throw new Error(`Resend send failed: ${error?.message ?? 'unknown'}`);
    }

    return { id: data.id };
  }
}
```

- [ ] **Step 5: Create the module shell**

Create `apps/api/src/modules/email/email.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { EmailService } from './email.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
```

- [ ] **Step 6: Register `EmailModule` in `app.module.ts`**

Read `apps/api/src/app.module.ts`, then use Edit tool to add the import + module entry:

```typescript
import { EmailModule } from './modules/email/email.module';
```

And add `EmailModule` to the `imports: [...]` array of `@Module({...})`.

- [ ] **Step 7: Run the test to verify it passes**

```bash
cd apps/api && pnpm test -- email.service.spec.ts
```

Expected: 2 tests pass.

- [ ] **Step 8: Run the full API suite to confirm no regressions**

```bash
cd apps/api && pnpm test
```

Expected: same set of pre-existing failures captured in Task 1 step 2 (no NEW failures introduced). Compare with `/tmp/lr001-phase0-test-baseline.log`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/email/ apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(email): wire Resend SDK behind EmailService" -m "Adds EmailModule + EmailService with text/html send + error envelope handling, plus unit tests for happy + error paths. Required by LR-001 Phase 0 (replace console-log token stub). Per amendment S3, ask boss to confirm paid Resend tier in production (free is 100/day, 3000/month — not enough for launch traffic)."
```

---

## Task 15: Resend send test — verification email round-trip

**Files:**
- Read-only (uses the service from Task 14).

Why: Phase 0 exit criterion explicitly says "Resend sends a verified test email." Unit tests confirm the wrapper logic; this task confirms the live integration works (DNS, API key, sandbox or verified domain).

- [ ] **Step 1: Ask user for a test recipient address**

> "I need to send one real test email through Resend to confirm the live integration works. What email address should receive it? (Your own inbox is fine. If Resend is in sandbox mode for the API key, the address must be verified in the Resend dashboard.)"

Wait for the answer. Also ask:

> "Have you set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, and `RESEND_FROM_NAME` in `apps/api/.env`? If not, do so now."

Wait for confirmation.

- [ ] **Step 2: Write a one-off test script**

Create `apps/api/test/lr001-phase0-resend-smoke.ts` (gitignored — it's a one-off):

```typescript
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../src/modules/email/email.service';

async function main() {
  const recipient = process.argv[2];
  if (!recipient) {
    console.error('Usage: tsx test/lr001-phase0-resend-smoke.ts <recipient-email>');
    process.exit(1);
  }

  const config = new ConfigService(process.env);
  const service = new EmailService(config);

  const result = await service.send({
    to: recipient,
    subject: 'Denimisia LR-001 Phase 0 plumbing test',
    text: 'If you received this, Resend is wired correctly. Reply to no one — this is automated.',
  });

  console.log(`SENT: ${result.id}`);
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
```

- [ ] **Step 3: Run the script**

```bash
cd apps/api && pnpm exec tsx test/lr001-phase0-resend-smoke.ts <recipient-from-step-1>
```

Expected: `SENT: <resend-message-id>` and the email arriving in the recipient's inbox (or spam folder — note this in the BUG LOG if so; Phase 5 will fix DNS).

- [ ] **Step 4: Clean up the script**

```bash
rm apps/api/test/lr001-phase0-resend-smoke.ts
```

(Keep the test script out of the commit. It served its one-time purpose.)

No commit in this task.

If the send fails, STOP. Add a BUG LOG entry in `ClaudeXDenim.md` describing the failure mode (auth error, DNS error, sandbox mode rejection, etc.), and either fix it in this task or open a follow-up commit. Phase 0 cannot exit without this working.

---

## Task 16: R2 round-trip verification

**Files:**
- Read-only (uses the existing uploads module).

Why: Phase 0 exit criterion. The `uploads` module exists (per `apps/api/src/modules/uploads/`). This task confirms an end-to-end upload + signed URL fetch + delete works against live R2.

- [ ] **Step 1: Inspect the uploads controller to find the actual endpoint contract**

Read `apps/api/src/modules/uploads/uploads.controller.ts` to know:
- Which HTTP method + path uploads a file
- Which role is required
- Whether it returns a presigned URL or stores immediately
- Any size/mime constraints

- [ ] **Step 2: Confirm R2 env vars are set**

```bash
grep -E "^(R2_|S3_|AWS_)" apps/api/.env || echo "MISSING_R2_ENV"
```

Expected: keys for R2 endpoint, access key, secret, bucket. If `MISSING_R2_ENV`, ask the user to populate before continuing.

- [ ] **Step 3: Start the API**

Background:

```bash
cd apps/api && pnpm dev
```

Wait for the bootstrap log.

- [ ] **Step 4: Obtain an admin JWT for the call**

Either log into the admin via browser and copy the cookie/token, OR use a CLI script:

```bash
curl -sf -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@denimisia.example","password":"<known-test-password>"}' | jq .
```

(Adjust to the actual login endpoint shape — Step 1 of Task 12 / inspection of `auth.controller.ts` tells you.)

Save the access token.

- [ ] **Step 5: Upload a tiny test file**

```bash
echo "lr001-phase0-r2-roundtrip" > /tmp/lr001-r2-test.txt

curl -sf -X POST http://localhost:3001/uploads \
  -H "Authorization: Bearer <token>" \
  -F "file=@/tmp/lr001-r2-test.txt" \
  -F "kind=test" | tee /tmp/lr001-r2-upload-result.json
```

Adjust the endpoint path + form fields based on Step 1.

Expected: 2xx with a response containing the R2 key or asset id.

- [ ] **Step 6: Fetch via signed URL or public URL**

Based on the upload response, either:
- If it returns a public URL: `curl -sf <public-url>` should return the file contents.
- If it returns an asset id: call the signed-URL endpoint, then fetch that URL.

Expected: file contents `lr001-phase0-r2-roundtrip`.

- [ ] **Step 7: Delete the test file**

```bash
curl -sf -X DELETE http://localhost:3001/uploads/<asset-id> \
  -H "Authorization: Bearer <token>"
```

Expected: 2xx.

- [ ] **Step 8: Confirm deletion**

Re-fetch the URL from Step 6 — should now 404 or signed-URL-expired.

- [ ] **Step 9: Clean up**

```bash
rm /tmp/lr001-r2-test.txt /tmp/lr001-r2-upload-result.json
```

Kill the background API. No commit in this task.

If any step fails, STOP, add a BUG LOG entry, and fix before exiting Phase 0.

---

## Task 17: Phase 0 exit — final verification + status entry

**Files:**
- Modify: `ClaudeXDenim.md` (append Phase 0 status entry under the LR-001 section).
- Modify: `LR-001-PHASE-0-PLAN.md` (mark this plan complete).

Why: design says each phase exit produces a one-screen status entry appended to ClaudeXDenim under the LR-001 section. This task does that and verifies all exit criteria.

- [ ] **Step 1: Re-run the boot smoke from Task 10 step 5**

```bash
pnpm dev
```

All three apps boot cleanly. Kill background.

- [ ] **Step 2: Re-run API tests, compare against baseline**

```bash
cd apps/api && pnpm test 2>&1 | tee /tmp/lr001-phase0-test-final.log
cd ../..
diff /tmp/lr001-phase0-test-baseline.log /tmp/lr001-phase0-test-final.log | head -50
```

Expected: the diff shows the NEW email.service tests passing (added in Task 14) and otherwise NO new failures relative to the baseline.

- [ ] **Step 3: Run typecheck + lint**

```bash
pnpm check-types
pnpm lint
```

Expected: no new errors relative to Task 1 step 3 baseline.

- [ ] **Step 4: Append the Phase 0 status entry to `ClaudeXDenim.md`**

Find the end of the `[2026-05-17] LR-001 — Launch Readiness Operational Sweep — DESIGN` section (it currently ends with the BUG LOG table). Insert a new subsection BEFORE the BUG LOG:

```markdown
### Phase 0 — Plumbing — SHIPPED <YYYY-MM-DD>

Plan: `LR-001-PHASE-0-PLAN.md` (delete after this section is appended).

What landed:
- WIP commit: <sha-of-Task-6-commit> — ~50 modified files plus AI-stylistic-marker cleanup.
- Migration rollback file at `packages/database/prisma/migrations/20260516120000_bulk_operations_foundation/down.sql` (commit <sha-of-Task-7-commit>).
- Migration `20260516120000_bulk_operations_foundation` applied to live Supabase. Forward + rollback both tested against local Postgres before live apply.
- `@nestjs/swagger` mounted at `/api/docs` (commit <sha-of-Task-12-commit>).
- R2 + Supabase image hosts added to `next.config.js` for web + admin (commit <sha-of-Task-13-commit>).
- `EmailModule` + `EmailService` (Resend wrapper) shipped with unit tests for happy + error envelope paths (commit <sha-of-Task-14-commit>).
- `apps/web/.env.example` + `apps/admin/.env.example` created; `apps/api/.env.example` extended.

Verification:
- All three apps boot cleanly via `pnpm dev` from repo root.
- Resend test email received at <recipient-from-Task-15> (or noted as spam folder for Phase 5 DNS work).
- R2 round-trip (upload + fetch + delete) passes against live R2.
- API test suite: same pre-existing failures as Task 1 baseline (those go to Phase 1 triage S6) + 2 new EmailService tests passing.
- Typecheck + lint: clean delta vs baseline.

Decisions:
- D1 (Variant image model): keep flat `ProductVariant.images String[]`, enforce per-color uniformity in admin UI (Phase 2B). See LR-001-PHASE-0-PLAN.md Decisions section.
- Image pipeline default: Cloudflare Image Resizing on top of R2 (concrete wiring deferred to Phase 5 deploy checklist).
- Resend tier: <answer from boss in Task 14 commit body>.

Next: Phase 1 — API hardening. First step: triage rule S6 over the pre-existing failing suite list, then begin spec-driven endpoint sweep per Arena A-048.
```

Substitute `<YYYY-MM-DD>` and the commit SHAs (use `git log --oneline -20` to find them).

- [ ] **Step 5: Mark the plan complete**

At the top of `LR-001-PHASE-0-PLAN.md`, add a banner under the H1:

```markdown
> **STATUS:** SHIPPED <YYYY-MM-DD>. See `ClaudeXDenim.md` section `Phase 0 — Plumbing — SHIPPED <YYYY-MM-DD>` for the canonical record. This plan file can be deleted at the start of Phase 1 (the status entry is the durable record).
```

- [ ] **Step 6: Commit the status entry**

```bash
git add ClaudeXDenim.md LR-001-PHASE-0-PLAN.md
git commit -m "docs(lr-001): Phase 0 status entry + mark plan SHIPPED"
```

- [ ] **Step 7: Confirm with user before declaring done**

Show the user the final commit list:

```bash
git log --oneline $(cat /tmp/lr001-phase0-head-before.txt)..HEAD
```

Then say:

> "Phase 0 is shipped. <N> commits added. All exit criteria met. Ready to move to Phase 1 — API hardening (triage of pre-existing failing test suites, then spec-driven endpoint sweep)."

---

## Self-review (run before declaring the plan ready)

Done as part of plan authoring, not at execution time. Captured here as the audit trail.

- **Spec coverage:** every line of the design's Phase 0 + every relevant LR-001 amendment is touched:
  - Phase 0 step 1 (WIP commit with marker pass) → Tasks 2, 3, 4, 6.
  - Phase 0 step 2 (migration apply with confirmation) → Tasks 7, 8, 9.
  - Phase 0 step 3 (pnpm install) → Task 10 step 1.
  - Phase 0 step 4 (env catalog + .env.example) → Task 11.
  - Phase 0 step 5 (wire Resend) → Tasks 14 + 15.
  - Phase 0 step 6 (R2 verify) → Task 16.
  - Phase 0 step 7 (zombie kill) → Pre-flight.
  - Phase 0 step 8 (boot all three) → Tasks 10 + 17.
  - Amendment C1 (rollback strategy) → Tasks 7, 8, 9.
  - Amendment S1 (`@nestjs/swagger`) → Task 12.
  - Amendment S2 (variant schema verify) → Task 5.
  - Amendment S3 (Resend tier) → Task 14 step 9 (commit body asks boss).
  - Amendment S4 (image pipeline + next.config.js) → Task 13.
- **Placeholder scan:** no `TBD`, `TODO`, `<fill in>` left in code blocks. The few `<placeholder>` strings (like `<sha-of-Task-7-commit>`) are inside narrative or commit-message templates that the executing engineer fills in from real commit SHAs, not code.
- **Type consistency:** `EmailService.send()` signature is consistent between the spec test (Task 14 step 2), the implementation (Task 14 step 4), and the smoke script (Task 15 step 2). Same with `SendEmailInput` / `SendEmailResult`.

## Decisions made during Phase 0

### D1. Variant image model: keep flat, enforce per-color convention in admin UI

Decision: keep `ProductVariant.images String[]` as-is. The admin product-create UI (Phase 2B) will collect images PER COLOR (not per variant), then duplicate the same array across every variant of that color on save. The API write path (Phase 1) will validate that all variants of the same `(productId, color)` have identical `images` arrays and reject mismatched writes with 409.

Rationale:
- No schema migration in Phase 0 (lowest blast radius).
- Verified against live data 2026-05-17: 100% of multi-variant `(productId, color)` groups have `distinct_image_arrays = 1` (sample of top 20, every row shows 1 distinct array). The convention is already followed in seed data.
- Refactor to a separate `ProductColor` entity is on the table for v2 if the duplication becomes painful.

Risk accepted: admin scripts that bypass the UI can write inconsistent variant images. Mitigation deferred to Phase 1 (add a CHECK constraint or trigger + an integration test that fails on mismatched arrays).

### D2. AI-marker scan: clean across all 184 changed text files

Decision: no AI-stylistic-marker fixes required in the WIP recovery commits. Tasks 2 + 3 of the plan are no-ops because the scan found zero hits against the banned-word list.

Verified 2026-05-17: scanned every modified + untracked `.ts/.tsx/.js/.jsx/.md/.mjs/.cjs/.json` file (184 total) for `\b(delve|leverage|robust|comprehensive|streamlined|seamless|elevate|unlock|harness|unleash|supercharge)\b` and `I('ve|'ll| have| will) (created|added|updated|implemented)`. Both regexes returned zero hits.

### D3. Dead-code scan: clean

No commented-out code blocks 4+ lines long found across the same 184-file scope. Task 4 also a no-op.

### D4. WIP scope expanded from "~50 files" to "260 files" (recovery commits)

Original spec assumed ~50 modified files. Actual working tree carries 49 modified + 180 untracked + 32 deleted = 261 changes. The untracked set includes major surfaces (most of `apps/admin/app/(dashboard)/`, `Arena.md`, `ClaudeXDenim.md`, `HANDOFF.md`, CI workflows, `apps/api/Dockerfile + scripts + test`, `apps/web/components/`, `packages/database`, `packages/utils`, `packages/types`) that have never been committed.

Decision: handle via logical chunked commits (Task 6 expanded from one commit to ~8). Commit order:
1. `.gitignore` hardening (already shipped: `b1ec751`).
2. Root project docs (Arena, ClaudeXDenim, HANDOFF, LR-001-PHASE-0-PLAN).
3. Original 49 modified files (the "real" WIP — API auth/cart/discounts/uploads hardening + admin login fixes).
4. CI/CD workflows.
5. `apps/admin/` untracked tree.
6. `apps/api/` untracked tree.
7. `apps/web/` untracked tree.
8. `packages/` untracked tree.
9. Deletions (apps/docs, packages/ui orphans).
