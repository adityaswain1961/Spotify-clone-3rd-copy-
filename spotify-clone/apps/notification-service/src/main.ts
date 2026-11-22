import '@spotify/env';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { PinoLoggerService, setupOtel } from '@spotify/common';
import { AppModule } from './app.module';

/** Queue consumer only - no HTTP server. */
async function bootstrap(): Promise<void> {
  await setupOtel('notification-service');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);
  app.enableShutdownHooks();
  logger.log('notification-service worker started');
}

void bootstrap();
