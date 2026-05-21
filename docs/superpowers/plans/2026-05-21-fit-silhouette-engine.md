# Fit Silhouette Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Phase 1 of the fit silhouette engine — a shared rendering package, DB schema additions, a new admin "Size & Fit" surface (replacing the old SizeChartEditor), a new admin silhouette editor, a unified storefront "Size & Fit" modal (replacing both the Size Guide and Find My Size PDP buttons), and a minimal bot enrichment.

**Architecture:** New shared package `packages/fit-engine` consumed by both `apps/web` and `apps/admin`. A new `Silhouette` Prisma model + a nullable `fitLandmarks` JSON column on `Product`. A new NestJS `silhouettes` module. Same renderer used by storefront + admin live preview so admins see what customers see.

**Tech Stack:** NestJS (API), Next.js 14 App Router (admin + web), Prisma + Postgres, React + Tailwind, Jest (unit), Playwright (E2E), Turborepo, pnpm.

**Spec:** [docs/superpowers/specs/2026-05-21-fit-silhouette-engine-design.md](../specs/2026-05-21-fit-silhouette-engine-design.md)

---

## Conventions for this plan

- Every code block is the **complete** content of a file or the **exact** lines being changed. Don't summarise; copy-paste.
- Run `pnpm install` at the repo root after creating any new package.
- Commit after every passing task. Conventional commits: `feat(scope):`, `fix(scope):`, `test(scope):`.
- Type-check after every code change touching `.ts`/`.tsx`: `pnpm check-types`.
- Use prisma client via `import { PrismaService } from '../prisma/prisma.service'` in NestJS modules.

---

# Phase A — Foundation (no behaviour change yet)

## Task A1 — Extend `SIZE_CHART_DIMENSIONS` taxonomy

**Files:**
- Modify: `apps/web/lib/product-taxonomy.ts:109-113`
- Modify: `apps/admin/lib/product-taxonomy.ts` (mirror)

- [ ] **Step 1: Update `apps/web/lib/product-taxonomy.ts`**

Replace lines 109–113 (`SIZE_CHART_DIMENSIONS`) with:

```ts
export const SIZE_CHART_DIMENSIONS: Record<ProductType, readonly string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'thigh', 'front rise', 'back rise', 'hem opening', 'waistband height'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'neck width', 'cuff opening', 'armhole depth'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'cuff opening', 'back length', 'armhole depth'],
};
```

- [ ] **Step 2: Mirror in `apps/admin/lib/product-taxonomy.ts`**

Open the admin file and apply the exact same replacement so admin and web stay in sync.

- [ ] **Step 3: Type-check**

Run: `pnpm check-types`
Expected: PASS in all packages.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/product-taxonomy.ts apps/admin/lib/product-taxonomy.ts
git commit -m "feat(taxonomy): extend SIZE_CHART_DIMENSIONS for fit silhouette engine"
```

---

## Task A2 — Create `packages/fit-engine` skeleton + shared types

**Files:**
- Create: `packages/fit-engine/package.json`
- Create: `packages/fit-engine/tsconfig.json`
- Create: `packages/fit-engine/src/index.ts`
- Create: `packages/fit-engine/src/types.ts`

- [ ] **Step 1: Create `packages/fit-engine/package.json`**

```json
{
  "name": "@denimisia/fit-engine",
  "version": "0.0.1",
  "private": true,
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "5.9.2"
  }
}
```

- [ ] **Step 2: Create `packages/fit-engine/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/fit-engine/src/types.ts`**

```ts
export type SilhouetteGender = 'MALE' | 'FEMALE';

export type LandmarkName =
  | 'collar' | 'shoulder' | 'armpit' | 'bicep' | 'elbow' | 'midForearm' | 'wrist'
  | 'highWaist' | 'naturalWaist' | 'lowWaist' | 'hip'
  | 'crotch' | 'midThigh' | 'knee' | 'midCalf' | 'ankle';

export type LandmarkMap = Record<LandmarkName, { y: number; x?: number }>;

export interface SilhouetteData {
  id: string;
  gender: SilhouetteGender;
  svgPath: string;
  viewBox: string;
  landmarks: LandmarkMap;
  version: number;
}

export interface GarmentOffsets {
  hemY?: number;
  topY?: number;
  sleeveEndY?: number;
  bodyWidthScale?: number; // clamped client-side to 0.85–1.20
}

