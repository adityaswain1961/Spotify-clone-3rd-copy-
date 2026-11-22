import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PinoLoggerService } from '@spotify/common';
import { RecommendationsService } from './recommendations.service';

@Injectable()
export class RecommendationSchedulers implements OnApplicationBootstrap {
  private running = new Set<string>();

  constructor(
    private readonly recommendationsService: RecommendationsService,
    private readonly logger: PinoLoggerService,
  ) {}

  /** Warm the caches right away instead of serving empty results until the first cron tick. */
  onApplicationBootstrap(): void {
    void this.run('trending', () => this.recommendationsService.refreshTrending());
    void this.run('collaborative', () => this.recommendationsService.refreshCollaborativeForAllUsers());
  }

  @Cron('*/10 * * * *')
  refreshTrending(): Promise<void> {
    return this.run('trending', () => this.recommendationsService.refreshTrending());
  }

  @Cron('*/30 * * * *')
  refreshCollaborative(): Promise<void> {
    return this.run('collaborative', () => this.recommendationsService.refreshCollaborativeForAllUsers());
  }

  /** Never overlap runs of the same job, and never let a failure crash the process. */
  private async run(name: string, job: () => Promise<void>): Promise<void> {
    if (this.running.has(name)) return;
    this.running.add(name);
    try {
      await job();
    } catch (error) {
      this.logger.error(`Recommendation job "${name}" failed`, {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running.delete(name);
    }
  }
}
