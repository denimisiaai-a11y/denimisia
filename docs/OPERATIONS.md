# Denimisia — Operations Runbook

Single source of truth for deploys, secrets, migrations, and incident response.

## Architecture

```
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│  Storefront web  │         │   Admin panel    │         │   Storefront CDN │
│  (Vercel)        │         │   (Vercel)       │         │   (Vercel/CF)    │
└────────┬─────────┘         └────────┬─────────┘         └────────┬─────────┘
         │                            │                            │
         └────────────┬───────────────┘                            │
                      ▼                                            │
             ┌────────────────┐                                    │
             │  NestJS API    │ ───────────┐                       │
             │  (Docker, Fly/ │            │                       │
             │  Render/Railway)│           ▼                       │
             └────────┬───────┘     ┌──────────────┐               │
                      │             │ Cloudflare R2│◀──────────────┘ (public reads)
                      ▼             └──────────────┘
             ┌────────────────┐
             │ Supabase       │
             │ Postgres (DB)  │
             └────────────────┘
```

- **Supabase Postgres** — primary database (pooled connection via Supabase Postgres pooler)
- **Cloudflare R2** — all media (images + videos). Served via custom CDN domain.
- **NestJS API** — all business logic. Deployed as Docker image on GHCR.
- **Redis** — session cache. Managed (Upstash / Redis Cloud) in prod.

---

## Secrets Inventory

Every secret and where it's used. Rotate on a schedule or when exposed.

| Secret | Used by | Location | Rotate when |
|--------|---------|----------|-------------|
| `DATABASE_URL` | API | Host env + GitHub secret `DATABASE_URL` | Supabase password rotated |
| `REDIS_URL` | API | Host env + GitHub secret `REDIS_URL` | Quarterly |
| `JWT_ACCESS_SECRET` | API | Host env | If leaked; otherwise annual |
| `JWT_REFRESH_SECRET` | API | Host env | If leaked; otherwise annual |
| `R2_ACCOUNT_ID` | API + migration script | Host env + GitHub `R2_ACCOUNT_ID` | Never (public identifier) |
| `R2_ACCESS_KEY_ID` | API + migration script | Host env | On employee departure |
| `R2_SECRET_ACCESS_KEY` | API + migration script | Host env | On employee departure, or quarterly |
| `R2_BUCKET_NAME` | API | Host env | On bucket rename |
| `R2_PUBLIC_URL` | API + web | Host env + web `NEXT_PUBLIC_R2_URL` | On CDN domain change |
| `SUPABASE_URL` | API (legacy) | Host env | On Supabase project change |
| `SUPABASE_SERVICE_ROLE_KEY` | API (legacy) + bucket migration | Host env | **Immediately if exposed — bypasses RLS** |
| `SUPER_ADMIN_PASSWORD` | DB seed only | Host env during `prod:cleanup` | Remove after first use |

**Rotation steps for any JWT secret:**
1. Generate new secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Add new secret to host env as `JWT_ACCESS_SECRET_NEW`
3. Deploy API — new deployments verify tokens against both old and new for 24h
4. Swap: `JWT_ACCESS_SECRET` = new value, remove `_NEW`
5. Redeploy.

*(Currently the API does not support dual-secret verification; add it before rotating in prod.)*

---

## Environment Variables

See [apps/api/.env.example](../apps/api/.env.example) for the complete list with comments.

**Required in production:**

| Var | Notes |
|-----|-------|
| `NODE_ENV=production` | Enables strict env checks + JSON logs |
| `DATABASE_URL` | Pooled Postgres URL (Supabase pooler) |
| `REDIS_URL` | Managed Redis |
| `CORS_ORIGINS` | Comma-sep — production storefront + admin domains only |
| `JWT_ACCESS_SECRET` | ≥ 64 chars |
| `JWT_REFRESH_SECRET` | ≥ 64 chars, different from access |
| `R2_*` | All five R2 vars populated |

Boot fails fast if any of the above is missing (see [apps/api/src/common/env.ts](../apps/api/src/common/env.ts)).

---

## Deployment

### First-time setup

1. Provision services: Supabase project, Cloudflare R2 bucket + custom domain, Upstash Redis
2. Populate GitHub repo secrets for `api-docker.yml` + `api-migrate.yml`:
   - `DATABASE_URL` (production)
   - Everything in the prod host env (so migrate workflow can run)
