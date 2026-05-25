import { createClient } from '@supabase/supabase-js';
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const bucket = process.env.SUPABASE_BUCKET_PUBLIC!;

async function listFolder(prefix: string): Promise<string[]> {
  const acc: string[] = [];
  const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) { console.error(prefix, error.message); return acc; }
  for (const item of data ?? []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null) {
      // folder
      acc.push(...await listFolder(full));
    } else {
      acc.push(full);
    }
  }
  return acc;
}

async function main() {
  console.log(`Listing supabase bucket: ${bucket}`);
  const all = await listFolder('');
  console.log(`Total objects: ${all.length}`);
  const slotted = all.filter(k => /^[a-z0-9_-]+\/[a-z0-9_-]+\/[a-f0-9]{12}\.\w+$/i.test(k));
  console.log(`Slot-pattern matches: ${slotted.length}`);
  const groups = new Map<string, string[]>();
  for (const k of slotted) {
    const [pageKey, slotKey] = k.split('/');
    const ref = `${pageKey}.${slotKey}`;
    const arr = groups.get(ref) ?? [];
    arr.push(k);
    groups.set(ref, arr);
  }
  for (const [ref, files] of [...groups.entries()].sort()) {
    console.log(` ${ref.padEnd(40)} files=${files.length}`);
  }
  const nonslot = all.filter(k => !slotted.includes(k)).slice(0, 10);
  if (nonslot.length) {
    console.log('Sample non-slot keys:');
    for (const k of nonslot) console.log(` ${k}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
