import {
  MiddlewareConsumer,
  Module,
  NestModule,
  UnauthorizedException,
} from '@nestjs/common';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { Request, Response, NextFunction } from 'express';
import { PinoLoggerService } from '@spotify/common';

type RouteMap = Record<string, string>;

type AuthenticatedRequest = Request & { user?: { sub: string; role: string } };

const DEFAULT_ROUTE_MAP: RouteMap = {
  '/auth': process.env.AUTH_SERVICE_URL ?? 'http://auth-service:3001',
  '/profiles': process.env.USER_PROFILE_SERVICE_URL ?? 'http://user-profile-service:3002',
  '/songs': process.env.MEDIA_SERVICE_URL ?? 'http://media-service:3003',
  '/playlists': process.env.PLAYLIST_SERVICE_URL ?? 'http://playlist-service:3004',
  '/interactions': process.env.INTERACTION_SERVICE_URL ?? 'http://interaction-service:3005',
  '/search': process.env.SEARCH_SERVICE_URL ?? 'http://search-service:3006',
  '/recommendations':
    process.env.RECOMMENDATION_SERVICE_URL ?? 'http://recommendation-service:3007',
};

@Module({})
export class RouteProxyModule implements NestModule {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly logger: PinoLoggerService,
  ) {}

  configure(consumer: MiddlewareConsumer): void {
    for (const [path, target] of Object.entries(DEFAULT_ROUTE_MAP)) {
      const authMiddleware = (req: AuthenticatedRequest, _res: Response, next: NextFunction) => {
        this.attachAuthContext(req, path);
        next();
      };

      consumer
        .apply(
          authMiddleware,
          createProxyMiddleware({
            target,
            changeOrigin: true,
            ws: true,
            on: {
              proxyReq: (proxyReq, req) => {
                const request = req as AuthenticatedRequest;
                const requestId = request.header('x-request-id');
                if (requestId) {
                  proxyReq.setHeader('X-Request-Id', requestId);
                }
                if (request.user?.sub) {
                  proxyReq.setHeader('X-User-Id', request.user.sub);
                }
                if (request.user?.role) {
                  proxyReq.setHeader('X-User-Role', request.user.role);
                }
              },
              error: (err, req) => {
                this.logger.error('Proxy error', {
                  error: err.message,
                  path: (req as Request).originalUrl,
                  target,
                });
              },
            },
          }),
        )
        .forRoutes(`${path}/*path`);
    }
  }

  private attachAuthContext(req: AuthenticatedRequest, path: string): void {
    if (this.isPublicRoute(path, req.method, req.path)) {
      return;
    }

    const authorization = req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = authorization.slice(7).trim();
    req.user = this.jwtAuthGuard.validateToken(token);
  }

  private isPublicRoute(servicePath: string, method: string, fullPath: string): boolean {
    const publicAuthRoutes = ['/auth/login', '/auth/register', '/auth/refresh'];
    if (servicePath === '/auth' && publicAuthRoutes.includes(fullPath)) {
      return true;
    }

    if (servicePath === '/search') {
      return method === 'GET';
    }

    if (servicePath === '/songs' && method === 'GET') {
      return true;
    }

    return false;
  }
}
