/**
 * Catalog seed — loads the real 78-variant Denimisia catalog into the database.
 *
 * Source of truth: packages/database/prisma/catalog-data.ts (auto-generated
 * from data/catalog/transform.py).
 *
 * Idempotent: upserts on slug/sku so re-running is safe.
 *
 * Run: pnpm --filter database seed:catalog
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { PARENTS, VARIANTS, INVENTORY } from './catalog-data';

const prisma = new PrismaClient();

// Hero category (from catalog-data) → existing Prisma Category slug.
// Existing seed (seed.ts) already creates womens-wide-leg, womens-baggy,
// womens-flare, womens-barrel, womens-cargo under parent slug "womens".
// New categories below are added under the same "womens" parent.
const HERO_CATEGORY_MAP: Record<string, { slug: string; name: string }> = {
  'wide-leg':    { slug: 'womens-wide-leg',    name: 'Wide Leg' },
  'baggy':       { slug: 'womens-baggy',       name: 'Baggy Fit' },
  'cargo':       { slug: 'womens-cargo',       name: 'Cargo' },
  'flared':      { slug: 'womens-flare',       name: 'Flare & Boot Cut' },
  'barrel':      { slug: 'womens-barrel',      name: 'Barrel Fit' },
  'boyfriend':   { slug: 'womens-boyfriend',   name: 'Boyfriend' },
  'straight':    { slug: 'womens-straight',    name: 'Straight Leg' },
  'designed':    { slug: 'womens-designed',    name: 'Designed' },
  'distressed':  { slug: 'womens-distressed',  name: 'Distressed' },
};

// Tags inside catalog that should become Collection memberships rather than
// Product.tags entries.
const COLLECTION_TAGS: Record<string, { slug: string; name: string; description: string }> = {
  spring26: { slug: 'spring-26',  name: "Spring '26",       description: "Spring 2026 capsule." },
  eid26:    { slug: 'eid-26',     name: "Eid al-Adha '26",  description: "Eid al-Adha 2026 edit." },
};

// Tags that DO map to a category are removed from Product.tags to avoid
// double-counting; everything else (series, style descriptors) stays as tags.
const TAG_IS_CATEGORY = new Set(Object.keys(HERO_CATEGORY_MAP));
const TAG_IS_COLLECTION = new Set(Object.keys(COLLECTION_TAGS));

type ParentRow = (typeof PARENTS)[number];
type VariantRow = (typeof VARIANTS)[number];
type InventoryRow = (typeof INVENTORY)[number];

async function ensureWomensParent(): Promise<string> {
  const parent = await prisma.category.upsert({
    where:  { slug: 'womens' },
    update: {},
    create: { name: "Women's", slug: 'womens', description: "Women's clothing" },
  });
  return parent.id;
}

async function ensureCategories(womensId: string): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const [heroKey, { slug, name }] of Object.entries(HERO_CATEGORY_MAP)) {
    const cat = await prisma.category.upsert({
      where:  { slug },
      update: {},
      create: { name, slug, parentId: womensId },
    });
    ids[heroKey] = cat.id;
  }
  return ids;
}

async function ensureCollections(): Promise<Record<string, string>> {
  const ids: Record<string, string> = {};
  for (const [tag, { slug, name, description }] of Object.entries(COLLECTION_TAGS)) {
    const col = await prisma.collection.upsert({
      where:  { slug },
      update: {},
      create: { name, slug, description, isActive: true },
    });
    ids[tag] = col.id;
  }
  return ids;
}

function buildDescription(parent: ParentRow, washCount: number): string {
  return (
    `${parent.title} — ${parent.fit} silhouette with ${parent.waist}-waist fit. ` +
    `Crafted from ${parent.fabric} for a structured drape and lasting durability. ` +
    `Available in ${washCount} ${washCount === 1 ? 'wash' : 'washes'} and sizes 24–48. ` +
    `Premium women's denim by Denimisia.`
  );
}

async function seedProducts(
  categoryIds: Record<string, string>,
  collectionIds: Record<string, string>,
): Promise<void> {
  let productCount = 0;
  let variantCount = 0;

  for (const parent of PARENTS) {
    const parentVariants: VariantRow[] = VARIANTS.filter(
      (v) => v.parent_model === parent.model,
    );
    const heroCatId = categoryIds[parent.hero_category];
    if (!heroCatId) {
      console.warn(`[skip] ${parent.model}: unknown hero_category "${parent.hero_category}"`);
      continue;
    }

    // First active variant is the pricing anchor for the parent row.
    const anchor = parentVariants.find((v) => v.status === 'enabled') ?? parentVariants[0];
    if (!anchor) continue;

    // Images shown on the parent — one thumbnail per wash (variant carries its own later).
    const parentImages = Array.from(new Set(parentVariants.map((v) => v.source_image)));

    // Series/style tags that do NOT map to a category or collection stay on the product.
    const productTags = parent.tags.filter(
      (t) => !TAG_IS_CATEGORY.has(t) && !TAG_IS_COLLECTION.has(t),
    );

    const product = await prisma.product.upsert({
      where: { slug: parent.slug },
      update: {
        name:           parent.title,
        description:    buildDescription(parent, parentVariants.length),
        price:          new Prisma.Decimal(anchor.price_bdt),
        compareAtPrice: null,
        images:         parentImages,
        tags:           productTags,
        isActive:       parentVariants.some((v) => v.status === 'enabled'),
        isFeatured:     false,
        categoryId:     heroCatId,
      },
      create: {
        name:           parent.title,
        slug:           parent.slug,
        description:    buildDescription(parent, parentVariants.length),
        price:          new Prisma.Decimal(anchor.price_bdt),
        compareAtPrice: null,
        images:         parentImages,
        tags:           productTags,
        isActive:       parentVariants.some((v) => v.status === 'enabled'),
        isFeatured:     false,
        categoryId:     heroCatId,
      },
    });
    productCount += 1;

    // Collection memberships — e.g. spring-26, eid-26.
    for (const tag of parent.tags) {
      const colId = collectionIds[tag];
      if (!colId) continue;
      await prisma.collectionProduct.upsert({
        where: { collectionId_productId: { collectionId: colId, productId: product.id } },
        update: {},
        create: { collectionId: colId, productId: product.id },
      });
    }

    // Variants — one ProductVariant per (wash × size).
    for (const variant of parentVariants) {
      const sizes: InventoryRow[] = INVENTORY.filter(
        (i) => i.variant_sku_prefix === variant.sku_prefix,
      );
      for (const inv of sizes) {
        await prisma.productVariant.upsert({
          where: { sku: inv.sku },
          update: {
            size:   String(inv.size),
            color:  variant.wash_name,
            stock:  inv.quantity,
            price:  new Prisma.Decimal(variant.special_price_bdt),
            images: [variant.source_image],
          },
          create: {
            productId: product.id,
            sku:       inv.sku,
            size:      String(inv.size),
            color:     variant.wash_name,
            stock:     inv.quantity,
            price:     new Prisma.Decimal(variant.special_price_bdt),
            images:    [variant.source_image],
          },
        });
        variantCount += 1;
      }
    }
  }

  console.log(`  products=${productCount}  variants=${variantCount}`);
}

async function main(): Promise<void> {
  console.log('Catalog seed — Denimisia 78-variant import');
  console.log('  parents =', PARENTS.length);
  console.log('  variants=', VARIANTS.length);
  console.log('  inventory rows=', INVENTORY.length);

  const womensId = await ensureWomensParent();
  const categoryIds = await ensureCategories(womensId);
  const collectionIds = await ensureCollections();

  console.log('  categories  :', Object.keys(categoryIds).length);
  console.log('  collections :', Object.keys(collectionIds).length);

  await seedProducts(categoryIds, collectionIds);

  console.log('Done.');
}

main()
  .catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Catalog seed failed:', message);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
