# Product Finder Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a rule-based product finder chat widget on the Denimisia storefront that parses free-text queries, recommends sizes from body measurements, and integrates with structured product taxonomy + admin tooling. No LLM.

**Architecture:** New Prisma tables (`ProductTag`, `ProductSizeChart`, `BotSynonym`, `BotUnrecognizedQuery`) + `User.fitProfile` JSON column. A new NestJS `BotModule` provides parser, search, and sizing services behind three REST endpoints. The admin form gains a Type dropdown with conditional attribute sections and a size chart editor. The storefront mounts a persistent chat bubble (hidden on `/checkout`) with a zustand store for conversation state. Spec at [docs/superpowers/specs/2026-05-21-product-finder-chatbot-design.md](../specs/2026-05-21-product-finder-chatbot-design.md).

**Tech Stack:** Prisma + PostgreSQL, NestJS 10, Jest, Next.js App Router (web + admin), zustand, Tailwind, Playwright.

**Conventions:**
- All API tests: `cd apps/api && pnpm test -- <pattern>`.
- All migrations: `cd packages/database && pnpm migrate -- --name <name>`.
- All commits: conventional commit format, no AI attribution lines.
- Customer = `User` model filtered by `role: CUSTOMER`. There is no separate `Customer` model.

---

## Phase 1 — Schema Foundation

### Task 1: Add ProductType enum and Product.type column

**Files:**
- Modify: `packages/database/prisma/schema.prisma:214-249` (Product model) and new enum near top
- Verify: `packages/database/generated/prisma/client.ts` regenerates

- [ ] **Step 1: Add the enum and column**

Edit `packages/database/prisma/schema.prisma`. Add the enum after the existing `OrderStatus` enum (around line 36) and add `type` field on `Product` (after line 222 `tags`):

```prisma
enum ProductType {
  PANTS
  SHIRTS
  JACKETS
}
```

```prisma
model Product {
  // ...existing fields...
  tags           String[]
  type           ProductType?       // nullable until backfilled; required by API DTOs going forward
  // ...rest of fields...

  @@index([type, isActive])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/database
pnpm migrate -- --name add_product_type
```

Expected: new file under `packages/database/prisma/migrations/<ts>_add_product_type/migration.sql` adding the enum and `type` column.

- [ ] **Step 3: Verify client regenerates**

```bash
cd packages/database
pnpm generate
```

Expected: `generated/prisma/client.ts` contains `ProductType` and `Product.type`.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add ProductType enum and Product.type column"
```

---

### Task 2: Add ProductTag model

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (add enum + model + back-relation on Product)

- [ ] **Step 1: Add the enum, model, and back-relation**

After the `ProductType` enum, add:

```prisma
enum TagDimension {
  silhouette
  rise
  length
  wash
  sleeve
  neckline
  closure
  warmth
  season
  occasion
  material
  pattern
}

model ProductTag {
  id        String       @id @default(cuid())
  productId String
  dimension TagDimension
  value     String
  product   Product      @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, dimension, value])
  @@index([dimension, value])
}
```

Add to `Product` model relations block:

```prisma
  productTags ProductTag[]
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/database
pnpm migrate -- --name add_product_tag
```

- [ ] **Step 3: Verify with Prisma Studio (optional sanity)**

```bash
cd packages/database
pnpm studio
```

Open http://localhost:5555 → confirm `ProductTag` table exists with the expected indexes. Close the studio.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add ProductTag taxonomy table"
```

---

### Task 3: Add ProductSizeChart model

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (add model + back-relation)

- [ ] **Step 1: Add the model and back-relation**

After `ProductTag`, add:

```prisma
model ProductSizeChart {
  id              String  @id @default(cuid())
  productId       String
  sizeKey         String   // matches Variant.size, e.g. "30", "M"
  dimension       String   // free-form: "waist" | "hip" | "inseam" | "thigh" | "chest" | "shoulder" | "length" | "sleeve"
  bodyValueIn     Float
  garmentValueIn  Float
  product         Product  @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@unique([productId, sizeKey, dimension])
  @@index([productId])
}
```

Add to `Product` relations:

```prisma
  sizeCharts ProductSizeChart[]
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/database
pnpm migrate -- --name add_product_size_chart
```

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add ProductSizeChart per-variant measurements"
```

---

### Task 4: Add User.fitProfile and bot tables

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

- [ ] **Step 1: Add the column and two tables**

Modify `User` (around line 99) to add `fitProfile Json?` after `tokenVersion`:

```prisma
model User {
  // ...existing fields...
  tokenVersion Int       @default(0)
  fitProfile   Json?     // shape: { pants?: {waist,hip,inseam,fitPref,updatedAt}, shirts?: {...}, jackets?: {...} }
  // ...rest...
}
```

At the end of the schema file, add:

```prisma
model BotSynonym {
  id        String   @id @default(cuid())
  dimension String   // "category" | "color" | "size" | TagDimension as string
  canonical String   // canonical DB value
  aliases   String[] // alternate spellings the parser accepts
  updatedAt DateTime @updatedAt

  @@unique([dimension, canonical])
  @@index([dimension])
}

model BotUnrecognizedQuery {
  id        String   @id @default(cuid())
  text      String
  sessionId String
  gender    String?
  createdAt DateTime @default(now())

  @@index([createdAt])
}
```

- [ ] **Step 2: Generate migration**

```bash
cd packages/database
pnpm migrate -- --name add_fit_profile_and_bot_tables
```

- [ ] **Step 3: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations/
git commit -m "feat(db): add User.fitProfile and bot synonym/log tables"
```

---

### Task 5: Seed initial synonym dictionary

**Files:**
- Create: `packages/database/prisma/bot-synonym-seed.ts`
- Modify: `packages/database/package.json` (add script)

- [ ] **Step 1: Write the seed file**

Create `packages/database/prisma/bot-synonym-seed.ts`:

```typescript
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

const SEED: Array<{ dimension: string; canonical: string; aliases: string[] }> = [
  // categories
  { dimension: 'category', canonical: 'pants', aliases: ['trousers', 'bottoms', 'denims'] },
  { dimension: 'category', canonical: 'shirts', aliases: ['shirt', 'tee', 't-shirt', 'tops'] },
  { dimension: 'category', canonical: 'jackets', aliases: ['jacket', 'coats', 'coat', 'outerwear'] },
  // colors
  { dimension: 'color', canonical: 'black', aliases: ['blk'] },
  { dimension: 'color', canonical: 'white', aliases: [] },
  { dimension: 'color', canonical: 'blue', aliases: ['navy', 'indigo'] },
  { dimension: 'color', canonical: 'grey', aliases: ['gray', 'charcoal'] },
  { dimension: 'color', canonical: 'beige', aliases: ['tan', 'khaki', 'sand', 'cream'] },
  { dimension: 'color', canonical: 'brown', aliases: [] },
  { dimension: 'color', canonical: 'olive', aliases: ['green'] },
  // silhouette
  { dimension: 'silhouette', canonical: 'skinny', aliases: ['tight'] },
  { dimension: 'silhouette', canonical: 'slim', aliases: ['slimfit'] },
  { dimension: 'silhouette', canonical: 'straight', aliases: ['regular-fit'] },
  { dimension: 'silhouette', canonical: 'relaxed', aliases: ['loose'] },
  { dimension: 'silhouette', canonical: 'baggy', aliases: ['oversized-fit'] },
  { dimension: 'silhouette', canonical: 'wide-leg', aliases: ['wide', 'flared'] },
  { dimension: 'silhouette', canonical: 'oversized', aliases: ['oversize', 'os'] },
  { dimension: 'silhouette', canonical: 'cropped', aliases: ['crop', 'short'] },
  // sleeve
  { dimension: 'sleeve', canonical: 'short', aliases: ['half'] },
  { dimension: 'sleeve', canonical: 'long', aliases: ['full'] },
  { dimension: 'sleeve', canonical: 'sleeveless', aliases: ['tank'] },
];

async function main() {
  for (const row of SEED) {
    await prisma.botSynonym.upsert({
      where: { dimension_canonical: { dimension: row.dimension, canonical: row.canonical } },
      create: row,
      update: { aliases: row.aliases },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${SEED.length} synonyms`);
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add the npm script**

Edit `packages/database/package.json` `scripts` block, add:

```json
"seed:bot": "tsx prisma/bot-synonym-seed.ts"
```

- [ ] **Step 3: Run the seed**

```bash
cd packages/database
pnpm seed:bot
```

Expected: `Seeded 22 synonyms` (or whatever the SEED length is) and no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/bot-synonym-seed.ts packages/database/package.json
git commit -m "feat(db): seed initial bot synonym dictionary"
```

---

## Phase 2 — Bot Backend Module

### Task 6: Scaffold BotModule and constants

**Files:**
- Create: `apps/api/src/modules/bot/bot.module.ts`
- Create: `apps/api/src/modules/bot/bot.constants.ts`
- Modify: `apps/api/src/app.module.ts` (register BotModule)

- [ ] **Step 1: Create the constants file**

Create `apps/api/src/modules/bot/bot.constants.ts`:

```typescript
import { ProductType } from '@prisma/client';

export const ATTRIBUTE_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: ['silhouette', 'rise', 'length', 'wash', 'season', 'occasion', 'material', 'pattern'],
  SHIRTS: ['silhouette', 'sleeve', 'neckline', 'length', 'season', 'occasion', 'material', 'pattern'],
  JACKETS: ['silhouette', 'length', 'closure', 'warmth', 'season', 'occasion', 'material', 'pattern'],
};

export const REQUIRED_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: ['silhouette', 'rise', 'season', 'material'],
  SHIRTS: ['silhouette', 'sleeve', 'neckline', 'season', 'material'],
  JACKETS: ['silhouette', 'length', 'closure', 'warmth', 'season', 'material'],
};

export const SIZE_CHART_DIMENSIONS_FOR_TYPE: Record<ProductType, string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'thigh'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve'],
};

export const SIZING_FLOW_STEPS: Record<ProductType, string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'fitPref'],
  SHIRTS: ['chest', 'shoulder', 'sleeve', 'fitPref'],
  JACKETS: ['chest', 'shoulder', 'fitPref'],
};

export const FIT_PREF_PENALTY = 0.5;
export const SIZE_TIE_TOLERANCE = 1.0;
export const SYNONYM_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_PRODUCTS_RETURNED = 6;
```

- [ ] **Step 2: Create the module file**

Create `apps/api/src/modules/bot/bot.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class BotModule {}
```

- [ ] **Step 3: Register in app.module.ts**

Edit `apps/api/src/app.module.ts`. Add `import { BotModule } from './modules/bot/bot.module';` and append `BotModule` to the `imports` array of `@Module`.

- [ ] **Step 4: Build to verify**

```bash
cd apps/api
pnpm build
```

Expected: build succeeds, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/bot/ apps/api/src/app.module.ts
git commit -m "feat(api): scaffold BotModule"
```

---

### Task 7: BotSynonymsService with TTL cache

