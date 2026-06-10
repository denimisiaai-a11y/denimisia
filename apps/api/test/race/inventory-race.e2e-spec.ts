import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';

import { OrdersService } from '../../src/modules/orders/orders.service';
import { PrismaService } from '../../src/modules/prisma/prisma.service';
import type { CreateOrderDto } from '../../src/modules/orders/orders.dto';

interface SingleVariantSeed {
  userAId: string;
  userBId: string;
  productId: string;
  variantId: string;
}

interface BundleSeed {
  userAId: string;
  userBId: string;
  productId: string;
  variantId: string;
  bundleId: string;
  bundleSize: string;
}

describe('Inventory race protection (e2e)', () => {
  let prismaA: PrismaService;
  let prismaB: PrismaService;
  let prismaAdmin: PrismaService;
  let serviceA: OrdersService;
  let serviceB: OrdersService;

  beforeAll(async () => {
    prismaA = new PrismaService();
    prismaB = new PrismaService();
    prismaAdmin = new PrismaService();
    await prismaA.onModuleInit();
    await prismaB.onModuleInit();
    await prismaAdmin.onModuleInit();
    // Sanity: prove the connection is real so a downed test DB fails fast
    // here instead of producing a confusing "createOrder threw" later.
    await prismaAdmin.$queryRaw`SELECT 1`;
    const emitter = new EventEmitter2();
    serviceA = new OrdersService(prismaA, emitter);
    serviceB = new OrdersService(prismaB, emitter);
  }, 60000);

  afterAll(async () => {
    await prismaA.$disconnect();
    await prismaB.$disconnect();
    await prismaAdmin.$disconnect();
  });

  async function seedCategoryId(prefix: string): Promise<string> {
    const slug = `${prefix}-cat-${randomUUID()}`;
    const cat = await prismaAdmin.category.create({
      data: { name: slug, slug },
    });
    return cat.id;
  }

  async function seedUser(prefix: string, side: 'a' | 'b'): Promise<string> {
    const user = await prismaAdmin.user.create({
      data: {
        email: `${prefix}-${side}-${randomUUID()}@test.local`,
        passwordHash: 'placeholder-not-used-in-test',
        firstName: side.toUpperCase(),
        lastName: 'Race',
      },
    });
    return user.id;
  }

  async function seedSingleVariant(): Promise<SingleVariantSeed> {
    const prefix = 'race-sv';
    const categoryId = await seedCategoryId(prefix);

    const product = await prismaAdmin.product.create({
      data: {
        name: `${prefix}-product-${randomUUID()}`,
        slug: `${prefix}-product-${randomUUID()}`,
        description: 'single-variant race test product',
        price: 100,
        images: [],
        tags: [],
        categoryId,
        variants: {
          create: {
            sku: `${prefix}-sku-${randomUUID()}`,
            size: 'M',
            color: 'Black',
            stock: 1,
            price: 100,
          },
        },
      },
      include: { variants: true },
    });

    const userAId = await seedUser(prefix, 'a');
    const userBId = await seedUser(prefix, 'b');

    return {
      userAId,
      userBId,
      productId: product.id,
      variantId: product.variants[0].id,
    };
  }

  async function seedBundleConstituent(): Promise<BundleSeed> {
    const prefix = 'race-bc';
    const categoryId = await seedCategoryId(prefix);

    // The bundle has one constituent product. The product has a Black/L
    // variant with stock=1. Both racers buy the same bundle in size L,
    // which forces both into the same constituent variant lock.
    const product = await prismaAdmin.product.create({
      data: {
        name: `${prefix}-product-${randomUUID()}`,
        slug: `${prefix}-product-${randomUUID()}`,
        description: 'bundle race test product',
        price: 200,
        images: [],
        tags: [],
        categoryId,
        variants: {
          create: {
            sku: `${prefix}-sku-${randomUUID()}`,
            size: 'L',
            color: 'Black',
            stock: 1,
            price: 200,
          },
        },
      },
      include: { variants: true },
    });

    const bundle = await prismaAdmin.productBundle.create({
      data: {
        name: `${prefix}-bundle-${randomUUID()}`,
        slug: `${prefix}-bundle-${randomUUID()}`,
        badgeText: 'RACE',
        bundlePrice: 180,
        availableSizes: ['L'],
        isActive: true,
        items: {
          create: { productId: product.id, color: 'Black' },
        },
      },
    });

    const userAId = await seedUser(prefix, 'a');
    const userBId = await seedUser(prefix, 'b');

    return {
      userAId,
      userBId,
      productId: product.id,
      variantId: product.variants[0].id,
      bundleId: bundle.id,
      bundleSize: 'L',
    };
  }

  function singleVariantDto(seed: SingleVariantSeed): CreateOrderDto {
    return {
      items: [
        { productId: seed.productId, variantId: seed.variantId, quantity: 1 },
      ],
      shippingAddress: { city: 'Dhaka', line1: 'race-test' },
    };
  }

  function bundleDto(seed: BundleSeed): CreateOrderDto {
    return {
      items: [
        { bundleId: seed.bundleId, bundleSize: seed.bundleSize, quantity: 1 },
      ],
      shippingAddress: { city: 'Dhaka', line1: 'race-test' },
    };
  }

  function partitionSettled<T>(settled: PromiseSettledResult<T>[]): {
    fulfilled: PromiseFulfilledResult<T>[];
    rejected: PromiseRejectedResult[];
  } {
    return {
      fulfilled: settled.filter(
        (r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled',
      ),
      rejected: settled.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      ),
    };
  }

  describe('single-variant race', () => {
    it('two concurrent createOrder calls on a stock=1 variant settle as one-fulfilled / one-rejected; stock ends at 0; exactly one Order and one SALE InventoryLog exist for the contested variant', async () => {
      const seed = await seedSingleVariant();
      const dto = singleVariantDto(seed);

      const settled = await Promise.allSettled([
        serviceA.createOrder(seed.userAId, dto),
        serviceB.createOrder(seed.userBId, dto),
      ]);

      const { fulfilled, rejected } = partitionSettled(settled);

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const error = rejected[0].reason as Error;
      expect(error.message).toMatch(/Insufficient stock for variant/);

      const variantPost = await prismaAdmin.productVariant.findUnique({
        where: { id: seed.variantId },
      });
      expect(variantPost?.stock).toBe(0);

      const orders = await prismaAdmin.order.findMany({
        where: { items: { some: { variantId: seed.variantId } } },
        include: { items: true },
      });
      expect(orders).toHaveLength(1);

      const inventoryLogs = await prismaAdmin.inventoryLog.findMany({
        where: { variantId: seed.variantId, type: 'SALE' },
      });
      expect(inventoryLogs).toHaveLength(1);
      expect(inventoryLogs[0].quantity).toBe(-1);
    }, 60000);
  });

  describe('bundle-constituent race', () => {
    it('two concurrent bundle orders whose only Black/L constituent has stock=1 settle as one-fulfilled / one-rejected; constituent stock ends at 0; exactly one Order and one SALE InventoryLog exist for the constituent variant', async () => {
      const seed = await seedBundleConstituent();
      const dto = bundleDto(seed);

      const settled = await Promise.allSettled([
        serviceA.createOrder(seed.userAId, dto),
        serviceB.createOrder(seed.userBId, dto),
      ]);

      const { fulfilled, rejected } = partitionSettled(settled);

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const error = rejected[0].reason as Error;
      // The lock-time guard always speaks in variant terms because it
      // operates on the resolved StockOp set. Bundle context is in the
      // note, not the error message.
      expect(error.message).toMatch(/Insufficient stock for variant/);

      const variantPost = await prismaAdmin.productVariant.findUnique({
        where: { id: seed.variantId },
      });
      expect(variantPost?.stock).toBe(0);

      const orders = await prismaAdmin.order.findMany({
        where: { items: { some: { bundleId: seed.bundleId } } },
        include: { items: true },
      });
      expect(orders).toHaveLength(1);

      const inventoryLogs = await prismaAdmin.inventoryLog.findMany({
        where: { variantId: seed.variantId, type: 'SALE' },
      });
      expect(inventoryLogs).toHaveLength(1);
      expect(inventoryLogs[0].quantity).toBe(-1);
    }, 60000);
  });
});
