import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Sets X-Robots-Tag: noindex, nofollow on every response the NestJS API
 * produces. Api responses are JSON/error payloads — never HTML. Having the
 * header blanket-set means if any public crawler somehow discovers an API
 * URL (cached in a service worker, stale link, referer, etc.), it won't
 * index it even if we forget to exclude that path in robots.txt later.
 */
@Injectable()
export class RobotsHeaderMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    next();
  }
}
