import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { InteractionsService } from './interactions.service';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { ToggleFollowDto } from './dto/toggle-follow.dto';
import { ListenDto } from './dto/listen.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('likes')
  toggleLike(@Headers('x-user-id') userId: string | undefined, @Body() dto: ToggleLikeDto) {
    return this.interactionsService.toggleLike(userId, dto);
  }

  @Get('me/likes')
  getMyLikes(@Headers('x-user-id') userId: string | undefined, @Query() pagination: PaginationDto) {
    return this.interactionsService.getMyLikedSongs(userId, pagination.page, pagination.size);
  }

  @Post('follows')
  toggleFollow(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: ToggleFollowDto,
  ) {
    return this.interactionsService.toggleFollow(userId, dto);
  }

  @Post('listen')
  listen(@Headers('x-user-id') userId: string | undefined, @Body() dto: ListenDto) {
    return this.interactionsService.listen(userId, dto);
  }
}

