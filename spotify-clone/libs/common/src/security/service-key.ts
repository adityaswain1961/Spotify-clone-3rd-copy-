import { timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/** Header the gateway adds to every proxied request. */
export const SERVICE_KEY_HEADER = 'x-service-key';

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Internal services trust the X-User-Id / X-User-Role headers set by the gateway.
 * This middleware makes sure only the gateway can reach them: when SERVICE_API_KEY
 * is configured, every request (except /health) must carry the shared key.
 */
export function serviceKeyMiddleware() {
  const expected = process.env.SERVICE_API_KEY;

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!expected || req.path === '/health') {
      next();
      return;
    }
    const provided = req.header(SERVICE_KEY_HEADER);
    if (provided && safeEqual(provided, expected)) {
      next();
      return;
    }
    res.status(401).json({ statusCode: 401, message: 'Requests must come through the API gateway' });
  };
}
