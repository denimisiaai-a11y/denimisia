import { PrismaClient, Prisma } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface RawProductRow {
  name: string;
  description?: string;
  price: string;
  compareAtPrice?: string;
  category: string;
  collection?: string;
  tags?: string;
  sizes?: string;
  colors?: string;
  stock?: string;
  images?: string;
  isFeatured?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCSV(filePath: string): RawProductRow[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length < 2)
    throw new Error('CSV must have a header row and at least one data row');

  const headers = lines[0]
    .split(',')
    .map((h) => h.trim().replace(/^"|"$/g, ''));

  return lines.slice(1).map((line) => {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row as unknown as RawProductRow;
  });
}

async function ensureCategory(name: string): Promise<string> {
  const slug = slugify(name);
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing.id;

  const created = await prisma.category.create({
    data: { name, slug },
  });
  return created.id;
}

async function importProducts(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  let rows: RawProductRow[];
  if (ext === '.csv') {
    rows = parseCSV(filePath);
  } else {
    console.error('Unsupported file format. Use .csv');
    console.log(
      'For Excel (.xlsx), convert to CSV first or install the xlsx package.',
    );
    process.exit(1);
  }

  console.log(`Found ${rows.length} products to import`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      if (!row.name || !row.price) {
        console.warn('Skipping row: missing name or price');
        skipped++;
        continue;
      }

      const slug = slugify(row.name);

      const existing = await prisma.product.findUnique({ where: { slug } });
      if (existing) {
        console.log(`Skipping "${row.name}" — already exists`);
        skipped++;
        continue;
      }

      const categoryId = await ensureCategory(row.category || 'Uncategorized');

      const images = row.images
        ? row.images
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : ['/images/product-bella.jpg'];

      const tags = row.tags
        ? row.tags
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      const price = new Prisma.Decimal(row.price);
      const compareAtPrice = row.compareAtPrice
        ? new Prisma.Decimal(row.compareAtPrice)
        : null;

      const product = await prisma.product.create({
        data: {
          name: row.name,
          slug,
          description: row.description || '',
          price,
          compareAtPrice,
          images,
          tags,
          isFeatured: row.isFeatured === 'true',
          categoryId,
        },
      });

      const sizes = row.sizes
        ? row.sizes.split(',').map((s) => s.trim())
        : ['Free Size'];
      const colors = row.colors
        ? row.colors.split(',').map((s) => s.trim())
        : ['Default'];
      const defaultStock = parseInt(row.stock || '10', 10);

      for (const size of sizes) {
        for (const color of colors) {
          const sku =
            `${slug}-${slugify(color)}-${slugify(size)}`.toUpperCase();
          await prisma.productVariant.create({
            data: {
              productId: product.id,
              sku,
              size,
              color,
              stock: defaultStock,
              price,
              images,
            },
          });
        }
      }

      imported++;
      console.log(
        `+ Imported "${row.name}" with ${sizes.length * colors.length} variants`,
      );
    } catch (err) {
      console.error(`x Error importing "${row.name}":`, err);
      errors++;
    }
  }

  console.log(
    `\nImport complete: ${imported} imported, ${skipped} skipped, ${errors} errors`,
  );
}

const filePath = process.argv[2];
if (!filePath) {
  console.log('Usage: pnpm --filter api import:products <path-to-csv>');
  console.log('\nExpected CSV columns:');
  console.log(
    '  name (required), price (required), description, compareAtPrice,',
  );
  console.log(
    '  category, collection, tags, sizes, colors, stock, images, isFeatured',
  );
  process.exit(1);
}

importProducts(path.resolve(filePath))
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    prisma.$disconnect();
    process.exit(1);
  });