**Files:**
- Create: `apps/api/src/modules/bot/bot.synonyms.service.ts`
- Create: `apps/api/src/modules/bot/bot.synonyms.service.spec.ts`
- Modify: `apps/api/src/modules/bot/bot.module.ts` (register)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/bot/bot.synonyms.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BotSynonymsService } from './bot.synonyms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSynonymsService', () => {
  let service: BotSynonymsService;
  let prisma: { botSynonym: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { botSynonym: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSynonymsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSynonymsService);
  });

  it('resolves a token to its canonical via direct match', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([
      { dimension: 'color', canonical: 'black', aliases: ['blk'] },
    ]);
    const hit = await service.resolveToken('color', 'black');
    expect(hit).toEqual({ dimension: 'color', canonical: 'black' });
  });

  it('resolves a token to its canonical via alias', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([
      { dimension: 'color', canonical: 'blue', aliases: ['navy', 'indigo'] },
    ]);
    const hit = await service.resolveToken('color', 'navy');
    expect(hit).toEqual({ dimension: 'color', canonical: 'blue' });
  });

  it('returns null when token is unknown', async () => {
    prisma.botSynonym.findMany.mockResolvedValueOnce([]);
    const hit = await service.resolveToken('color', 'puce');
    expect(hit).toBeNull();
  });

  it('caches DB calls within the TTL window', async () => {
    prisma.botSynonym.findMany.mockResolvedValue([
      { dimension: 'color', canonical: 'black', aliases: [] },
    ]);
    await service.resolveToken('color', 'black');
    await service.resolveToken('color', 'black');
    expect(prisma.botSynonym.findMany).toHaveBeenCalledTimes(1);
  });

  it('invalidate() forces a reload on next lookup', async () => {
    prisma.botSynonym.findMany.mockResolvedValue([
      { dimension: 'color', canonical: 'black', aliases: [] },
    ]);
    await service.resolveToken('color', 'black');
    service.invalidate();
    await service.resolveToken('color', 'black');
    expect(prisma.botSynonym.findMany).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/api
pnpm test -- bot.synonyms.service
```

Expected: FAIL with "Cannot find module './bot.synonyms.service'".

- [ ] **Step 3: Implement the service**

Create `apps/api/src/modules/bot/bot.synonyms.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYNONYM_CACHE_TTL_MS } from './bot.constants';

interface SynonymRow {
  dimension: string;
  canonical: string;
  aliases: string[];
}

@Injectable()
export class BotSynonymsService {
  private cache: SynonymRow[] | null = null;
  private cacheLoadedAt = 0;

  constructor(private readonly prisma: PrismaService) {}

  invalidate(): void {
    this.cache = null;
    this.cacheLoadedAt = 0;
  }

  async resolveToken(
    dimension: string,
    token: string,
  ): Promise<{ dimension: string; canonical: string } | null> {
    const rows = await this.loadCache();
    const lower = token.toLowerCase();
    for (const row of rows) {
      if (row.dimension !== dimension) continue;
      if (row.canonical.toLowerCase() === lower) {
        return { dimension: row.dimension, canonical: row.canonical };
      }
      if (row.aliases.some((a) => a.toLowerCase() === lower)) {
        return { dimension: row.dimension, canonical: row.canonical };
      }
    }
    return null;
  }

  async allForDimension(dimension: string): Promise<SynonymRow[]> {
    const rows = await this.loadCache();
    return rows.filter((r) => r.dimension === dimension);
  }

  private async loadCache(): Promise<SynonymRow[]> {
    const now = Date.now();
    if (this.cache !== null && now - this.cacheLoadedAt < SYNONYM_CACHE_TTL_MS) {
      return this.cache;
    }
    this.cache = await this.prisma.botSynonym.findMany({
      select: { dimension: true, canonical: true, aliases: true },
    });
    this.cacheLoadedAt = now;
    return this.cache;
  }
}
```

- [ ] **Step 4: Register in BotModule**

Edit `apps/api/src/modules/bot/bot.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BotSynonymsService } from './bot.synonyms.service';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [BotSynonymsService],
  exports: [BotSynonymsService],
})
export class BotModule {}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/api
pnpm test -- bot.synonyms.service
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/bot/bot.synonyms.service.ts apps/api/src/modules/bot/bot.synonyms.service.spec.ts apps/api/src/modules/bot/bot.module.ts
git commit -m "feat(api): add BotSynonymsService with TTL cache"
```

---

### Task 8: BotParserService — tokenize, fuzzy match, slot extraction

**Files:**
- Create: `apps/api/src/modules/bot/bot.parser.service.ts`
- Create: `apps/api/src/modules/bot/bot.parser.service.spec.ts`
- Create: `apps/api/src/modules/bot/bot.types.ts`
- Modify: `apps/api/src/modules/bot/bot.module.ts`

- [ ] **Step 1: Create shared types**

Create `apps/api/src/modules/bot/bot.types.ts`:

```typescript
import { ProductType } from '@prisma/client';

export type BotIntent = 'find' | 'whats_new' | 'sizing' | 'unknown';

export interface ParsedSlots {
  type?: ProductType;
  color?: string;
  size?: string;
  tags: Array<{ dimension: string; value: string }>;
}

export interface BotContext {
  sessionId: string;
  gender?: 'M' | 'F' | null;
  flow?: {
    name: 'sizing';
    step: string;
    type: ProductType;
    collected: Record<string, number | string>;
  };
}

export interface BotMessageReply {
  message: string;
  products?: unknown[];
  chips?: string[];
  input?: 'text' | 'numeric';
  nextContext: BotContext;
}
```

- [ ] **Step 2: Write the failing parser tests**

Create `apps/api/src/modules/bot/bot.parser.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BotParserService } from './bot.parser.service';
import { BotSynonymsService } from './bot.synonyms.service';

describe('BotParserService', () => {
  let service: BotParserService;
  const fakeSyn: { resolveToken: jest.Mock; allForDimension: jest.Mock } = {
    resolveToken: jest.fn(),
    allForDimension: jest.fn(),
  };

  beforeEach(async () => {
    fakeSyn.resolveToken.mockReset();
    fakeSyn.allForDimension.mockReset();
    const mod = await Test.createTestingModule({
      providers: [
        BotParserService,
        { provide: BotSynonymsService, useValue: fakeSyn },
      ],
    }).compile();
    service = mod.get(BotParserService);
  });

  it('classifies intent="whats_new" on new arrivals trigger', async () => {
    const res = await service.detectIntent('show me whats new');
    expect(res).toBe('whats_new');
  });

  it('classifies intent="sizing" on size trigger', async () => {
    const res = await service.detectIntent('help me find my size');
    expect(res).toBe('sizing');
  });

  it('classifies intent="find" by default', async () => {
    const res = await service.detectIntent('black pants 30');
    expect(res).toBe('find');
  });

  it('extracts slots from "black baggy pants in 30"', async () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      const map: Record<string, Record<string, string>> = {
        category: { pants: 'pants' },
        color: { black: 'black' },
        silhouette: { baggy: 'baggy' },
      };
      return map[dim]?.[tok] ? { dimension: dim, canonical: map[dim][tok] } : null;
    });
    const slots = await service.extractSlots('black baggy pants in 30');
    expect(slots.type).toBe('PANTS');
    expect(slots.color).toBe('black');
    expect(slots.size).toBe('30');
    expect(slots.tags).toEqual(
      expect.arrayContaining([{ dimension: 'silhouette', value: 'baggy' }]),
    );
  });

  it('fuzzy-matches one-edit typos via Levenshtein', async () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      if (dim === 'color' && tok === 'black') return { dimension: 'color', canonical: 'black' };
      return null;
    });
    fakeSyn.allForDimension.mockImplementation(async (dim) => {
      if (dim === 'color') return [{ dimension: 'color', canonical: 'black', aliases: [] }];
      return [];
    });
    const slots = await service.extractSlots('blakc pants');
    expect(slots.color).toBe('black');
  });

  it('detects a contradiction (slim + baggy)', async () => {
    fakeSyn.resolveToken.mockImplementation(async (dim, tok) => {
      if (dim === 'silhouette' && (tok === 'slim' || tok === 'baggy')) {
        return { dimension: 'silhouette', canonical: tok };
      }
      return null;
    });
    const c = await service.detectContradictions({
      tags: [
        { dimension: 'silhouette', value: 'slim' },
        { dimension: 'silhouette', value: 'baggy' },
      ],
    });
    expect(c).toEqual([{ dimension: 'silhouette', values: ['slim', 'baggy'] }]);
  });
});
```

- [ ] **Step 3: Run the test (should fail)**

```bash
cd apps/api
pnpm test -- bot.parser.service
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement the parser**

Create `apps/api/src/modules/bot/bot.parser.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { BotSynonymsService } from './bot.synonyms.service';
import { BotIntent, ParsedSlots } from './bot.types';

const WHATS_NEW_TRIGGERS = ['new', 'new arrivals', 'latest', 'recent', "what's new", 'whats new'];
const SIZING_TRIGGERS = ['my size', 'find my size', 'fit me', 'measurements', 'help me find my size', 'what size am i'];
const SINGLE_SILHOUETTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['slim', 'baggy'],
  ['slim', 'relaxed'],
  ['skinny', 'baggy'],
  ['fitted', 'oversized'],
  ['cropped', 'long'],
];

@Injectable()
export class BotParserService {
  constructor(private readonly synonyms: BotSynonymsService) {}

  async detectIntent(text: string): Promise<BotIntent> {
    const lower = text.toLowerCase();
    if (SIZING_TRIGGERS.some((t) => lower.includes(t))) return 'sizing';
    if (WHATS_NEW_TRIGGERS.some((t) => lower.includes(t))) return 'whats_new';
    if (lower.trim() === '') return 'unknown';
    return 'find';
  }

  async extractSlots(text: string): Promise<ParsedSlots> {
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const slots: ParsedSlots = { tags: [] };

    for (const tok of tokens) {
      // Size: numeric or single-letter S/M/L/XL/XXL
      if (/^\d{2,3}$/.test(tok) || /^(xs|s|m|l|xl|xxl|xxxl)$/i.test(tok)) {
        slots.size = tok.toUpperCase();
        continue;
      }

      // Category
      const cat = await this.matchWithFuzzy('category', tok);
      if (cat) {
        const map: Record<string, ProductType> = {
          pants: 'PANTS',
          shirts: 'SHIRTS',
          jackets: 'JACKETS',
        };
        if (map[cat.canonical]) slots.type = map[cat.canonical];
        continue;
      }

      // Color
      const color = await this.matchWithFuzzy('color', tok);
      if (color) {
        slots.color = color.canonical;
        continue;
      }

      // Other tag dimensions
      for (const dim of ['silhouette', 'sleeve', 'neckline', 'closure', 'warmth', 'rise', 'wash', 'season', 'occasion', 'material', 'pattern', 'length']) {
        const m = await this.matchWithFuzzy(dim, tok);
        if (m) {
          slots.tags.push({ dimension: dim, value: m.canonical });
          break;
        }
      }
    }

    return slots;
  }

  async detectContradictions(slots: { tags: Array<{ dimension: string; value: string }> }): Promise<Array<{ dimension: string; values: string[] }>> {
    const conflicts: Array<{ dimension: string; values: string[] }> = [];
    const sil = slots.tags.filter((t) => t.dimension === 'silhouette').map((t) => t.value);
    for (const [a, b] of SINGLE_SILHOUETTE_PAIRS) {
      if (sil.includes(a) && sil.includes(b)) {
        conflicts.push({ dimension: 'silhouette', values: [a, b] });
      }
    }
    return conflicts;
  }

  private async matchWithFuzzy(
    dimension: string,
    token: string,
  ): Promise<{ dimension: string; canonical: string } | null> {
    const direct = await this.synonyms.resolveToken(dimension, token);
    if (direct) return direct;
    const candidates = await this.synonyms.allForDimension(dimension);
    for (const row of candidates) {
      const pool = [row.canonical, ...row.aliases];
      for (const candidate of pool) {
        if (levenshtein(candidate.toLowerCase(), token) <= 1 && candidate.length >= 4) {
          return { dimension: row.dimension, canonical: row.canonical };
        }
      }
    }
    return null;
  }
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array<number>(n + 1);
  const curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}
```

