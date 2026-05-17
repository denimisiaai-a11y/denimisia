import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { env, corsOrigins, isProd } from './common/env';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  // Routes NOT under /api/v1 — liveness/readiness must work without the prefix.
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });

  // Security headers first — before CORS, parsers, routing.
  app.use(
    helmet({
      contentSecurityPolicy: isProd() ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());
  // Body size cap — prevents JSON bombs and oversized requests.
  // Uploads use multipart which bypasses JSON parsing; only admin mutations use raw JSON.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Trust proxy headers in production (behind a load balancer).
  // Required for accurate client IPs used by the throttler.
  if (isProd()) {
    const http = app.getHttpAdapter().getInstance() as {
      set?: (k: string, v: unknown) => void;
    };
    http.set?.('trust proxy', 1);
  }

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  app.enableCors({
    origin: corsOrigins(),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  });

  // OpenAPI docs — mounted only in non-prod, or when explicitly enabled.
  // Path: GET /api/v1/docs (JSON) + /api/v1/docs/ui (Swagger UI).
  if (!isProd() || process.env.ENABLE_DOCS === '1') {
    const swagger = new DocumentBuilder()
      .setTitle('Denimisia API')
      .setDescription('Storefront + admin endpoints')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
      .build();
    const doc = SwaggerModule.createDocument(app, swagger);
    SwaggerModule.setup('api/v1/docs', app, doc, {
      jsonDocumentUrl: 'api/v1/docs-json',
    });
    logger.log('OpenAPI mounted at /api/v1/docs');
  }

  // Graceful shutdown — let /ready flip to degraded before SIGTERM kills us.
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  logger.log(
    `API listening on :${env.PORT} · env=${env.NODE_ENV} · cors=${corsOrigins().join(',')}`,
  );
}

bootstrap().catch((err: unknown) => {
  console.error('Bootstrap failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
