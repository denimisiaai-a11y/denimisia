/**
 * Structured logging config for the API.
 *
 * - JSON in production (parseable by log aggregators — CloudWatch, Datadog, etc.)
 * - Pretty-printed in development
 * - Request ID auto-generated per request and included in every log line
 * - Auth/password/token fields auto-redacted
 */

import { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { env, isProd } from './env';

export const pinoConfig: Params = {
  pinoHttp: {
    level: env.NODE_ENV === 'test' ? 'silent' : isProd() ? 'info' : 'debug',
    genReqId: (req, res) => {
      // Never trust a client-supplied x-request-id — always generate a fresh UUID.
      const id = randomUUID();
      const rawHint = req.headers['x-request-id'];
      const hint =
        typeof rawHint === 'string'
          ? rawHint
          : Array.isArray(rawHint)
            ? (rawHint[0] ?? '')
            : '';
      const clientRequestId =
        hint.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 48) || undefined;
      res.setHeader('x-request-id', id);
      // Attach the sanitized client hint to the request object for later log enrichment.
      if (clientRequestId) {
        (req as unknown as { clientRequestId?: string }).clientRequestId =
          clientRequestId;
      }
      return id;
    },
    transport: isProd()
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            singleLine: true,
            colorize: true,
            translateTime: 'SYS:HH:MM:ss.l',
            ignore: 'pid,hostname,req,res',
            messageFormat: '{context} [{reqId}] {msg}',
          },
        },
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.currentPassword',
        'req.body.newPassword',
        'req.body.passwordHash',
        'req.body.token',
        'req.body.refreshToken',
        'res.headers["set-cookie"]',
        '*.passwordHash',
        '*.refreshToken',
        '*.accessToken',
      ],
      censor: '[REDACTED]',
    },
    serializers: {
      req: (req) => {
        const clientRequestId = (
          req.raw as unknown as { clientRequestId?: string } | undefined
        )?.clientRequestId;
        return {
          id: req.id,
          method: req.method,
          url: req.url,
          ...(clientRequestId ? { clientRequestId } : {}),
          // Don't log every query param — can be noisy and leak tokens.
        };
      },
      res: (res) => ({ statusCode: res.statusCode }),
    },
    customLogLevel: (_req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  },
};