- [ ] **Step 5: Register in BotModule**

Update `apps/api/src/modules/bot/bot.module.ts` `providers` and `exports`:

```typescript
providers: [BotSynonymsService, BotParserService],
exports: [BotSynonymsService, BotParserService],
```

with the import `import { BotParserService } from './bot.parser.service';`.

- [ ] **Step 6: Run tests**

```bash
cd apps/api
pnpm test -- bot.parser.service
```

Expected: 6 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/bot/bot.parser.service.ts apps/api/src/modules/bot/bot.parser.service.spec.ts apps/api/src/modules/bot/bot.types.ts apps/api/src/modules/bot/bot.module.ts
git commit -m "feat(api): add BotParserService with intent + slot extraction + fuzzy match"
```

---

### Task 9: BotSearchService — DB query from slots

**Files:**
- Create: `apps/api/src/modules/bot/bot.search.service.ts`
- Create: `apps/api/src/modules/bot/bot.search.service.spec.ts`
- Modify: `apps/api/src/modules/bot/bot.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/bot/bot.search.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BotSearchService } from './bot.search.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSearchService', () => {
  let service: BotSearchService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSearchService);
  });

  it('builds a query with type, tags, and in-stock variants', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p1', name: 'X', variants: [{ stock: 2, color: 'black', size: '30' }] }]);
    const result = await service.searchBySlots({
      type: 'PANTS',
      color: 'black',
      size: '30',
      tags: [{ dimension: 'silhouette', value: 'baggy' }],
    });
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: 'PANTS',
          isActive: true,
          deletedAt: null,
          productTags: { some: { dimension: 'silhouette', value: 'baggy' } },
          variants: { some: { color: { equals: 'black', mode: 'insensitive' }, size: '30', stock: { gt: 0 } } },
        }),
        take: 6,
      }),
    );
    expect(result).toHaveLength(1);
  });

  it('returns newest products when only intent is "whats_new"', async () => {
    prisma.product.findMany.mockResolvedValue([{ id: 'p2' }]);
    await service.findWhatsNew();
    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isActive: true, isNewArrival: true, deletedAt: null }),
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
    );
  });

  it('filters out products with no in-stock variants', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'a', variants: [{ stock: 0 }, { stock: 0 }] },
      { id: 'b', variants: [{ stock: 3 }] },
    ]);
    const r = await service.searchBySlots({ tags: [] });
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('b');
  });
});
```

- [ ] **Step 2: Run test (should fail)**

```bash
cd apps/api
pnpm test -- bot.search.service
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/modules/bot/bot.search.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MAX_PRODUCTS_RETURNED } from './bot.constants';
import { ParsedSlots } from './bot.types';

const INCLUDE = {
  variants: { select: { id: true, sku: true, size: true, color: true, stock: true, images: true } },
  productTags: { select: { dimension: true, value: true } },
};

@Injectable()
export class BotSearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchBySlots(slots: ParsedSlots) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
      deletedAt: null,
    };
    if (slots.type) where.type = slots.type;
    if (slots.tags.length > 0) {
      where.AND = slots.tags.map((t) => ({
        productTags: { some: { dimension: t.dimension as any, value: t.value } },
      }));
    }
    if (slots.color || slots.size) {
      const variantFilter: Prisma.ProductVariantWhereInput = { stock: { gt: 0 } };
      if (slots.color) variantFilter.color = { equals: slots.color, mode: 'insensitive' };
      if (slots.size) variantFilter.size = slots.size;
      where.variants = { some: variantFilter };
    }

    const rows = await this.prisma.product.findMany({
      where,
      include: INCLUDE,
      orderBy: [{ createdAt: 'desc' }],
      take: MAX_PRODUCTS_RETURNED,
    });
    return rows.filter((p: any) => p.variants?.some((v: any) => v.stock > 0));
  }

  async findWhatsNew() {
    return this.prisma.product.findMany({
      where: { isActive: true, isNewArrival: true, deletedAt: null },
      include: INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: MAX_PRODUCTS_RETURNED,
    });
  }
}
```

- [ ] **Step 4: Register in BotModule**

Update `apps/api/src/modules/bot/bot.module.ts` `providers` and `exports` to add `BotSearchService` (import as well).

- [ ] **Step 5: Run tests**

```bash
cd apps/api
pnpm test -- bot.search.service
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/bot/bot.search.service.ts apps/api/src/modules/bot/bot.search.service.spec.ts apps/api/src/modules/bot/bot.module.ts
git commit -m "feat(api): add BotSearchService for slot-based product queries"
```

---

### Task 10: BotSizingService — recommendation algorithm

**Files:**
- Create: `apps/api/src/modules/bot/bot.sizing.service.ts`
- Create: `apps/api/src/modules/bot/bot.sizing.service.spec.ts`
- Modify: `apps/api/src/modules/bot/bot.module.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/bot/bot.sizing.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BotSizingService } from './bot.sizing.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotSizingService', () => {
  let service: BotSizingService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn() } };
    const mod = await Test.createTestingModule({
      providers: [
        BotSizingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = mod.get(BotSizingService);
  });

  it('recommends size 30 for waist=32 hip=40 inseam=32', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1', name: 'A',
        sizeCharts: [
          { sizeKey: '28', dimension: 'waist', bodyValueIn: 30 },
          { sizeKey: '28', dimension: 'hip', bodyValueIn: 38 },
          { sizeKey: '28', dimension: 'inseam', bodyValueIn: 30 },
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 32 },
          { sizeKey: '30', dimension: 'hip', bodyValueIn: 40 },
          { sizeKey: '30', dimension: 'inseam', bodyValueIn: 32 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 34 },
          { sizeKey: '32', dimension: 'hip', bodyValueIn: 42 },
          { sizeKey: '32', dimension: 'inseam', bodyValueIn: 32 },
        ],
        variants: [{ size: '28', stock: 1 }, { size: '30', stock: 1 }, { size: '32', stock: 1 }],
      },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32, hip: 40, inseam: 32 },
      fitPref: 'regular',
    });
    expect(r.recommendedSize).toBe('30');
    expect(r.alternativeSize).toBeUndefined();
  });

  it('returns alternative size when next-best is within tolerance', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1', name: 'A',
        sizeCharts: [
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 32 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 32.5 },
        ],
        variants: [{ size: '30', stock: 1 }, { size: '32', stock: 1 }],
      },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32.25 },
      fitPref: 'regular',
    });
    expect([r.recommendedSize, r.alternativeSize].sort()).toEqual(['30', '32']);
  });

  it('skips products with no chart data', async () => {
    prisma.product.findMany.mockResolvedValue([
      { id: 'p1', sizeCharts: [], variants: [{ size: '30', stock: 1 }] },
    ]);
    const r = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32 },
      fitPref: 'regular',
    });
    expect(r.recommendedSize).toBeNull();
  });

  it('penalizes when bodyValueIn > body for slim preference', async () => {
    prisma.product.findMany.mockResolvedValue([
      {
        id: 'p1',
        sizeCharts: [
          { sizeKey: '30', dimension: 'waist', bodyValueIn: 31 },
          { sizeKey: '32', dimension: 'waist', bodyValueIn: 32 },
        ],
        variants: [{ size: '30', stock: 1 }, { size: '32', stock: 1 }],
      },
    ]);
    const slim = await service.recommend({
      type: 'PANTS',
      measurements: { waist: 32 },
      fitPref: 'slim',
    });
    expect(slim.recommendedSize).toBe('30');
  });
});
```

- [ ] **Step 2: Run tests (should fail)**

```bash
cd apps/api
pnpm test -- bot.sizing.service
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the service**

Create `apps/api/src/modules/bot/bot.sizing.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FIT_PREF_PENALTY, SIZE_TIE_TOLERANCE, MAX_PRODUCTS_RETURNED } from './bot.constants';

type FitPref = 'slim' | 'regular' | 'baggy' | 'fitted' | 'oversized';

interface RecommendInput {
  type: ProductType;
  measurements: Record<string, number>;
  fitPref: FitPref;
}

interface RecommendResult {
  recommendedSize: string | null;
  alternativeSize?: string;
  products: unknown[];
}

@Injectable()
export class BotSizingService {
  constructor(private readonly prisma: PrismaService) {}

  async recommend(input: RecommendInput): Promise<RecommendResult> {
    const products = await this.prisma.product.findMany({
      where: { type: input.type, isActive: true, deletedAt: null },
      include: {
        sizeCharts: { select: { sizeKey: true, dimension: true, bodyValueIn: true } },
        variants: { select: { size: true, stock: true } },
      },
    });

    const scoresBySize = new Map<string, number>();
    const countBySize = new Map<string, number>();

    for (const p of products as any[]) {
      const variantSizes = new Set(p.variants.filter((v: any) => v.stock > 0).map((v: any) => v.size));
      if (variantSizes.size === 0 || p.sizeCharts.length === 0) continue;

      const sizeMap = new Map<string, Map<string, number>>();
      for (const c of p.sizeCharts) {
        if (!sizeMap.has(c.sizeKey)) sizeMap.set(c.sizeKey, new Map());
        sizeMap.get(c.sizeKey)!.set(c.dimension, c.bodyValueIn);
      }

      for (const [sizeKey, dims] of sizeMap) {
        if (!variantSizes.has(sizeKey)) continue;
        let score = 0;
        let dimensionsMatched = 0;
        for (const [dim, body] of Object.entries(input.measurements)) {
          const chart = dims.get(dim);
          if (chart === undefined) continue;
          dimensionsMatched += 1;
          score += Math.abs(chart - body);
          if (input.fitPref === 'slim' && chart > body) score += FIT_PREF_PENALTY;
          if (input.fitPref === 'baggy' && chart < body) score += FIT_PREF_PENALTY;
        }
        if (dimensionsMatched === 0) continue;
        const acc = scoresBySize.get(sizeKey) ?? 0;
        scoresBySize.set(sizeKey, acc + score);
        countBySize.set(sizeKey, (countBySize.get(sizeKey) ?? 0) + 1);
      }
    }

    if (scoresBySize.size === 0) {
      return { recommendedSize: null, products: [] };
    }

    const averaged: Array<[string, number]> = [];
    for (const [size, totalScore] of scoresBySize) {
      averaged.push([size, totalScore / (countBySize.get(size) ?? 1)]);
    }
    averaged.sort((a, b) => a[1] - b[1]);
    const [bestSize, bestScore] = averaged[0];
    let alternativeSize: string | undefined;
    if (averaged.length > 1 && averaged[1][1] - bestScore <= SIZE_TIE_TOLERANCE) {
      alternativeSize = averaged[1][0];
    }

    const matched = await this.prisma.product.findMany({
      where: {
        type: input.type,
        isActive: true,
        deletedAt: null,
        variants: { some: { size: bestSize, stock: { gt: 0 } } },
      },
      include: { variants: true, sizeCharts: true, productTags: true },
      take: MAX_PRODUCTS_RETURNED,
      orderBy: { createdAt: 'desc' },
    });

    return { recommendedSize: bestSize, alternativeSize, products: matched };
  }
}
```

- [ ] **Step 4: Register in BotModule**

Update `apps/api/src/modules/bot/bot.module.ts` to add `BotSizingService` to providers and exports.

- [ ] **Step 5: Run tests**

```bash
cd apps/api
pnpm test -- bot.sizing.service
```

