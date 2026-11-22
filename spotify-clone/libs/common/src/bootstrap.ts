import { INestApplication, Type, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GlobalExceptionFilter } from './filters/global-exception.filter';
import { TransformInterceptor } from './interceptors/transform.interceptor';
import { PinoLoggerService } from './logger/pino-logger.service';
import { serviceKeyMiddleware } from './security/service-key';
import { setupOtel } from './tracing/otel.setup';
import { envInt } from './config/env';

export interface ServiceOptions {
  /** Used for logs and tracing. */
  name: string;
  /** Default port; override with <NAME>_PORT, e.g. MEDIA_SERVICE_PORT. */
  port: number;
}

/**
 * Shared bootstrap for every internal HTTP service, so they all get the same
 * validation, error format, response envelope, gateway-only access and graceful shutdown.
 */
export async function bootstrapService(module: Type<unknown>, options: ServiceOptions): Promise<INestApplication> {
  await setupOtel(options.name);

  const app = await NestFactory.create(module, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);

  app.use(serviceKeyMiddleware());
  app.useGlobalFilters(new GlobalExceptionFilter(logger));
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.enableShutdownHooks();

  const envName = `${options.name.toUpperCase().replace(/-/g, '_')}_PORT`;
  const port = envInt(envName, options.port);
  await app.listen(port);
  logger.log(`${options.name} listening on port ${port}`);
  return app;
}
