import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const assets = await p.mediaAsset.count();
  const slots = await p.pageSlot.count();
  const linked = await p.pageSlot.count({ where: { assetId: { not: null } } });
  const history = await p.pageSlotHistory.count();
  console.log({ mediaAssets: assets, pageSlots: slots, slotsLinked: linked, historyRows: history });
  if (assets > 0) {
    const sample = await p.mediaAsset.findMany({
      take: 10,
      orderBy: { createdAt: 'asc' },
      select: { id: true, kind: true, publicUrl: true, width: true, height: true, bytes: true, createdAt: true },
    });
    console.log('First 10 assets:');
    for (const a of sample) console.log(' ', a.id.slice(0,8), a.kind, `${a.width}x${a.height}`, a.bytes, a.publicUrl.slice(0,80));
  }
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
