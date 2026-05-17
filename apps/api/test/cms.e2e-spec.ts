import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';

describe('CMS Endpoints (e2e)', () => {
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

  // ─── Blog Posts ───────────────────────────────────────────────────────────

  describe('GET /api/v1/cms/blog', () => {
    it('should return a paginated list of published blog posts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('posts');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data).toHaveProperty('page');
      expect(res.body.data).toHaveProperty('limit');
      expect(Array.isArray(res.body.data.posts)).toBe(true);
      expect(typeof res.body.data.total).toBe('number');
    });

    it('should default to page 1 and limit 10', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog')
        .expect(200);

      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(10);
    });

    it('should respect page and limit query params', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog')
        .query({ page: '1', limit: '3' })
        .expect(200);

      expect(res.body.data.page).toBe(1);
      expect(res.body.data.limit).toBe(3);
      expect(res.body.data.posts.length).toBeLessThanOrEqual(3);
    });

    it('should include author info for each blog post', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog')
        .expect(200);

      for (const post of res.body.data.posts) {
        expect(post).toHaveProperty('author');
        if (post.author) {
          expect(post.author).toHaveProperty('firstName');
          expect(post.author).toHaveProperty('lastName');
        }
      }
    });

    it('should only return published posts', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog')
        .expect(200);

      for (const post of res.body.data.posts) {
        expect(post.isPublished).toBe(true);
      }
    });
  });

  describe('GET /api/v1/cms/blog/:slug', () => {
    it('should return a blog post by slug', async () => {
      // First get a valid slug from the list
      const listRes = await request(app.getHttpServer()).get(
        '/api/v1/cms/blog',
      );

      if (listRes.body.data.posts.length === 0) {
        return; // No blog posts in DB, skip
      }

      const slug = listRes.body.data.posts[0].slug;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/cms/blog/${slug}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('slug', slug);
      expect(res.body.data).toHaveProperty('title');
      expect(res.body.data).toHaveProperty('body');
      expect(res.body.data).toHaveProperty('author');
    });

    it('should return 404 for non-existent blog slug', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/blog/this-blog-post-does-not-exist-xyz')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(404);
    });
  });

  // ─── Banners ──────────────────────────────────────────────────────────────

  describe('GET /api/v1/cms/banners', () => {
    it('should return active banners', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/banners')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // All returned banners should be active
      for (const banner of res.body.data) {
        expect(banner.isActive).toBe(true);
      }
    });

    it('should return banners with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/banners')
        .expect(200);

      if (res.body.data.length > 0) {
        const banner = res.body.data[0];
        expect(banner).toHaveProperty('id');
        expect(banner).toHaveProperty('isActive');
      }
    });
  });

  // ─── Homepage Sections ────────────────────────────────────────────────────

  describe('GET /api/v1/cms/sections', () => {
    it('should return active homepage sections', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/sections')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);

      // All returned sections should be active
      for (const section of res.body.data) {
        expect(section.isActive).toBe(true);
      }
    });

    it('should return sections ordered by position', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/sections')
        .expect(200);

      const positions = res.body.data.map(
        (s: { position: number }) => s.position,
      );
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('should return sections with expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/sections')
        .expect(200);

      if (res.body.data.length > 0) {
        const section = res.body.data[0];
        expect(section).toHaveProperty('id');
        expect(section).toHaveProperty('key');
        expect(section).toHaveProperty('isActive');
        expect(section).toHaveProperty('position');
      }
    });
  });

  describe('GET /api/v1/cms/sections/:key', () => {
    it('should return a section by key', async () => {
      // First get a valid key from the list
      const listRes = await request(app.getHttpServer()).get(
        '/api/v1/cms/sections',
      );

      if (listRes.body.data.length === 0) {
        return; // No sections in DB, skip
      }

      const key = listRes.body.data[0].key;

      const res = await request(app.getHttpServer())
        .get(`/api/v1/cms/sections/${key}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('key', key);
    });

    it('should return 404 for non-existent section key', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/sections/non-existent-section-key-xyz')
        .expect(404);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(404);
    });
  });

  // ─── Admin CMS endpoints require auth ─────────────────────────────────────

  describe('Admin CMS endpoints', () => {
    it('POST /api/v1/cms/blog should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cms/blog')
        .send({
          title: 'Unauthorized Post',
          slug: 'unauthorized-post',
          content: 'Should not be created',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('POST /api/v1/cms/banners should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cms/banners')
        .send({
          title: 'Unauthorized Banner',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('POST /api/v1/cms/sections should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cms/sections')
        .send({
          key: 'unauthorized-section',
          title: 'Unauthorized',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });
  });
});
