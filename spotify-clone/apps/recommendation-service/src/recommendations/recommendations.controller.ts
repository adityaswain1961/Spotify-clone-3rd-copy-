import { Controller, Get } from '@nestjs/common';
import { UserId } from '@spotify/common';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  /** Everything the home screen needs in one round-trip. */
  @Get('home')
  home(@UserId() userId: string) {
    return this.recommendationsService.getHome(userId);
  }

  @Get('for-you')
  forYou(@UserId() userId: string) {
    return this.recommendationsService.getForYou(userId);
  }

  @Get('trending')
  trending() {
    return this.recommendationsService.getTrending();
  }
}
