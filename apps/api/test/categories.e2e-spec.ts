import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';

describe('Categories Endpoints (e2e)', () => {
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

  // ─── List Categories ──────────────────────────────────────────────────────

  describe('GET /api/v1/categories', () => {
    it('should return a list of top-level categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it('should return categories sorted by name ascending', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      const names = res.body.data.map((c: { name: string }) => c.name);
      const sorted = [...names].sort((a: string, b: string) =>
        a.localeCompare(b),
      );
      expect(names).toEqual(sorted);
    });

    it('should include nested children categories', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      if (res.body.data.length > 0) {
        const category = res.body.data[0];
        expect(category).toHaveProperty('children');
        expect(Array.isArray(category.children)).toBe(true);
      }
    });

    it('should return categories with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      if (res.body.data.length > 0) {
        const category = res.body.data[0];
        expect(category).toHaveProperty('id');
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('slug');
        expect(category).toHaveProperty('children');
      }
    });

    it('should only return top-level categories (no parentId)', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories')
        .expect(200);

      for (const category of res.body.data) {
        expect(category.parentId).toBeNull();
      }
    });
  });

  // ─── Category by Slug ─────────────────────────────────────────────────────

  describe('GET /api/v1/categories/:slug', () => {
    it('should return a category by slug with children and products', async () => {
      // First get a valid slug from the list
      const listRes = await request(app.getHttpServer()).get(
        '/api/v1/categories',
      );

      if (listRes.body.data.length === 0) {
        return; // No categories in DB, skip
      }

      const slug = listRes.body.data[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${slug}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('slug', slug);
      expect(res.body.data).toHaveProperty('name');
      expect(res.body.data).toHaveProperty('children');
      expect(res.body.data).toHaveProperty('products');
      expect(Array.isArray(res.body.data.children)).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
    });

    it('should include product variants for products in category', async () => {
      const listRes = await request(app.getHttpServer()).get(
        '/api/v1/categories',
      );

      if (listRes.body.data.length === 0) {
        return;
      }

      const slug = listRes.body.data[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${slug}`)
        .expect(200);

      if (res.body.data.products.length > 0) {
        const product = res.body.data.products[0];
        expect(product).toHaveProperty('variants');
        expect(Array.isArray(product.variants)).toBe(true);
      }
    });

    it('should return at most 24 products per category', async () => {
      const listRes = await request(app.getHttpServer()).get(
        '/api/v1/categories',
      );

      if (listRes.body.data.length === 0) {
        return;
      }

      const slug = listRes.body.data[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/categories/${slug}`)
        .expect(200);

      expect(res.body.data.products.length).toBeLessThanOrEqual(24);
    });

    it('should return 404 for non-existent category slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/categories/this-category-does-not-exist-xyz')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(404);
    });
  });

  // ─── Admin category endpoints require auth ────────────────────────────────

  describe('Admin category endpoints', () => {
    it('POST /api/v1/categories should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/categories')
        .send({
          name: 'Unauthorized Category',
          slug: 'unauthorized-category',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('PATCH /api/v1/categories/:id should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/categories/some-id')
        .send({ name: 'Updated Category' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('DELETE /api/v1/categories/:id should reject without auth', async () => {
      await request(app.getHttpServer())
        .delete('/api/v1/categories/some-id')
        .expect(401);
    });
  });
});
