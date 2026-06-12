import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import Redis from 'ioredis';
import { HealthController, PinoLoggerService } from '@spotify/common';
import { BullConfigModule } from '@spotify/bull-config';
import { PrismaModule } from '@spotify/prisma';
import { ScheduleModule } from '@nestjs/schedule';
import { InteractionsModule } from './interactions/interactions.module';

@Module({
  imports: [
    PrismaModule,
    BullConfigModule,
    TerminusModule,
    ScheduleModule.forRoot(),
    InteractionsModule,
  ],
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

