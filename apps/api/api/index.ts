/**
 * Vercel serverless entry for the Denimisia NestJS API.
 *
 * Each Vercel invocation imports this file. We bootstrap the Nest app once and
 * cache the resulting express handler on the warm function instance, so only
 * the first cold-start invocation pays the ~2-3s Nest initialization cost.
 *
 * Long-running connections (Redis via ioredis, Prisma pool) survive between
 * warm invocations. Cold starts open fresh connections, which is fine on
 * Upstash Redis (TCP `redis://...` URL) and Supabase pooler (PgBouncer).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import serverlessExpress from '@vendia/serverless-express';
import { createApp } from '../src/bootstrap';

type ExpressHandler = (req: VercelRequest, res: VercelResponse) => void;

let cachedHandler: ExpressHandler | null = null;

async function getHandler(): Promise<ExpressHandler> {
  if (cachedHandler) return cachedHandler;
  const app = await createApp();
  await app.init();
  const expressApp = app.getHttpAdapter().getInstance() as unknown;
  cachedHandler = serverlessExpress({ app: expressApp } as never) as ExpressHandler;
  return cachedHandler;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  const h = await getHandler();
  return h(req, res);
}
