import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { GlobalExceptionFilter, PinoLoggerService, setupOtel } from '@spotify/common';
import rateLimit from 'express-rate-limit';

function parseOrigins(originsValue?: string): string[] {
  if (!originsValue) {
    return ['*'];
  }

  return originsValue
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap(): Promise<void> {
  await setupOtel();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);

  app.useLogger(logger);
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 100,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.use(
    '/auth/login',
    rateLimit({
      windowMs: 60 * 1000,
      limit: 10,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.enableCors({
    origin: parseOrigins(process.env.ALLOWED_ORIGINS),
    credentials: true,
  });

  await app.listen(3000);
  logger.log('api-gateway listening on port 3000');
}

void bootstrap();
