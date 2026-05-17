/**
 * Supabase Storage → Cloudflare R2 migration.
 *
 * Copies every asset from the old Supabase buckets to the new R2 bucket,
 * then rewrites every MediaAsset row's publicUrl / storageBucket / storagePath
 * to point at the R2 location. Idempotent (skips assets already on R2).
 *
 * Pre-flight:
 *   - R2 env vars populated in apps/api/.env
 *   - SUPABASE_* env vars still populated (source)
 *   - Both buckets readable by the service-role key
 *
 * Run: pnpm --filter api exec tsx scripts/migrate-supabase-to-r2.ts
 * Dry: DRY_RUN=1 pnpm --filter api exec tsx scripts/migrate-supabase-to-r2.ts
 */

import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.env.DRY_RUN === '1';
const prisma = new PrismaClient();

async function run(): Promise<void> {
  const {
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME, R2_PUBLIC_URL,
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_BUCKET_ORIGINALS = 'media-originals',
    SUPABASE_BUCKET_PUBLIC    = 'media-public',
  } = process.env as Record<string, string | undefined>;

  const missing = [
    ['R2_ACCOUNT_ID', R2_ACCOUNT_ID],
    ['R2_ACCESS_KEY_ID', R2_ACCESS_KEY_ID],
    ['R2_SECRET_ACCESS_KEY', R2_SECRET_ACCESS_KEY],
    ['R2_BUCKET_NAME', R2_BUCKET_NAME],
    ['R2_PUBLIC_URL', R2_PUBLIC_URL],
    ['SUPABASE_URL', SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error(`Missing env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId:     R2_ACCESS_KEY_ID!,
      secretAccessKey: R2_SECRET_ACCESS_KEY!,
    },
  });

  const sb = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });

  const assets = await prisma.mediaAsset.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Found ${assets.length} MediaAsset rows.`);

  let migrated = 0;
  let skipped  = 0;
  let failed   = 0;

  for (const a of assets) {
    const alreadyOnR2 = a.publicUrl.startsWith(R2_PUBLIC_URL!);
    if (alreadyOnR2) {
      skipped += 1;
      continue;
    }

    // Derive source bucket + source path from the stored storageBucket/storagePath.
    const sourceBucket = a.storageBucket || SUPABASE_BUCKET_PUBLIC;
    const sourcePath   = a.storagePath;
    const newKey       = `public/${sourcePath}`;
    const newUrl       = `${R2_PUBLIC_URL}/${newKey}`;

    try {
      // Download from Supabase (service role bypasses RLS).
      const { data, error } = await sb.storage.from(sourceBucket).download(sourcePath);
      if (error || !data) throw new Error(error?.message ?? 'Supabase download returned no data');
      const buffer = Buffer.from(await data.arrayBuffer());

      console.log(`  migrating ${sourceBucket}/${sourcePath} → ${newKey} (${buffer.length} bytes)`);

      if (!DRY_RUN) {
        await r2.send(new PutObjectCommand({
          Bucket:       R2_BUCKET_NAME!,
          Key:          newKey,
          Body:         buffer,
          ContentType:  a.mime,
          CacheControl: 'public, max-age=31536000, immutable',
        }));

        // Also copy the original if recorded (strip the bucket prefix).
        const originalBucketPath = a.originalUrl.replace(/^r2:\/\/[^/]+\//, '').replace(new RegExp(`^${SUPABASE_BUCKET_ORIGINALS}/`), '');
        if (originalBucketPath && originalBucketPath !== sourcePath) {
          const { data: origData } = await sb.storage.from(SUPABASE_BUCKET_ORIGINALS).download(originalBucketPath).catch(() => ({ data: null }));
          if (origData) {
            const origBuf = Buffer.from(await origData.arrayBuffer());
            await r2.send(new PutObjectCommand({
              Bucket:      R2_BUCKET_NAME!,
              Key:         `originals/${originalBucketPath}`,
              Body:        origBuf,
              ContentType: a.mime,
              CacheControl:'private, max-age=0',
            }));
          }
        }

        await prisma.mediaAsset.update({
          where: { id: a.id },
          data: {
            publicUrl:     newUrl,
            storageBucket: R2_BUCKET_NAME!,
            storagePath:   newKey,
            originalUrl:   `r2://${R2_BUCKET_NAME}/originals/${originalBucketPath}`,
            ...(a.posterUrl && !a.posterUrl.startsWith(R2_PUBLIC_URL!) ? {
              posterUrl: a.posterUrl.replace(/^https?:\/\/[^/]+\/[^/]+\/[^/]+\//, `${R2_PUBLIC_URL}/public/`),
            } : {}),
          },
        });
      }
      migrated += 1;
    } catch (err) {
      failed += 1;
      console.error(`  [fail] ${sourceBucket}/${sourcePath}: ${err instanceof Error ? err.message : err}`);
    }
  }

  console.log(`\n── Summary ────────────────────────────`);
  console.log(`  migrated   ${migrated}`);
  console.log(`  skipped    ${skipped} (already on R2)`);
  console.log(`  failed     ${failed}`);
  if (DRY_RUN) console.log('\n(DRY_RUN — no R2 writes and no DB updates committed.)');
}

run()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => void prisma.$disconnect());
