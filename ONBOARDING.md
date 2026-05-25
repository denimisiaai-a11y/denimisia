# Denimisia — Onboarding for Next Claude Session

**Last updated:** 2026-05-25
**Status:** Catalog imported. Deployment in progress. Domain bought, not pointed yet.

---

## 1) What's already done

### Catalog (production-ready)
- **17 real products** live in Supabase Postgres, all priced ৳1099 BDT.
- **475 ProductVariant rows** (color × size combos), **~10,071 units** of stock loaded from source matrices.
- **159 images** uploaded to Cloudflare R2 under `denimisia-media/products/<sku>/*` — already optimized (max ~1.3MB each, retina-grade).
- **1,232 ProductSizeChart rows** auto-generated from PANTS defaults; storefront Size & Fit modal renders correctly.
- **80 ProductTag rows** (silhouette, rise, season=All-season, material=Denim).
- **Categories** assigned per silhouette (Wide Leg / Baggy / Flare & Boot Cut / Cargo under Women's).
- **3045 (AeroLite Highwaist Flare Jeans)** excluded from this batch — owner decision.

### Code shipped this session
- Admin **product search** wired to support comma-separated tokens matching name/slug/variant SKU (e.g., `20007, 2121`). See `apps/api/src/modules/products/products.{dto,service}.ts`.
- Admin **Auto-fill defaults button** on size chart editor — generates industry-standard PANTS/SHIRTS/JACKETS measurements. See `apps/admin/components/products/size-and-fit-editor.tsx`.
- **API serverless adapter** for Vercel deployment (new files):
  - `apps/api/src/bootstrap.ts` — extracted `createApp()` factory (no `.listen()`)
  - `apps/api/api/index.ts` — Vercel handler wrapping Nest via `@vendia/serverless-express`
  - `apps/api/vercel.json` — rewrites all paths to the function, maxDuration 30s, 1024MB
  - `apps/api/src/main.ts` — refactored to use the factory, still works for dev
- Two new deps added to `apps/api/package.json`: `@vendia/serverless-express`, `@vercel/node`.

### Infrastructure
- **Supabase project**: `https://kwzzaoglsfvmcsyodlnm.supabase.co` — Postgres for all DB.
- **Cloudflare R2**: bucket `denimisia-media`, public URL `https://pub-39d4f51379c0476098b5292730f14b86.r2.dev` — product images.
- **Domain**: `denimisiabd.com` purchased on Spaceship (1yr, auto-renew on, WHOIS privacy on). Not pointed at anything yet — "Connect" button still shows in Spaceship dashboard.
- **Vercel admin project**: started but build was kicked off without env vars. Project name `denimisia-admin`. Built from `joycghosh13/denimisia` repo, branch `main`, root dir `apps/admin`.

### Local artifacts (not in git, on owner's disk only)
- `docs/imports/product-images/` — 187 source images including ARW masters (don't commit)
- `docs/imports/2026-05-24-products-batch-1.json` — product source of truth
- `docs/imports/2026-05-24-stock-matrices.json` — stock matrices from source doc images
- `docs/imports/upload-manifest.json` — R2 upload manifest mapping SKU → URLs
- `docs/imports/color-legend.json` — 16 color codes decoded
- `docs/imports/convert-raw-to-jpg.py`, `compress-jpegs.py`, `upload-to-r2.py`, `fix-r2-filenames-with-spaces.py` — reusable scripts
- `packages/database/prisma/import-products-2026-05-24.ts` — the import script that created the 17 products
- `packages/database/prisma/backfill-*` scripts — type/attributes + size chart backfills

---

## 2) What's pending — deployment to Vercel

### Architecture target (all Vercel)
```
denimisiabd.com (storefront, apps/web)   → Vercel (apps/web)
admin.denimisiabd.com OR vercel URL     → Vercel (apps/admin)
api.denimisiabd.com OR vercel URL       → Vercel (apps/api as serverless)
Postgres                                → Supabase (existing)
Redis                                    → Upstash (needs signup)
Images                                   → Cloudflare R2 (existing)
DNS                                      → Cloudflare (recommended in front of Spaceship)
```

### Step-by-step plan (next session picks up here)

1. **Owner: commit & push the API serverless changes** (uncommitted as of session end):
   ```powershell
   git status   # confirm new files in apps/api/ are there
   git add apps/api/api apps/api/src/bootstrap.ts apps/api/src/main.ts apps/api/vercel.json apps/api/package.json pnpm-lock.yaml
   git commit -m "feat(api): vercel serverless adapter + bootstrap factory"
   git push
   ```

2. **Owner: sign up for Upstash Redis** (5 min)
   - https://upstash.com → sign up with GitHub
   - Create DB `denimisia-prod` in Singapore region (closest to BD)
   - Copy the `rediss://default:...@...upstash.io:6379` URL

3. **Deploy API on Vercel** (~10 min)
   - New project from `joycghosh13/denimisia` repo
   - Root Directory: `apps/api`
   - Framework: Other (Vercel will auto-detect NestJS but ignore that; the `vercel.json` controls routing)
   - Add Environment Variables before first deploy:
     - `DATABASE_URL` — from Supabase project settings → Database → Connection string (pooler URL, not direct)
     - `DIRECT_URL` — direct (non-pooled) connection string from Supabase, for migrations
     - `REDIS_URL` — Upstash `rediss://...` URL from step 2
     - `R2_ACCOUNT_ID=962f39dabcbf446b16f43a97ee1ea6b6`
     - `R2_ACCESS_KEY_ID=c2304e00a843f14634ed042904a83898`
     - `R2_SECRET_ACCESS_KEY=274459ba8dd20bd79d04a7d915124eb4da1ec77f0cc319eed8189f73a64e1f15`
     - `R2_BUCKET_NAME=denimisia-media`
     - `R2_PUBLIC_URL=https://pub-39d4f51379c0476098b5292730f14b86.r2.dev`
     - `JWT_SECRET` — generate fresh: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`
     - `NODE_ENV=production`
     - `PORT=3001` (vestigial; serverless ignores it)
     - `CORS_ORIGINS=https://denimisiabd.com,https://www.denimisiabd.com` — add admin/web Vercel preview URLs too once known
     - any other `.env` keys from `apps/api/.env` (check that file)
   - Deploy. Test the URL: `https://<deploy>.vercel.app/health` should return 200.

4. **Deploy storefront on Vercel** (~10 min)
   - New project, same repo, root `apps/web`
   - Env vars:
     - `NEXT_PUBLIC_API_URL=https://<api-deploy>.vercel.app/api/v1`
     - any R2 vars web reads
     - Auth/session secrets if web has its own
   - Deploy.

5. **Update admin Vercel project** (~5 min)
   - Already created (in-progress as of session end), needs env vars:
     - `NEXT_PUBLIC_API_URL` — same as web
     - `NEXT_PUBLIC_WEB_ORIGIN=https://denimisiabd.com`
     - `NEXTAUTH_SECRET=MsngI7bRnajotcHe166A7Vqv86ywWtvKBwrNKw8j2D60wjQJ+P6YtQDnJy63sima` (generated previous session — fine to reuse, or generate a fresh one)
     - `NEXTAUTH_URL=https://<admin-deploy>.vercel.app`
   - Trigger redeploy after adding env vars.

6. **Wire denimisiabd.com via Cloudflare** (~15 min)
   - Recommended: free Cloudflare account → Add Site → enter denimisiabd.com → Free plan
   - Cloudflare gives you 2 nameservers → go to Spaceship → Domains → denimisiabd.com → Nameservers → change to Cloudflare's
   - Wait 5-15 min for propagation
   - In Cloudflare DNS: add CNAME `@` and `www` pointing to the Vercel storefront URL
   - In Vercel storefront project → Settings → Domains → add `denimisiabd.com` + `www.denimisiabd.com`
   - Optional: subdomain `admin.denimisiabd.com` → admin Vercel; `api.denimisiabd.com` → api Vercel
   - Optional: enable Cloudflare Email Routing → forward `contact@denimisiabd.com` → owner's gmail

7. **End-to-end test order on production** (~10 min)
   - Visit denimisiabd.com once DNS propagates
   - Add a product to cart → checkout as guest → place a COD order
   - Verify in admin: order appears, stock decrements, no API errors
   - Verify product images load fast from R2

---

## 3) Cosmetic cleanup pending (non-blocking)

- **"test 101" banner** still showing in the top strip — clear it from the admin Banner editor before launch.
- **`/images/category-denims.jpg`** 400 error on homepage — placeholder category card image is missing. Add to `apps/web/public/images/` or update the card to point at an R2 URL.
- **favicon.ico** — 404 in console. Drop a 32×32 PNG at `apps/web/public/favicon.ico`.
- **Legal pages**: Privacy Policy, Terms, Refund Policy. Required-ish for BD commerce + Meta ads.
- **Color hex swatches** in admin — none set yet, all colors render as text. Add hex codes via VariantsBuilder once time permits.
- **Per-color image curation** — all images currently in the general product gallery. Admin lets you assign per-color in VariantsBuilder later.

---

## 4) Key business decisions to remember

- **COD-only v1** — no payment gateway. Admin manually transitions PENDING → CONFIRMED orders. (See memory `project_cod_only.md`.)
- **bKash integration explicitly excluded** from scope.
- **Returns spec is locked**: 7-day window, 6 reasons, fault mapping, refund on INSPECTED_PASS. Plan at `docs/superpowers/plans/2026-05-20-returns-system.md`.
- **No AI features in product** — owner does not want AI-shopping/recommendation features visible to customers. (Memory `feedback_no_ai.md`.)
- **Build first, polish later** — owner prefers shipping features over visual perfection up front.

---

## 5) Critical operational notes

- **NEVER run `prisma db seed` against live Supabase without explicit confirmation** — caused product data loss on 2026-05-21. Memory: `feedback_never_run_seed_on_live_db.md`.
- **Don't dispatch parallel agents for plan execution** — owner prefers main-session execution. Memory: `feedback_no_subagents_for_plan_exec.md`.
- **Reports go to `ClaudeXDenim.md` and `Arena.md` (A-NNN entries)**, not `docs/superpowers/specs/`. Memory: `reference_work_reports.md`.
- **Windows pnpm leaks watchers** — if API won't restart on :3001, kill zombie processes BEFORE debugging anything else. Memory: `project_dev_server_zombies.md`.

---

## 6) Verify the live DB before any destructive work

Quick sanity query the next session should run before assuming anything:

```sql
SELECT
  (SELECT COUNT(*) FROM "Product")            AS products,
  (SELECT COUNT(*) FROM "ProductVariant")     AS variants,
  (SELECT COUNT(*) FROM "ProductSizeChart")   AS size_chart_rows,
  (SELECT COUNT(*) FROM "ProductTag")         AS tags,
  (SELECT COUNT(*) FROM "Order")              AS orders;
```

Expected as of handoff: **17 products, 475 variants, 1232 size_chart_rows, 95 tags, 0 orders** (the test order was purged).

---

## 7) Open todos for the next session (in priority order)

1. Owner pushes the uncommitted API serverless adapter changes
2. Owner signs up for Upstash Redis, grabs the URL
3. Deploy API on Vercel with env vars
4. Deploy storefront on Vercel
5. Add env vars to the half-deployed admin Vercel project; redeploy
6. Cloudflare DNS in front, point denimisiabd.com → storefront
7. End-to-end test order on prod
8. Cosmetic cleanup pass (banner / favicon / placeholder images)
9. Legal pages

---

**Next session: paste this file's contents into the first message, or use the `ShareOnboardingGuide` link the assistant generates from this file.**
