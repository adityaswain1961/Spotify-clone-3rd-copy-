import { randomUUID } from 'crypto';
import { Agent } from 'http';
import type { Express, NextFunction, Request, Response } from 'express';
import { JwtService } from '@nestjs/jwt';
import { createProxyMiddleware } from 'http-proxy-middleware';
import {
  PinoLoggerService,
  requestContext,
  SERVICE_KEY_HEADER,
  USER_ID_HEADER,
  USER_ROLE_HEADER,
} from '@spotify/common';
import { isPublicRoute, serviceRoutes } from './routes';

interface AccessTokenPayload {
  sub: string;
  role: string;
}

function bearerToken(req: Request): string | null {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? header.slice(7).trim() || null : null;
}

/** Assigns / propagates X-Request-Id so one request can be traced across services. */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const id = req.header('x-request-id') ?? randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    requestContext.run(new Map([['requestId', id]]), next);
  };
}

/**
 * Verifies the access token once at the edge and forwards identity to services
 * via trusted headers. Client-supplied identity headers are always stripped, so
 * they can never be spoofed - not even on public routes.
 */
export function authContext(jwtSecret: string) {
  const jwt = new JwtService({ secret: jwtSecret });
  const serviceKey = process.env.SERVICE_API_KEY;

  return (req: Request, res: Response, next: NextFunction): void => {
    delete req.headers[USER_ID_HEADER];
    delete req.headers[USER_ROLE_HEADER];
    delete req.headers[SERVICE_KEY_HEADER];

    const token = bearerToken(req);
    let user: AccessTokenPayload | null = null;
    if (token) {
      try {
        user = jwt.verify<AccessTokenPayload>(token);
      } catch {
        user = null;
      }
    }

    if (!user && !isPublicRoute(req.method, req.path)) {
      res.status(401).json({
        statusCode: 401,
        message: token ? 'Access token is invalid or expired' : 'Authentication required',
        requestId: req.header('x-request-id') ?? null,
      });
      return;
    }

    if (user) {
      req.headers[USER_ID_HEADER] = user.sub;
      req.headers[USER_ROLE_HEADER] = user.role;
    }
    if (serviceKey) {
      req.headers[SERVICE_KEY_HEADER] = serviceKey;
    }
    next();
  };
}

/**
 * Mount one proxy per service at the app root with a path filter, so the original
 * URL is forwarded untouched. Upstream connections are kept alive, which removes a
 * TCP handshake from every API call.
 */
export function mountServiceProxies(app: Express, logger: PinoLoggerService): void {
  const agent = new Agent({ keepAlive: true, maxSockets: 256, keepAliveMsecs: 30_000 });

  for (const route of serviceRoutes()) {
    app.use(
      createProxyMiddleware<Request, Response>({
        target: route.target,
        pathFilter: (path) => path === route.prefix || path.startsWith(`${route.prefix}/`),
        changeOrigin: true,
        xfwd: true,
        agent,
        proxyTimeout: route.timeoutMs,
        on: {
          error: (error, req, res) => {
            logger.error('Upstream request failed', {
              target: route.target,
              path: req.originalUrl ?? req.url,
              error: error.message,
            });
            if ('headersSent' in res && !res.headersSent) {
              res.writeHead(502, { 'content-type': 'application/json' });
              res.end(
                JSON.stringify({
                  statusCode: 502,
                  message: `${route.prefix.slice(1)} service is unavailable`,
                  requestId: req.headers['x-request-id'] ?? null,
                }),
              );
            } else if ('destroy' in res) {
              res.destroy();
            }
          },
        },
      }),
    );
  }
}
