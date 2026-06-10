/**
 * Ensure the two Supabase Storage buckets exist with correct visibility.
 * Idempotent — safe to run anytime. Creates if missing, updates visibility
 * if the bucket exists but public/private flag is wrong.
 *
 * Run: pnpm --filter api exec tsx scripts/ensure-supabase-buckets.ts
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  const originals = process.env.SUPABASE_BUCKET_ORIGINALS ?? 'media-originals';
  const publicName = process.env.SUPABASE_BUCKET_PUBLIC ?? 'media-public';

  const { data: existing, error: listErr } = await client.storage.listBuckets();
  if (listErr) throw listErr;

  async function ensure(name: string, isPublic: boolean): Promise<void> {
    const found = existing?.find((b) => b.name === name);
    if (!found) {
      const { error } = await client.storage.createBucket(name, {
        public: isPublic,
        fileSizeLimit: isPublic ? 40 * 1024 * 1024 : 80 * 1024 * 1024,
      });
      if (error) throw error;
      console.log(`created: ${name} (${isPublic ? 'public' : 'private'})`);
    } else if (found.public !== isPublic) {
      const { error } = await client.storage.updateBucket(name, { public: isPublic });
      if (error) throw error;
      console.log(`updated visibility: ${name} → ${isPublic ? 'public' : 'private'}`);
    } else {
      console.log(`ok: ${name} (${isPublic ? 'public' : 'private'})`);
    }
  }

  await ensure(originals, false);
  await ensure(publicName, true);
  console.log('Buckets ready.');
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('Bucket setup failed:', msg);
  process.exit(1);
});
