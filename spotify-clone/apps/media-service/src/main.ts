import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  GlobalExceptionFilter,
  PinoLoggerService,
  TransformInterceptor,
  setupOtel,
} from '@spotify/common';

async function bootstrap(): Promise<void> {
  await setupOtel();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const logger = app.get(PinoLoggerService);
  app.useLogger(logger);
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(3003);
  logger.log('media-service listening on port 3003');
}

void bootstrap();
