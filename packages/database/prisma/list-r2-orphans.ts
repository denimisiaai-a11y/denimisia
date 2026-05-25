import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

const accountId = process.env.R2_ACCOUNT_ID!;
const bucket    = process.env.R2_BUCKET_NAME!;
const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

async function listAll(prefix: string) {
  let token: string | undefined;
  const out: { key: string; size: number }[] = [];
  do {
    const r = await client.send(new ListObjectsV2Command({
      Bucket: bucket, Prefix: prefix, ContinuationToken: token, MaxKeys: 1000,
    }));
    for (const o of r.Contents ?? []) {
      if (o.Key && typeof o.Size === 'number') out.push({ key: o.Key, size: o.Size });
    }
    token = r.NextContinuationToken;
  } while (token);
  return out;
}

async function main() {
  const objs = await listAll('public/');
  console.log(`Total public objects: ${objs.length}`);
  const slotted = objs.filter(o => {
    const rest = o.key.replace(/^public\//, '');
    return /^[a-z0-9_-]+\/[a-z0-9_-]+\/[a-f0-9]{12}\.\w+$/i.test(rest);
  });
  console.log(`Slot-pattern matches: ${slotted.length}`);
  const bySlot = new Map<string, { key: string; size: number }[]>();
  for (const o of slotted) {
    const rest = o.key.replace(/^public\//, '');
    const [pageKey, slotKey] = rest.split('/');
    const ref = `${pageKey}.${slotKey}`;
    const arr = bySlot.get(ref) ?? [];
    arr.push(o);
    bySlot.set(ref, arr);
  }
  console.log('Slot refs with files:');
  for (const [ref, files] of [...bySlot.entries()].sort()) {
    console.log(` ${ref.padEnd(40)} files=${files.length}  bytes=${files.reduce((s,f)=>s+f.size,0)}`);
  }
  // Sample of non-slotted public objects
  const nonslot = objs.filter(o => !slotted.includes(o)).slice(0, 5);
  if (nonslot.length) {
    console.log('Sample non-slot public objects:');
    for (const o of nonslot) console.log(` ${o.key} (${o.size}b)`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