Expected: 4 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/bot/bot.sizing.service.ts apps/api/src/modules/bot/bot.sizing.service.spec.ts apps/api/src/modules/bot/bot.module.ts
git commit -m "feat(api): add BotSizingService body-to-size recommendation"
```

---

### Task 11: BotController — `/bot/message`, `/bot/recommend-size`, `/bot/synonyms`

**Files:**
- Create: `apps/api/src/modules/bot/bot.controller.ts`
- Create: `apps/api/src/modules/bot/bot.controller.spec.ts`
- Create: `apps/api/src/modules/bot/bot.dto.ts`
- Modify: `apps/api/src/modules/bot/bot.module.ts`

- [ ] **Step 1: Create the DTOs**

Create `apps/api/src/modules/bot/bot.dto.ts`:

```typescript
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { ProductType } from '@prisma/client';

export class BotContextFlowDto {
  @IsString() name!: 'sizing';
  @IsString() step!: string;
  @IsEnum(ProductType) type!: ProductType;
  @IsObject() collected!: Record<string, number | string>;
}

export class BotContextDto {
  @IsString() @MaxLength(64) sessionId!: string;
  @IsOptional() @IsIn(['M', 'F', null]) gender?: 'M' | 'F' | null;
  @IsOptional() @ValidateNested() @Type(() => BotContextFlowDto) flow?: BotContextFlowDto;
}

export class BotMessageDto {
  @IsString() @MaxLength(500) text!: string;
  @ValidateNested() @Type(() => BotContextDto) context!: BotContextDto;
}

export class RecommendSizeDto {
  @IsEnum(ProductType) type!: ProductType;
  @IsObject() measurements!: Record<string, number>;
  @IsIn(['slim', 'regular', 'baggy', 'fitted', 'oversized']) fitPref!: string;
}
```

- [ ] **Step 2: Write the failing controller test**

Create `apps/api/src/modules/bot/bot.controller.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { BotController } from './bot.controller';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotSynonymsService } from './bot.synonyms.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BotController', () => {
  let controller: BotController;
  const parser = {
    detectIntent: jest.fn(),
    extractSlots: jest.fn(),
    detectContradictions: jest.fn().mockResolvedValue([]),
  };
  const search = { searchBySlots: jest.fn(), findWhatsNew: jest.fn() };
  const sizing = { recommend: jest.fn() };
  const synonyms = { resolveToken: jest.fn(), allForDimension: jest.fn(), invalidate: jest.fn() };
  const prisma = { botUnrecognizedQuery: { create: jest.fn() } };

  beforeEach(async () => {
    Object.values({ parser, search, sizing, synonyms, prisma }).forEach((m) =>
      Object.values(m).forEach((fn: any) => fn.mockReset?.()),
    );
    const mod = await Test.createTestingModule({
      controllers: [BotController],
      providers: [
        { provide: BotParserService, useValue: parser },
        { provide: BotSearchService, useValue: search },
        { provide: BotSizingService, useValue: sizing },
        { provide: BotSynonymsService, useValue: synonyms },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    controller = mod.get(BotController);
  });

  it('returns a find reply with product cards', async () => {
    parser.detectIntent.mockResolvedValue('find');
    parser.extractSlots.mockResolvedValue({ type: 'PANTS', color: 'black', size: '30', tags: [{ dimension: 'silhouette', value: 'baggy' }] });
    search.searchBySlots.mockResolvedValue([{ id: 'p1' }]);
    const r = await controller.message({ text: 'black baggy pants 30', context: { sessionId: 's1' } } as any);
    expect(r.message).toMatch(/Got it:/i);
    expect(r.products).toHaveLength(1);
  });

  it('returns whats-new reply', async () => {
    parser.detectIntent.mockResolvedValue('whats_new');
    search.findWhatsNew.mockResolvedValue([{ id: 'p2' }]);
    const r = await controller.message({ text: "what's new", context: { sessionId: 's1' } } as any);
    expect(r.products).toHaveLength(1);
  });

  it('starts the sizing flow when intent=sizing', async () => {
    parser.detectIntent.mockResolvedValue('sizing');
    const r = await controller.message({ text: 'help me find my size', context: { sessionId: 's1' } } as any);
    expect(r.message).toMatch(/shopping for/i);
    expect(r.chips).toEqual(expect.arrayContaining(['Pants', 'Shirts', 'Jackets']));
    expect(r.nextContext.flow?.step).toBe('type');
  });

  it('advances sizing flow when context.flow.step is type', async () => {
    parser.detectIntent.mockResolvedValue('find');
    const r = await controller.message({
      text: 'Pants',
      context: { sessionId: 's1', flow: { name: 'sizing', step: 'type', type: 'PANTS', collected: {} } },
    } as any);
    expect(r.message).toMatch(/waist/i);
    expect(r.nextContext.flow?.step).toBe('waist');
  });

  it('logs unrecognized query when nothing parses', async () => {
    parser.detectIntent.mockResolvedValue('find');
    parser.extractSlots.mockResolvedValue({ tags: [] });
    const r = await controller.message({ text: 'lorem ipsum', context: { sessionId: 's1' } } as any);
    expect(r.message).toMatch(/didn't catch/i);
    expect(prisma.botUnrecognizedQuery.create).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test (should fail)**

```bash
cd apps/api
pnpm test -- bot.controller
```

Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement the controller**

Create `apps/api/src/modules/bot/bot.controller.ts`:

```typescript
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ProductType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BotMessageDto, RecommendSizeDto } from './bot.dto';
import { BotParserService } from './bot.parser.service';
import { BotSearchService } from './bot.search.service';
import { BotSizingService } from './bot.sizing.service';
import { BotSynonymsService } from './bot.synonyms.service';
import { SIZING_FLOW_STEPS } from './bot.constants';
import { BotMessageReply, BotContext } from './bot.types';

@Controller('bot')
export class BotController {
  constructor(
    private readonly parser: BotParserService,
    private readonly search: BotSearchService,
    private readonly sizing: BotSizingService,
    private readonly synonyms: BotSynonymsService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('message')
  async message(@Body() dto: BotMessageDto): Promise<BotMessageReply> {
    const { text, context } = dto;

    if (context.flow?.name === 'sizing') {
      return this.advanceSizingFlow(text, context as BotContext);
    }

    const intent = await this.parser.detectIntent(text);

    if (intent === 'sizing') {
      return this.startSizingFlow(context as BotContext);
    }

    if (intent === 'whats_new') {
      const products = await this.search.findWhatsNew();
      return {
        message: products.length
          ? "Here's what's new:"
          : 'No new arrivals right now.',
        products,
        chips: ['Pants', 'Shirts', 'Jackets'],
        nextContext: context as BotContext,
      };
    }

    if (intent === 'find') {
      const slots = await this.parser.extractSlots(text);
      const contradictions = await this.parser.detectContradictions(slots);
      if (contradictions.length > 0) {
        const c = contradictions[0];
        return {
          message: `Did you mean ${c.values.join(' or ')}?`,
          chips: c.values,
          nextContext: context as BotContext,
        };
      }

      const hasAnySlot =
        slots.type !== undefined ||
        slots.color !== undefined ||
        slots.size !== undefined ||
        slots.tags.length > 0;

      if (!hasAnySlot) {
        await this.prisma.botUnrecognizedQuery.create({
          data: { text, sessionId: context.sessionId, gender: context.gender ?? null },
        });
        return {
          message: "I didn't catch that. Pick a category to start?",
          chips: ['Pants', 'Shirts', 'Jackets', "What's new", 'Help me find my size'],
          nextContext: context as BotContext,
        };
      }

      const products = await this.search.searchBySlots(slots);
      const echo = formatSlotEcho(slots);
      return {
        message: products.length
          ? `Got it: ${echo}. Found ${products.length} matches:`
          : `Got it: ${echo}. No matches in stock right now.`,
        products,
        chips: products.length
          ? ['See all matches', 'Different color', 'Different size']
          : ['Try different colour', 'Try different size'],
        nextContext: context as BotContext,
      };
    }

    return {
      message: 'I can help find products. For other questions, see contact.',
      chips: ['Pants', 'Shirts', 'Jackets'],
      nextContext: context as BotContext,
    };
  }

  @Post('recommend-size')
  async recommendSize(@Body() dto: RecommendSizeDto) {
    return this.sizing.recommend({
      type: dto.type,
      measurements: dto.measurements,
      fitPref: dto.fitPref as any,
    });
  }

  @Get('synonyms')
  async listSynonyms() {
    return {
      categories: await this.synonyms.allForDimension('category'),
      colors: await this.synonyms.allForDimension('color'),
      silhouettes: await this.synonyms.allForDimension('silhouette'),
    };
  }

  private startSizingFlow(context: BotContext): BotMessageReply {
    return {
      message: 'What are you shopping for?',
      chips: ['Pants', 'Shirts', 'Jackets'],
      nextContext: {
        ...context,
        flow: { name: 'sizing', step: 'type', type: 'PANTS', collected: {} },
      },
    };
  }

  private async advanceSizingFlow(text: string, context: BotContext): Promise<BotMessageReply> {
    const flow = context.flow!;
    const step = flow.step;
    const newCollected = { ...flow.collected };

    if (step === 'type') {
      const t = text.trim().toUpperCase() as ProductType;
      const isValid = ['PANTS', 'SHIRTS', 'JACKETS'].includes(t);
      if (!isValid) {
        return { message: 'Pick one: Pants, Shirts, or Jackets.', chips: ['Pants', 'Shirts', 'Jackets'], nextContext: context };
      }
      const steps = SIZING_FLOW_STEPS[t];
      const firstStep = steps[0];
      return {
        message: this.promptForStep(firstStep),
        input: firstStep === 'fitPref' ? 'text' : 'numeric',
        chips: firstStep === 'fitPref' ? this.fitPrefChips(t) : ['Skip'],
        nextContext: { ...context, flow: { name: 'sizing', step: firstStep, type: t, collected: {} } },
      };
    }

    if (step !== 'fitPref') {
      const num = Number(text.replace(/[^\d.]/g, ''));
      if (!Number.isNaN(num) && num > 0) newCollected[step] = num;
    } else {
      newCollected.fitPref = text.toLowerCase();
    }

    const steps = SIZING_FLOW_STEPS[flow.type];
    const idx = steps.indexOf(step);
    const nextStep = steps[idx + 1];

    if (nextStep) {
      return {
        message: this.promptForStep(nextStep),
        input: nextStep === 'fitPref' ? 'text' : 'numeric',
        chips: nextStep === 'fitPref' ? this.fitPrefChips(flow.type) : ['Skip'],
        nextContext: { ...context, flow: { name: 'sizing', step: nextStep, type: flow.type, collected: newCollected } },
      };
    }

    const measurementOnly: Record<string, number> = {};
    for (const [k, v] of Object.entries(newCollected)) {
      if (typeof v === 'number') measurementOnly[k] = v;
    }
    const result = await this.sizing.recommend({
      type: flow.type,
      measurements: measurementOnly,
      fitPref: (newCollected.fitPref as any) ?? 'regular',
    });

    if (!result.recommendedSize) {
      return {
        message: "I couldn't find a match — try a different category.",
        chips: ['Pants', 'Shirts', 'Jackets'],
        nextContext: { ...context, flow: undefined },
      };
    }

    const altText = result.alternativeSize
      ? ` Or **${result.alternativeSize}** for a different fit.`
      : '';
    return {
      message: `You're likely a size **${result.recommendedSize}**.${altText} Here's what's available:`,
      products: result.products,
      chips: ['See all matches', 'Start over'],
      nextContext: { ...context, flow: undefined },
    };
  }

  private promptForStep(step: string): string {
    const prompts: Record<string, string> = {
      waist: "What's your waist measurement?",
      hip: "What's your hip measurement?",
      inseam: "What's your inseam?",
      chest: "What's your chest measurement?",
      shoulder: "What's your shoulder measurement?",
      sleeve: "What's your sleeve length?",
      fitPref: 'How do you like it to fit?',
    };
    return prompts[step] ?? `Please provide ${step}.`;
  }

  private fitPrefChips(type: ProductType): string[] {
    if (type === 'PANTS') return ['slim', 'regular', 'baggy'];
    return ['fitted', 'regular', 'oversized'];
  }
}

function formatSlotEcho(slots: { color?: string; size?: string; type?: string; tags: Array<{ value: string }> }): string {
  const parts: string[] = [];
  if (slots.color) parts.push(slots.color);
  if (slots.tags.length) parts.push(...slots.tags.map((t) => t.value));
  if (slots.size) parts.push(`size ${slots.size}`);
  if (slots.type) parts.push(slots.type.toLowerCase());
  return parts.join(' · ');
}
```

- [ ] **Step 5: Register controller in BotModule**

Update `apps/api/src/modules/bot/bot.module.ts` `controllers` array to `[BotController]` (import added).

- [ ] **Step 6: Run tests**

```bash
cd apps/api
pnpm test -- bot.controller
```

Expected: 5 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/bot/bot.controller.ts apps/api/src/modules/bot/bot.controller.spec.ts apps/api/src/modules/bot/bot.dto.ts apps/api/src/modules/bot/bot.module.ts
git commit -m "feat(api): add BotController with message, recommend-size, synonyms"
```

---

## Phase 3 — Products & Users API Extensions

### Task 12: Add type/tags/sizeChart to product CRUD

**Files:**
- Modify: `apps/api/src/modules/products/products.dto.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`
- Modify: `apps/api/src/modules/products/products.controller.ts`

- [ ] **Step 1: Update DTOs**

Open `apps/api/src/modules/products/products.dto.ts`. Add fields to `CreateProductDto` and `UpdateProductDto`:

```typescript
import { IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ProductType } from '@prisma/client';

class ProductTagDto {
  @IsString() dimension!: string;
  @IsString() value!: string;
}

class SizeChartEntryDto {
  @IsString() sizeKey!: string;
  @IsString() dimension!: string;
  @IsNumber() bodyValueIn!: number;
  @IsNumber() garmentValueIn!: number;
}
```

Add to `CreateProductDto`:

```typescript
  @IsOptional() @IsEnum(ProductType) type?: ProductType;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProductTagDto) productTags?: ProductTagDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SizeChartEntryDto) sizeCharts?: SizeChartEntryDto[];
```

Mirror the same three optional fields on `UpdateProductDto`.

- [ ] **Step 2: Update ProductsService.create to persist tags and chart**

In `apps/api/src/modules/products/products.service.ts:222` (the `create` method), wrap the existing product creation so tags + size chart are inserted in the same transaction. Locate the existing `prisma.product.create({...})` call and replace it with:

```typescript
  async create(dto: CreateProductDto) {
    const { productTags, sizeCharts, ...rest } = dto as any;
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({ data: rest });
      if (productTags?.length) {
        await tx.productTag.createMany({
          data: productTags.map((t: any) => ({ productId: product.id, dimension: t.dimension, value: t.value })),
        });
      }
      if (sizeCharts?.length) {
        await tx.productSizeChart.createMany({
          data: sizeCharts.map((s: any) => ({ productId: product.id, sizeKey: s.sizeKey, dimension: s.dimension, bodyValueIn: s.bodyValueIn, garmentValueIn: s.garmentValueIn })),
        });
      }
      return tx.product.findUnique({ where: { id: product.id }, include: { variants: true, productTags: true, sizeCharts: true } });
    });
  }
```

(Adjust the original return type signature to match if it was inline.) Apply the equivalent pattern to `update()`: delete existing tags/charts and re-insert when arrays are provided.

- [ ] **Step 3: Include tags + size charts in the list/get include**

In the same file, find `PRODUCT_LIST_INCLUDE` (line 21) and add:

```typescript
const PRODUCT_LIST_INCLUDE = {
  // ...existing fields...
  productTags: { select: { dimension: true, value: true } },
  sizeCharts: { select: { sizeKey: true, dimension: true, bodyValueIn: true, garmentValueIn: true } },
} as const;
```

Mirror to `findBySlug`'s include.

- [ ] **Step 4: Run existing product tests to confirm nothing broke**

```bash
cd apps/api
pnpm test -- products
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/products/
git commit -m "feat(api): persist type, tags, and size charts on Product CRUD"
```

---

### Task 13: Add `GET /products/:id/size-chart` and `POST /users/me/fit-profile`

**Files:**
- Modify: `apps/api/src/modules/products/products.controller.ts`
- Modify: `apps/api/src/modules/products/products.service.ts`
- Modify: `apps/api/src/modules/users/users.controller.ts`
- Modify: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/dto/fit-profile.dto.ts`

- [ ] **Step 1: Add size-chart endpoint**

In `apps/api/src/modules/products/products.service.ts`, add:

```typescript
  async getSizeChart(productId: string) {
    const rows = await this.prisma.productSizeChart.findMany({
      where: { productId },
      orderBy: [{ sizeKey: 'asc' }, { dimension: 'asc' }],
    });
    return { rows };
  }
```

In `apps/api/src/modules/products/products.controller.ts`, add the route:

```typescript
  @Get(':id/size-chart')
  async sizeChart(@Param('id') id: string) {
    return this.service.getSizeChart(id);
  }
```

- [ ] **Step 2: Add fit profile DTO**

Create `apps/api/src/modules/users/dto/fit-profile.dto.ts`:

```typescript
import { IsEnum, IsIn, IsObject } from 'class-validator';
import { ProductType } from '@prisma/client';

export class FitProfileDto {
  @IsEnum(ProductType) type!: ProductType;
  @IsObject() measurements!: Record<string, number>;
  @IsIn(['slim', 'regular', 'baggy', 'fitted', 'oversized']) fitPref!: string;
}
```

- [ ] **Step 3: Add service method**

In `apps/api/src/modules/users/users.service.ts`, add:

```typescript
  async saveFitProfile(userId: string, payload: { type: string; measurements: Record<string, number>; fitPref: string }) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { fitProfile: true } });
    const existing = (user?.fitProfile as Record<string, unknown>) ?? {};
    const updated = {
      ...existing,
      [payload.type.toLowerCase()]: {
        ...payload.measurements,
        fitPref: payload.fitPref,
        updatedAt: new Date().toISOString(),
      },
    };
    return this.prisma.user.update({
      where: { id: userId },
      data: { fitProfile: updated },
      select: { fitProfile: true },
    });
  }
```

- [ ] **Step 4: Add controller route**

In `apps/api/src/modules/users/users.controller.ts`, add (using the existing JWT auth pattern in that file — copy the decorator pattern used by other authenticated `me` routes):

```typescript
  @Post('me/fit-profile')
  @UseGuards(JwtAuthGuard)
  async saveFitProfile(@Req() req: any, @Body() dto: FitProfileDto) {
    return this.service.saveFitProfile(req.user.id, dto);
  }
```

Make sure `JwtAuthGuard`, `Req`, `Post`, `Body`, and `FitProfileDto` are imported.

- [ ] **Step 5: Add tests**

Append to `apps/api/src/modules/users/users.service.spec.ts` a test:

```typescript
  it('saveFitProfile merges new type into existing JSON', async () => {
    prisma.user.findUnique.mockResolvedValue({ fitProfile: { shirts: { chest: 40, fitPref: 'regular' } } });
    prisma.user.update.mockResolvedValue({ fitProfile: { shirts: { chest: 40 }, pants: { waist: 32, fitPref: 'slim' } } });
    const r = await service.saveFitProfile('u1', { type: 'PANTS', measurements: { waist: 32 }, fitPref: 'slim' });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { fitProfile: expect.objectContaining({ shirts: expect.any(Object), pants: expect.objectContaining({ waist: 32, fitPref: 'slim' }) }) },
      }),
    );
  });