3. Push a git tag: `git tag v1.0.0 && git push --tags`
4. Workflows fire:
   - `api-docker.yml` builds `ghcr.io/<org>/denimisia-api:v1.0.0` and `:latest`
   - `api-migrate.yml` runs `prisma migrate deploy` against the prod DB

### Day-to-day deploys

- Merge to `main` → CI runs typecheck, lint, build, and pushes `:main` tag to GHCR
- Host platform (Fly/Render) auto-pulls `:main` — no manual step needed
- For migrations: bump a tag (`v1.0.1`) to trigger `api-migrate.yml` explicitly

### Rollback

```bash
# Roll container back:
fly deploy --image ghcr.io/<org>/denimisia-api:v1.0.0-previous

# Roll migration back: the hardening migration is destructive;
# keep a known-good DB snapshot before every migrate:deploy.
```

---

## Database Migrations

**We use Prisma migrations.** Schema changes MUST go through a migration.

### Creating a new migration (dev)

```bash
cd packages/database
pnpm exec prisma migrate dev --name describe_your_change
```

### Deploying to prod

Automated via `api-migrate.yml` on tag push. To run manually:

```bash
cd packages/database
DATABASE_URL=<prod> pnpm exec prisma migrate deploy
```

### Migration history (as of launch)

1. `20260406083534_init`
2. `20260412185643_add_soft_delete_and_order_status`
3. `20260412190152_add_order_status_history`
4. `20260413105116_add_cms_permissions_roles`
5. `20260420171614_sync_baseline_after_db_push` (empty — catches history up to DB state)
6. `20260420172303_schema_hardening` (indexes, FK cascades, timestamps, Review.isApproved)

---

## Data Hygiene — Pre-launch cleanup

Run ONCE before flipping DNS to production. Destructive — take a DB snapshot first.

```bash
cd packages/database
DRY_RUN=1 pnpm prod:cleanup        # preview
pnpm prod:cleanup                  # execute
```

This removes placeholder products/users/banners and creates or promotes a SUPER_ADMIN.

---

## Health Monitoring

- **GET /health** — liveness. Returns 200 if process is up. Container liveness probe.
- **GET /ready**  — readiness. Returns 200 if DB + Redis reachable. Routing probe.
- Log format: JSON in production with `reqId` per request (X-Request-Id header echoed).

Point your uptime monitor at `/ready` — alert on non-200 or when `checks.db != "ok"`.

---

## Incident Response Cheat-sheet

| Symptom | First-look command |
|---------|--------------------|
| 5xx rate spike | Tail logs grouped by `reqId`; check `/ready` for DB/Redis degraded |
| Slow DB queries | Supabase dashboard → Performance → Slow queries. Most common: missing index → add via migration |
| Stock overselling | Check `InventoryLog` for the variant. The `createOrder` transaction uses `FOR UPDATE` locking — overselling means a code path bypassed it |
| Auth rate-limit hit by real users | Tune rates in `auth.controller.ts` and `env.THROTTLE_*` |
| Stuck PENDING orders | Check `OrderStatusHistory`. Any PENDING > 7 days is flagged by the data audit; cron a job to auto-transition to PAYMENT_FAILED |

---

## R2 → CDN Domain Setup

1. Cloudflare dashboard → R2 → your bucket → **Settings → Public Access**
2. Attach custom domain `cdn.denimisia.com`
3. Add DNS CNAME `cdn` → `<bucket>.<account>.r2.cloudflarestorage.com`
4. Set `R2_PUBLIC_URL=https://cdn.denimisia.com` in host env
5. Restart API. New uploads and resolved URLs use the CDN domain.

---

## Ops Phone-home

- Uptime: UptimeRobot / BetterStack pointing at `/ready` every 60s
- Errors: Sentry DSN in `SENTRY_DSN` env (wire via pino-sentry if/when added)
- Analytics: PostHog or Plausible — neither wired yet; pick one before launch if you want conversion funnel

---

## Known gaps (pre-launch TODOs)

1. **Payment gateway** — no module yet; add SSLCommerz / bKash / Stripe per Bangladesh market
2. **Courier integration** — no module yet; Steadfast or Pathao recommended
3. **Transactional email** — no provider wired; add Resend or SendGrid
4. **Dual-JWT-secret support** — add to enable zero-downtime secret rotation
5. **Redis cache layer** — scaffolded (module exists) but not applied to product/category reads
6. **N+1 audit** — products/search endpoints not profiled under load
