import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationSchedulers } from './schedulers';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationSchedulers],
})
export class RecommendationsModule {}

