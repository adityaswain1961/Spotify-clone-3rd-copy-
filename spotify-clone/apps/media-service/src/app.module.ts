import { Module } from '@nestjs/common';
import { PrismaModule } from '@spotify/prisma';
import { BullConfigModule } from '@spotify/bull-config';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import { HealthController, PinoLoggerService } from '@spotify/common';
import { SongsModule } from './songs/songs.module';

@Module({
  imports: [PrismaModule, BullConfigModule, TerminusModule, SongsModule],
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
