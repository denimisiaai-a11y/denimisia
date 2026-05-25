import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const before = await p.banner.findMany({
    where: { position: 'top' },
    select: { id: true, title: true },
  });
  console.log(`Deleting ${before.length} banner(s) with position=top:`);
  for (const b of before) console.log(` - ${b.id.slice(0,8)}  ${b.title}`);
  const result = await p.banner.deleteMany({ where: { position: 'top' } });
  console.log(`Deleted ${result.count} row(s).`);
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => p.$disconnect());
