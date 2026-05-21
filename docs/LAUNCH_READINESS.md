# Launch Readiness Checklist

This document tracks everything between the current dev state and a public launch.
Update statuses as items close.

**Legend:** ✅ Done | 🟡 In progress | ⏸ Blocked | ⬜ Not started

---

## 1. Feature branches → main

Dependency order (must merge bottom-up):

| Branch | Status | Notes |
|---|---|---|
| `feat/returns-system` | ⬜ | Returns + refunds; spec at [docs/superpowers/plans/2026-05-20-returns-system.md](superpowers/plans/2026-05-20-returns-system.md). Check for unresolved issues before merging to main. |
| `feat/product-finder-chatbot` | ⬜ | Sits on top of returns. Includes chat bubble, size matcher, synonyms admin, fit-data dashboard widget. |
| `feat/cms-section-composer` | ⬜ | Sits on top of chatbot. Includes promo banner dimensions, auth session fix, **fit-silhouette engine** (merged 2026-05-21). |
| `feat/fit-silhouette-engine` | ✅ | Merged into `feat/cms-section-composer` (commits `85b52a0`, `9be5a25`, `0bb07cc`). Pushed to origin. |

### Pre-merge checks per branch

- [ ] `pnpm check-types` passes across all 4 packages
- [ ] `pnpm lint` passes (or warnings reviewed)
- [ ] `pnpm --filter api test` passes (note: existing `auth.service.spec.ts` and `curation.service.spec.ts` have pre-existing failures unrelated to fit work — triage before merge)
- [ ] Playwright E2E suite passes against the branch
- [ ] Manual smoke test: PDP modal opens, admin product save round-trips, bot returns style notes

---

## 2. Data & content

| Item | Status | Notes |
|---|---|---|
| Real product catalog | ⬜ | Currently 17 seed products. User's prior test products were lost on 2026-05-21 (see `feedback_never_run_seed_on_live_db` memory). Populate real products via admin Size & Fit editor. |
| Product images on R2 | ⬜ | Per `project_decisions` memory: images go to Cloudflare R2. Currently using `/images/*.jpg` local placeholders. |
| Proper silhouette art | ⬜ | Current men/women silhouettes are crude geometric placeholders. Designer needs to draw real silhouettes; replace via `/settings/silhouettes` SVG upload. |
| Categories populated | ✅ | 7 categories seeded (women's denim sub-categories + men's placeholder). |
| Collections populated | ✅ | 4 collections seeded (new arrivals, bestsellers, wide-leg, baggy). |
| Banners | ⬜ | 2 banner rows exist with placeholder images. Need real banner art + copy. |
| Per-product fit data | ⬜ | 1 product (`womens-high-waist-balloon-jeans`) has full fit data from the smoke test. The other 16 need: `type`, `fitLandmarks`, size charts populated. |
| Per-product size charts | ⬜ | Only 4 chart rows exist (smoke test). Need full body+garment matrices for every variant size × dimension. |
| Product tags | ⬜ | 0 productTag rows. Fit-data coverage widget will surface these gaps. |

---

## 3. Infrastructure

| Item | Status | Notes |
|---|---|---|
| **Supabase plan upgrade** | ⏸ | Free tier has **no backups**. Today's data loss happened because of this. Upgrade to Pro ($25/mo) for daily backups, or enable PITR. Critical before launch. |
| Image hosting | ⬜ | R2 buckets + uploader. Admin currently uses `/uploads` API — verify it points at R2 in production. |
| API deployment target | ⬜ | NestJS API (port 3001). Options: Fly.io, Render, Railway, AWS App Runner. Decide + configure. |
| Web deployment | ⬜ | Next.js storefront (port 3000). Vercel is the natural fit. |
| Admin deployment | ⬜ | Next.js admin (port 3002). Vercel as a separate project (or subdomain). |
| Domain + SSL | ⬜ | Point DNS at deployment targets. Use Vercel's auto-SSL or Cloudflare. |
| `NEXTAUTH_SECRET` | ⏸ | Per `project_dev_server_zombies` memory (and observation 6466 from earlier session), the value is currently a placeholder. **Rotate to a strong random value before production.** |
| Database URL secrets | ⬜ | Per-environment `.env` files; verify production points at a different Supabase project than dev (or at minimum a separate database within the same project). |
| Email provider | ⬜ | Order confirmations, password resets. Postmark / SendGrid / Resend — pick one + wire the existing email module. |
| SMS provider | ⬜ | If COD requires SMS confirmation. Bangladesh-friendly: Twilio / Vonage / local provider. |
| Rate limiting | ✅ | NestJS throttler module is configured per `apps/api/src/app.module.ts`. Verify limits are sane for production traffic. |
| CORS | ⬜ | Verify production CORS only allows the storefront + admin domains. |
| Sentry / error tracking | ⬜ | No error tracking currently visible. Add Sentry to web, admin, and API. |

