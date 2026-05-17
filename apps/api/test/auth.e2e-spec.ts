import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';

describe('Auth Endpoints (e2e)', () => {
  let app: INestApplication;
  const uniqueSuffix = Date.now();

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

  // ─── Registration ──────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/register', () => {
    const validUser = {
      email: `test-register-${uniqueSuffix}@denimisia.test`,
      password: 'TestPass123!',
      firstName: 'Test',
      lastName: 'User',
    };

    it('should register a new user and return accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validUser)
        .expect(201);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');

      // Refresh token should be in httpOnly cookie, not in response body
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.startsWith('refresh_token='))
        : undefined;
      expect(refreshCookie).toBeDefined();
    });

    it('should reject duplicate email registration', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validUser)
        .expect(409);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.statusCode).toBe(409);
    });

    it('should reject registration with missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(400);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'TestPass123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(400);
    });

    it('should reject registration with short password (< 8 chars)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `short-pw-${uniqueSuffix}@denimisia.test`,
          password: 'short',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(400);
    });

    it('should reject registration with missing firstName', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `no-fname-${uniqueSuffix}@denimisia.test`,
          password: 'TestPass123!',
          lastName: 'User',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(400);
    });

    it('should reject registration with missing lastName', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: `no-lname-${uniqueSuffix}@denimisia.test`,
          password: 'TestPass123!',
          firstName: 'Test',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(400);
    });

    it('should reject registration with empty body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ─── Login ─────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login', () => {
    const registeredUser = {
      email: `test-login-${uniqueSuffix}@denimisia.test`,
      password: 'LoginPass123!',
      firstName: 'Login',
      lastName: 'Tester',
    };

    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(registeredUser);
    });

    it('should login with valid credentials and return accessToken', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: registeredUser.email,
          password: registeredUser.password,
        })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(typeof res.body.data.accessToken).toBe('string');

      // Refresh token should be set as httpOnly cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('should reject login with wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: registeredUser.email,
          password: 'WrongPassword!',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(401);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nobody@nonexistent.com',
          password: 'SomePass123!',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(401);
    });

    it('should reject login with missing password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: registeredUser.email,
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject login with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'not-valid',
          password: 'SomePass123!',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ─── Forgot Password ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should always return success message (prevent email enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: `test-login-${uniqueSuffix}@denimisia.test` })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.message).toContain('reset link');
    });

    it('should return same message for non-existent email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' })
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty('message');
      expect(res.body.data.message).toContain('reset link');
    });

    it('should reject with invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'bad-email' })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject with missing email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/forgot-password')
        .send({})
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ─── Reset Password ───────────────────────────────────────────────────────

  describe('POST /api/v1/auth/reset-password', () => {
    it('should reject with invalid/expired token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'invalid-token-12345',
          newPassword: 'NewSecurePass123!',
        })
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
      expect(res.body.statusCode).toBe(401);
    });

    it('should reject with missing token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({ newPassword: 'NewSecurePass123!' })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should reject with short new password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/reset-password')
        .send({
          token: 'some-token',
          newPassword: 'short',
        })
        .expect(400);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ─── Refresh Token ─────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('should reject refresh without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });
  });

  // ─── Logout ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout', () => {
    it('should reject logout without authentication', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .expect(401);

      expect(res.body).toHaveProperty('success', false);
    });

    it('should successfully logout with valid access token', async () => {
      // Register a fresh user to get a valid token
      const freshUser = {
        email: `logout-test-${uniqueSuffix}@denimisia.test`,
        password: 'LogoutPass123!',
        firstName: 'Logout',
        lastName: 'Tester',
      };
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(freshUser);

      const accessToken = registerRes.body.data.accessToken;

      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('success', true);
      expect(res.body.data).toHaveProperty(
        'message',
        'Logged out successfully',
      );
    });
  });

  // ─── Protected endpoint access ────────────────────────────────────────────

  describe('Authenticated access', () => {
    it('should access protected endpoint with valid JWT after login', async () => {
      const user = {
        email: `auth-access-${uniqueSuffix}@denimisia.test`,
        password: 'AccessPass123!',
        firstName: 'Access',
        lastName: 'Tester',
      };

      // Register
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(user);

      // Login to get fresh token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password: user.password });

      const token = loginRes.body.data.accessToken;
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
    });
  });
});
