import { Module } from '@nestjs/common';
import { PinoLoggerService } from '@spotify/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';
import { RecommendationSchedulers } from './schedulers';

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService, RecommendationSchedulers, PinoLoggerService],
})
export class RecommendationsModule {}
