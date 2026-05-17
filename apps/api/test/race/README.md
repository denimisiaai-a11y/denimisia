# Inventory Race E2E Tests

Two-process race tests for the order-creation `SELECT FOR UPDATE` lock path. These tests stand up two independent `PrismaClient` connections against a real Postgres instance and verify that exactly one of two concurrent `createOrder` calls succeeds when the contested variant has `stock = 1`.

## Why a separate suite

The existing `test:e2e` suite (`apps/api/test/jest-e2e.json`) boots the full Nest app and hits HTTP routes. The race tests are lower-level: they call `OrdersService.createOrder` directly with two competing `PrismaClient` instances. They need an isolated, disposable Postgres so each run starts from a clean schema and there is zero risk of leaking test rows into the live database.

## Prerequisites

- Docker Desktop running
- `pnpm install` completed at repo root

## Running

```powershell
# 1. Start the disposable test Postgres (port 5433, tmpfs-backed, profile-gated)
#    --wait blocks until the container reports healthy so migrate deploy
#    in globalSetup does not race the Postgres startup window.
docker compose --profile test up -d --wait postgres-test

# 2. Run the race suite (globalSetup runs prisma migrate deploy against it)
pnpm --filter api test:race-e2e

# 3. Tear down when finished
docker compose --profile test down
```

## Schema sync strategy

`globalSetup` runs `prisma migrate deploy` against the test container. Migration `20260518000000_baseline_reset_capture_drift` captures the auth columns (`User.isActive`, `User.tokenVersion`), the five CMS tables (`SectionCuration`, `SectionProduct`, `MediaAsset`, `PageSlot`, `PageSlotHistory`), and the `updatedAt` default-cleanup ALTERs that had previously drifted into the live DB through unrecorded `prisma db push` runs.

## Configuration

The test DB URL defaults to `postgresql://denimisia:secret@localhost:5433/denimisia_test`. Override with `TEST_DATABASE_URL` if needed:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://...'
pnpm --filter api test:race-e2e
```

## Test contract

Each scenario asserts the four invariants the unit suite cannot prove against a real Postgres:

1. Exactly one promise fulfills, exactly one rejects with `BadRequestException('Insufficient stock for variant ...')`.
2. Post-race stock equals 0 (never goes negative).
3. Exactly one `Order` row exists for the contested entity.
4. Exactly one `InventoryLog` row of type `SALE` exists for the contested variant.

## Status

Two scenarios pass against a fresh `prisma migrate deploy`-applied schema: single-variant race and bundle-constituent race. Each asserts the four invariants above.
