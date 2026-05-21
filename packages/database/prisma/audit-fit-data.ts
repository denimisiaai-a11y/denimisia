import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const missingType = await prisma.product.findMany({
    where: { isActive: true, deletedAt: null, type: null },
    select: { id: true, name: true, slug: true },
  });

  const missingTags = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      type: { not: null },
      productTags: { none: {} },
    },
    select: { id: true, name: true, slug: true, type: true },
  });

  const missingCharts = await prisma.product.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      type: { not: null },
      sizeCharts: { none: {} },
    },
    select: { id: true, name: true, slug: true, type: true },
  });

  console.log(JSON.stringify({ missingType, missingTags, missingCharts }, null, 2));
}

main().finally(() => prisma.$disconnect());