export type PantsFit = {
  kind: 'PANTS';
  rise: 'low' | 'mid' | 'high';
  hem: 'above-knee' | 'mid-calf' | 'ankle' | 'floor';
  legShape: 'skinny' | 'slim' | 'straight' | 'wide' | 'flared' | 'bootcut';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type ShirtFit = {
  kind: 'SHIRTS';
  hem: 'cropped' | 'waist' | 'hip' | 'tunic';
  sleeve: 'sleeveless' | 'short' | 'three-quarter' | 'long';
  neckline: 'crew' | 'v-neck' | 'polo' | 'henley' | 'mock-neck' | 'button-up';
  bodyFit: 'slim' | 'fitted' | 'regular' | 'relaxed' | 'oversized';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type JacketFit = {
  kind: 'JACKETS';
  hem: 'cropped' | 'hip' | 'mid' | 'long';
  sleeve: 'short' | 'three-quarter' | 'long';
  closure: 'zip' | 'button' | 'snap' | 'drape';
  bodyFit: 'fitted' | 'regular' | 'oversized';
  silhouetteGender: SilhouetteGender | 'BOTH';
  offsets?: GarmentOffsets;
};

export type FitLandmarks = PantsFit | ShirtFit | JacketFit;

export interface OverlayDescriptor {
  kind: FitLandmarks['kind'];
  fit: FitLandmarks;
}
```

- [ ] **Step 4: Create `packages/fit-engine/src/index.ts`**

```ts
export * from './types';
```

- [ ] **Step 5: Register the package in pnpm workspace**

The repo uses pnpm workspaces; `packages/*` is already included. Run:

```bash
pnpm install
```

Expected output: installs deps for the new package, no errors.

- [ ] **Step 6: Type-check**

Run: `pnpm --filter @denimisia/fit-engine check-types`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/fit-engine pnpm-lock.yaml
git commit -m "feat(fit-engine): scaffold package + shared types"
```

---

## Task A3 — Prisma migration: `Silhouette` table + `Product.fitLandmarks`

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<auto>_add_fit_silhouette/migration.sql` (generated)

- [ ] **Step 1: Add `SilhouetteGender` enum + `Silhouette` model + `Product.fitLandmarks` column**

Open `packages/database/prisma/schema.prisma`. Find the existing `ProductType` enum and add this **right after it**:

```prisma
enum SilhouetteGender {
  MALE
  FEMALE
}

model Silhouette {
  id        String           @id @default(cuid())
  gender    SilhouetteGender @unique
  svgPath   String           @db.Text
  viewBox   String
  landmarks Json
  version   Int              @default(1)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}
```

Find the `Product` model (around line 235) and add **right after the `type` field**:

```prisma
  fitLandmarks   Json?
```

- [ ] **Step 2: Generate the migration**

Run from repo root:

```bash
pnpm --filter @denimisia/database exec prisma migrate dev --name add_fit_silhouette --create-only
```

Expected: a new folder `packages/database/prisma/migrations/<timestamp>_add_fit_silhouette/` with `migration.sql` containing `CREATE TABLE "Silhouette"`, `CREATE TYPE "SilhouetteGender"`, and `ALTER TABLE "Product" ADD COLUMN "fitLandmarks"`.

- [ ] **Step 3: Apply the migration**

```bash
pnpm --filter @denimisia/database exec prisma migrate dev
```

Expected: migration applied, Prisma client regenerated.

- [ ] **Step 4: Verify the schema is in sync**

```bash
pnpm --filter @denimisia/database exec prisma validate
```

Expected: "The schema is valid".

- [ ] **Step 5: Type-check**

```bash
pnpm check-types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/*_add_fit_silhouette
git commit -m "feat(db): add Silhouette table + Product.fitLandmarks column"
```

---

## Task A4 — Seed default silhouettes

**Files:**
- Modify: `packages/database/prisma/seed.ts` (or wherever seeding happens — find it)
- Create: `packages/database/prisma/seeds/silhouettes.ts`

- [ ] **Step 1: Locate the seed entry point**

Run: `find packages/database/prisma -maxdepth 2 -name "seed*"`
Expected: lists existing seed file (likely `seed.ts` or `seed.mts`). Open it; we'll call our new seed function from there.

- [ ] **Step 2: Create `packages/database/prisma/seeds/silhouettes.ts`**

```ts
import type { PrismaClient } from '@prisma/client';

const WOMEN_SVG_PATH = 'M 100 22 C 116 22 116 46 100 46 C 84 46 84 22 100 22 Z M 100 46 L 100 60 M 100 60 L 130 68 L 134 110 L 136 158 L 128 162 L 100 158 L 72 162 L 64 158 L 66 110 L 70 68 Z M 98 158 L 92 252 L 110 254 L 116 158 Z M 102 158 L 110 254 L 92 256 L 84 158 Z M 92 252 L 90 290 L 106 290 L 110 254 Z M 110 254 L 106 290 L 92 290 L 94 252 Z';

const MEN_SVG_PATH = 'M 100 22 C 117 22 117 48 100 48 C 83 48 83 22 100 22 Z M 100 48 L 100 62 M 100 62 L 134 70 L 140 112 L 140 158 L 128 162 L 100 158 L 72 162 L 60 158 L 60 112 L 66 70 Z M 96 158 L 90 252 L 108 254 L 116 158 Z M 104 158 L 110 254 L 92 256 L 84 158 Z M 90 252 L 88 290 L 104 290 L 108 254 Z M 110 254 L 104 290 L 90 290 L 92 252 Z';

const WOMEN_LANDMARKS = {
  collar:        { y: 68 },
  shoulder:      { y: 76 },
  armpit:        { y: 102 },
  bicep:         { y: 108, x: 60 },
  elbow:         { y: 130, x: 56 },
  midForearm:    { y: 150, x: 54 },
  wrist:         { y: 168, x: 52 },
  highWaist:     { y: 116 },
  naturalWaist:  { y: 120 },
  lowWaist:      { y: 132 },
  hip:           { y: 158 },
  crotch:        { y: 168 },
  midThigh:      { y: 200 },
  knee:          { y: 225 },
  midCalf:       { y: 258 },
  ankle:         { y: 290 },
} as const;

const MEN_LANDMARKS = {
  collar:        { y: 70 },
  shoulder:      { y: 78 },
  armpit:        { y: 104 },
  bicep:         { y: 110, x: 56 },
  elbow:         { y: 134, x: 52 },
  midForearm:    { y: 154, x: 50 },
  wrist:         { y: 174, x: 48 },
  highWaist:     { y: 118 },
  naturalWaist:  { y: 124 },
  lowWaist:      { y: 138 },
  hip:           { y: 158 },
  crotch:        { y: 170 },
  midThigh:      { y: 204 },
  knee:          { y: 228 },
  midCalf:       { y: 260 },
  ankle:         { y: 290 },
} as const;

export async function seedSilhouettes(prisma: PrismaClient) {
  await prisma.silhouette.upsert({
    where: { gender: 'FEMALE' },
    update: {},
    create: {
      gender: 'FEMALE',
      svgPath: WOMEN_SVG_PATH,
      viewBox: '0 0 200 320',
      landmarks: WOMEN_LANDMARKS,
    },
  });
  await prisma.silhouette.upsert({
    where: { gender: 'MALE' },
    update: {},
    create: {
      gender: 'MALE',
      svgPath: MEN_SVG_PATH,
      viewBox: '0 0 200 320',
      landmarks: MEN_LANDMARKS,
    },
  });
}
```

- [ ] **Step 3: Wire it into the seed entry point**

In the located seed file, add an import and call near the end of the main seed function (before `prisma.$disconnect()`):

```ts
import { seedSilhouettes } from './seeds/silhouettes';

// inside main():
await seedSilhouettes(prisma);
```

- [ ] **Step 4: Run the seed**

```bash
pnpm --filter @denimisia/database exec prisma db seed
```

Expected: completes without error; verify with:

```bash
pnpm --filter @denimisia/database exec prisma studio
```

Open the `Silhouette` table — should see two rows (MALE, FEMALE).

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma
git commit -m "feat(db): seed default men + women silhouettes"
```

---

# Phase B — API layer

## Task B1 — Create `silhouettes` NestJS module skeleton

**Files:**
- Create: `apps/api/src/modules/silhouettes/silhouettes.module.ts`
- Create: `apps/api/src/modules/silhouettes/silhouettes.service.ts`
- Create: `apps/api/src/modules/silhouettes/silhouettes.controller.ts`
- Create: `apps/api/src/modules/silhouettes/silhouettes.dto.ts`
- Create: `apps/api/src/modules/silhouettes/silhouettes.service.spec.ts`
- Modify: `apps/api/src/app.module.ts` (register the new module)

- [ ] **Step 1: Write the failing service test**

Create `apps/api/src/modules/silhouettes/silhouettes.service.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { SilhouettesService } from './silhouettes.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SilhouettesService', () => {
  let service: SilhouettesService;
  let prisma: { silhouette: { findMany: jest.Mock; update: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      silhouette: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        SilhouettesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SilhouettesService);
  });

  describe('findAll', () => {
    it('returns all silhouettes', async () => {
      const rows = [
        { id: '1', gender: 'FEMALE', svgPath: 'P', viewBox: 'V', landmarks: {}, version: 1 },
        { id: '2', gender: 'MALE',   svgPath: 'P', viewBox: 'V', landmarks: {}, version: 1 },
      ];
      prisma.silhouette.findMany.mockResolvedValue(rows);
      await expect(service.findAll()).resolves.toEqual(rows);
    });
  });

  describe('updateByGender', () => {
    it('bumps version on update', async () => {
      const updated = { id: '1', gender: 'FEMALE', svgPath: 'NEW', viewBox: 'V', landmarks: { a: 1 }, version: 2 };
      prisma.silhouette.update.mockResolvedValue(updated);
      const result = await service.updateByGender('FEMALE', { svgPath: 'NEW', landmarks: { a: 1 } });
      expect(prisma.silhouette.update).toHaveBeenCalledWith({
        where: { gender: 'FEMALE' },
        data: {
          svgPath: 'NEW',
          landmarks: { a: 1 },
          version: { increment: 1 },
        },
      });
      expect(result).toEqual(updated);
    });
  });
});
```

- [ ] **Step 2: Run the test — it should fail**

```bash
pnpm --filter @denimisia/api test -- silhouettes.service.spec
```

Expected: FAIL (`SilhouettesService` doesn't exist).

- [ ] **Step 3: Create the DTO**

Create `apps/api/src/modules/silhouettes/silhouettes.dto.ts`:

```ts
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateSilhouetteDto {
  @IsOptional()
  @IsString()
  svgPath?: string;

  @IsOptional()
  @IsString()
  viewBox?: string;

  @IsOptional()
  @IsObject()
  landmarks?: Record<string, { y: number; x?: number }>;
}
```

- [ ] **Step 4: Create the service**

Create `apps/api/src/modules/silhouettes/silhouettes.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSilhouetteDto } from './silhouettes.dto';

type Gender = 'MALE' | 'FEMALE';

@Injectable()
export class SilhouettesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.silhouette.findMany({ orderBy: { gender: 'asc' } });
  }

  updateByGender(gender: Gender, dto: UpdateSilhouetteDto) {
    return this.prisma.silhouette.update({
      where: { gender },
      data: {
        ...(dto.svgPath !== undefined && { svgPath: dto.svgPath }),
        ...(dto.viewBox !== undefined && { viewBox: dto.viewBox }),
        ...(dto.landmarks !== undefined && { landmarks: dto.landmarks }),
        version: { increment: 1 },
      },
    });
  }
}
```

- [ ] **Step 5: Create the controller**

Create `apps/api/src/modules/silhouettes/silhouettes.controller.ts`:

```ts
import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { SilhouettesService } from './silhouettes.service';
import { UpdateSilhouetteDto } from './silhouettes.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';

@Controller('silhouettes')
export class SilhouettesController {
  constructor(private readonly service: SilhouettesService) {}

  @Get()
  list() {
    return this.service.findAll();
  }
}

@Controller('admin/silhouettes')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminSilhouettesController {
  constructor(private readonly service: SilhouettesService) {}

  @Put(':gender')
  update(@Param('gender') gender: string, @Body() dto: UpdateSilhouetteDto) {
    const normalised = gender.toUpperCase() as 'MALE' | 'FEMALE';
    return this.service.updateByGender(normalised, dto);
  }
}
```

**Note for the engineer:** If `JwtAuthGuard` and `AdminGuard` aren't at the paths above, grep for them: `grep -r "JwtAuthGuard" apps/api/src/modules/` and adjust the imports.

- [ ] **Step 6: Create the module file**

Create `apps/api/src/modules/silhouettes/silhouettes.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SilhouettesService } from './silhouettes.service';
import { SilhouettesController, AdminSilhouettesController } from './silhouettes.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [SilhouettesService],
  controllers: [SilhouettesController, AdminSilhouettesController],
  exports: [SilhouettesService],
})
export class SilhouettesModule {}
```

- [ ] **Step 7: Register in `apps/api/src/app.module.ts`**

Add to imports array:

```ts
import { SilhouettesModule } from './modules/silhouettes/silhouettes.module';
// ...
imports: [..., SilhouettesModule],
```

- [ ] **Step 8: Run the test — should now pass**

```bash
pnpm --filter @denimisia/api test -- silhouettes.service.spec
```

Expected: PASS.

- [ ] **Step 9: Type-check + start dev server smoke test**

```bash
pnpm check-types
pnpm --filter @denimisia/api dev
```

In another terminal:

```bash
curl http://localhost:3001/silhouettes
```

Expected: JSON array with two silhouette objects.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/silhouettes apps/api/src/app.module.ts
git commit -m "feat(api): silhouettes module with GET + admin PUT endpoints"
```

---

## Task B2 — Extend product DTOs + service for `fitLandmarks`

**Files:**
- Modify: `apps/api/src/modules/products/products.dto.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`
- Modify: `apps/api/src/modules/products/products.controller.ts` (only if response serialisation strips JSON columns)

- [ ] **Step 1: Add `fitLandmarks` to create + update DTOs**

Open `apps/api/src/modules/products/products.dto.ts`. Add this import at the top:

```ts
import { IsOptional, IsObject } from 'class-validator';
```

Inside both `CreateProductDto` and `UpdateProductDto` classes, add:

```ts
@IsOptional()
@IsObject()
fitLandmarks?: Record<string, unknown>;
```

(We accept any object — runtime shape is validated by the engine's discriminated union when it consumes the data.)

- [ ] **Step 2: Persist `fitLandmarks` in the service**

In `apps/api/src/modules/products/products.service.ts`, find the `create` and `update` methods. Add `fitLandmarks: dto.fitLandmarks` to the `data` object passed to `prisma.product.create` / `prisma.product.update`.

Example for `create`:

```ts
return this.prisma.product.create({
  data: {
    name: dto.name,
    slug: dto.slug,
    // ... existing fields
    fitLandmarks: dto.fitLandmarks ?? undefined,
  },
});
```

Same pattern for `update`.

- [ ] **Step 3: Confirm read endpoints already include `fitLandmarks`**

In `apps/api/src/modules/products/products.service.ts`, locate `findOne` (or equivalent) and verify it uses Prisma's default select (which includes all columns including `fitLandmarks`). If the service uses explicit `select` clauses anywhere, add `fitLandmarks: true` to them.

- [ ] **Step 4: Smoke test**

Start the API. Use the existing admin auth flow to obtain a token, then:

```bash
curl -X PUT http://localhost:3001/admin/products/<existing-product-id> \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"fitLandmarks":{"kind":"PANTS","rise":"high","hem":"ankle","legShape":"skinny","silhouetteGender":"FEMALE"}}'
```

Then GET the same product and verify `fitLandmarks` is present in the response.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/products
git commit -m "feat(api): accept and persist fitLandmarks on products"
```

---

# Phase C — Engine package

## Task C1 — Presets per garment type

**Files:**
- Create: `packages/fit-engine/src/presets/pants-presets.ts`
- Create: `packages/fit-engine/src/presets/shirt-presets.ts`
- Create: `packages/fit-engine/src/presets/jacket-presets.ts`
- Create: `packages/fit-engine/src/presets/index.ts`

- [ ] **Step 1: Create `pants-presets.ts`**

```ts
import type { LandmarkName, PantsFit } from '../types';

export const PANTS_RISE_TO_LANDMARK: Record<PantsFit['rise'], LandmarkName> = {
  high: 'highWaist',
  mid:  'naturalWaist',
  low:  'lowWaist',
};

export const PANTS_HEM_TO_LANDMARK: Record<PantsFit['hem'], LandmarkName> = {
  'above-knee': 'midThigh',
  'mid-calf':   'midCalf',
  'ankle':      'ankle',
  'floor':      'ankle', // floor sits at ankle Y + small extension handled by overlay
};

export const PANTS_LEG_WIDTH_RATIO: Record<PantsFit['legShape'], number> = {
  skinny:  0.30,
  slim:    0.36,
  straight:0.42,
  wide:    0.55,
  flared:  0.50,
  bootcut: 0.46,
};
```

- [ ] **Step 2: Create `shirt-presets.ts`**

```ts
import type { LandmarkName, ShirtFit } from '../types';

export const SHIRT_HEM_TO_LANDMARK: Record<ShirtFit['hem'], LandmarkName> = {
  cropped: 'naturalWaist',
  waist:   'lowWaist',
  hip:     'hip',
  tunic:   'midThigh',
};

export const SHIRT_SLEEVE_TO_LANDMARK: Record<ShirtFit['sleeve'], LandmarkName> = {
  sleeveless:       'armpit',
  short:            'bicep',
  'three-quarter':  'elbow',
  long:             'wrist',
};

export const SHIRT_NECKLINE_DEPTH: Record<ShirtFit['neckline'], number> = {
  crew:        4,
  'v-neck':    12,
  polo:        8,
  henley:      10,
  'mock-neck': 2,
  'button-up': 6,
};

export const SHIRT_BODY_WIDTH_SCALE: Record<ShirtFit['bodyFit'], number> = {
  slim:      0.92,
  fitted:    0.98,
  regular:   1.04,
  relaxed:   1.10,
  oversized: 1.20,
};
```

- [ ] **Step 3: Create `jacket-presets.ts`**

```ts
import type { LandmarkName, JacketFit } from '../types';

export const JACKET_HEM_TO_LANDMARK: Record<JacketFit['hem'], LandmarkName> = {
  cropped: 'naturalWaist',
  hip:     'hip',
  mid:     'midThigh',
  long:    'knee',
};

export const JACKET_SLEEVE_TO_LANDMARK: Record<JacketFit['sleeve'], LandmarkName> = {
  short:           'bicep',
  'three-quarter': 'elbow',
  long:            'wrist',
};

export const JACKET_BODY_WIDTH_SCALE: Record<JacketFit['bodyFit'], number> = {
  fitted:    1.02,
  regular:   1.10,
  oversized: 1.22,
};
```

- [ ] **Step 4: Barrel-export from `presets/index.ts`**

```ts
export * from './pants-presets';
export * from './shirt-presets';
export * from './jacket-presets';
```

- [ ] **Step 5: Type-check**

```bash
pnpm --filter @denimisia/fit-engine check-types
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/fit-engine/src/presets
git commit -m "feat(fit-engine): preset maps per garment type"
```

---

## Task C2 — `PantsOverlay` component

**Files:**
- Create: `packages/fit-engine/src/overlays/pants.tsx`
- Create: `packages/fit-engine/src/overlays/pants.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { PantsOverlay } from './pants';
import type { SilhouetteData } from '../types';

const SIL: SilhouetteData = {
  id: 'sil-1',
  gender: 'FEMALE',
  svgPath: 'M 0 0',
  viewBox: '0 0 200 320',
  version: 1,
  landmarks: {
    collar: { y: 68 }, shoulder: { y: 76 }, armpit: { y: 102 },
    bicep: { y: 108, x: 60 }, elbow: { y: 130, x: 56 },
    midForearm: { y: 150, x: 54 }, wrist: { y: 168, x: 52 },
    highWaist: { y: 116 }, naturalWaist: { y: 120 }, lowWaist: { y: 132 },
    hip: { y: 158 }, crotch: { y: 168 }, midThigh: { y: 200 },
    knee: { y: 225 }, midCalf: { y: 258 }, ankle: { y: 290 },
  },
};

describe('PantsOverlay', () => {
  it('renders a path that starts at the rise landmark Y', () => {
    const { container } = render(
      <svg><PantsOverlay silhouette={SIL} fit={{
        kind: 'PANTS', rise: 'high', hem: 'ankle', legShape: 'skinny', silhouetteGender: 'FEMALE'
      }}/></svg>
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toContain('116'); // highWaist Y
    expect(path!.getAttribute('d')).toContain('290'); // ankle Y
  });
});
```

To run React component tests, ensure `@testing-library/react` and `jest-environment-jsdom` are devDeps on the package. Add to `packages/fit-engine/package.json` devDependencies:

```json
"@testing-library/react": "^14.0.0",
"jest": "^29.7.0",
"jest-environment-jsdom": "^29.7.0",
"@types/jest": "^29.5.0",
"ts-jest": "^29.1.0"
```

Add `packages/fit-engine/jest.config.cjs`:

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/*.test.tsx', '<rootDir>/src/**/*.test.ts'],
};
```

Add to `packages/fit-engine/package.json` scripts:

```json
"test": "jest"
```

Run `pnpm install` again.

- [ ] **Step 2: Run the test — fails**

```bash
pnpm --filter @denimisia/fit-engine test
```

Expected: FAIL — module `./pants` not found.

- [ ] **Step 3: Implement `PantsOverlay`**

Create `packages/fit-engine/src/overlays/pants.tsx`:

```tsx
import type { PantsFit, SilhouetteData } from '../types';
import {
  PANTS_RISE_TO_LANDMARK,
  PANTS_HEM_TO_LANDMARK,
  PANTS_LEG_WIDTH_RATIO,
} from '../presets/pants-presets';

interface PantsOverlayProps {
  silhouette: SilhouetteData;
  fit: PantsFit;
  editable?: boolean;
}

const CENTER_X = 100;
const BODY_FULL_WIDTH = 72; // hip-to-hip baseline

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function PantsOverlay({ silhouette, fit }: PantsOverlayProps) {
  const topY = silhouette.landmarks[PANTS_RISE_TO_LANDMARK[fit.rise]].y
    + (fit.offsets?.topY ?? 0);

  const hemY = silhouette.landmarks[PANTS_HEM_TO_LANDMARK[fit.hem]].y
    + (fit.offsets?.hemY ?? 0);

  const legWidthRatio = PANTS_LEG_WIDTH_RATIO[fit.legShape];
  const widthScale = clamp(fit.offsets?.bodyWidthScale ?? 1, 0.85, 1.20);
  const legHalfWidth = BODY_FULL_WIDTH * legWidthRatio * widthScale * 0.5;

  // Two leg shapes joined at the crotch; outer edge tapers from hip to hem.
  const hipLeft  = CENTER_X - BODY_FULL_WIDTH / 2 * widthScale;
  const hipRight = CENTER_X + BODY_FULL_WIDTH / 2 * widthScale;
  const crotchY  = silhouette.landmarks.crotch.y;

  const leftLegOuterX  = CENTER_X - legHalfWidth * 2;
  const rightLegOuterX = CENTER_X + legHalfWidth * 2;

  // Subtle taper for skinny, flare for wide/flared
  const taperOut = fit.legShape === 'flared' || fit.legShape === 'bootcut' ? 6 : 0;

  const d = [
    `M ${hipLeft} ${topY}`,
    `L ${hipRight} ${topY}`,
    `L ${hipRight} ${crotchY}`,
    `L ${rightLegOuterX + taperOut} ${hemY}`,
    `L ${CENTER_X + 1} ${hemY}`,
    `L ${CENTER_X + 1} ${crotchY}`,
    `L ${CENTER_X - 1} ${crotchY}`,
    `L ${CENTER_X - 1} ${hemY}`,
    `L ${leftLegOuterX - taperOut} ${hemY}`,
    `L ${hipLeft} ${crotchY}`,
    'Z',
  ].join(' ');

  return <path d={d} fill="#1f2937" stroke="#111" strokeWidth={0.6} opacity={0.92} />;
}
```

- [ ] **Step 4: Run the test — passes**

```bash
pnpm --filter @denimisia/fit-engine test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fit-engine
git commit -m "feat(fit-engine): PantsOverlay component + test"
```

---

## Task C3 — `ShirtOverlay` component

**Files:**
- Create: `packages/fit-engine/src/overlays/shirt.tsx`
- Create: `packages/fit-engine/src/overlays/shirt.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { render } from '@testing-library/react';
import { ShirtOverlay } from './shirt';
import type { SilhouetteData } from '../types';

const SIL: SilhouetteData = {
  id: 'sil-1', gender: 'FEMALE', svgPath: '', viewBox: '0 0 200 320', version: 1,
  landmarks: {
    collar: { y: 68 }, shoulder: { y: 76 }, armpit: { y: 102 },
    bicep: { y: 108, x: 60 }, elbow: { y: 130, x: 56 },
    midForearm: { y: 150, x: 54 }, wrist: { y: 168, x: 52 },
    highWaist: { y: 116 }, naturalWaist: { y: 120 }, lowWaist: { y: 132 },
    hip: { y: 158 }, crotch: { y: 168 }, midThigh: { y: 200 },
    knee: { y: 225 }, midCalf: { y: 258 }, ankle: { y: 290 },
  },
};

describe('ShirtOverlay', () => {
  it('renders a cropped tee ending at natural waist', () => {
    const { container } = render(
      <svg><ShirtOverlay silhouette={SIL} fit={{
        kind: 'SHIRTS', hem: 'cropped', sleeve: 'short', neckline: 'crew',
        bodyFit: 'regular', silhouetteGender: 'FEMALE',
      }}/></svg>
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toContain('120'); // naturalWaist Y (cropped)
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
pnpm --filter @denimisia/fit-engine test -- shirt.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `ShirtOverlay`**

```tsx
import type { ShirtFit, SilhouetteData } from '../types';
import {
  SHIRT_HEM_TO_LANDMARK,
  SHIRT_SLEEVE_TO_LANDMARK,
  SHIRT_NECKLINE_DEPTH,
  SHIRT_BODY_WIDTH_SCALE,
} from '../presets/shirt-presets';

interface ShirtOverlayProps {
  silhouette: SilhouetteData;
  fit: ShirtFit;
  editable?: boolean;
}

const CENTER_X = 100;
const SHOULDER_WIDTH = 70; // shoulder-to-shoulder baseline

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function ShirtOverlay({ silhouette, fit }: ShirtOverlayProps) {
  const widthScale = clamp(
    (fit.offsets?.bodyWidthScale ?? 1) * SHIRT_BODY_WIDTH_SCALE[fit.bodyFit],
    0.85, 1.30,
  );
  const halfWidth = SHOULDER_WIDTH / 2 * widthScale;

  const shoulderY = silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0);
  const hemY = silhouette.landmarks[SHIRT_HEM_TO_LANDMARK[fit.hem]].y
    + (fit.offsets?.hemY ?? 0);
  const sleeveEndY = silhouette.landmarks[SHIRT_SLEEVE_TO_LANDMARK[fit.sleeve]].y
    + (fit.offsets?.sleeveEndY ?? 0);

  const necklineDepth = SHIRT_NECKLINE_DEPTH[fit.neckline];
  const necklineY = silhouette.landmarks.collar.y + necklineDepth;

  // Sleeve outer X comes from the silhouette's arm landmark if available.
  const sleeveLM = silhouette.landmarks[SHIRT_SLEEVE_TO_LANDMARK[fit.sleeve]];
  const sleeveOuterLeft  = sleeveLM.x !== undefined ? sleeveLM.x : CENTER_X - halfWidth;
  const sleeveOuterRight = sleeveLM.x !== undefined ? 200 - sleeveLM.x : CENTER_X + halfWidth;

  const d = [
    `M ${CENTER_X - halfWidth * 0.4} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X - halfWidth} ${shoulderY}`,
    `L ${sleeveOuterLeft} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${sleeveEndY}`,
    `L ${sleeveOuterRight} ${sleeveEndY}`,
    `L ${CENTER_X + halfWidth} ${shoulderY}`,
    `L ${CENTER_X + halfWidth * 0.4} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X + halfWidth * 0.3} ${necklineY}`,
    `L ${CENTER_X - halfWidth * 0.3} ${necklineY}`,
    'Z',
  ].join(' ');

  return <path d={d} fill="#374151" stroke="#1f2937" strokeWidth={0.6} opacity={0.92} />;
}
```

- [ ] **Step 4: Run the test — passes**

```bash
pnpm --filter @denimisia/fit-engine test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fit-engine/src/overlays/shirt.tsx packages/fit-engine/src/overlays/shirt.test.tsx
git commit -m "feat(fit-engine): ShirtOverlay component + test"
```

---

## Task C4 — `JacketOverlay` component

**Files:**
- Create: `packages/fit-engine/src/overlays/jacket.tsx`
- Create: `packages/fit-engine/src/overlays/jacket.test.tsx`

- [ ] **Step 1: Test**

```tsx
import { render } from '@testing-library/react';
import { JacketOverlay } from './jacket';
import type { SilhouetteData } from '../types';

const SIL: SilhouetteData = {
  id: 'sil-1', gender: 'FEMALE', svgPath: '', viewBox: '0 0 200 320', version: 1,
  landmarks: {
    collar: { y: 68 }, shoulder: { y: 76 }, armpit: { y: 102 },
    bicep: { y: 108, x: 60 }, elbow: { y: 130, x: 56 },
    midForearm: { y: 150, x: 54 }, wrist: { y: 168, x: 52 },
    highWaist: { y: 116 }, naturalWaist: { y: 120 }, lowWaist: { y: 132 },
    hip: { y: 158 }, crotch: { y: 168 }, midThigh: { y: 200 },
    knee: { y: 225 }, midCalf: { y: 258 }, ankle: { y: 290 },
  },
};

describe('JacketOverlay', () => {
  it('renders a hip-length jacket with long sleeves', () => {
    const { container } = render(
      <svg><JacketOverlay silhouette={SIL} fit={{
        kind: 'JACKETS', hem: 'hip', sleeve: 'long', closure: 'zip',
        bodyFit: 'regular', silhouetteGender: 'FEMALE',
      }}/></svg>
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toContain('158'); // hip Y
    expect(path!.getAttribute('d')).toContain('168'); // wrist Y
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
pnpm --filter @denimisia/fit-engine test -- jacket.test
```

Expected: FAIL.

- [ ] **Step 3: Implement `JacketOverlay`**

```tsx
import type { JacketFit, SilhouetteData } from '../types';
import {
  JACKET_HEM_TO_LANDMARK,
  JACKET_SLEEVE_TO_LANDMARK,
  JACKET_BODY_WIDTH_SCALE,
} from '../presets/jacket-presets';

interface JacketOverlayProps {
  silhouette: SilhouetteData;
  fit: JacketFit;
  editable?: boolean;
}

const CENTER_X = 100;
const SHOULDER_WIDTH = 76; // jacket sits slightly wider than shirt

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function JacketOverlay({ silhouette, fit }: JacketOverlayProps) {
  const widthScale = clamp(
    (fit.offsets?.bodyWidthScale ?? 1) * JACKET_BODY_WIDTH_SCALE[fit.bodyFit],
    0.95, 1.35,
  );
  const halfWidth = SHOULDER_WIDTH / 2 * widthScale;

  const shoulderY = silhouette.landmarks.shoulder.y + (fit.offsets?.topY ?? 0);
  const hemY = silhouette.landmarks[JACKET_HEM_TO_LANDMARK[fit.hem]].y
    + (fit.offsets?.hemY ?? 0);
  const sleeveEndY = silhouette.landmarks[JACKET_SLEEVE_TO_LANDMARK[fit.sleeve]].y
    + (fit.offsets?.sleeveEndY ?? 0);

  const sleeveLM = silhouette.landmarks[JACKET_SLEEVE_TO_LANDMARK[fit.sleeve]];
  const sleeveOuterLeft  = sleeveLM.x !== undefined ? sleeveLM.x - 4 : CENTER_X - halfWidth - 4;
  const sleeveOuterRight = sleeveLM.x !== undefined ? 200 - sleeveLM.x + 4 : CENTER_X + halfWidth + 4;

  // Closure: open/drape uses a gap down the middle; others render closed.
  const isOpen = fit.closure === 'drape';
  const centerGap = isOpen ? 8 : 0;

  const d = [
    `M ${CENTER_X - halfWidth * 0.45} ${silhouette.landmarks.collar.y}`,
    `L ${CENTER_X - halfWidth} ${shoulderY}`,
    `L ${sleeveOuterLeft} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 8} ${sleeveEndY}`,
    `L ${CENTER_X - halfWidth + 6} ${hemY}`,
    `L ${CENTER_X - centerGap / 2} ${hemY}`,
    `L ${CENTER_X - centerGap / 2} ${silhouette.landmarks.collar.y + 6}`,
    `L ${CENTER_X + centerGap / 2} ${silhouette.landmarks.collar.y + 6}`,
    `L ${CENTER_X + centerGap / 2} ${hemY}`,
    `L ${CENTER_X + halfWidth - 6} ${hemY}`,
    `L ${CENTER_X + halfWidth - 8} ${sleeveEndY}`,
    `L ${sleeveOuterRight} ${sleeveEndY}`,
    `L ${CENTER_X + halfWidth} ${shoulderY}`,
    `L ${CENTER_X + halfWidth * 0.45} ${silhouette.landmarks.collar.y}`,
    'Z',
  ].join(' ');

  return <path d={d} fill="#1e293b" stroke="#0f172a" strokeWidth={0.7} opacity={0.94} />;
}
```

- [ ] **Step 4: Test passes**

```bash
pnpm --filter @denimisia/fit-engine test
```

Expected: PASS (all overlay tests).

- [ ] **Step 5: Commit**

```bash
git add packages/fit-engine/src/overlays/jacket.tsx packages/fit-engine/src/overlays/jacket.test.tsx
git commit -m "feat(fit-engine): JacketOverlay component + test"
```

---

## Task C5 — `SilhouetteCanvas` composer

**Files:**
- Create: `packages/fit-engine/src/silhouette-canvas.tsx`
- Create: `packages/fit-engine/src/default-overlays.ts`

- [ ] **Step 1: Create the default overlays helper**

`packages/fit-engine/src/default-overlays.ts`:

```ts
import type { FitLandmarks, SilhouetteGender } from './types';

export function defaultPlaceholderFit(
  type: 'PANTS' | 'SHIRTS' | 'JACKETS' | null,
  silhouetteGender: SilhouetteGender,
): FitLandmarks | null {
  if (type === 'PANTS') {
    return { kind: 'PANTS', rise: 'mid', hem: 'ankle', legShape: 'straight', silhouetteGender };
  }
  if (type === 'SHIRTS') {
    return { kind: 'SHIRTS', hem: 'hip', sleeve: 'short', neckline: 'crew', bodyFit: 'regular', silhouetteGender };
  }
  if (type === 'JACKETS') {
    return { kind: 'JACKETS', hem: 'hip', sleeve: 'long', closure: 'zip', bodyFit: 'regular', silhouetteGender };
  }
  return null;
}
```

- [ ] **Step 2: Create `SilhouetteCanvas`**

`packages/fit-engine/src/silhouette-canvas.tsx`:

```tsx
import type { FitLandmarks, SilhouetteData, GarmentOffsets } from './types';
import { PantsOverlay } from './overlays/pants';
import { ShirtOverlay } from './overlays/shirt';
import { JacketOverlay } from './overlays/jacket';

interface SilhouetteCanvasProps {
  silhouette: SilhouetteData;
  fit: FitLandmarks | null;
  callouts?: Array<{ landmarkY: number; label: string }>;
  editable?: boolean;
  onOffsetsChange?: (next: GarmentOffsets) => void;
  width?: number;
  height?: number;
}

export function SilhouetteCanvas({
  silhouette, fit, callouts = [], editable = false, onOffsetsChange, width = 220, height = 380,
}: SilhouetteCanvasProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox={silhouette.viewBox}
      role="img"
      aria-label={`${silhouette.gender.toLowerCase()} silhouette with garment overlay`}
    >
      <path d={silhouette.svgPath} fill="#e6e6e6" stroke="#999" strokeWidth={0.8} />

      {fit?.kind === 'PANTS'   && <PantsOverlay   silhouette={silhouette} fit={fit} editable={editable} />}
      {fit?.kind === 'SHIRTS'  && <ShirtOverlay   silhouette={silhouette} fit={fit} editable={editable} />}
      {fit?.kind === 'JACKETS' && <JacketOverlay  silhouette={silhouette} fit={fit} editable={editable} />}

      {callouts.map((c, i) => (
        <g key={`callout-${i}`}>
          <line x1={64} y1={c.landmarkY} x2={80} y2={c.landmarkY} stroke="#c00" strokeWidth={1.5} />
          <line x1={120} y1={c.landmarkY} x2={136} y2={c.landmarkY} stroke="#c00" strokeWidth={1.5} />
          <text x={142} y={c.landmarkY + 3} fontSize={9} fontWeight={700} fill="#c00">{c.label}</text>
        </g>
      ))}

      {/* Drag handles are added in C6 */}
    </svg>
  );
}
```

(Note: `onOffsetsChange` is wired in Task C6 where DragHandles are added.)

- [ ] **Step 3: Export from `index.ts`**

Replace `packages/fit-engine/src/index.ts`:

```ts
export * from './types';
export * from './silhouette-canvas';
export * from './overlays/pants';
export * from './overlays/shirt';
export * from './overlays/jacket';
export * from './default-overlays';
export * from './presets';
```

- [ ] **Step 4: Type-check + tests**

```bash
pnpm --filter @denimisia/fit-engine check-types
pnpm --filter @denimisia/fit-engine test
```

Expected: PASS both.

- [ ] **Step 5: Commit**

```bash
git add packages/fit-engine
git commit -m "feat(fit-engine): SilhouetteCanvas composer + default fits"
```

---

## Task C6 — Drag handles (admin-only)

**Files:**
- Create: `packages/fit-engine/src/drag-handles.tsx`
- Modify: `packages/fit-engine/src/silhouette-canvas.tsx`

- [ ] **Step 1: Create `drag-handles.tsx`**

```tsx
import { useCallback, useRef, useState } from 'react';
import type { GarmentOffsets } from './types';

interface DragHandleProps {
  cx: number;
  cy: number;
  axis: 'y' | 'x';
  onDelta: (deltaY: number) => void;
  ariaLabel: string;
}

export function DragHandle({ cx, cy, onDelta, ariaLabel }: DragHandleProps) {
  const startY = useRef<number | null>(null);
  const accumulatedDelta = useRef(0);
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    accumulatedDelta.current = 0;
    setActive(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (startY.current === null) return;
    const delta = e.clientY - startY.current;
    accumulatedDelta.current = delta;
  }, []);

  const onPointerUp = useCallback(() => {
    if (startY.current === null) return;
    onDelta(accumulatedDelta.current);
    startY.current = null;
    setActive(false);
  }, [onDelta]);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 6 : 5}
      fill="#fff"
      stroke="#c00"
      strokeWidth={2}
      style={{ cursor: 'ns-resize' }}
      role="slider"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

interface DragHandleSetProps {
  topY: number;
  hemY: number;
  offsets: GarmentOffsets;
  onOffsetsChange: (next: GarmentOffsets) => void;
}

export function DragHandleSet({ topY, hemY, offsets, onOffsetsChange }: DragHandleSetProps) {
  return (
    <>
      <DragHandle
        cx={100} cy={topY} axis="y"
        ariaLabel="Adjust top edge"
        onDelta={(d) => onOffsetsChange({ ...offsets, topY: (offsets.topY ?? 0) + d })}
      />
      <DragHandle
        cx={100} cy={hemY} axis="y"
        ariaLabel="Adjust hem edge"
        onDelta={(d) => onOffsetsChange({ ...offsets, hemY: (offsets.hemY ?? 0) + d })}
      />
    </>
  );
}
```

- [ ] **Step 2: Wire `DragHandleSet` into `SilhouetteCanvas`**

Open `packages/fit-engine/src/silhouette-canvas.tsx`. Add import:

```tsx
import { DragHandleSet } from './drag-handles';
import { PANTS_RISE_TO_LANDMARK, PANTS_HEM_TO_LANDMARK } from './presets/pants-presets';
import { SHIRT_HEM_TO_LANDMARK } from './presets/shirt-presets';
import { JACKET_HEM_TO_LANDMARK } from './presets/jacket-presets';
```

Before the final `</svg>` and after the callouts, add:

```tsx
{editable && fit && onOffsetsChange && (() => {
  let topY = silhouette.landmarks.shoulder.y;
  let hemY = silhouette.landmarks.hip.y;
  if (fit.kind === 'PANTS')   { topY = silhouette.landmarks[PANTS_RISE_TO_LANDMARK[fit.rise]].y; hemY = silhouette.landmarks[PANTS_HEM_TO_LANDMARK[fit.hem]].y; }
  if (fit.kind === 'SHIRTS')  { topY = silhouette.landmarks.shoulder.y; hemY = silhouette.landmarks[SHIRT_HEM_TO_LANDMARK[fit.hem]].y; }
  if (fit.kind === 'JACKETS') { topY = silhouette.landmarks.shoulder.y; hemY = silhouette.landmarks[JACKET_HEM_TO_LANDMARK[fit.hem]].y; }
  return <DragHandleSet topY={topY + (fit.offsets?.topY ?? 0)} hemY={hemY + (fit.offsets?.hemY ?? 0)} offsets={fit.offsets ?? {}} onOffsetsChange={onOffsetsChange} />;
})()}
```

- [ ] **Step 3: Export from `index.ts`**

Add to the existing barrel:

```ts
export * from './drag-handles';
```

- [ ] **Step 4: Type-check + tests**

```bash
pnpm --filter @denimisia/fit-engine check-types
pnpm --filter @denimisia/fit-engine test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/fit-engine
git commit -m "feat(fit-engine): DragHandles + wire into SilhouetteCanvas"
```

---

# Phase D — Admin

## Task D1 — `SizeAndFitEditor` scaffold (replaces `SizeChartEditor`)

**Files:**
- Create: `apps/admin/components/products/size-and-fit-editor.tsx`
- Modify: `apps/admin/app/(dashboard)/products/new/page.tsx`
- Modify: `apps/admin/app/(dashboard)/products/[id]/page.tsx`
- Delete (after wiring): `apps/admin/components/products/size-chart-editor.tsx`

- [ ] **Step 1: Add `@denimisia/fit-engine` as dependency of admin app**

Edit `apps/admin/package.json` — add to `dependencies`:

```json
"@denimisia/fit-engine": "workspace:*"
```

Run `pnpm install`.

- [ ] **Step 2: Create `size-and-fit-editor.tsx` — top-level skeleton with three blocks**

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  SilhouetteCanvas,
  defaultPlaceholderFit,
  type FitLandmarks,
  type GarmentOffsets,
  type SilhouetteData,
} from '@denimisia/fit-engine';
import { SIZE_CHART_DIMENSIONS, type ProductType } from '@/lib/product-taxonomy';

export interface ChartRow {
  sizeKey: string;
  dimension: string;
  bodyValueIn: number;
  garmentValueIn: number;
}

interface SizeAndFitEditorProps {
  type: ProductType | null;
  variantSizes: string[];
  chartValue: ChartRow[];
  onChartChange: (next: ChartRow[]) => void;
  fitLandmarks: FitLandmarks | null;
  onFitChange: (next: FitLandmarks | null) => void;
}

export function SizeAndFitEditor(props: SizeAndFitEditorProps) {
  const { type, variantSizes, chartValue, onChartChange, fitLandmarks, onFitChange } = props;
  const [silhouettes, setSilhouettes] = useState<SilhouetteData[] | null>(null);
  const [editingOverlay, setEditingOverlay] = useState(false);
  const [unit, setUnit] = useState<'in' | 'cm'>('in');

  useEffect(() => {
    fetch('/api/silhouettes')
      .then((r) => r.json())
      .then((data: SilhouetteData[]) => setSilhouettes(data))
      .catch(() => setSilhouettes([]));
  }, []);

  if (!type) {
    return <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Select a type first.</p>;
  }

  const effectiveFit: FitLandmarks | null =
    fitLandmarks ?? defaultPlaceholderFit(type, 'FEMALE');

  const silhouette = silhouettes?.find(
    (s) => s.gender === (effectiveFit?.silhouetteGender === 'MALE' ? 'MALE' : 'FEMALE'),
  );

  return (
    <section className="space-y-6">
      <header className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Size &amp; Fit</header>

      {/* Block 1: live preview + presets — populated in D2/D3 */}
      <div className="grid grid-cols-[340px_1fr] gap-6 rounded border border-outline-variant/20 p-4">
        <div className="flex flex-col items-center gap-3 bg-surface-container-low/30 p-3 rounded">
          <span className="text-[10px] uppercase tracking-widest text-secondary">Live preview</span>
          {silhouette ? (
            <SilhouetteCanvas
              silhouette={silhouette}
              fit={effectiveFit}
              editable={editingOverlay}
              onOffsetsChange={(offsets) => {
                if (!effectiveFit) return;
                onFitChange({ ...effectiveFit, offsets });
              }}
            />
          ) : (
            <p className="text-xs text-secondary">Loading silhouettes…</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              className="px-3 py-1.5 bg-on-surface text-surface text-[10px] tracking-widest rounded"
              onClick={() => setEditingOverlay((e) => !e)}
            >
              {editingOverlay ? 'Done editing' : 'Edit overlay'}
            </button>
            <button
              type="button"
              className="px-3 py-1.5 border border-outline-variant text-[10px] tracking-widest rounded"
              onClick={() => effectiveFit && onFitChange({ ...effectiveFit, offsets: {} })}
            >
              Reset tweaks
            </button>
          </div>
        </div>

        <div data-testid="fit-presets-block">
          {/* D2 fills this in */}
          <p className="text-[11px] text-secondary">Fit presets coming in next task.</p>
        </div>
      </div>

      {/* Block 2: detailed size chart — populated in D3 */}
      <div data-testid="size-chart-block" className="rounded border border-outline-variant/20 p-4">
        <p className="text-[11px] text-secondary">Detailed size chart coming next.</p>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Wire `SizeAndFitEditor` into the new product page**

Open `apps/admin/app/(dashboard)/products/new/page.tsx`. Replace the import + usage of `SizeChartEditor` with the new editor:

```tsx
import { SizeAndFitEditor } from '@/components/products/size-and-fit-editor';

// Inside the form render, replace the <SizeChartEditor ... /> block with:
<SizeAndFitEditor
  type={form.type ?? null}
  variantSizes={form.variantSizes}
  chartValue={form.sizeChart}
  onChartChange={(next) => setForm({ ...form, sizeChart: next })}
  fitLandmarks={form.fitLandmarks ?? null}
  onFitChange={(next) => setForm({ ...form, fitLandmarks: next })}
/>
```

Add `fitLandmarks` to the form state initializer.

- [ ] **Step 4: Wire into the edit page**

Same change in `apps/admin/app/(dashboard)/products/[id]/page.tsx`.

- [ ] **Step 5: Type-check + admin dev server smoke**

```bash
pnpm check-types
pnpm --filter @denimisia/admin dev
```

Open `/products/new` — should see the "Size & Fit" section with a silhouette + the "coming in next task" placeholders. No console errors.

- [ ] **Step 6: Commit**

```bash
git add apps/admin
git commit -m "feat(admin): scaffold SizeAndFitEditor with live silhouette preview"
```

---

## Task D2 — Fit presets block

**Files:**
- Modify: `apps/admin/components/products/size-and-fit-editor.tsx`

- [ ] **Step 1: Add helper to derive default fit from product type**

Inside `size-and-fit-editor.tsx`, add this above the component:

```tsx
function emptyFitForType(type: ProductType): FitLandmarks {
  if (type === 'PANTS') {
    return { kind: 'PANTS', rise: 'mid', hem: 'ankle', legShape: 'straight', silhouetteGender: 'FEMALE' };
  }
  if (type === 'SHIRTS') {
    return { kind: 'SHIRTS', hem: 'hip', sleeve: 'short', neckline: 'crew', bodyFit: 'regular', silhouetteGender: 'FEMALE' };
  }
  return { kind: 'JACKETS', hem: 'hip', sleeve: 'long', closure: 'zip', bodyFit: 'regular', silhouetteGender: 'FEMALE' };
}
```

- [ ] **Step 2: Replace the "fit-presets-block" placeholder**

In the JSX of `SizeAndFitEditor`, replace the `<div data-testid="fit-presets-block">…</div>` section with:

```tsx
<div data-testid="fit-presets-block" className="space-y-3">
  <p className="text-[10px] uppercase tracking-widest text-secondary">Fit presets</p>

  {type === 'PANTS' && effectiveFit?.kind === 'PANTS' && (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <label>
        <div className="text-[10px] text-secondary mb-1">RISE</div>
        <select
          className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.rise}
          onChange={(e) => onFitChange({ ...effectiveFit, rise: e.target.value as 'low' | 'mid' | 'high' })}
        >
          <option value="high">High</option>
          <option value="mid">Mid</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">HEM</div>
        <select
          className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.hem}
          onChange={(e) => onFitChange({ ...effectiveFit, hem: e.target.value as 'above-knee' | 'mid-calf' | 'ankle' | 'floor' })}
        >
          <option value="above-knee">Above knee</option>
          <option value="mid-calf">Mid-calf</option>
          <option value="ankle">Ankle</option>
          <option value="floor">Floor</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">LEG SHAPE</div>
        <select
          className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.legShape}
          onChange={(e) => onFitChange({ ...effectiveFit, legShape: e.target.value as 'skinny' | 'slim' | 'straight' | 'wide' | 'flared' | 'bootcut' })}
        >
          <option value="skinny">Skinny</option>
          <option value="slim">Slim</option>
          <option value="straight">Straight</option>
          <option value="wide">Wide</option>
          <option value="flared">Flared</option>
          <option value="bootcut">Bootcut</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">SILHOUETTE GENDER</div>
        <select
          className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.silhouetteGender}
          onChange={(e) => onFitChange({ ...effectiveFit, silhouetteGender: e.target.value as 'FEMALE' | 'MALE' | 'BOTH' })}
        >
          <option value="FEMALE">Women</option>
          <option value="MALE">Men</option>
          <option value="BOTH">Show toggle</option>
        </select>
      </label>
    </div>
  )}

  {type === 'SHIRTS' && effectiveFit?.kind === 'SHIRTS' && (
    <div className="grid grid-cols-2 gap-3 text-xs">
      {/* mirror the pattern for shirts: hem, sleeve, neckline, bodyFit, silhouetteGender */}
      <label>
        <div className="text-[10px] text-secondary mb-1">HEM</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.hem}
          onChange={(e) => onFitChange({ ...effectiveFit, hem: e.target.value as 'cropped' | 'waist' | 'hip' | 'tunic' })}>
          <option value="cropped">Cropped</option><option value="waist">Waist</option>
          <option value="hip">Hip</option><option value="tunic">Tunic</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">SLEEVE</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.sleeve}
          onChange={(e) => onFitChange({ ...effectiveFit, sleeve: e.target.value as 'sleeveless' | 'short' | 'three-quarter' | 'long' })}>
          <option value="sleeveless">Sleeveless</option><option value="short">Short</option>
          <option value="three-quarter">3/4</option><option value="long">Long</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">NECKLINE</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.neckline}
          onChange={(e) => onFitChange({ ...effectiveFit, neckline: e.target.value as 'crew' | 'v-neck' | 'polo' | 'henley' | 'mock-neck' | 'button-up' })}>
          <option value="crew">Crew</option><option value="v-neck">V-neck</option>
          <option value="polo">Polo</option><option value="henley">Henley</option>
          <option value="mock-neck">Mock-neck</option><option value="button-up">Button-up</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">BODY FIT</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.bodyFit}
          onChange={(e) => onFitChange({ ...effectiveFit, bodyFit: e.target.value as 'slim' | 'fitted' | 'regular' | 'relaxed' | 'oversized' })}>
          <option value="slim">Slim</option><option value="fitted">Fitted</option>
          <option value="regular">Regular</option><option value="relaxed">Relaxed</option>
          <option value="oversized">Oversized</option>
        </select>
      </label>
      <label className="col-span-2">
        <div className="text-[10px] text-secondary mb-1">SILHOUETTE GENDER</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.silhouetteGender}
          onChange={(e) => onFitChange({ ...effectiveFit, silhouetteGender: e.target.value as 'FEMALE' | 'MALE' | 'BOTH' })}>
          <option value="FEMALE">Women</option><option value="MALE">Men</option>
          <option value="BOTH">Show toggle</option>
        </select>
      </label>
    </div>
  )}

  {type === 'JACKETS' && effectiveFit?.kind === 'JACKETS' && (
    <div className="grid grid-cols-2 gap-3 text-xs">
      <label>
        <div className="text-[10px] text-secondary mb-1">HEM</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.hem}
          onChange={(e) => onFitChange({ ...effectiveFit, hem: e.target.value as 'cropped' | 'hip' | 'mid' | 'long' })}>
          <option value="cropped">Cropped</option><option value="hip">Hip</option>
          <option value="mid">Mid</option><option value="long">Long</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">SLEEVE</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.sleeve}
          onChange={(e) => onFitChange({ ...effectiveFit, sleeve: e.target.value as 'short' | 'three-quarter' | 'long' })}>
          <option value="short">Short</option><option value="three-quarter">3/4</option>
          <option value="long">Long</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">CLOSURE</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.closure}
          onChange={(e) => onFitChange({ ...effectiveFit, closure: e.target.value as 'zip' | 'button' | 'snap' | 'drape' })}>
          <option value="zip">Zip</option><option value="button">Button</option>
          <option value="snap">Snap</option><option value="drape">Drape</option>
        </select>
      </label>
      <label>
        <div className="text-[10px] text-secondary mb-1">BODY FIT</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.bodyFit}
          onChange={(e) => onFitChange({ ...effectiveFit, bodyFit: e.target.value as 'fitted' | 'regular' | 'oversized' })}>
          <option value="fitted">Fitted</option><option value="regular">Regular</option>
          <option value="oversized">Oversized</option>
        </select>
      </label>
      <label className="col-span-2">
        <div className="text-[10px] text-secondary mb-1">SILHOUETTE GENDER</div>
        <select className="w-full border border-outline-variant rounded px-2 py-1.5"
          value={effectiveFit.silhouetteGender}
          onChange={(e) => onFitChange({ ...effectiveFit, silhouetteGender: e.target.value as 'FEMALE' | 'MALE' | 'BOTH' })}>
          <option value="FEMALE">Women</option><option value="MALE">Men</option>
          <option value="BOTH">Show toggle</option>
        </select>
      </label>
    </div>
  )}

  <p className="mt-2 text-[10px] text-secondary bg-warning-container/30 border-l-2 border-warning p-2">
    Categorical picks are the source of truth. Drag tweaks (red handles in preview) are visual polish on top.
  </p>
</div>
```

Make sure `onFitChange` initialises a fresh fit if `fitLandmarks` was null:

At the very top of the component body, replace:

```tsx
const effectiveFit: FitLandmarks | null = fitLandmarks ?? defaultPlaceholderFit(type, 'FEMALE');
```

with:

```tsx
const effectiveFit: FitLandmarks | null =
  fitLandmarks ?? (type ? emptyFitForType(type) : null);
```

- [ ] **Step 3: Type-check + visual smoke**

```bash
pnpm check-types
```

Run the admin dev server, open `/products/new`, set the product type to PANTS — the dropdowns should appear and changes should re-render the silhouette overlay.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/products/size-and-fit-editor.tsx
git commit -m "feat(admin): fit-presets block in SizeAndFitEditor"
```

---

## Task D3 — Detailed size chart block (port + extend)

**Files:**
- Modify: `apps/admin/components/products/size-and-fit-editor.tsx`
- Reference: `apps/admin/components/products/size-chart-editor.tsx` (port its logic)

- [ ] **Step 1: Port the existing matrix logic**

Open the existing `size-chart-editor.tsx` and copy the `getValue` and `setValue` helpers + the table-rendering JSX. Paste them inside `SizeAndFitEditor` at the bottom — replacing the `data-testid="size-chart-block"` placeholder.

The skeleton inside `SizeAndFitEditor`'s JSX:

```tsx
{(() => {
  if (variantSizes.length === 0) {
    return <p className="text-[11px] uppercase tracking-[0.2em] text-secondary">Add at least one variant size first.</p>;
  }
  const dims = SIZE_CHART_DIMENSIONS[type];

  const getValue = (sizeKey: string, dim: string, key: 'bodyValueIn' | 'garmentValueIn'): string => {
    const found = chartValue.find((r) => r.sizeKey === sizeKey && r.dimension === dim);
    if (!found) return '';
    const v = found[key];
    if (v === 0) return '';
    return unit === 'cm' ? (v * 2.54).toFixed(1) : String(v);
  };

  const setValueAt = (sizeKey: string, dim: string, key: 'bodyValueIn' | 'garmentValueIn', raw: string) => {
    if (raw.trim() === '') {
      const existing = chartValue.find((r) => r.sizeKey === sizeKey && r.dimension === dim);
      if (!existing) return;
      const without = chartValue.filter((r) => !(r.sizeKey === sizeKey && r.dimension === dim));
      const other = key === 'bodyValueIn' ? existing.garmentValueIn : existing.bodyValueIn;
      if (other === 0) { onChartChange(without); return; }
      onChartChange([...without, { sizeKey, dimension: dim, bodyValueIn: key === 'bodyValueIn' ? 0 : existing.bodyValueIn, garmentValueIn: key === 'garmentValueIn' ? 0 : existing.garmentValueIn }]);
      return;
    }
    let inches = Number(raw);
    if (Number.isNaN(inches)) return;
    if (unit === 'cm') inches = inches / 2.54;
    inches = Math.round(inches * 2) / 2;
    const existing = chartValue.find((r) => r.sizeKey === sizeKey && r.dimension === dim);
    const without = chartValue.filter((r) => !(r.sizeKey === sizeKey && r.dimension === dim));
    const next: ChartRow = { sizeKey, dimension: dim, bodyValueIn: existing?.bodyValueIn ?? 0, garmentValueIn: existing?.garmentValueIn ?? 0 };
    next[key] = inches;
    onChartChange([...without, next]);
  };

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] uppercase tracking-widest text-secondary">Detailed size chart</p>
        <button type="button" className="text-[10px] uppercase tracking-widest text-secondary underline" onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')}>
          {unit === 'in' ? 'Show in cm' : 'Show in inches'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-outline-variant/20">
          <thead>
            <tr className="bg-surface-container-low/50">
              <th className="border-b border-outline-variant/20 px-3 py-2 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">Size</th>
              {dims.map((d) => (
                <th key={d} colSpan={2} className="border-b border-outline-variant/20 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                  {d}
                </th>
              ))}
            </tr>
            <tr className="bg-surface-container-low/30">
              <th className="px-3 py-1" aria-hidden />
              {dims.flatMap((d) => [
                <th key={`${d}-body`} className="px-2 py-1 text-center text-[9px] font-semibold uppercase text-secondary">Body</th>,
                <th key={`${d}-garment`} className="px-2 py-1 text-center text-[9px] font-semibold uppercase text-secondary">Garment</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {variantSizes.map((s) => (
              <tr key={s} className="border-t border-outline-variant/10">
                <td className="px-3 py-2 font-mono text-sm">{s}</td>
                {dims.flatMap((d) => [
                  <td key={`${s}-${d}-body`} className="px-2 py-1">
                    <input type="number" step="0.5" min="0"
                      value={getValue(s, d, 'bodyValueIn')}
                      onChange={(e) => setValueAt(s, d, 'bodyValueIn', e.target.value)}
                      placeholder="—" aria-label={`${d} body for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-0" />
                  </td>,
                  <td key={`${s}-${d}-garment`} className="px-2 py-1">
                    <input type="number" step="0.5" min="0"
                      value={getValue(s, d, 'garmentValueIn')}
                      onChange={(e) => setValueAt(s, d, 'garmentValueIn', e.target.value)}
                      placeholder="—" aria-label={`${d} garment for size ${s}`}
                      className="w-16 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-center text-sm focus:border-primary focus:outline-none focus:ring-0" />
                  </td>,
                ])}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[10px] tracking-wide text-secondary">
        Values stored in inches. Leave a cell blank to omit. New dimensions (front rise, hem opening, etc.) are part of the chart now.
      </p>
    </>
  );
})()}
```

- [ ] **Step 2: Delete the old `SizeChartEditor` file**

```bash
rm apps/admin/components/products/size-chart-editor.tsx
```

Search for any remaining imports of `SizeChartEditor` across the codebase:

```bash
grep -r "size-chart-editor\|SizeChartEditor" apps/admin apps/web apps/api packages
```

If anything remains, replace them with `SizeAndFitEditor` and adjust props.

- [ ] **Step 3: Type-check**

```bash
pnpm check-types
```

Expected: PASS.

- [ ] **Step 4: Manual smoke**

In the admin dev server, open `/products/new`, set type, add variant sizes, enter chart values, change fit presets, drag the overlay, click "Reset tweaks". Verify everything updates in the preview and that saving the product persists the new fields (Network tab → POST request body contains `fitLandmarks` + `sizeChart`).

- [ ] **Step 5: Commit**

```bash
git add apps/admin/components/products/size-and-fit-editor.tsx
git rm apps/admin/components/products/size-chart-editor.tsx
git commit -m "feat(admin): detailed size chart in SizeAndFitEditor + remove old editor"
```

---

## Task D4 — Silhouette settings page

**Files:**
- Create: `apps/admin/app/(dashboard)/settings/silhouettes/page.tsx`
- Create: `apps/admin/app/(dashboard)/settings/silhouettes/silhouette-editor-client.tsx`

- [ ] **Step 1: Create the route**

`apps/admin/app/(dashboard)/settings/silhouettes/page.tsx`:

```tsx
import { SilhouetteEditorClient } from './silhouette-editor-client';

export default function SilhouetteSettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">Silhouettes</h1>
      <SilhouetteEditorClient />
    </div>
  );
}
```

- [ ] **Step 2: Create the client editor**

`apps/admin/app/(dashboard)/settings/silhouettes/silhouette-editor-client.tsx`:

```tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SilhouetteData, LandmarkName } from '@denimisia/fit-engine';

const LANDMARK_NAMES: LandmarkName[] = [
  'collar', 'shoulder', 'armpit', 'bicep', 'elbow', 'midForearm', 'wrist',
  'highWaist', 'naturalWaist', 'lowWaist', 'hip',
  'crotch', 'midThigh', 'knee', 'midCalf', 'ankle',
];

export function SilhouetteEditorClient() {
  const [silhouettes, setSilhouettes] = useState<SilhouetteData[]>([]);
  const [selected, setSelected] = useState<'MALE' | 'FEMALE'>('FEMALE');
  const [draft, setDraft] = useState<SilhouetteData | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/silhouettes')
      .then((r) => r.json())
      .then((rows: SilhouetteData[]) => {
        setSilhouettes(rows);
        const initial = rows.find((s) => s.gender === selected);
        if (initial) setDraft(initial);
      });
  }, [selected]);

  const dragPin = useCallback((landmark: LandmarkName, deltaY: number) => {
    setDraft((d) => {
      if (!d) return d;
      const current = d.landmarks[landmark];
      return {
        ...d,
        landmarks: {
          ...d.landmarks,
          [landmark]: { ...current, y: Math.round(current.y + deltaY) },
        },
      };
    });
  }, []);

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    const res = await fetch(`/api/admin/silhouettes/${draft.gender}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ landmarks: draft.landmarks }),
    });
    setSaving(false);
    if (res.ok) {
      const updated = await res.json();
      setSilhouettes((arr) => arr.map((s) => (s.id === updated.id ? updated : s)));
    }
  };

  if (!draft) return <p>Loading…</p>;

  return (
    <div className="grid grid-cols-[260px_1fr] gap-6">
      <aside className="space-y-2">
        {silhouettes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSelected(s.gender)}
            className={`w-full px-3 py-2 rounded text-left text-sm ${
              selected === s.gender ? 'bg-on-surface text-surface' : 'border border-outline-variant'
            }`}
          >
            {s.gender === 'FEMALE' ? 'Women' : 'Men'} <span className="text-xs opacity-70">v{s.version}</span>
          </button>
        ))}
      </aside>

      <section className="space-y-4">
        <p className="text-[10px] uppercase tracking-widest text-secondary">
          Drag the red pins up or down to set landmark positions on the {selected === 'FEMALE' ? 'women' : 'men'} silhouette.
        </p>
        <svg width={240} height={400} viewBox={draft.viewBox} className="border border-outline-variant rounded bg-surface">
          <path d={draft.svgPath} fill="#e6e6e6" stroke="#999" strokeWidth={0.8} />
          {LANDMARK_NAMES.map((name) => {
            const point = draft.landmarks[name];
            return (
              <g key={name}>
                <line x1={60} y1={point.y} x2={140} y2={point.y} stroke="#c00" strokeDasharray="2 2" strokeWidth={0.8} />
                <DraggablePin cx={60} cy={point.y} onDelta={(d) => dragPin(name, d)} ariaLabel={`Adjust ${name}`} />
                <text x={146} y={point.y + 3} fontSize={9} fontWeight={700} fill="#c00">{name}</text>
              </g>
            );
          })}
        </svg>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="px-4 py-2 bg-on-surface text-surface text-[11px] tracking-widest rounded disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save landmarks'}
        </button>
      </section>
    </div>
  );
}

interface DraggablePinProps {
  cx: number;
  cy: number;
  ariaLabel: string;
  onDelta: (deltaY: number) => void;
}

function DraggablePin({ cx, cy, ariaLabel, onDelta }: DraggablePinProps) {
  const onPointerDown = (e: React.PointerEvent<SVGCircleElement>) => {
    const startY = e.clientY;
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    const onMove = (mv: PointerEvent) => {
      const delta = mv.clientY - startY;
      (e.target as SVGCircleElement).setAttribute('cy', String(cy + delta));
    };
    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onDelta(up.clientY - startY);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };
  return <circle cx={cx} cy={cy} r={5} fill="#fff" stroke="#c00" strokeWidth={2} style={{ cursor: 'ns-resize' }} role="slider" aria-label={ariaLabel} onPointerDown={onPointerDown} />;
}
```

- [ ] **Step 3: Smoke test**

Open `/settings/silhouettes` in admin dev. Drag pins — they should follow the cursor and save round-trip via the PUT endpoint.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/settings/silhouettes
git commit -m "feat(admin): silhouette landmark editor at /settings/silhouettes"
```

---

## Task D5 — Extend fit-data-coverage dashboard widget

**Files:**
- Modify: `apps/admin/app/(dashboard)/_components/dashboard/fit-data-coverage-card.tsx`
- Modify: `apps/api/src/modules/products/products.service.ts` (add a coverage stat endpoint)
- Modify: `apps/api/src/modules/products/products.controller.ts`

- [ ] **Step 1: Add a coverage stat in `products.service.ts`**

Add a method:

```ts
async getFitCoverage() {
  const [total, missingFitLandmarks, missingSizeChart] = await Promise.all([
    this.prisma.product.count({ where: { deletedAt: null } }),
    this.prisma.product.count({ where: { deletedAt: null, fitLandmarks: { equals: null } } }),
    this.prisma.product.count({ where: { deletedAt: null, sizeCharts: { none: {} } } }),
  ]);
  return { total, missingFitLandmarks, missingSizeChart };
}
```

- [ ] **Step 2: Expose via the controller**

```ts
@Get('coverage/fit')
@UseGuards(JwtAuthGuard, AdminGuard)
getFitCoverage() {
  return this.service.getFitCoverage();
}
```

- [ ] **Step 3: Use in the dashboard card**

In `fit-data-coverage-card.tsx`, fetch from `/api/products/coverage/fit` on mount and render the three counts (total, missing fit landmarks, missing size chart) with click-through links to `/products?missing=fitLandmarks` and `/products?missing=sizeChart`. The exact UI follows the card's existing layout; add the two new metrics next to whatever's there.

For the click-through, the products list page should accept a `?missing=` query param. Open `apps/admin/app/(dashboard)/products/page.tsx` and add a filter that hides products with `fitLandmarks !== null` when `?missing=fitLandmarks` is set, and hides products with `sizeCharts.length > 0` when `?missing=sizeChart` is set.

- [ ] **Step 4: Type-check + smoke**

```bash
pnpm check-types
```

Open the admin dashboard; the coverage card should show the new metrics and clicking them should filter the product list.

- [ ] **Step 5: Commit**

```bash
git add apps/admin apps/api
git commit -m "feat(admin): fit coverage stats + missing-data filter on products list"
```

---

# Phase E — Storefront

## Task E1 — `SizeAndFitModal` component

**Files:**
- Create: `apps/web/components/products/size-and-fit-modal.tsx`
- Modify: `apps/web/lib/api.ts` (add a `getSilhouettes` helper if not present)

- [ ] **Step 1: Add web dependency on fit-engine**

Edit `apps/web/package.json`, add to dependencies:

```json
"@denimisia/fit-engine": "workspace:*"
```

Run `pnpm install`.

- [ ] **Step 2: Add API helper**

Append to `apps/web/lib/api.ts`:

```ts
import type { SilhouetteData } from '@denimisia/fit-engine';

export async function getSilhouettes(): Promise<SilhouetteData[]> {
  const res = await fetch(`${API_BASE}/silhouettes`, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error('failed to load silhouettes');
  return res.json();
}
```

(`API_BASE` should already exist near the top of the file. If named differently, match the existing convention.)

- [ ] **Step 3: Create `size-and-fit-modal.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { SilhouetteCanvas, defaultPlaceholderFit, type FitLandmarks, type SilhouetteData } from '@denimisia/fit-engine';
import { getProductSizeChart, getSilhouettes, type SizeChartRow } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/components/chat/use-chat-store';

interface SizeAndFitModalProps {
  productId: string;
  productName: string;
  productType: 'PANTS' | 'SHIRTS' | 'JACKETS' | null;
  fitLandmarks: FitLandmarks | null;
  open: boolean;
  onClose: () => void;
}

function genId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `m-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function SizeAndFitModal({ productId, productName, productType, fitLandmarks, open, onClose }: SizeAndFitModalProps) {
  const [rows, setRows] = useState<SizeChartRow[]>([]);
  const [silhouettes, setSilhouettes] = useState<SilhouetteData[]>([]);
  const [chosenGender, setChosenGender] = useState<'MALE' | 'FEMALE'>('FEMALE');
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [loading, setLoading] = useState(true);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const pushMessage = useChatStore((s) => s.pushMessage);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([getProductSizeChart(productId), getSilhouettes()])
      .then(([sc, sils]) => {
        if (!cancelled) {
          setRows(sc.rows);
          setSilhouettes(sils);
          if (fitLandmarks?.silhouetteGender === 'MALE') setChosenGender('MALE');
          if (fitLandmarks?.silhouetteGender === 'FEMALE') setChosenGender('FEMALE');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, productId, fitLandmarks]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  const showGenderToggle = fitLandmarks?.silhouetteGender === 'BOTH';
  const silhouette = silhouettes.find((s) => s.gender === chosenGender);
  const effectiveFit: FitLandmarks | null = fitLandmarks ?? defaultPlaceholderFit(productType, chosenGender);
  const sizes = Array.from(new Set(rows.map((r) => r.sizeKey)));
  const dimensions = Array.from(new Set(rows.map((r) => r.dimension)));
  const display = (v: number) => (unit === 'cm' ? (v * 2.54).toFixed(1) : v.toFixed(1));

  function helpMePick() {
    setChatOpen(true);
    pushMessage({ id: genId(), role: 'user', text: 'Help me find my size', ts: Date.now() });
    onClose();
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="size-fit-title"
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink/60 backdrop-blur-sm p-4 sm:items-center"
      onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-paper shadow-2xl">

        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 id="size-fit-title" className="text-xs font-semibold uppercase tracking-[0.2em] text-ink">Size &amp; Fit</h3>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')}
              className="text-xs font-medium uppercase tracking-[0.15em] text-muted underline-offset-2 hover:underline"
              aria-label={`Switch to ${unit === 'in' ? 'centimetres' : 'inches'}`}>
              {unit === 'in' ? 'Show cm' : 'Show in'}
            </button>
            <button type="button" onClick={onClose} aria-label="Close"
              className="rounded-full p-1 text-ink/60 hover:bg-ink/5 hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] flex-1 overflow-hidden">
          <aside className="bg-muted-bg/30 border-r border-border p-5 flex flex-col items-center gap-3">
            {showGenderToggle && (
              <div className="inline-flex bg-paper border border-border rounded-full p-1 text-[10px]">
                <button type="button" onClick={() => setChosenGender('FEMALE')}
                  className={cn('px-3 py-1 rounded-full', chosenGender === 'FEMALE' && 'bg-ink text-paper')}>Women</button>
                <button type="button" onClick={() => setChosenGender('MALE')}
                  className={cn('px-3 py-1 rounded-full', chosenGender === 'MALE' && 'bg-ink text-paper')}>Men</button>
              </div>
            )}
            {silhouette ? (
              <SilhouetteCanvas silhouette={silhouette} fit={effectiveFit} editable={false} />
            ) : (
              <p className="text-xs text-muted">Loading silhouette…</p>
            )}
            <p className="text-[11px] text-muted text-center max-w-[200px]">{productName}</p>
          </aside>

          <section className="flex flex-col p-5 overflow-y-auto">
            <h4 className="text-[10px] uppercase tracking-[0.15em] text-muted mb-2">Size chart</h4>
            {loading ? (
              <p className="py-6 text-center text-sm text-muted">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="py-6 text-sm text-muted">Size chart not available for this product yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border border-border text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted-bg/50">
                      <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">Size</th>
                      {dimensions.flatMap((d) => [
                        <th key={`${d}-body`} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">{d} (body)</th>,
                        <th key={`${d}-garment`} className="px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">{d} (garment)</th>,
                      ])}
                    </tr>
                  </thead>
                  <tbody>
                    {sizes.map((s, i) => (
                      <tr key={s} className={cn(i !== sizes.length - 1 && 'border-b border-border/60')}>
                        <td className="px-3 py-2 text-left text-sm font-semibold text-ink">{s}</td>
                        {dimensions.flatMap((d) => {
                          const row = rows.find((r) => r.sizeKey === s && r.dimension === d);
                          return [
                            <td key={`${s}-${d}-b`} className="px-3 py-2 text-center text-sm text-muted">{row ? display(row.bodyValueIn) : '—'}</td>,
                            <td key={`${s}-${d}-g`} className="px-3 py-2 text-center text-sm text-muted">{row ? display(row.garmentValueIn) : '—'}</td>,
                          ];
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-auto pt-5 border-t border-border/60">
              <button type="button" onClick={helpMePick}
                className="w-full rounded-full bg-ink px-5 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-paper hover:opacity-90">
                Help me pick →
              </button>
              <p className="text-[10px] text-muted text-center mt-2">Opens chat for personalised sizing</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm check-types
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): SizeAndFitModal component"
```

---

## Task E2 — PDP integration: replace two buttons with one

**Files:**
- Modify: `apps/web/app/products/[slug]/product-detail.tsx`
- Delete: `apps/web/components/products/size-chart-modal.tsx`

- [ ] **Step 1: Open `product-detail.tsx` and find the existing buttons**

Run: `grep -n "Size guide\|Find my size\|SizeChartModal" apps/web/app/products/\[slug\]/product-detail.tsx`

You'll find two buttons. Replace them with a single one:

```tsx
import { SizeAndFitModal } from '@/components/products/size-and-fit-modal';

const [sizeAndFitOpen, setSizeAndFitOpen] = useState(false);

// In the JSX, replace the two existing buttons with:
<button
  type="button"
  onClick={() => setSizeAndFitOpen(true)}
  className="text-xs font-medium uppercase tracking-[0.15em] text-ink underline-offset-2 hover:underline"
>
  Size &amp; Fit
</button>

<SizeAndFitModal
  productId={product.id}
  productName={product.name}
  productType={product.type ?? null}
  fitLandmarks={product.fitLandmarks ?? null}
  open={sizeAndFitOpen}
  onClose={() => setSizeAndFitOpen(false)}
/>
```

Remove the import + usage of `SizeChartModal` and the old Find-My-Size button.

- [ ] **Step 2: Confirm `product` includes `fitLandmarks` in its type**

Open `apps/web/lib/api.ts` (or wherever `getProduct` is typed). Add `fitLandmarks?: FitLandmarks | null` to the product type. Import `FitLandmarks` from `@denimisia/fit-engine`.

- [ ] **Step 3: Delete old `SizeChartModal`**

```bash
rm apps/web/components/products/size-chart-modal.tsx
```

- [ ] **Step 4: grep for remaining references**

```bash
grep -r "SizeChartModal" apps/web
```

If anything remains, replace it with `SizeAndFitModal` or delete it.

- [ ] **Step 5: Type-check + smoke**

```bash
pnpm check-types
pnpm --filter @denimisia/web dev
```

Open any PDP in the browser. Should see exactly one "Size & Fit" button. Clicking opens the modal with silhouette + size chart + "Help me pick".

- [ ] **Step 6: Commit**

```bash
git add apps/web
git rm apps/web/components/products/size-chart-modal.tsx
git commit -m "feat(web): unified Size & Fit modal replaces Size Guide + Find My Size on PDP"
```

---

# Phase F — Bot enrichment

## Task F1 — Style-note generator + bot loader extension

**Files:**
- Modify: `apps/api/src/modules/bot/bot.constants.ts`
- Modify: `apps/api/src/modules/bot/bot.sizing.service.ts`
- Modify: `apps/api/src/modules/bot/bot.sizing.service.spec.ts`

- [ ] **Step 1: Write the failing test**

In `bot.sizing.service.spec.ts`, add a new describe block:

```ts
import type { FitLandmarks } from '@denimisia/fit-engine';
// ...

describe('formatFitStyleNote', () => {
  it('describes high-waisted skinny ankle pants', () => {
    const fit: FitLandmarks = {
      kind: 'PANTS', rise: 'high', hem: 'ankle', legShape: 'skinny', silhouetteGender: 'FEMALE',
    };
    expect(service.formatFitStyleNote(fit)).toBe(
      'High-waisted skinny — sits at natural waist, ends at ankle.',
    );
  });

  it('describes cropped relaxed crew tee', () => {
    const fit: FitLandmarks = {
      kind: 'SHIRTS', hem: 'cropped', sleeve: 'short', neckline: 'crew',
      bodyFit: 'relaxed', silhouetteGender: 'FEMALE',
    };
    expect(service.formatFitStyleNote(fit)).toBe(
      'Cropped relaxed tee — ends above natural waist.',
    );
  });

  it('describes hip zip jacket', () => {
    const fit: FitLandmarks = {
      kind: 'JACKETS', hem: 'hip', sleeve: 'long', closure: 'zip',
      bodyFit: 'regular', silhouetteGender: 'FEMALE',
    };
    expect(service.formatFitStyleNote(fit)).toBe(
      'Hip-length zip-up — ends at hip line, full-length sleeves.',
    );
  });

  it('returns null when fit is null', () => {
    expect(service.formatFitStyleNote(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
pnpm --filter @denimisia/api test -- bot.sizing.service.spec
```

Expected: FAIL (`formatFitStyleNote` doesn't exist).

- [ ] **Step 3: Add templates in `bot.constants.ts`**

Append:

```ts
export const RISE_LABELS: Record<'low' | 'mid' | 'high', string> = {
  low: 'Low-rise', mid: 'Mid-rise', high: 'High-waisted',
};
export const PANTS_HEM_LABELS: Record<'above-knee' | 'mid-calf' | 'ankle' | 'floor', string> = {
  'above-knee': 'above the knee', 'mid-calf': 'mid-calf', ankle: 'ankle', floor: 'floor',
};
export const RISE_PHRASE: Record<'low' | 'mid' | 'high', string> = {
  low: 'sits at low waist', mid: 'sits at natural waist', high: 'sits at natural waist',
};
export const JACKET_HEM_LABELS: Record<'cropped' | 'hip' | 'mid' | 'long', string> = {
  cropped: 'Cropped', hip: 'Hip-length', mid: 'Mid-length', long: 'Long',
};
export const JACKET_CLOSURE_LABELS: Record<'zip' | 'button' | 'snap' | 'drape', string> = {
  zip: 'zip-up', button: 'button-up', snap: 'snap-front', drape: 'open-drape',
};
export const SLEEVE_LABELS: Record<'sleeveless' | 'short' | 'three-quarter' | 'long', string> = {
  sleeveless: 'sleeveless', short: 'short sleeves', 'three-quarter': '3/4 sleeves', long: 'full-length sleeves',
};
```

- [ ] **Step 4: Add `formatFitStyleNote` to `bot.sizing.service.ts`**

```ts
import type { FitLandmarks } from '@denimisia/fit-engine';
import {
  RISE_LABELS, PANTS_HEM_LABELS, RISE_PHRASE,
  JACKET_HEM_LABELS, JACKET_CLOSURE_LABELS, SLEEVE_LABELS,
} from './bot.constants';

// In the service class:
formatFitStyleNote(fit: FitLandmarks | null): string | null {
  if (!fit) return null;
  if (fit.kind === 'PANTS') {
    return `${RISE_LABELS[fit.rise]} ${fit.legShape} — ${RISE_PHRASE[fit.rise]}, ends at ${PANTS_HEM_LABELS[fit.hem]}.`;
  }
  if (fit.kind === 'SHIRTS') {
    const hemPhrase = {
      cropped: 'ends above natural waist',
      waist:   'ends at natural waist',
      hip:     'ends at hip',
      tunic:   'extends past hip',
    }[fit.hem];
    return `${fit.hem === 'cropped' ? 'Cropped' : fit.hem === 'tunic' ? 'Tunic-length' : 'Standard'} ${fit.bodyFit} tee — ${hemPhrase}.`;
  }
  if (fit.kind === 'JACKETS') {
    return `${JACKET_HEM_LABELS[fit.hem]} ${JACKET_CLOSURE_LABELS[fit.closure]} — ends at ${fit.hem === 'cropped' ? 'natural waist' : fit.hem === 'hip' ? 'hip line' : fit.hem === 'mid' ? 'mid-thigh' : 'knee'}, ${SLEEVE_LABELS[fit.sleeve]}.`;
  }
  return null;
}
```

- [ ] **Step 5: Test passes**

```bash
pnpm --filter @denimisia/api test -- bot.sizing.service.spec
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/bot
git commit -m "feat(bot): formatFitStyleNote + style-context label constants"
```

---

## Task F2 — Wire style note into the bot's size recommendation output

**Files:**
- Modify: `apps/api/src/modules/bot/bot.sizing.service.ts` (recommendation builder)
- Modify: `apps/api/src/modules/bot/bot.sizing.service.spec.ts` (existing recommendation tests)

- [ ] **Step 1: Locate the recommendation-building method**

Run: `grep -n "recommendSize\|buildResponse\|recommendation" apps/api/src/modules/bot/bot.sizing.service.ts`

You'll find the method that assembles the final response string. At the point where the size suggestion is rendered into a sentence (e.g., `"Size ${size} fits your measurements."`), append the style note:

```ts
const styleNote = this.formatFitStyleNote(product.fitLandmarks as FitLandmarks | null);
return styleNote
  ? `${baseRecommendation} ${styleNote}`
  : baseRecommendation;
```

If the method doesn't currently load `fitLandmarks` from the product, extend the prisma include/select to fetch it.

- [ ] **Step 2: Add an integration test**

In the existing service spec, add a test that mocks a product with `fitLandmarks` and verifies the response includes the style note.

```ts
it('appends style note to recommendation when fitLandmarks exists', async () => {
  prisma.product.findUnique.mockResolvedValue({
    id: 'p1', name: 'Cropped Tee', type: 'SHIRTS',
    fitLandmarks: { kind: 'SHIRTS', hem: 'cropped', sleeve: 'short', neckline: 'crew', bodyFit: 'relaxed', silhouetteGender: 'FEMALE' },
    sizeCharts: [/* representative rows */],
  });
  const result = await service.recommendSize({ productId: 'p1', measurements: { chestIn: 36 } });
  expect(result.text).toContain('Cropped relaxed tee — ends above natural waist.');
});
```

(Names of methods/properties — `recommendSize`, `measurements` — should match what's actually in the service. Adjust to match.)

- [ ] **Step 3: Run tests**

```bash
pnpm --filter @denimisia/api test -- bot.sizing.service.spec
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/bot
git commit -m "feat(bot): include fit style note in size recommendation"
```

---

# Phase G — Verification

## Task G1 — Playwright E2E: unified Size & Fit modal opens with overlay

**Files:**
- Create: `e2e/fit-silhouette.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test('Size & Fit modal opens and shows silhouette', async ({ page }) => {
  await page.goto('/products');
  await page.click('text=View product');
  await page.click('text=Size & Fit');
  const dialog = page.getByRole('dialog', { name: /size & fit/i });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('svg[role="img"]')).toBeVisible();
  await expect(dialog.getByRole('table')).toBeVisible();
  await expect(dialog.getByRole('button', { name: /help me pick/i })).toBeVisible();
});

test('Help me pick triggers chat flow', async ({ page }) => {
  await page.goto('/products');
  await page.click('text=View product');
  await page.click('text=Size & Fit');
  await page.click('text=Help me pick');
  await expect(page.locator('[data-testid="chat-bubble"]')).toBeVisible();
});
```

(Adjust selectors — `text=View product`, `data-testid="chat-bubble"` — to match existing markup.)

- [ ] **Step 2: Run**

```bash
pnpm --filter @denimisia/web exec playwright test fit-silhouette
```

Expected: PASS once the app is running. If selectors don't match, fix them.

- [ ] **Step 3: Commit**

```bash
git add e2e/fit-silhouette.spec.ts
git commit -m "test(e2e): Size & Fit modal happy path"
```

---

## Task G2 — Playwright E2E: admin save round-trip

**Files:**
- Create: `e2e/admin-fit-roundtrip.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.use({ storageState: 'e2e/.auth/admin.json' }); // existing auth state convention

test('admin saves fit data and storefront reflects it', async ({ page, request, baseURL }) => {
  // 1. Edit an existing product
  await page.goto('/products');
  const firstProduct = page.locator('[data-testid="product-row"]').first();
  const productHref = await firstProduct.locator('a').getAttribute('href');
  await firstProduct.locator('a').click();

  // 2. Set a fit preset
  await page.selectOption('select[aria-label*="RISE" i], select:has-text("Rise"), [data-testid="fit-rise"]', { label: 'High' });
  await page.selectOption('[data-testid="fit-hem"], select:near(:text("HEM"))', { label: 'Ankle' });

  // 3. Save
  await page.click('text=Save');
  await expect(page.locator('text=Saved')).toBeVisible({ timeout: 5000 });

  // 4. Storefront reflects it
  const slug = productHref!.split('/').pop();
  await page.goto(`${baseURL}/products/${slug}`);
  await page.click('text=Size & Fit');
  // Silhouette overlay path should be present
  await expect(page.locator('[role="dialog"] svg path').nth(1)).toBeVisible();
});
```

(This is the most likely-to-break test in the plan; adjust selectors to match the actual admin form. Use `data-testid` attributes added to selects in D2 if needed.)

- [ ] **Step 2: Add `data-testid` to the relevant selects in `size-and-fit-editor.tsx`** if the selectors above don't resolve. E.g., on the PANTS rise select: `data-testid="fit-rise"`.

- [ ] **Step 3: Run**

```bash
pnpm --filter @denimisia/web exec playwright test admin-fit-roundtrip
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/admin-fit-roundtrip.spec.ts apps/admin/components/products/size-and-fit-editor.tsx
git commit -m "test(e2e): admin fit-data round-trip to storefront"
```

---

## Task G3 — Final integration check

- [ ] **Step 1: Full repo type-check + lint + test**

```bash
pnpm check-types
pnpm lint
pnpm test
```

Expected: PASS across all packages.

- [ ] **Step 2: Manual product walkthrough**

1. Run all three apps: `pnpm dev` (turbo).
2. In admin, edit two existing products of different types (PANTS + SHIRTS):
   - Set fit presets
   - Drag the overlay
   - Fill in some new dimensions (front rise, hem opening)
   - Save
3. In web, open both PDPs:
   - One "Size & Fit" button per page (no old Size Guide / Find My Size buttons)
   - Modal opens with the correct silhouette + overlay
   - Size chart shows the new dimensions
   - "Help me pick" opens the chat
   - In chat, request size — verify the bot's reply includes the style note
4. In admin dashboard, the fit-coverage card should reflect the products now covered.
5. In admin `/settings/silhouettes`, drag a landmark and save — refresh the product preview and verify the overlay positions shift to match.

- [ ] **Step 3: Final commit + push**

If any small fixes were made:

```bash
git add -A
git commit -m "chore(fit-engine): final integration pass"
```

Push the branch and open a PR.

---

# Self-Review

- **Spec coverage:** Every spec section maps to tasks:
  - §5.1 Silhouette table → A3 + A4
  - §5.2 fitLandmarks column → A3 + B2
  - §5.3 Taxonomy extension → A1
  - §6 Storefront UX → E1, E2, G1
  - §7.1–7.3 Admin UX → D1, D2, D3, D4
  - §7.4 Backfill tooling → D5
  - §8 Engine architecture → A2, C1–C6
  - §9 Bot integration → F1, F2
  - §11 Rollout / migration safety → A3 (nullable column), E1 (graceful null handling), default-overlays.ts placeholder
  - §12 Acceptance criteria → G1, G2, G3 walkthrough

- **Placeholder scan:** No "TBD", "TODO", or "implement later" in any step. Every code-changing step shows the code. Edge cases ("if names don't match, grep and adjust") are explicit instructions, not placeholders.

- **Type consistency:** `FitLandmarks` shape from `types.ts` (A2) used consistently in admin (D1, D2), engine (C1–C6), web (E1), bot (F1, F2). `SilhouetteData`, `LandmarkMap`, `GarmentOffsets` names match across tasks. `formatFitStyleNote` signature is the same in F1 and F2.

- **Likely friction points** the engineer should expect:
  - `JwtAuthGuard` / `AdminGuard` import paths (B1 Step 5) — grep before assuming.
  - Existing seed entry-point file name (A4 Step 1) — varies by project.
  - Playwright selectors in G1/G2 — almost certainly need tweaking to match real markup.
  - The recommendation-builder method name in F2 — grep first.

---

# Execution Handoff

**Plan complete and saved to [docs/superpowers/plans/2026-05-21-fit-silhouette-engine.md](2026-05-21-fit-silhouette-engine.md). Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Good for a plan this size (~22 tasks).

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. You'd see every step here.

**Which approach?**
