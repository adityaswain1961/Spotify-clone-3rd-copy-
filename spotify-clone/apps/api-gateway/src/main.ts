import '@spotify/env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { envInt, GlobalExceptionFilter, PinoLoggerService, requireEnv, setupOtel } from '@spotify/common';
import { AppModule } from './app.module';
import { authContext, mountServiceProxies, requestId } from './gateway';
import { isMediaFileRoute } from './routes';

function corsOrigins(): string[] | boolean {
  const configured = process.env.ALLOWED_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean);
  // Native apps don't send Origin; reflect any origin in dev so Expo web works too.
  return configured?.length ? configured : true;
}

async function bootstrap(): Promise<void> {
  await setupOtel('api-gateway');
  const jwtSecret = requireEnv('JWT_ACCESS_SECRET');

  // bodyParser off: the gateway only streams bodies through to services. With it on,
  // Nest consumes POST/PUT bodies before the proxy and those requests hang upstream.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });
  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.enableShutdownHooks();
  if (process.env.TRUST_PROXY) app.set('trust proxy', process.env.TRUST_PROXY);

  app.enableCors({ origin: corsOrigins(), exposedHeaders: ['x-request-id'] });
  app.use(requestId());
  // gzip JSON (lists of songs compress ~5-10x); audio is already compressed.
  app.use(compression({ filter: (req, res) => !isMediaFileRoute(req.path) && compression.filter(req, res) }));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: envInt('RATE_LIMIT_PER_MINUTE', 600),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      skip: (req) => isMediaFileRoute(req.path),
    }),
  );
  app.use(
    ['/auth/login', '/auth/register'],
    rateLimit({ windowMs: 60_000, limit: envInt('AUTH_RATE_LIMIT_PER_MINUTE', 20), standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.use(authContext(jwtSecret));
  mountServiceProxies(app.getHttpAdapter().getInstance(), logger);

  const port = envInt('API_GATEWAY_PORT', envInt('PORT', 3000));
  await app.listen(port, '0.0.0.0');
  logger.log(`api-gateway listening on http://0.0.0.0:${port}`);
}

void bootstrap();
