import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';

describe('Products Endpoints (e2e)', () => {
  let app: INestApplication;

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
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─── List Products ─────────────────────────────────────────────────────────

  describe('GET /api/v1/products', () => {
    it('should return a paginated list of products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('products');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('limit');
      expect(res.body.data).toHaveProperty('totalPages');
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(typeof res.body.data.total).toBe('number');
    });

    it('should respect page and limit query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ page: '1', limit: '2' })
        .expect(200);

      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(2);
      expect(res.body.data.products.length).toBeLessThanOrEqual(2);
    });

    it('should default to page 1 and limit 24 without params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .expect(200);

      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(24);
    });

    it('should filter by category slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ category: 'jeans' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      // All returned products should belong to the filtered category
      for (const product of res.body.data.products) {
        if (product.category) {
          expect(product.category.slug).toBe('jeans');
        }
      }
    });

    it('should sort by price ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sort: 'price_asc' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      const prices = res.body.data.products.map(
        (p: { price: number }) => p.price,
      );
      for (let i = 1; i < prices.length; i++) {
        expect(Number(prices[i])).toBeGreaterThanOrEqual(Number(prices[i - 1]));
      }
    });

    it('should sort by price descending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ sort: 'price_desc' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      const prices = res.body.data.products.map(
        (p: { price: number }) => p.price,
      );
      for (let i = 1; i < prices.length; i++) {
        expect(Number(prices[i])).toBeLessThanOrEqual(Number(prices[i - 1]));
      }
    });

    it('should include category and variants in product response', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ limit: '1' })
        .expect(200);

      if (res.body.data.products.length > 0) {
        const product = res.body.data.products[0];
        expect(product).toHaveProperty('category');
        expect(product).toHaveProperty('variants');
        expect(product).toHaveProperty('_count');
      }
    });
  });

  // ─── Featured Products ────────────────────────────────────────────────────

  describe('GET /api/v1/products/featured', () => {
    it('should return featured products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/featured')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // All returned products should be featured
      for (const product of res.body.data) {
        expect(product.isFeatured).toBe(true);
      }
    });

    it('should return at most 8 featured products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/featured')
        .expect(200);

      expect(res.body.data.length).toBeLessThanOrEqual(8);
    });

    it('should include category and variants for featured products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/featured')
        .expect(200);

      if (res.body.data.length > 0) {
        const product = res.body.data[0];
        expect(product).toHaveProperty('category');
        expect(product).toHaveProperty('variants');
        expect(product).toHaveProperty('_count');
      }
    });
  });

  // ─── New Arrivals ─────────────────────────────────────────────────────────

  describe('GET /api/v1/products/new-arrivals', () => {
    it('should return new arrival products', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/new-arrivals')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(8);
    });
  });

  // ─── Product by Slug ──────────────────────────────────────────────────────

  describe('GET /api/v1/products/:slug', () => {
    it('should return a product by slug with full details', async () => {
      // First get a valid slug from the products list
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ limit: '1' });

      if (listRes.body.data.products.length === 0) {
        return; // No products in DB, skip
      }

      const slug = listRes.body.data.products[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${slug}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('slug', slug);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('description');
      expect(res.body.data).toHaveProperty('price');
      expect(res.body.data).toHaveProperty('category');
      expect(res.body.data).toHaveProperty('variants');
    });

    it('should include reviews and collections for product by slug', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/api/v1/products')
        .query({ limit: '1' });

      if (listRes.body.data.products.length === 0) {
        return;
      }

      const slug = listRes.body.data.products[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/products/${slug}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('reviews');
      expect(res.body.data).toHaveProperty('collections');
      expect(Array.isArray(res.body.data.reviews)).toBe(true);
      expect(Array.isArray(res.body.data.collections)).toBe(true);
    });

    it('should return 404 for non-existent slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/products/this-slug-definitely-does-not-exist-xyz')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(404);
    });
  });

  // ─── Admin endpoints require auth ─────────────────────────────────────────

  describe('Admin product endpoints', () => {
    it('POST /api/v1/products should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/products')
        .send({
          name: 'Unauthorized Product',
          slug: 'unauthorized-product',
          description: 'Should not be created',
          price: 99,
          categoryId: 'some-id',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('PATCH /api/v1/products/:id should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/products/some-id')
        .send({ name: 'Updated Name' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('DELETE /api/v1/products/:id should reject without auth', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/products/some-id')
        .expect(401);
    });
  });
});
