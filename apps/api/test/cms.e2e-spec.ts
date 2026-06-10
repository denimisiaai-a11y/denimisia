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

  // ─── Homepage Section Composer ────────────────────────────────────────────

  describe('GET /api/v1/cms/homepage/sections/active', () => {
    it('returns active sections ordered by position', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/homepage/sections/active')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(Array.isArray(res.body.data)).toBe(true);

      for (const s of res.body.data) {
        expect(s.isActive).toBe(true);
      }

      const positions = res.body.data.map(
        (s: { position: number }) => s.position,
      );
      for (let i = 1; i < positions.length; i++) {
        expect(positions[i]).toBeGreaterThanOrEqual(positions[i - 1]);
      }
    });

    it('returns sections with type + config fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/homepage/sections/active')
        .expect(200);

      if (res.body.data.length > 0) {
        const s = res.body.data[0];
        expect(s).toHaveProperty('id');
        expect(s).toHaveProperty('type');
        expect(s).toHaveProperty('position');
        expect(s).toHaveProperty('isActive');
        expect(s).toHaveProperty('config');
      }
    });
  });

  describe('GET /api/v1/cms/homepage/styles', () => {
    it('returns the singleton styles row', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/cms/homepage/styles')
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('negativeSpace');
      expect(res.body.data).toHaveProperty('typographyFlow');
    });
  });

  // ─── Admin CMS endpoints require auth ─────────────────────────────────────

  describe('Admin CMS endpoints', () => {
    it('POST /api/v1/cms/banners should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cms/banners')
        .send({ title: 'Unauthorized Banner' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('POST /api/v1/cms/homepage/sections should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/cms/homepage/sections')
        .send({ type: 'HERO' })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('PATCH /api/v1/cms/homepage/styles should reject without auth', async () => {
      const res = await request(app.getHttpServer())
        .patch('/api/v1/cms/homepage/styles')
        .send({ negativeSpace: 2 })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });
  });
});