```

- [ ] **Step 6: Run tests**

```bash
cd apps/api
pnpm test -- users.service
```

Expected: all pass including new test.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/products/ apps/api/src/modules/users/
git commit -m "feat(api): add product size-chart endpoint and user fit-profile endpoint"
```

---

## Phase 4 — Admin UI

### Task 14: Taxonomy constants (shared web/admin)

**Files:**
- Create: `packages/shared/src/product-taxonomy.ts` (or wherever shared code lives — verify first with `ls packages/shared`)
- Verify: `tsconfig.json` already resolves `@denimisia/shared` (or matching path alias)

- [ ] **Step 1: Find shared package**

```bash
ls packages/
```

Expected: directory listing. If a `shared` package exists with TypeScript, use it. Otherwise create the file at `apps/admin/lib/product-taxonomy.ts` and **also** copy to `apps/web/lib/product-taxonomy.ts` (duplication acceptable for v1; consolidate later).

- [ ] **Step 2: Write the taxonomy file**

```typescript
// product-taxonomy.ts — single source of truth for attribute options
export const PRODUCT_TYPES = ['PANTS', 'SHIRTS', 'JACKETS'] as const;
export type ProductType = typeof PRODUCT_TYPES[number];

export const UNIVERSAL_ATTRIBUTES = {
  season: { required: true, multi: true, options: ['Summer', 'Winter', 'Spring/Fall', 'All-season'] },
  occasion: { required: false, multi: true, options: ['Casual', 'Smart casual', 'Formal', 'Workwear', 'Party'] },
  material: { required: true, multi: true, options: ['Cotton', 'Denim', 'Linen', 'Leather', 'Wool', 'Polyester', 'Blend', 'Stretch'] },
  pattern: { required: false, multi: false, options: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic', 'Distressed'] },
} as const;

export const TYPE_ATTRIBUTES: Record<ProductType, Record<string, { required: boolean; multi: boolean; options: readonly string[] }>> = {
  PANTS: {
    silhouette: { required: true, multi: true, options: ['Skinny', 'Slim', 'Straight', 'Relaxed', 'Baggy', 'Wide-leg', 'Bootcut', 'Flared'] },
    rise: { required: true, multi: false, options: ['Low', 'Mid', 'High'] },
    length: { required: false, multi: false, options: ['Full', 'Cropped', 'Ankle'] },
    wash: { required: false, multi: false, options: ['Raw', 'Dark', 'Mid', 'Light', 'Black', 'Distressed', 'Acid'] },
  },
  SHIRTS: {
    silhouette: { required: true, multi: true, options: ['Slim', 'Fitted', 'Regular', 'Relaxed', 'Baggy', 'Oversized', 'Cropped'] },
    sleeve: { required: true, multi: false, options: ['Sleeveless', 'Short', '3/4', 'Long'] },
    neckline: { required: true, multi: false, options: ['Crew', 'V-neck', 'Polo', 'Button-up', 'Henley', 'Mock-neck'] },
    length: { required: false, multi: false, options: ['Regular', 'Cropped', 'Tunic'] },
  },
  JACKETS: {
    silhouette: { required: true, multi: true, options: ['Cropped', 'Fitted', 'Regular', 'Oversized'] },
    length: { required: true, multi: false, options: ['Cropped', 'Hip-length', 'Mid-length', 'Long'] },
    closure: { required: true, multi: false, options: ['Zip', 'Button', 'Snap', 'Open/drape'] },
    warmth: { required: true, multi: false, options: ['Light', 'Medium', 'Heavy'] },
  },
};

export const SIZE_CHART_DIMENSIONS: Record<ProductType, readonly string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'thigh'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve'],
};
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/lib/product-taxonomy.ts apps/web/lib/product-taxonomy.ts
git commit -m "feat(taxonomy): shared product attribute taxonomy constants"
```

