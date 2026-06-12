import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RecommendationsService } from './recommendations.service';

@Injectable()
export class RecommendationSchedulers {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Cron('*/10 * * * *')
  async refreshTrending(): Promise<void> {
    await this.recommendationsService.refreshTrending();
  }

  @Cron('*/30 * * * *')
  async refreshCollaborative(): Promise<void> {
    await this.recommendationsService.refreshCollaborativeForAllUsers();
  }
}

