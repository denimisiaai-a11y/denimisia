/**
 * One-shot recovery: scan R2 + Supabase public buckets for slot-shaped paths,
 * recreate MediaAsset rows from the surviving files, and attach them to the
 * matching PageSlot. Safe to re-run — dedupes on contentHash.
 *
 * Run: pnpm --filter database exec tsx -r dotenv/config prisma/reattach-orphan-assets.ts dotenv_config_path=../../apps/api/.env
 */
import { PrismaClient, MediaKind } from '@prisma/client';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const prisma = new PrismaClient();

const SLOT_PATH_RE = /^([a-z0-9_-]+)\/([a-z0-9_-]+)\/[a-f0-9]{12}\.(\w+)$/i;

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm',
};

interface Survivor {
  pageKey: string;
  slotKey: string;
  ext: string;
  bytes: Buffer;
  storagePath: string;     // relative path stored in MediaAsset
  storageBucket: string;
  publicUrl: string;
  originalUrl: string;     // best effort; mirrors the public path
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

async function collectR2(): Promise<Survivor[]> {
  const required = ['R2_ACCOUNT_ID','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_URL'];
  for (const k of required) if (!process.env[k]) { console.log(`R2: missing ${k} — skipping`); return []; }
  const bucket = process.env.R2_BUCKET_NAME!;
  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const out: Survivor[] = [];
  let token: string | undefined;
  do {
    const r = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'public/', ContinuationToken: token, MaxKeys: 1000 }));
    for (const o of r.Contents ?? []) {
      if (!o.Key) continue;
      const rel = o.Key.replace(/^public\//, '');
      const m = rel.match(SLOT_PATH_RE);
      if (!m) continue;
      const [, pageKey, slotKey, ext] = m;
      const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: o.Key }));
      const buf = await streamToBuffer(obj.Body as NodeJS.ReadableStream);
      out.push({
        pageKey, slotKey, ext: ext.toLowerCase(), bytes: buf,
        storagePath: rel,
        storageBucket: bucket,
        publicUrl: `${process.env.R2_PUBLIC_URL}/${o.Key}`,
        originalUrl: `${bucket}/originals/${rel}`,
      });
    }
    token = r.NextContinuationToken;
  } while (token);
  return out;
}

async function collectSupabase(): Promise<Survivor[]> {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.SUPABASE_BUCKET_PUBLIC) {
    console.log('Supabase: env not configured — skipping'); return [];
  }
  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const bucket = process.env.SUPABASE_BUCKET_PUBLIC!;
  const out: Survivor[] = [];

  async function walk(prefix: string) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
    if (error) { console.error(`Supabase list ${prefix}:`, error.message); return; }
    for (const item of data ?? []) {
      const full = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) { await walk(full); continue; }
      const m = full.match(SLOT_PATH_RE);
      if (!m) continue;
      const [, pageKey, slotKey, ext] = m;
      const { data: blob, error: dlErr } = await sb.storage.from(bucket).download(full);
      if (dlErr || !blob) { console.error(`Supabase download ${full}:`, dlErr?.message); continue; }
      const buf = Buffer.from(await blob.arrayBuffer());
      const pub = sb.storage.from(bucket).getPublicUrl(full).data.publicUrl;
      out.push({
        pageKey, slotKey, ext: ext.toLowerCase(), bytes: buf,
        storagePath: full,
        storageBucket: bucket,
        publicUrl: pub,
        originalUrl: pub,
      });
    }
  }
  await walk('');
  return out;
}

async function attach(s: Survivor): Promise<'reattached' | 'created' | 'no-slot' | 'dup-skip'> {
  const slot = await prisma.pageSlot.findFirst({ where: { pageKey: s.pageKey, slotKey: s.slotKey } });
  if (!slot) return 'no-slot';

  const contentHash = createHash('sha256').update(s.bytes).digest('hex');
  let asset = await prisma.mediaAsset.findUnique({ where: { contentHash } });

  if (!asset) {
    const mime = MIME_BY_EXT[s.ext] ?? `application/${s.ext}`;
    const isVideo = mime.startsWith('video/');
    const kind: MediaKind = isVideo ? 'VIDEO' : 'IMAGE';
    let width: number | null = null, height: number | null = null;
    if (!isVideo) {
      try {
        const meta = await sharp(s.bytes).metadata();
        width  = meta.width  ?? null;
        height = meta.height ?? null;
      } catch (e) {
        console.warn(`sharp failed for ${s.storagePath}: ${(e as Error).message}`);
      }
    }
    asset = await prisma.mediaAsset.create({
      data: {
        kind, mime, bytes: s.bytes.byteLength,
        width, height,
        originalUrl: s.originalUrl,
        publicUrl: s.publicUrl,
        storageBucket: s.storageBucket,
        storagePath: s.storagePath,
        contentHash,
      },
    });
  }

  if (slot.assetId === asset.id) return 'dup-skip';

  await prisma.pageSlot.update({ where: { id: slot.id }, data: { assetId: asset.id } });
  return slot.assetId ? 'reattached' : 'reattached';
}

async function main() {
  console.log('Scanning R2…');
  const r2 = await collectR2();
  console.log(`  R2 survivors: ${r2.length}`);
  console.log('Scanning Supabase legacy bucket…');
  const sb = await collectSupabase();
  console.log(`  Supabase survivors: ${sb.length}`);

  const all = [...r2, ...sb];
  console.log(`Reattaching ${all.length} file(s)…`);
  for (const s of all) {
    const status = await attach(s);
    console.log(`  ${status.padEnd(12)} ${s.pageKey}.${s.slotKey}  ${s.bytes.byteLength}b  ${s.storageBucket}/${s.storagePath}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