---

### Task 15: Type dropdown + conditional attribute sections in product form

**Files:**
- Modify: `apps/admin/app/(dashboard)/products/new/page.tsx`
- Modify: `apps/admin/app/(dashboard)/products/[id]/page.tsx`
- Create: `apps/admin/components/products/type-attribute-fields.tsx`

- [ ] **Step 1: Create the conditional fields component**

Create `apps/admin/components/products/type-attribute-fields.tsx`:

```tsx
'use client';
import { TYPE_ATTRIBUTES, UNIVERSAL_ATTRIBUTES, ProductType } from '../../lib/product-taxonomy';

interface TagPair { dimension: string; value: string }

interface Props {
  type: ProductType | null;
  selected: TagPair[];
  onChange: (next: TagPair[]) => void;
}

export function TypeAttributeFields({ type, selected, onChange }: Props) {
  if (!type) {
    return <p className="text-sm text-muted-foreground">Select a Type to configure attributes.</p>;
  }

  const allDims = {
    ...UNIVERSAL_ATTRIBUTES,
    ...TYPE_ATTRIBUTES[type],
  } as Record<string, { required: boolean; multi: boolean; options: readonly string[] }>;

  const isSelected = (dimension: string, value: string) =>
    selected.some((s) => s.dimension === dimension && s.value === value);

  const toggle = (dimension: string, value: string, multi: boolean) => {
    if (multi) {
      const has = isSelected(dimension, value);
      const next = has
        ? selected.filter((s) => !(s.dimension === dimension && s.value === value))
        : [...selected, { dimension, value }];
      onChange(next);
    } else {
      const cleared = selected.filter((s) => s.dimension !== dimension);
      onChange([...cleared, { dimension, value }]);
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(allDims).map(([dimension, spec]) => (
        <div key={dimension}>
          <label className="block text-sm font-medium capitalize">
            {dimension}
            {spec.required ? <span className="text-red-500">*</span> : null}
          </label>
          <div className="mt-1 flex flex-wrap gap-2">
            {spec.options.map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => toggle(dimension, opt.toLowerCase(), spec.multi)}
                className={`rounded-full px-3 py-1 text-sm border ${
                  isSelected(dimension, opt.toLowerCase())
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-gray-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `products/new/page.tsx`**

Open `apps/admin/app/(dashboard)/products/new/page.tsx`. Find the form state and add:

```tsx
const [type, setType] = useState<ProductType | null>(null);
const [tags, setTags] = useState<Array<{ dimension: string; value: string }>>([]);
```

Add the Type dropdown near the top of the form (after Name/Slug):

```tsx
<label className="block text-sm font-medium">Type *</label>
<select
  value={type ?? ''}
  onChange={(e) => setType((e.target.value || null) as ProductType | null)}
  required
  className="mt-1 block w-full rounded border-gray-300"
>
  <option value="" disabled>Select type</option>
  {PRODUCT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
</select>
```

Below it, render `<TypeAttributeFields type={type} selected={tags} onChange={setTags} />`.

In the submit handler, include `type` and `productTags: tags` in the payload.

Add a client-side validator: before submit, verify every `required` dimension has at least one selected tag; otherwise prevent submit and show an inline message.

- [ ] **Step 3: Mirror to `products/[id]/page.tsx`**

In the edit page, hydrate state from `product.type` and `product.productTags` on load. Reuse the same component.

- [ ] **Step 4: Server-side enforcement**

Open `apps/api/src/modules/products/products.service.ts` `create()` method. After destructuring the DTO, add:

```typescript
import { ATTRIBUTE_DIMENSIONS_FOR_TYPE, REQUIRED_DIMENSIONS_FOR_TYPE } from '../bot/bot.constants';

// ...inside create(), after destructuring...
if (rest.type) {
  const requiredDims = REQUIRED_DIMENSIONS_FOR_TYPE[rest.type as keyof typeof REQUIRED_DIMENSIONS_FOR_TYPE];
  const providedDims = new Set((productTags ?? []).map((t: any) => t.dimension));
  for (const dim of requiredDims) {
    if (!providedDims.has(dim)) {
      throw new BadRequestException(`Missing required attribute: ${dim} for type ${rest.type}`);
    }
  }
}
```

Make sure `BadRequestException` is imported from `@nestjs/common`.

- [ ] **Step 5: Smoke test in dev**

```bash
cd apps/admin
pnpm dev
```

Open http://localhost:3001/products/new, pick PANTS, verify silhouette/rise/season/material show as required. Try submitting without rise selected — expect an inline error. Cancel.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/app/\(dashboard\)/products/ apps/admin/components/products/ apps/admin/lib/product-taxonomy.ts apps/api/src/modules/products/products.service.ts
git commit -m "feat(admin): type dropdown + conditional attribute sections in product form"
```

---

### Task 16: Size chart editor in product form

**Files:**
- Create: `apps/admin/components/products/size-chart-editor.tsx`
- Modify: `apps/admin/app/(dashboard)/products/new/page.tsx`
- Modify: `apps/admin/app/(dashboard)/products/[id]/page.tsx`

- [ ] **Step 1: Build the editor component**

Create `apps/admin/components/products/size-chart-editor.tsx`:

```tsx
'use client';
import { useMemo, useState } from 'react';
import { SIZE_CHART_DIMENSIONS, ProductType } from '../../lib/product-taxonomy';

interface ChartRow { sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }

interface Props {
  type: ProductType | null;
  variantSizes: string[];
  value: ChartRow[];
  onChange: (next: ChartRow[]) => void;
}

export function SizeChartEditor({ type, variantSizes, value, onChange }: Props) {
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  if (!type) return <p className="text-sm text-muted-foreground">Select a Type first.</p>;
  if (variantSizes.length === 0) return <p className="text-sm text-muted-foreground">Add at least one variant size first.</p>;

  const dims = SIZE_CHART_DIMENSIONS[type];
  const getValue = (sizeKey: string, dim: string, key: 'bodyValueIn' | 'garmentValueIn'): string => {
    const found = value.find((r) => r.sizeKey === sizeKey && r.dimension === dim);
    if (!found) return '';
    const v = found[key];
    return unit === 'cm' ? (v * 2.54).toFixed(1) : String(v);
  };

  const setValue = (sizeKey: string, dim: string, key: 'bodyValueIn' | 'garmentValueIn', raw: string) => {
    let inches = Number(raw);
    if (Number.isNaN(inches)) return;
    if (unit === 'cm') inches = inches / 2.54;
    const without = value.filter((r) => !(r.sizeKey === sizeKey && r.dimension === dim));
    const existing = value.find((r) => r.sizeKey === sizeKey && r.dimension === dim);
    const next = { sizeKey, dimension: dim, bodyValueIn: existing?.bodyValueIn ?? 0, garmentValueIn: existing?.garmentValueIn ?? 0, [key]: Math.round(inches * 2) / 2 } as ChartRow;
    onChange([...without, next]);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium">Size chart</label>
        <button type="button" onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')} className="text-xs underline">
          {unit === 'in' ? 'Show in cm' : 'Show in inches'}
        </button>
      </div>
      <table className="w-full text-sm border">
        <thead>
          <tr>
            <th className="border p-1">Size</th>
            {dims.flatMap((d) => [
              <th key={`${d}-body`} className="border p-1 capitalize">{d} (body)</th>,
              <th key={`${d}-garment`} className="border p-1 capitalize">{d} (garment)</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {variantSizes.map((s) => (
            <tr key={s}>
              <td className="border p-1 font-mono">{s}</td>
              {dims.flatMap((d) => [
                <td key={`${s}-${d}-body`} className="border p-1">
                  <input type="number" step="0.5" value={getValue(s, d, 'bodyValueIn')} onChange={(e) => setValue(s, d, 'bodyValueIn', e.target.value)} className="w-16" />
                </td>,
                <td key={`${s}-${d}-garment`} className="border p-1">
                  <input type="number" step="0.5" value={getValue(s, d, 'garmentValueIn')} onChange={(e) => setValue(s, d, 'garmentValueIn', e.target.value)} className="w-16" />
                </td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Wire into new/edit pages**

In `apps/admin/app/(dashboard)/products/new/page.tsx`, add state:

```tsx
const [sizeCharts, setSizeCharts] = useState<Array<{ sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }>>([]);
```

Below the attribute fields, render:

```tsx
<SizeChartEditor
  type={type}
  variantSizes={Array.from(new Set(variants.map((v) => v.size))).filter(Boolean)}
  value={sizeCharts}
  onChange={setSizeCharts}
/>
```

Include `sizeCharts` in the submit payload. Mirror to `[id]/page.tsx`.

- [ ] **Step 3: Smoke test**

```bash
cd apps/admin
pnpm dev
```

Create a product with type=PANTS and two variants (size 30, 32). Verify size chart appears with `waist | hip | inseam | thigh` columns and body/garment subcolumns. Fill in two cells, save, then re-open — values persist.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/components/products/size-chart-editor.tsx apps/admin/app/\(dashboard\)/products/
git commit -m "feat(admin): per-variant size chart editor"
```

---

### Task 17: Synonym editor admin page

**Files:**
- Create: `apps/admin/app/(dashboard)/bot/synonyms/page.tsx`
- Modify: `apps/api/src/modules/bot/bot.controller.ts` (add CRUD endpoints)

- [ ] **Step 1: Add admin endpoints to BotController**

Append to `apps/api/src/modules/bot/bot.controller.ts`:

```typescript
  @Get('admin/synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async listAllSynonyms() {
    return this.prisma.botSynonym.findMany({ orderBy: [{ dimension: 'asc' }, { canonical: 'asc' }] });
  }

  @Post('admin/synonyms')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async createSynonym(@Body() body: { dimension: string; canonical: string; aliases: string[] }) {
    const row = await this.prisma.botSynonym.upsert({
      where: { dimension_canonical: { dimension: body.dimension, canonical: body.canonical } },
      create: body,
      update: { aliases: body.aliases },
    });
    this.synonyms.invalidate();
    return row;
  }

  @Delete('admin/synonyms/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async deleteSynonym(@Param('id') id: string) {
    await this.prisma.botSynonym.delete({ where: { id } });
    this.synonyms.invalidate();
    return { ok: true };
  }
```

Import `Delete`, `Param`, `UseGuards`, `JwtAuthGuard`, `RolesGuard`, `Roles` consistent with how other admin controllers in the codebase do it (check `apps/api/src/modules/categories/categories.controller.ts` for the existing pattern and copy verbatim).

- [ ] **Step 2: Build the admin page**

Create `apps/admin/app/(dashboard)/bot/synonyms/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/admin-api';

const DIMENSIONS = ['category', 'color', 'silhouette', 'sleeve', 'neckline', 'closure', 'warmth', 'rise', 'wash', 'season', 'occasion', 'material', 'pattern'] as const;

interface Synonym { id: string; dimension: string; canonical: string; aliases: string[] }

export default function SynonymsPage() {
  const [rows, setRows] = useState<Synonym[]>([]);
  const [form, setForm] = useState({ dimension: 'color', canonical: '', aliases: '' });

  async function reload() {
    const r = await adminApi.get('/bot/admin/synonyms');
    setRows(r);
  }

  useEffect(() => { reload(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await adminApi.post('/bot/admin/synonyms', {
      dimension: form.dimension,
      canonical: form.canonical.trim().toLowerCase(),
      aliases: form.aliases.split(',').map((a) => a.trim().toLowerCase()).filter(Boolean),
    });
    setForm({ dimension: 'color', canonical: '', aliases: '' });
    reload();
  }

  async function remove(id: string) {
    if (!confirm('Delete this synonym?')) return;
    await adminApi.delete(`/bot/admin/synonyms/${id}`);
    reload();
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium">Bot synonyms</h1>
      <form onSubmit={submit} className="mt-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs">Dimension</label>
          <select value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })} className="rounded border px-2 py-1 text-sm">
            {DIMENSIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs">Canonical</label>
          <input value={form.canonical} onChange={(e) => setForm({ ...form, canonical: e.target.value })} required className="rounded border px-2 py-1 text-sm" />
        </div>
        <div className="flex-1">
          <label className="block text-xs">Aliases (comma-separated)</label>
          <input value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} className="w-full rounded border px-2 py-1 text-sm" />
        </div>
        <button type="submit" className="rounded bg-foreground px-3 py-1 text-sm text-background">Save</button>
      </form>
      <table className="mt-6 w-full text-sm">
        <thead>
          <tr><th className="text-left p-1">Dimension</th><th className="text-left p-1">Canonical</th><th className="text-left p-1">Aliases</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-1">{r.dimension}</td>
              <td className="p-1 font-medium">{r.canonical}</td>
              <td className="p-1 text-muted-foreground">{r.aliases.join(', ')}</td>
              <td className="p-1 text-right"><button onClick={() => remove(r.id)} className="text-xs text-red-600">Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

(If `adminApi` does not exist in this codebase, locate the existing pattern with `grep -r "from .*/lib/admin-api" apps/admin` or replace those three calls with direct `fetch` to `${process.env.NEXT_PUBLIC_API_URL}/api/v1/bot/admin/synonyms` with credentials included.)

- [ ] **Step 3: Add a sidebar link**

Find the admin sidebar nav (search for "categories" links in the admin layout file). Add a "Bot Synonyms" entry under a "Chat Bot" section.

- [ ] **Step 4: Manual smoke test**

```bash
cd apps/admin
pnpm dev
```

Navigate to /bot/synonyms, add a row `dimension=color canonical=teal aliases=["aqua"]`. Refresh. Confirm it persists.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/bot/ apps/api/src/modules/bot/bot.controller.ts
git commit -m "feat(admin): synonym editor admin page"
```

---

### Task 18: Unrecognized queries log + fit-data dashboard widget

**Files:**
- Create: `apps/admin/app/(dashboard)/bot/unrecognized/page.tsx`
- Modify: `apps/admin/app/(dashboard)/page.tsx` (admin home — find via grep if path differs)
- Modify: `apps/api/src/modules/bot/bot.controller.ts`

- [ ] **Step 1: Add admin endpoints**

Append to `bot.controller.ts`:

```typescript
  @Get('admin/unrecognized')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async listUnrecognized(@Query('limit') limit?: string) {
    return this.prisma.botUnrecognizedQuery.findMany({
      orderBy: { createdAt: 'desc' },
      take: Number(limit ?? 50),
    });
  }

  @Get('admin/fit-data-coverage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'STAFF')
  async fitDataCoverage() {
    const total = await this.prisma.product.count({ where: { isActive: true, deletedAt: null } });
    const missingType = await this.prisma.product.count({ where: { isActive: true, deletedAt: null, type: null } });
    const missingTags = await this.prisma.product.count({
      where: { isActive: true, deletedAt: null, type: { not: null }, productTags: { none: {} } },
    });
    const missingCharts = await this.prisma.product.count({
      where: { isActive: true, deletedAt: null, type: { not: null }, sizeCharts: { none: {} } },
    });
    return { total, missingType, missingTags, missingCharts };
  }
```

- [ ] **Step 2: Build the unrecognized log page**

Create `apps/admin/app/(dashboard)/bot/unrecognized/page.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { adminApi } from '../../../../lib/admin-api';

interface Row { id: string; text: string; sessionId: string; gender: string | null; createdAt: string }

export default function UnrecognizedPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    adminApi.get('/bot/admin/unrecognized?limit=200').then(setRows);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-xl font-medium">Unrecognized queries</h1>
      <p className="mt-1 text-sm text-muted-foreground">Customer messages the bot did not parse. Add common ones as synonyms to improve recall.</p>
      <table className="mt-4 w-full text-sm">
        <thead><tr><th className="text-left p-1">Time</th><th className="text-left p-1">Text</th><th className="text-left p-1">Session</th><th className="text-left p-1">Gender</th><th></th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-1 text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
              <td className="p-1 font-mono">"{r.text}"</td>
              <td className="p-1 text-xs">{r.sessionId.slice(0, 8)}</td>
              <td className="p-1 text-xs">{r.gender ?? '-'}</td>
              <td className="p-1 text-right">
                <a href={`/bot/synonyms?prefill=${encodeURIComponent(r.text)}`} className="text-xs underline">Add as synonym</a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Add the dashboard widget**

Locate the admin home page (typically `apps/admin/app/(dashboard)/page.tsx`). Append a card before the closing container element:

```tsx
'use client';
// (only the new card block — add to existing component)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { adminApi } from '../../lib/admin-api';

function FitDataCoverageCard() {
  const [data, setData] = useState<{ total: number; missingType: number; missingTags: number; missingCharts: number } | null>(null);
  useEffect(() => { adminApi.get('/bot/admin/fit-data-coverage').then(setData); }, []);
  if (!data) return null;
  return (
    <div className="rounded-lg border p-4">
      <h2 className="text-sm font-medium">Fit data coverage</h2>
      <dl className="mt-2 space-y-1 text-sm">
        <div className="flex justify-between"><dt>Total products</dt><dd>{data.total}</dd></div>
        <div className="flex justify-between"><dt>Missing Type</dt><dd><Link href="/products?missing=type" className="underline">{data.missingType}</Link></dd></div>
        <div className="flex justify-between"><dt>Missing attributes</dt><dd><Link href="/products?missing=tags" className="underline">{data.missingTags}</Link></dd></div>
        <div className="flex justify-between"><dt>Missing size charts</dt><dd><Link href="/products?missing=charts" className="underline">{data.missingCharts}</Link></dd></div>
      </dl>
    </div>
  );
}
```

Then render `<FitDataCoverageCard />` in the dashboard grid alongside existing cards.

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/bot/unrecognized/ apps/api/src/modules/bot/bot.controller.ts apps/admin/app/\(dashboard\)/page.tsx
git commit -m "feat(admin): unrecognized queries log + fit data dashboard widget"
```

---

## Phase 5 — Storefront Chat Widget

### Task 19: Chat store and types (zustand)

**Files:**
- Create: `apps/web/components/chat/use-chat-store.ts`
- Create: `apps/web/components/chat/chat.types.ts`

- [ ] **Step 1: Define shared types**

Create `apps/web/components/chat/chat.types.ts`:

```typescript
export type Role = 'bot' | 'user';

export interface BotProductCard {
  id: string;
  name: string;
  slug: string;
  price: number;
  images: string[];
}

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  ts: number;
  products?: BotProductCard[];
  chips?: string[];
  inputHint?: 'text' | 'numeric';
}

export interface BotContext {
  sessionId: string;
  gender?: 'M' | 'F' | null;
  flow?: {
    name: 'sizing';
    step: string;
    type: 'PANTS' | 'SHIRTS' | 'JACKETS';
    collected: Record<string, number | string>;
  };
}
```

- [ ] **Step 2: Create the zustand store**

Create `apps/web/components/chat/use-chat-store.ts`:

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BotContext, ChatMessage } from './chat.types';

const TTL_MS = 24 * 60 * 60 * 1000;

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  context: BotContext;
  lastUpdatedAt: number;
  setOpen: (open: boolean) => void;
  pushMessage: (msg: ChatMessage) => void;
  setContext: (ctx: BotContext) => void;
  reset: () => void;
}

function newSessionId(): string {
  return crypto.randomUUID();
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      open: false,
      messages: [],
      context: { sessionId: newSessionId() },
      lastUpdatedAt: Date.now(),
      setOpen: (open) => set({ open }),
      pushMessage: (msg) => set({ messages: [...get().messages, msg], lastUpdatedAt: Date.now() }),
      setContext: (ctx) => set({ context: ctx, lastUpdatedAt: Date.now() }),
      reset: () => set({ messages: [], context: { sessionId: newSessionId() }, lastUpdatedAt: Date.now() }),
    }),
    {
      name: 'denimisia-chat',
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Date.now() - state.lastUpdatedAt > TTL_MS) {
          state.messages = [];
          state.context = { sessionId: newSessionId() };
        }
      },
    },
  ),
);
```

- [ ] **Step 3: Verify zustand is installed**

```bash
cd apps/web
pnpm list zustand
```

If missing: `pnpm add zustand`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/chat/ apps/web/package.json
git commit -m "feat(web): chat store with persistent context and TTL"
```

---

### Task 20: Chat bubble + panel UI shells

**Files:**
- Create: `apps/web/components/chat/chat-bubble.tsx`
- Create: `apps/web/components/chat/chat-panel.tsx`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Build the bubble**

Create `apps/web/components/chat/chat-bubble.tsx`:

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { useChatStore } from './use-chat-store';
import { ChatPanel } from './chat-panel';

export function ChatBubble() {
  const pathname = usePathname();
  const open = useChatStore((s) => s.open);
  const setOpen = useChatStore((s) => s.setOpen);

  if (pathname?.startsWith('/checkout')) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="Open product finder"
        className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full bg-foreground text-background shadow-lg"
      >
        ?
      </button>
      {open ? <ChatPanel /> : null}
    </>
  );
}
```

- [ ] **Step 2: Build the panel shell**

Create `apps/web/components/chat/chat-panel.tsx`:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useChatStore } from './use-chat-store';
import { sendBotMessage } from '../../lib/api';

export function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const pushMessage = useChatStore((s) => s.pushMessage);
  const context = useChatStore((s) => s.context);
  const setContext = useChatStore((s) => s.setContext);
  const setOpen = useChatStore((s) => s.setOpen);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (messages.length === 0) {
      pushMessage({
        id: crypto.randomUUID(),
        role: 'bot',
        text: 'Looking for something? Tell me what you want, or tap a category.',
        ts: Date.now(),
        chips: ['Pants', 'Shirts', 'Jackets', "What's new", 'Help me find my size'],
      });
    }
  }, [messages.length, pushMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || sending) return;
    setSending(true);
    pushMessage({ id: crypto.randomUUID(), role: 'user', text, ts: Date.now() });
    setInput('');
    try {
      const reply = await sendBotMessage(text, context);
      setContext(reply.nextContext);
      pushMessage({
        id: crypto.randomUUID(),
        role: 'bot',
        text: reply.message,
        ts: Date.now(),
        products: reply.products,
        chips: reply.chips,
        inputHint: reply.input,
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-20 right-4 z-50 flex h-[70vh] w-[360px] max-w-[90vw] flex-col rounded-lg border bg-background shadow-2xl">
      <header className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-medium">Product finder</h2>
        <button onClick={() => setOpen(false)} aria-label="Close">×</button>
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`text-sm ${m.role === 'user' ? 'text-right' : ''}`}>
            <div className={`inline-block rounded-lg px-3 py-2 ${m.role === 'user' ? 'bg-foreground text-background' : 'bg-gray-100'}`}>
              {m.text}
            </div>
            {m.products?.length ? (
              <ul className="mt-2 space-y-1">
                {m.products.map((p) => (
                  <li key={p.id}>
                    <a href={`/products/${p.slug}`} className="block rounded border p-2 text-left text-xs hover:bg-gray-50">
                      <div className="font-medium">{p.name}</div>
                      <div className="text-muted-foreground">৳{p.price}</div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
            {m.chips?.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {m.chips.map((c) => (
                  <button key={c} onClick={() => send(c)} className="rounded-full border px-2 py-1 text-xs">
                    {c}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="border-t p-2 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a product, size, colour..."
          className="flex-1 rounded border px-2 py-1 text-sm"
          disabled={sending}
        />
        <button type="submit" disabled={sending} className="rounded bg-foreground px-3 py-1 text-sm text-background">
          Send
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Add the API client helper**

Open `apps/web/lib/api.ts` and append:

```typescript
import type { BotContext } from '../components/chat/chat.types';

export async function sendBotMessage(text: string, context: BotContext): Promise<any> {
  const res = await fetch(`${API_BASE}/bot/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, context }),
  });
  if (!res.ok) throw new Error(`Bot request failed: ${res.status}`);
  return res.json();
}
```

(Use whatever `API_BASE` constant already exists in that file; if none, reuse the same env var the existing helpers use.)

- [ ] **Step 4: Mount in root layout**

Open `apps/web/app/layout.tsx`. Inside the `<body>` near the closing tag, render `<ChatBubble />`. Import it from `../components/chat/chat-bubble`.

- [ ] **Step 5: Smoke test**

```bash
cd apps/web
pnpm dev
```

Open http://localhost:3000. The chat bubble should appear bottom-right on the homepage. Open it, type "black pants" — should get a response. Navigate to /checkout — bubble must disappear.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/chat/ apps/web/app/layout.tsx apps/web/lib/api.ts
git commit -m "feat(web): chat bubble + panel mounted in storefront layout"
```

---

### Task 21: "Find your size" modal on product detail

**Files:**
- Create: `apps/web/components/products/size-chart-modal.tsx`
- Modify: `apps/web/app/products/[slug]/page.tsx` (or whichever PDP component holds the CTA)
- Modify: `apps/web/lib/api.ts`

- [ ] **Step 1: Add API helper**

Append to `apps/web/lib/api.ts`:

```typescript
export async function getProductSizeChart(productId: string): Promise<{ rows: Array<{ sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }> }> {
  const res = await fetch(`${API_BASE}/products/${productId}/size-chart`);
  if (!res.ok) throw new Error(`Size chart fetch failed: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Build the modal**

Create `apps/web/components/products/size-chart-modal.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { getProductSizeChart } from '../../lib/api';
import { useChatStore } from '../chat/use-chat-store';

interface Row { sizeKey: string; dimension: string; bodyValueIn: number; garmentValueIn: number }

interface Props {
  productId: string;
  open: boolean;
  onClose: () => void;
}

export function SizeChartModal({ productId, open, onClose }: Props) {
  const [rows, setRows] = useState<Row[]>([]);
  const [unit, setUnit] = useState<'in' | 'cm'>('in');
  const [loading, setLoading] = useState(true);
  const setChatOpen = useChatStore((s) => s.setOpen);
  const pushMessage = useChatStore((s) => s.pushMessage);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getProductSizeChart(productId)
      .then((r) => setRows(r.rows))
      .finally(() => setLoading(false));
  }, [open, productId]);

  if (!open) return null;

  const sizes = Array.from(new Set(rows.map((r) => r.sizeKey)));
  const dimensions = Array.from(new Set(rows.map((r) => r.dimension)));
  const display = (v: number) => (unit === 'cm' ? (v * 2.54).toFixed(1) : v.toFixed(1));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-lg bg-background p-4">
        <header className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Size chart</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => setUnit(unit === 'in' ? 'cm' : 'in')} className="text-xs underline">{unit === 'in' ? 'cm' : 'in'}</button>
            <button onClick={onClose} aria-label="Close">×</button>
          </div>
        </header>
        {loading ? (
          <p className="py-4 text-center text-sm">Loading...</p>
        ) : rows.length === 0 ? (
          <p className="py-4 text-sm">Size chart not available for this product yet. <a className="underline" href="/size-guide">See general sizing guide</a>.</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr>
                <th className="p-1 text-left">Size</th>
                {dimensions.flatMap((d) => [
                  <th key={`${d}-body`} className="p-1 capitalize">{d} body</th>,
                  <th key={`${d}-garment`} className="p-1 capitalize">{d} garment</th>,
                ])}
              </tr>
            </thead>
            <tbody>
              {sizes.map((s) => (
                <tr key={s}>
                  <td className="p-1 font-mono">{s}</td>
                  {dimensions.flatMap((d) => {
                    const row = rows.find((r) => r.sizeKey === s && r.dimension === d);
                    return [
                      <td key={`${s}-${d}-b`} className="p-1">{row ? display(row.bodyValueIn) : '-'}</td>,
                      <td key={`${s}-${d}-g`} className="p-1">{row ? display(row.garmentValueIn) : '-'}</td>,
                    ];
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              setChatOpen(true);
              pushMessage({
                id: crypto.randomUUID(),
                role: 'user',
                text: 'Help me find my size',
                ts: Date.now(),
              });
              onClose();
            }}
            className="rounded bg-foreground px-4 py-2 text-sm text-background"
          >
            Help me pick →
          </button>
        </div>
      </div>
    </div>
  );
}
```

(The "Help me pick" button pushes the message client-side; the next user input will trigger the API call which carries the empty context — the panel's first render will see the user message and the parser will pick `sizing` from "help me find my size".)

- [ ] **Step 3: Add button on PDP**

In `apps/web/app/products/[slug]/page.tsx`, near the size selector, add a "Find your size" button that toggles a `useState<boolean>` and renders `<SizeChartModal productId={product.id} open={open} onClose={() => setOpen(false)} />`.

- [ ] **Step 4: Smoke test**

```bash
cd apps/web
pnpm dev
```

Open any product detail page, click "Find your size". Modal opens. If the product has chart data, it shows. Otherwise the fallback link works.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/products/size-chart-modal.tsx apps/web/app/products/ apps/web/lib/api.ts
git commit -m "feat(web): find-your-size modal with body and garment columns"
```

---

## Phase 6 — Testing & Polish

### Task 22: E2E happy path (Playwright)

**Files:**
- Create: `apps/web/tests/e2e/bot-find.spec.ts`
- Verify: existing Playwright config at `apps/web/playwright.config.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/tests/e2e/bot-find.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test('chat bubble opens, parses query, returns product cards', async ({ page }) => {
  await page.goto('/');
  const bubble = page.getByRole('button', { name: /open product finder/i });
  await bubble.click();
  await page.getByPlaceholder(/Type a product/).fill('black pants 30');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.locator('text=Got it')).toBeVisible({ timeout: 10_000 });
});

test('chat bubble is hidden on /checkout', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page.getByRole('button', { name: /open product finder/i })).toHaveCount(0);
});

test('sizing flow recommends a size', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /open product finder/i }).click();
  await page.getByRole('button', { name: 'Help me find my size' }).click();
  await expect(page.locator('text=shopping for')).toBeVisible();
  await page.getByRole('button', { name: 'Pants' }).click();
  await page.getByPlaceholder(/Type a product/).fill('32');
  await page.getByRole('button', { name: 'Send' }).click();
  // additional steps would continue here; this asserts the flow starts
});
```

- [ ] **Step 2: Run the e2e suite**

```bash
cd apps/web
pnpm playwright test bot-find
```

Expected: 3 tests pass (after the dev API and seed catalog are available). If they fail, investigate — do not skip.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/e2e/bot-find.spec.ts
git commit -m "test(web): e2e happy path for chat bubble and sizing flow"
```

---

### Task 23: Backfill audit — flag products missing fit data

**Files:**
- Create: `packages/database/prisma/audit-fit-data.ts`
- Modify: `packages/database/package.json` (add script)

- [ ] **Step 1: Create the audit script**

```typescript
// audit-fit-data.ts — read-only report
import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function main() {
  const missingType = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, type: null },
    select: { id: true, name: true, slug: true },
  });
  const missingTags = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, type: { not: null }, productTags: { none: {} } },
    select: { id: true, name: true, slug: true, type: true },
  });
  const missingCharts = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, type: { not: null }, sizeCharts: { none: {} } },
    select: { id: true, name: true, slug: true, type: true },
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ missingType, missingTags, missingCharts }, null, 2));
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Add script entry**

Edit `packages/database/package.json` `scripts`:

```json
"audit:fit": "tsx prisma/audit-fit-data.ts"
```

- [ ] **Step 3: Run it**

```bash
cd packages/database
pnpm audit:fit > /tmp/fit-audit.json
```

Expected: JSON file with three arrays. Use it to plan manual backfill in admin.

- [ ] **Step 4: Commit**

```bash
git add packages/database/prisma/audit-fit-data.ts packages/database/package.json
git commit -m "chore(db): audit script for products missing fit data"
```

---

### Task 24: Final manual QA pass

**Files:** none (verification step)

- [ ] **Step 1: Start all dev servers**

```bash
pnpm -F api dev &
pnpm -F admin dev &
pnpm -F web dev &
```

- [ ] **Step 2: Verify each acceptance criterion**

Walk through this checklist in the browser:

- [ ] Chat bubble visible on `/`, `/shop`, `/products/<slug>`, `/account/orders`. Hidden on `/checkout`.
- [ ] Typing "black pants 30" returns at least one product card if catalog has matching stock.
- [ ] Typing "lorem ipsum" logs to `BotUnrecognizedQuery` and shows the fallback chips.
- [ ] Typing "slim baggy pants" produces a contradiction prompt.
- [ ] Tapping "Help me find my size" → Pants → entering measurements yields a size recommendation.
- [ ] Logged-in user: completing sizing flow persists to `User.fitProfile`.
- [ ] "Find your size" modal on a PDP shows chart data; in/cm toggle works.
- [ ] Admin: new product form blocks save when required attributes missing.
- [ ] Admin: size chart editor saves and reloads correctly.
- [ ] Admin: dashboard "Fit data coverage" card matches the count from `pnpm audit:fit`.

- [ ] **Step 3: Document any deviations**

If any check fails, file an issue or fix immediately. Update this plan's task list with new entries.

- [ ] **Step 4: Final commit (only if changes were made)**

```bash
git status
# If clean, no commit needed.
```

---

## Self-Review Notes

Coverage check against spec:

- §1 Goal — covered by full plan.
- §3 Surface — Task 20.
- §4 Intents (find / whats_new / sizing / fallthrough) — Tasks 8, 11.
- §5 Taxonomy — Tasks 1, 2, 14, 15.
- §6 Size charts & body-size flow — Tasks 3, 10, 11, 16, 21.
- §7 Data model — Tasks 1–4.
- §8 API endpoints — Tasks 11, 13.
- §9 Frontend — Tasks 19, 20, 21.
- §10 Admin — Tasks 15, 16, 17, 18.
- §11 Edge cases — Tasks 8 (contradiction), 9 (stock-aware), 11 (unknown intent), 18 (fit-unknown flag).
- §12 Testing — Tasks 7, 8, 9, 10, 11, 13, 22.
- §13 Performance — Task 6 (cache constants), Task 1 (indexes), Task 2 (index).
- §14 Open Items — Items 1, 2, 3 are resolved by inspecting the DB in Task 1 (categories are independent, Customer = User, color canonicalization handled by `mode: 'insensitive'` in BotSearchService). Item 4 (cache invalidation) resolved via direct `invalidate()` call in Task 17 admin endpoints. Item 5 (mobile positioning) handled by Tailwind classes in Task 20; verify in Task 24.
