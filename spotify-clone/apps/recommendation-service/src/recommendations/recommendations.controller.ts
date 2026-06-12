import { Controller, Get, Headers } from '@nestjs/common';
import { RecommendationsService } from './recommendations.service';

@Controller('recommendations')
export class RecommendationsController {
  constructor(private readonly recommendationsService: RecommendationsService) {}

  @Get('for-you')
  forYou(@Headers('x-user-id') userId: string | undefined) {
    return this.recommendationsService.getForYou(userId);
  }

  @Get('trending')
  trending() {
    return this.recommendationsService.getTrending();
  }
}

