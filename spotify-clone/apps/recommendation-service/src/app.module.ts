import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthController, PinoLoggerService, RedisModule } from '@spotify/common';
import { PrismaModule } from '@spotify/prisma';
import { RecommendationsModule } from './recommendations/recommendations.module';

@Module({
  imports: [PrismaModule, RedisModule, TerminusModule, ScheduleModule.forRoot(), RecommendationsModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
