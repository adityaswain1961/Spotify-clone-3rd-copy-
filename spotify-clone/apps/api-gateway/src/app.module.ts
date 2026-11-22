import { Module } from '@nestjs/common';
import { PinoLoggerService } from '@spotify/common';
import { HealthController } from './health.controller';

/** Routing, auth and rate limiting live in plain Express middleware (see gateway.ts). */
@Module({
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
