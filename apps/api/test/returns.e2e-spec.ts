import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';

import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import {
  AUTH_TV_KEY,
  AUTH_TV_TTL_SECONDS,
} from '../src/modules/auth/auth.service';
import { REDIS_CLIENT } from '../src/modules/redis/redis.decorator';
import { env } from '../src/common/env';

// Tracks rows created in this spec so afterAll can tear them down without
// touching anything that pre-existed in the test DB. Order matters: rows are
// deleted in reverse insertion order because foreign keys cascade upward
// (RefundTransaction -> Return -> Order -> User; ProductVariant -> Product
// -> Category).
interface SeedRefs {
  refundTxnId: string | null;
  returnId: string | null;
  orderId: string | null;
  variantId: string | null;
  productId: string | null;
  categoryId: string | null;
  customerUserId: string | null;
  adminUserId: string | null;
}

describe('Returns lifecycle happy path (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwt: JwtService;
  let redis: Redis;

  const seed: SeedRefs = {
    refundTxnId: null,
    returnId: null,
    orderId: null,
    variantId: null,
    productId: null,
    categoryId: null,
    customerUserId: null,
    adminUserId: null,
  };

  let adminToken = '';
  let customerToken = '';
  let orderItemId = '';
  let returnItemId = '';
  const RETURNED_QTY = 1;
  let stockBeforeRefund = 0;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    jwt = app.get(JwtService);
    redis = app.get<Redis>(REDIS_CLIENT);

    // Sanity ping so a downed test DB fails fast here instead of producing
    // a confusing "createReturn threw" later.
    await prisma.$queryRaw`SELECT 1`;

    const suffix = randomUUID();

    // ── Seed catalog ────────────────────────────────────────────────────
    const category = await prisma.category.create({
      data: {
        name: `returns-e2e-cat-${suffix}`,
        slug: `returns-e2e-cat-${suffix}`,
      },
    });
    seed.categoryId = category.id;

    const product = await prisma.product.create({
      data: {
        name: `returns-e2e-product-${suffix}`,
        slug: `returns-e2e-product-${suffix}`,
        description: 'Returns happy-path e2e product',
        price: 100,
        images: [],
        tags: [],
        returnable: true,
        categoryId: category.id,
        variants: {
          create: {
            sku: `returns-e2e-sku-${suffix}`,
            size: 'M',
            color: 'Black',
            stock: 5,
            price: 100,
          },
        },
      },
      include: { variants: true },
    });
    seed.productId = product.id;
    seed.variantId = product.variants[0].id;

    // ── Seed users ──────────────────────────────────────────────────────
    const customer = await prisma.user.create({
      data: {
        email: `returns-e2e-customer-${suffix}@denimisia.test`,
        passwordHash: 'placeholder-not-used-in-test',
        firstName: 'Customer',
        lastName: 'Returns',
      },
    });
    seed.customerUserId = customer.id;

    const admin = await prisma.user.create({
      data: {
        email: `returns-e2e-admin-${suffix}@denimisia.test`,
        passwordHash: 'placeholder-not-used-in-test',
        firstName: 'Admin',
        lastName: 'Returns',
        role: 'ADMIN',
      },
    });
    seed.adminUserId = admin.id;

    // ── Seed order in DELIVERED status, delivered 1 hour ago ────────────
    const deliveredAt = new Date(Date.now() - 60 * 60 * 1000);
    const order = await prisma.order.create({
      data: {
        // E2E seeds the row directly; bypasses OrderNumberService so we
        // supply a synthetic test number well outside the production
        // range. The unique index would catch any collision.
        orderNumber: `DEN-TEST-${Date.now()}`,
        userId: customer.id,
        status: 'DELIVERED',
        shippingAddress: {
          line1: 'Returns Lane 1',
          city: 'Dhaka',
          contactName: 'Customer Returns',
          contactPhone: '01700000000',
        },
        subtotal: 100,
        total: 100,
        items: {
          create: {
            productId: product.id,
            variantId: product.variants[0].id,
            quantity: 1,
            unitPrice: 100,
            total: 100,
            snapshot: {
              name: product.name,
              sku: product.variants[0].sku,
              size: product.variants[0].size,
              color: product.variants[0].color,
              unitPrice: 100,
            },
          },
        },
        statusHistory: {
          create: {
            fromStatus: 'SHIPPED',
            toStatus: 'DELIVERED',
            changedBy: admin.id,
            createdAt: deliveredAt,
          },
        },
      },
      include: { items: true },
    });
    seed.orderId = order.id;
    orderItemId = order.items[0].id;

    // ── Mint admin + customer JWTs ──────────────────────────────────────
    // JwtStrategy validates: (1) token version in Redis matches payload.tv,
    // (2) DB role matches payload.role. We seed Redis directly so we don't
    // have to call register/login (which would mint a token with role=CUSTOMER
    // and then require a role-bump + new login).
    await redis.setex(AUTH_TV_KEY(admin.id), AUTH_TV_TTL_SECONDS, '0');
    await redis.setex(AUTH_TV_KEY(customer.id), AUTH_TV_TTL_SECONDS, '0');

    adminToken = await jwt.signAsync(
      { sub: admin.id, email: admin.email, role: 'ADMIN', tv: 0 },
      {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        issuer: 'denimisia-api',
        audience: 'denimisia-clients',
        expiresIn: '1h',
      },
    );
    customerToken = await jwt.signAsync(
      { sub: customer.id, email: customer.email, role: 'CUSTOMER', tv: 0 },
      {
        secret: env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        issuer: 'denimisia-api',
        audience: 'denimisia-clients',
        expiresIn: '1h',
      },
    );
  }, 60000);

  afterAll(async () => {
    // Tear down in reverse dependency order. Each delete is wrapped in a
    // try/catch so partial seeds (e.g. test bailed mid-flow) still clean
    // up everything they can.
    const tryDelete = async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch {
        // ignore — row may not exist if the test bailed early
      }
    };

    if (seed.refundTxnId) {
      await tryDelete(() =>
        prisma.refundTransaction.delete({ where: { id: seed.refundTxnId! } }),
      );
    }
    if (seed.returnId) {
      // ReturnItem rows cascade via onDelete: Cascade on Return.
      await tryDelete(() =>
        prisma.return.delete({ where: { id: seed.returnId! } }),
      );
    }
    if (seed.orderId) {
      // OrderItem + OrderStatusHistory cascade.
      await tryDelete(() =>
        prisma.order.delete({ where: { id: seed.orderId! } }),
      );
    }
    if (seed.variantId) {
      await tryDelete(() =>
        prisma.productVariant.delete({ where: { id: seed.variantId! } }),
      );
    }
    if (seed.productId) {
      await tryDelete(() =>
        prisma.product.delete({ where: { id: seed.productId! } }),
      );
    }
    if (seed.categoryId) {
      await tryDelete(() =>
        prisma.category.delete({ where: { id: seed.categoryId! } }),
      );
    }
    if (seed.customerUserId) {
      await tryDelete(() =>
        prisma.user.delete({ where: { id: seed.customerUserId! } }),
      );
      await redis.del(AUTH_TV_KEY(seed.customerUserId));
    }
    if (seed.adminUserId) {
      await tryDelete(() =>
        prisma.user.delete({ where: { id: seed.adminUserId! } }),
      );
      await redis.del(AUTH_TV_KEY(seed.adminUserId));
    }

    await app.close();
  }, 60000);

  it('walks REQUESTED → UNDER_REVIEW → APPROVED → RECEIVED → INSPECTING → INSPECTED_PASS → REFUNDED, restocks variant', async () => {
    // 1) Customer files the return.
    const createRes = await request(app.getHttpServer())
      .post('/api/v1/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderId: seed.orderId,
        reason: 'WRONG_SIZE',
        photos: [],
        items: [{ orderItemId, quantity: RETURNED_QTY }],
      })
      .expect(201);

    expect(createRes.body).toHaveProperty('success', true);
    expect(createRes.body.data).toHaveProperty('id');
    expect(createRes.body.data).toHaveProperty('rtnNumber');
    expect(typeof createRes.body.data.rtnNumber).toBe('string');
    seed.returnId = createRes.body.data.id;

    // Pull the returnItem id from the admin detail endpoint so we can pass
    // it to /inspect later. The customer-side response only includes
    // {id, rtnNumber}.
    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/admin/returns/${seed.returnId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(detailRes.body.data.items).toHaveLength(1);
    returnItemId = detailRes.body.data.items[0].id;
    expect(detailRes.body.data.status).toBe('REQUESTED');

    // 2) Admin → UNDER_REVIEW
    const reviewRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${seed.returnId}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewerNotes: 'Looks legit' })
      .expect(200);
    expect(reviewRes.body.data.status).toBe('UNDER_REVIEW');

    // 3) Admin → APPROVED
    const approveRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${seed.returnId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ carrier: 'Pathao', approvalNotes: 'Approved for pickup' })
      .expect(200);
    expect(approveRes.body.data.status).toBe('APPROVED');

    // 4) Admin → RECEIVED
    const receivedRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${seed.returnId}/mark-received`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ trackingNumber: 'PATHAO-TEST-123' })
      .expect(200);
    expect(receivedRes.body.data.status).toBe('RECEIVED');

    // 5) Admin → INSPECTING
    const startInspectionRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${seed.returnId}/start-inspection`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    expect(startInspectionRes.body.data.status).toBe('INSPECTING');

    // 6) Admin → INSPECTED_PASS (and mark for restock)
    const inspectRes = await request(app.getHttpServer())
      .patch(`/api/v1/admin/returns/${seed.returnId}/inspect`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        itemResults: [
          {
            returnItemId,
            inspectionResult: 'PASS',
            restock: true,
          },
        ],
        inspectionNotes: 'All good',
      })
      .expect(200);
    expect(inspectRes.body.data.status).toBe('INSPECTED_PASS');

    // 7) Capture variant stock immediately BEFORE the refund so we can
    //    assert the increment.
    const variantBefore = await prisma.productVariant.findUnique({
      where: { id: seed.variantId! },
    });
    expect(variantBefore).not.toBeNull();
    stockBeforeRefund = variantBefore!.stock;

    // 8) Admin issues refund — atomic with restock + RefundTransaction.
    const refundRes = await request(app.getHttpServer())
      .post(`/api/v1/admin/returns/${seed.returnId}/issue-refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        amount: 100,
        method: 'CASH',
        reference: 'CASH-VOUCHER-TEST-001',
        notes: 'Refunded to walk-in',
      })
      .expect(201);
    expect(refundRes.body.data).toHaveProperty('id');
    expect(refundRes.body.data).toHaveProperty('amount');
    seed.refundTxnId = refundRes.body.data.id;

    // 9) Return row is now REFUNDED + has the txn linked.
    const finalDetail = await request(app.getHttpServer())
      .get(`/api/v1/admin/returns/${seed.returnId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(finalDetail.body.data.status).toBe('REFUNDED');
    expect(finalDetail.body.data.refundTxn).not.toBeNull();
    expect(finalDetail.body.data.refundTxn.id).toBe(seed.refundTxnId);
    expect(finalDetail.body.data.refundedAt).not.toBeNull();

    // 10) Variant stock incremented by the returned quantity.
    const variantAfter = await prisma.productVariant.findUnique({
      where: { id: seed.variantId! },
    });
    expect(variantAfter).not.toBeNull();
    expect(variantAfter!.stock).toBe(stockBeforeRefund + RETURNED_QTY);
  }, 90000);
});