---

## 4. Pre-existing tech debt (not blockers, but should be triaged)

| Item | Severity | Notes |
|---|---|---|
| `apps/api` type errors in spec files | Low | `auth.service.spec.ts`, `curation.service.spec.ts` have mock-typing issues. Don't block runtime. Fix when touching auth/curation. |
| `prisma/audit-damage.ts` references removed models | Low | Utility script references `homepageSection`, `imageUrl`, `endsAt` — all removed by various CMS/banner refactors. Either update or delete. |
| `seed.ts` legacy `homepageSection` block | ✅ | Fixed 2026-05-21 (commits `f36cf9e` + `0bb07cc`). |
| Windows pnpm zombie watchers | Medium | Documented in `project_dev_server_zombies` memory. Kill old `node.exe` processes when Prisma client regen fails with EPERM. |
| Supabase MCP read-only | Info | The MCP is configured read-only at server level; all writes go via direct DATABASE_URL through prisma db execute. Not a blocker. |

---

## 5. Compliance & legal

| Item | Status | Notes |
|---|---|---|
| Privacy policy page | ⬜ | Required for collecting customer data. |
| Terms of service page | ⬜ | Required for any e-commerce site. |
| Returns policy page | ⬜ | Returns spec is locked (7-day window, 6 reasons — see `project_returns_spec` memory). Public-facing version of that policy needs writing. |
| Cookie consent banner | ⬜ | EU/GDPR if you have any EU customers. |
| Bangladesh business registration | ⬜ | Out of code scope; flag if not done. |
| Payment compliance | n/a | Per `project_cod_only` memory, v1 is cash-on-delivery only. No gateway compliance needed yet. |

---

## 6. Pre-launch smoke test

Run these scenarios against staging before pointing production DNS:

- [ ] Browse catalog, filter, sort
- [ ] Add to cart, modify quantities
- [ ] Wishlist add/remove
- [ ] Account creation + email verification
- [ ] Login + logout (web + admin)
- [ ] Place a COD order end-to-end
- [ ] Admin transitions order PENDING → CONFIRMED → SHIPPED → DELIVERED
- [ ] Returns: customer requests → admin reviews → refund issued
- [ ] **Size & Fit modal** on every product type (PANTS, SHIRTS, JACKETS)
- [ ] **Find My Size chat** end-to-end with style note in response
- [ ] **Admin silhouette landmark editor** save round-trip
- [ ] Performance: PDP first paint < 2s, Lighthouse > 80
- [ ] Mobile responsive: storefront on a real phone (not just devtools)

---

## 7. Day-0 launch ops

- [ ] Monitor Supabase logs for first hour (use `mcp__supabase__get_logs` via Claude or the dashboard)
- [ ] Watch Sentry for unexpected errors
- [ ] Confirm a real customer can complete a COD order
- [ ] Have a rollback plan: which commit on `main` is the previous stable state?
- [ ] Have a comms plan: email list + social ready to announce

---

## Quick links

- Branches on GitHub: https://github.com/joycghosh13/denimisia/branches
- Supabase project: https://supabase.com/dashboard/project/kwzzaoglsfvmcsyodlnm
- Local URLs (dev): web [http://localhost:3000](http://localhost:3000), admin [http://localhost:3002](http://localhost:3002), api [http://localhost:3001/api/v1](http://localhost:3001/api/v1)
- Fit-silhouette spec: [superpowers/specs/2026-05-21-fit-silhouette-engine-design.md](superpowers/specs/2026-05-21-fit-silhouette-engine-design.md)
- Fit-silhouette plan: [superpowers/plans/2026-05-21-fit-silhouette-engine.md](superpowers/plans/2026-05-21-fit-silhouette-engine.md)
