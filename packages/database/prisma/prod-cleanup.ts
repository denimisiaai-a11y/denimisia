/**
 * Production cleanup — destructive, run once before launch.
 *
 * Removes:
 *   - 17 hand-seeded placeholder products (images = '/images/product-bella.jpg')
 *     and their 195 variants (cascade), their CollectionProduct links, BundleItems
 *   - 13 test users (test-register-*, logout-test-*, auth-access-*, customer@denimisia.com)
 *   - 8 duplicate banners (keep 1 of each unique title+image combination)
 *
 * Rewires before delete:
 *   - All 11 BundleItem rows currently point at placeholder products.
 *     Re-point them at matching CDN products (matched by name token) before delete,
 *     or skip the bundle if no match found.
 *
 * Repairs content image URLs:
 *   - HomepageSection.hero.content.image → use a real editorial placeholder
 *
 * Creates:
 *   - SUPER_ADMIN user (credentials prompted via env: SUPER_ADMIN_EMAIL, SUPER_ADMIN_PASSWORD)
 *
 * Run: pnpm --filter database prod:cleanup
 * Dry run: DRY_RUN=1 pnpm --filter database prod:cleanup
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const DRY_RUN = process.env.DRY_RUN === '1';
const CDN_PREFIX = 'storola-client-space.sgp1.cdn.digitaloceanspaces.com';
const PLACEHOLDER_PATH = '/images/product-bella.jpg';

interface CleanupReport {
  placeholderProducts: number;
  placeholderVariants: number;
  placeholderCollectionLinks: number;
  placeholderBundleItems: number;
  rewiredBundleItems: number;
  testUsers: number;
  duplicateBanners: number;
  homepageSectionFixes: number;
  superAdminCreated: boolean;
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[()|,\-'"]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !['the', 'and', 'for', 'with', 'denim', 'jean', 'jeans'].includes(t));
}

function matchScore(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  let overlap = 0;
  for (const t of ta) if (tb.has(t)) overlap += 1;
  return overlap;
}

async function findReplacementProduct(placeholderName: string): Promise<string | null> {
  // Find the best CDN-backed product whose name shares the most tokens.
  const cdnProducts = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      images: { hasSome: [] },
      // crude filter: we'll check CDN prefix in JS
    },
    select: { id: true, name: true, images: true },
  });
  const cdnOnly = cdnProducts.filter((p) => p.images.some((u) => u.includes(CDN_PREFIX)));
  let best: { id: string; name: string; score: number } | null = null;
  for (const p of cdnOnly) {
    const score = matchScore(placeholderName, p.name);
    if (score >= 2 && (!best || score > best.score)) {
      best = { id: p.id, name: p.name, score };
    }
  }
  return best?.id ?? null;
}

async function run(): Promise<CleanupReport> {
  const report: CleanupReport = {
    placeholderProducts:        0,
    placeholderVariants:        0,
    placeholderCollectionLinks: 0,
    placeholderBundleItems:     0,
    rewiredBundleItems:         0,
    testUsers:                  0,
    duplicateBanners:           0,
    homepageSectionFixes:       0,
    superAdminCreated:          false,
  };

  // ── 1. Identify placeholder products ────────────────────────────────────
  const placeholders = await prisma.product.findMany({
    where: { images: { has: PLACEHOLDER_PATH } },
    select: { id: true, name: true, slug: true },
  });
  report.placeholderProducts = placeholders.length;
  const placeholderIds = placeholders.map((p) => p.id);
  console.log(`Found ${placeholders.length} placeholder products to remove.`);

  // Count collateral
  const [variantCount, collectionLinks, bundleItems] = await Promise.all([
    prisma.productVariant.count({ where: { productId: { in: placeholderIds } } }),
    prisma.collectionProduct.count({ where: { productId: { in: placeholderIds } } }),
    prisma.bundleItem.findMany({ where: { productId: { in: placeholderIds } }, include: { product: true } }),
  ]);
  report.placeholderVariants = variantCount;
  report.placeholderCollectionLinks = collectionLinks;
  report.placeholderBundleItems = bundleItems.length;
  console.log(`  → ${variantCount} variants, ${collectionLinks} collection links, ${bundleItems.length} bundle items`);

  // ── 2. Rewire BundleItems to CDN products before delete ────────────────
  for (const item of bundleItems) {
    const newProductId = await findReplacementProduct(item.product.name);
    if (newProductId && newProductId !== item.productId) {
      // Check for duplicate (bundle, newProduct) would violate @@unique
      const dup = await prisma.bundleItem.findUnique({
        where: {
          bundleId_productId_color: {
            bundleId: item.bundleId,
            productId: newProductId,
            color: '',
          },
        },
      });
      if (dup) {
        console.log(`  [bundle ${item.bundleId}] ${item.product.name.slice(0, 40)} → duplicate of existing, will drop`);
      } else {
        console.log(`  [bundle ${item.bundleId}] ${item.product.name.slice(0, 40)} → CDN match found`);
        if (!DRY_RUN) {
          await prisma.bundleItem.update({
            where: { id: item.id },
            data:  { productId: newProductId },
          });
          report.rewiredBundleItems += 1;
        }
      }
    } else {
      console.log(`  [bundle ${item.bundleId}] ${item.product.name.slice(0, 40)} → no CDN match, will cascade-delete`);
    }
  }

  // ── 3. Delete placeholder products (cascades to variants + junctions) ──
  if (!DRY_RUN && placeholderIds.length > 0) {
    // Explicitly clean up junctions that don't have cascade cleanup yet
    // (the migration added Cascade on CollectionProduct + BundleItem, but we
    // re-wired bundles above; remaining BundleItems pointing at placeholders
    // will cascade-delete).
    await prisma.product.deleteMany({ where: { id: { in: placeholderIds } } });
    console.log(`  ✓ Deleted ${placeholders.length} placeholder products (cascaded).`);
  }

  // ── 4. Delete test users ────────────────────────────────────────────────
  const testUserEmails = [
    'customer@denimisia.com',
  ];
  const testUserPatterns = [
    'test-register-',
    'logout-test-',
    'test-login-',
    'auth-access-',
    '@denimisia.test',
  ];
  const testUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { in: testUserEmails } },
        ...testUserPatterns.map((p) => ({ email: { contains: p } as const })),
      ],
    },
    select: { id: true, email: true },
  });
  report.testUsers = testUsers.length;
  console.log(`Found ${testUsers.length} test users to remove.`);
  testUsers.forEach((u) => console.log(`  - ${u.email}`));
  if (!DRY_RUN && testUsers.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: testUsers.map((u) => u.id) } } });
    console.log(`  ✓ Deleted ${testUsers.length} test users (cascaded addresses/carts/wishlists).`);
  }

  // ── 5. Dedupe banners ───────────────────────────────────────────────────
  const banners = await prisma.banner.findMany({ orderBy: { createdAt: 'asc' } });
  const seen = new Map<string, string>();
  const toDelete: string[] = [];
  for (const b of banners) {
    const key = `${b.title}|${b.image}|${b.position}`;
    if (seen.has(key)) {
      toDelete.push(b.id);
    } else {
      seen.set(key, b.id);
    }
  }
  report.duplicateBanners = toDelete.length;
  console.log(`Found ${toDelete.length} duplicate banners to remove.`);
  if (!DRY_RUN && toDelete.length > 0) {
    await prisma.banner.deleteMany({ where: { id: { in: toDelete } } });
    console.log(`  ✓ Deleted ${toDelete.length} duplicate banners.`);
  }

  // ── 6. Repair homepage section image ───────────────────────────────────
  // HomepageSection: clear any `content` JSON whose `image` field is a local path
  const sections = await prisma.homepageSection.findMany();
  for (const s of sections) {
    const content = s.content as { image?: string } | null;
    if (content?.image?.startsWith('/images/')) {
      if (!DRY_RUN) {
        const { image: _drop, ...rest } = content;
        await prisma.homepageSection.update({
          where: { id: s.id },
          data:  { content: rest as object, image: null },
        });
      }
      report.homepageSectionFixes += 1;
    }
  }
  console.log(`  ✓ Cleared ${report.homepageSectionFixes} homepage section placeholder images.`);

  // ── 7. Ensure SUPER_ADMIN exists ────────────────────────────────────────
  // Priority: explicit env var → elevate existing admin@denimisia.com → skip.
  const existing = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (existing) {
    console.log(`SUPER_ADMIN already exists (${existing.email}).`);
  } else {
    const superEmail    = process.env.SUPER_ADMIN_EMAIL ?? 'admin@denimisia.com';
    const superPassword = process.env.SUPER_ADMIN_PASSWORD;
    const current = await prisma.user.findUnique({ where: { email: superEmail } });
    if (current) {
      // Elevate existing admin account.
      if (!DRY_RUN) {
        await prisma.user.update({
          where: { id: current.id },
          data:  { role: 'SUPER_ADMIN', isVerified: true },
        });
        report.superAdminCreated = true;
        console.log(`  ✓ Elevated existing user to SUPER_ADMIN: ${superEmail}`);
      }
    } else if (superPassword && superPassword.length >= 12) {
      // Create new super-admin from env credentials.
      const hash = await bcrypt.hash(superPassword, 12);
      if (!DRY_RUN) {
        await prisma.user.create({
          data: {
            email:        superEmail,
            passwordHash: hash,
            firstName:    'Super',
            lastName:     'Admin',
            role:         'SUPER_ADMIN',
            isVerified:   true,
          },
        });
        report.superAdminCreated = true;
        console.log(`  ✓ Created new SUPER_ADMIN: ${superEmail}`);
      }
    } else {
      console.warn(`  ⚠ No SUPER_ADMIN exists and no credentials provided. Set SUPER_ADMIN_EMAIL + SUPER_ADMIN_PASSWORD env, or create admin@denimisia.com first.`);
    }
  }

  return report;
}

run()
  .then((r) => {
    console.log('\n── Cleanup summary ───────────────────────────');
    for (const [k, v] of Object.entries(r)) console.log(`  ${k.padEnd(30)} ${v}`);
    if (DRY_RUN) console.log('\n(DRY_RUN was set — no changes committed.)');
  })
  .catch((err: unknown) => {
    console.error('Cleanup failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
