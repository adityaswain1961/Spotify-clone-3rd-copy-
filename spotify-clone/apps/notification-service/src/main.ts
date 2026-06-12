import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { PinoLoggerService, setupOtel } from '@spotify/common';

async function bootstrap(): Promise<void> {
  await setupOtel();
  const app = await NestFactory.createApplicationContext(AppModule, {
    bufferLogs: true,
  });
  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);
  logger.log('notification-service worker started on port 3008 (queue consumer only)');
}

void bootstrap();

