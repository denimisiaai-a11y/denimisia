import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

interface ColorLegendEntry {
  name: string;
  status: string;
}
interface ColorLegend {
  pattern_rules: Record<string, string>;
  codes: Record<string, ColorLegendEntry>;
}

interface MatrixEntry {
  name: string;
  matrix_label?: string | null;
  sizes: number[];
  colors: string[];
  stock: Record<string, Record<string, number>>;
  total?: number;
  excluded?: boolean;
}
interface MatricesFile {
  matrices: Record<string, MatrixEntry>;
}

interface ProductSource {
  sku: string;
  name: string;
  slug: string;
  description?: string;
  details?: string[];
  care?: string;
  model_note?: string;
  drive_folder_id?: string | null;
  price?: number | null;
  sale_price?: number | null;
  tags?: string[];
  excluded?: boolean;
}
interface ProductsFile {
  products: ProductSource[];
}

interface UploadedImage {
  filename: string;
  url: string;
  bytes: number;
}
interface UploadManifestEntry {
  uploaded: UploadedImage[];
  deduped: string[];
  arw_archived_locally: string[];
}
interface UploadManifest {
  per_sku: Record<string, UploadManifestEntry>;
}

const IMPORTS_DIR = resolve('c:/Users/joycg/denimisia/docs/imports');
const products = JSON.parse(readFileSync(resolve(IMPORTS_DIR, '2026-05-24-products-batch-1.json'), 'utf8')) as ProductsFile;
const matrices = JSON.parse(readFileSync(resolve(IMPORTS_DIR, '2026-05-24-stock-matrices.json'), 'utf8')) as MatricesFile;
const colors = JSON.parse(readFileSync(resolve(IMPORTS_DIR, 'color-legend.json'), 'utf8')) as ColorLegend;
const uploads = JSON.parse(readFileSync(resolve(IMPORTS_DIR, 'upload-manifest.json'), 'utf8')) as UploadManifest;

// Category slug per SKU (from owner-confirmed mapping 2026-05-24)
const CATEGORY_BY_SKU: Record<string, string> = {
  '21001': 'womens-baggy',
  '21013': 'womens-flare',
  '21022': 'womens-baggy',
  '41013': 'womens-wide-leg',
  '41011': 'womens-wide-leg',
  '4101':  'womens-wide-leg',
  '2120':  'womens-baggy',
  '3010':  'womens-wide-leg',
  '3037':  'womens-wide-leg',
  '3042':  'womens-wide-leg',
  '3044':  'womens-flare',
  '3039':  'womens-flare',
  '6008':  'womens-cargo',
  '2121':  'womens-baggy',
  '20007': 'womens-wide-leg',
  '2123':  'womens-baggy',
  '2125':  'womens-baggy',
};

function buildDescription(p: ProductSource): string {
  const parts: string[] = [];
  if (p.description) parts.push(p.description);
  if (p.details && p.details.length > 0) {
    parts.push('\nDetails:\n' + p.details.map((d) => `• ${d}`).join('\n'));
  }
  if (p.care) parts.push(`\nCare: ${p.care}`);
  if (p.model_note) parts.push(`\n${p.model_note}`);
  return parts.join('\n');
}

async function main(): Promise<void> {
  // Build slug -> id map for categories
  const cats = await prisma.category.findMany({ select: { id: true, slug: true } });
  const catIdBySlug = Object.fromEntries(cats.map((c) => [c.slug, c.id]));

  console.log('Importing products...\n');
  let created = 0;
  let skipped = 0;
  const skuTotals: Array<{ sku: string; name: string; variants: number; images: number; totalStock: number }> = [];

  for (const p of products.products) {
    if (p.excluded) {
      console.log(`  SKIP ${p.sku} -- excluded by owner`);
      skipped++;
      continue;
    }
    const m = matrices.matrices[p.sku];
    const u = uploads.per_sku[p.sku];
    const catSlug = CATEGORY_BY_SKU[p.sku];
    const catId = catIdBySlug[catSlug];

    if (!m) { console.log(`  SKIP ${p.sku} -- no matrix`); skipped++; continue; }
    if (!u) { console.log(`  SKIP ${p.sku} -- no upload manifest`); skipped++; continue; }
    if (!catId) { console.log(`  SKIP ${p.sku} -- category '${catSlug}' not found`); skipped++; continue; }
    if (p.price == null) { console.log(`  SKIP ${p.sku} -- no price`); skipped++; continue; }

    const variantsToCreate: Prisma.ProductVariantCreateWithoutProductInput[] = [];
    let totalStock = 0;
    for (const colorCode of m.colors) {
      const colorName = colors.codes[colorCode]?.name ?? colorCode;
      const stockBySize = m.stock[colorCode] ?? {};
      for (const size of m.sizes) {
        const stock = stockBySize[String(size)] ?? 0;
        totalStock += stock;
        variantsToCreate.push({
          sku: `${p.sku}-${colorCode}-${size}`,
          size: String(size),
          color: colorName,
          stock,
        });
      }
    }

    const imageUrls = u.uploaded.map((x) => x.url);

    await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: buildDescription(p),
        price: new Prisma.Decimal(p.price),
        images: imageUrls,
        tags: p.tags ?? [],
        categoryId: catId,
        isActive: true,
        isNewArrival: true,
        isFeatured: false,
        isTrending: false,
        showStarBadge: false,
        returnable: true,
        variants: { create: variantsToCreate },
      },
    });

    created++;
    skuTotals.push({
      sku: p.sku,
      name: p.name,
      variants: variantsToCreate.length,
      images: imageUrls.length,
      totalStock,
    });
    console.log(`  OK   ${p.sku} ${p.name}  -- ${variantsToCreate.length} variants, ${imageUrls.length} images, ${totalStock} units`);
  }

  console.log(`\nCreated ${created} products, skipped ${skipped}.\n`);

  const after = await Promise.all([
    prisma.product.count(),
    prisma.productVariant.count(),
  ]);
  console.log(`Live DB now: ${after[0]} products, ${after[1]} variants.`);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
