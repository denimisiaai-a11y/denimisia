/**
 * Shared bootstrap factory used by:
 *   - src/main.ts (long-running Node process; dev + non-Vercel hosts)
 *   - api/index.ts (Vercel serverless entry; @vendia/serverless-express wrap)
 *
 * Builds the Nest app with all middleware wired but does NOT call .listen().
 * Caller decides whether to bind to a port or expose the Express instance.
 */

import type { INestApplication } from '@nestjs/common';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { corsOrigins, isProd } from './common/env';

export async function createApp(): Promise<INestApplication> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));

  app.setGlobalPrefix('api/v1', { exclude: ['health', 'ready'] });

  app.use(
    helmet({
      contentSecurityPolicy: isProd() ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  app.use(cookieParser());
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

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

  app.enableShutdownHooks();

  return app;
}
