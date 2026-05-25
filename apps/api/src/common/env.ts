/**
 * Env validation at bootstrap.
 *
 * Parses + validates process.env using zod. If anything is missing or invalid
 * in production, the app refuses to start with a clear error listing every
 * failing variable. In development we fall back to sensible defaults where
 * safe and emit warnings for missing non-critical vars.
 *
 * Anywhere in the app: `import { env } from '@/common/env'` gets the
 * strongly-typed, validated config. Never reference process.env directly.
 */

import 'dotenv/config';
import { z } from 'zod';

const NodeEnv = z.enum(['development', 'test', 'production']);

const envSchema = z.object({
  // App
  NODE_ENV: NodeEnv.default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000,http://localhost:3002'),

  // Database
  DATABASE_URL: z.string().url(),

  // Redis
  REDIS_URL: z.string().url(),

  // JWT — minimum 32 chars enforced in ALL environments (dev included).
  // Placeholder strings are rejected even in development to prevent
  // a dev-default secret leaking into a deployed build.
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters')
    .refine(
      (v) => !v.toLowerCase().includes('change-in-production'),
      'JWT secret contains a placeholder string; generate a real one',
    ),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be at least 32 characters')
    .refine(
      (v) => !v.toLowerCase().includes('change-in-production'),
      'JWT secret contains a placeholder string; generate a real one',
    ),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // R2 (object storage — required in production)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_PUBLIC_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),

  // Supabase Storage (legacy while R2 migration is pending)
  SUPABASE_URL: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.string().url().optional(),
  ),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET_ORIGINALS: z.string().default('media-originals'),
  SUPABASE_BUCKET_PUBLIC: z.string().default('media-public'),

  // Algolia — optional; search falls back to DB if absent
  ALGOLIA_APP_ID: z.string().optional(),
  ALGOLIA_API_KEY: z.string().optional(),
  ALGOLIA_SEARCH_KEY: z.string().optional(),
  ALGOLIA_INDEX_NAME: z.string().default('products'),

  // Storefront URL used to build links inside transactional emails
  // (verify-email, password-reset, order-confirmation). MUST point at the
  // customer-facing site without a trailing slash.
  STOREFRONT_URL: z.string().url().default('http://localhost:3000'),

  // Google OAuth — optional. Required only when the web app's "Sign in with
  // Google" button is enabled. Must match the Client ID configured in the
  // Google Cloud Console OAuth 2.0 client, since the API verifies that the
  // ID token's `aud` claim matches before trusting the email.
  GOOGLE_CLIENT_ID: z.string().optional(),

  // Rate limiting
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(60),

  // Feature flags
  ENABLE_DOCS: z.enum(['0', '1']).default('0'),
});

type Env = z.infer<typeof envSchema>;

function parse(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map(
      (i) => `  • ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(`Environment validation failed:\n${issues.join('\n')}`);
  }
  const env = parsed.data;

  // Production-only hard requirements — missing values should fail loudly.
  if (env.NODE_ENV === 'production') {
    const prodRequired: Array<[keyof Env, string]> = [
      ['R2_ACCOUNT_ID', 'R2 required in production — object storage'],
      ['R2_ACCESS_KEY_ID', 'R2 required in production'],
      ['R2_SECRET_ACCESS_KEY', 'R2 required in production'],
      ['R2_BUCKET_NAME', 'R2 required in production'],
      ['R2_PUBLIC_URL', 'R2 CDN URL required in production'],
      [
        'CORS_ORIGINS',
        'CORS_ORIGINS required in production (explicit origin list, no localhost)',
      ],
    ];
    const missing = prodRequired
      .filter(([k]) => !env[k])
      .map(([k, why]) => `  • ${k}: ${why}`);
    if (missing.length > 0) {
      throw new Error(
        `Missing required production variables:\n${missing.join('\n')}`,
      );
    }
    if (env.JWT_ACCESS_SECRET.length < 64) {
      throw new Error('JWT_ACCESS_SECRET must be >= 64 chars in production');
    }
    if (env.JWT_REFRESH_SECRET.length < 64) {
      throw new Error('JWT_REFRESH_SECRET must be >= 64 chars in production');
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
    }
    // CORS origins must be an explicit allowlist in production.
    const origins = env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (origins.length === 0) {
      throw new Error(
        'CORS_ORIGINS must contain at least one explicit origin in production',
      );
    }
    if (origins.some((o) => o === '*' || o.toLowerCase() === 'true')) {
      throw new Error('CORS_ORIGINS must not contain wildcards in production');
    }
    if (origins.some((o) => /localhost|127\.0\.0\.1/i.test(o))) {
      throw new Error('CORS_ORIGINS must not include localhost in production');
    }
  }

  return env;
}

export const env: Readonly<Env> = Object.freeze(parse());

export const corsOrigins = (): readonly string[] => {
  const list = env.CORS_ORIGINS.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // Defence-in-depth: strip wildcards if they ever slip in via env.
  return list.filter((o) => o !== '*' && o.toLowerCase() !== 'true');
};

export const isProd = (): boolean => env.NODE_ENV === 'production';
export const isDev = (): boolean => env.NODE_ENV === 'development';
