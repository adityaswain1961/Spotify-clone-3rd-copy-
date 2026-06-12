import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import { HealthController, PinoLoggerService } from '@spotify/common';
import { PrismaModule } from '@spotify/prisma';
import { SearchModule } from './search/search.module';

@Module({
  imports: [PrismaModule, TerminusModule, SearchModule],
  controllers: [HealthController],
  providers: [
    PinoLoggerService,
    {
      provide: 'REDIS_CLIENT',
      useFactory: () => new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379'),
    },
  ],
})
export class AppModule {}

