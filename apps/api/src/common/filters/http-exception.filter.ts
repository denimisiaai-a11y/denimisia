import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { isProd } from '../env';

interface ErrorBody {
  success: false;
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  path: string;
  timestamp: string;
  requestId?: string;
}

/**
 * Global exception filter.
 *
 * - HttpException: passes through its status + sanitized message.
 * - PrismaClientKnownRequestError: maps known error codes to HTTP (e.g.
 *   P2002 → 409 Conflict, P2025 → 404 Not Found).
 * - Unhandled: 500 with a generic message in production (never leaks stack
 *   traces or internal details); full detail logged server-side.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const mapped = this.map(exception);
    const requestId =
      (request.headers['x-request-id'] as string | undefined) ?? undefined;

    const body: ErrorBody = {
      success: false,
      statusCode: mapped.status,
      error: mapped.error,
      message: mapped.message,
      path: request.url,
      timestamp: new Date().toISOString(),
      requestId,
      ...(mapped.details !== undefined && !isProd()
        ? { details: mapped.details }
        : {}),
    };

    // Log server-side with full detail (stack in non-prod, message only in prod).
    if (mapped.status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${mapped.status} ${mapped.error}: ${mapped.message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `${request.method} ${request.url} → ${mapped.status} ${mapped.error}: ${mapped.message}`,
      );
    }

    response.status(mapped.status).json(body);
  }

  private map(exception: unknown): {
    status: number;
    error: string;
    message: string;
    details?: unknown;
  } {
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        return {
          status: exception.getStatus(),
          error: this.httpErrorName(exception.getStatus()),
          message: res,
        };
      }
      const obj = res as {
        message?: string | string[];
        error?: string;
        issues?: unknown;
      };
      const msg = Array.isArray(obj.message)
        ? obj.message.join(', ')
        : (obj.message ?? exception.message);
      return {
        status: exception.getStatus(),
        error: obj.error ?? this.httpErrorName(exception.getStatus()),
        message: msg,
        details: Array.isArray(obj.message)
          ? obj.message
          : obj.issues !== undefined
            ? obj.issues
            : undefined,
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.mapPrismaKnown(exception);
    }
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return {
        status: 400,
        error: 'Bad Request',
        message: 'Invalid query parameters',
      };
    }

    // Body-parser errors (oversized payload, malformed JSON).
    if (exception instanceof Error) {
      const err = exception as Error & { type?: string };
      if (err.type === 'entity.too.large') {
        return {
          status: 413,
          error: 'Payload Too Large',
          message: 'Request body exceeds maximum size',
        };
      }
      if (err.type === 'entity.parse.failed') {
        return {
          status: 400,
          error: 'Bad Request',
          message: 'Malformed request body',
        };
      }
    }

    // Unknown error — never leak details (or stacks) in prod.
    // Even in dev, strip the stack — it goes to the logger, never to the HTTP body.
    const devDetail =
      exception instanceof Error
        ? { name: exception.name, message: exception.message }
        : { value: String(exception) };
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: isProd()
        ? 'An unexpected error occurred.'
        : exception instanceof Error
          ? exception.message
          : String(exception),
      details: isProd() ? undefined : devDetail,
    };
  }

  private mapPrismaKnown(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    error: string;
    message: string;
  } {
    // In production we return opaque messages; in dev we surface Prisma detail
    // to aid debugging. Stack traces are NEVER returned via this method — they
    // are logged server-side only.
    const prod = isProd();
    const devDetail = err.message.split('\n')[0];
    switch (err.code) {
      case 'P2002':
        return {
          status: 409,
          error: 'Conflict',
          message: prod ? 'Conflict' : `Conflict: ${devDetail}`,
        };
      case 'P2003':
        return {
          status: 400,
          error: 'Bad Request',
          message: prod ? 'Bad Request' : `Bad Request: ${devDetail}`,
        };
      case 'P2025':
        return {
          status: 404,
          error: 'Not Found',
          message: prod ? 'Not found' : `Not found: ${devDetail}`,
        };
      default:
        return {
          status: 500,
          error: 'Internal Server Error',
          message: prod
            ? 'Database error.'
            : `Prisma ${err.code}: ${devDetail}`,
        };
    }
  }

  private httpErrorName(status: number): string {
    const map: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      502: 'Bad Gateway',
      503: 'Service Unavailable',
    };
    return map[status] ?? 'Error';
  }
}
