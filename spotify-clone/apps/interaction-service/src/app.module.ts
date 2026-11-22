import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController, PinoLoggerService, RedisModule } from '@spotify/common';
import { BullConfigModule } from '@spotify/bull-config';
import { PrismaModule } from '@spotify/prisma';
import { InteractionsModule } from './interactions/interactions.module';

@Module({
  imports: [PrismaModule, BullConfigModule, RedisModule, TerminusModule, ScheduleModule.forRoot(), InteractionsModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
