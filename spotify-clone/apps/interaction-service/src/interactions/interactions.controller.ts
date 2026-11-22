import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { UserId } from '@spotify/common';
import { InteractionsService } from './interactions.service';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { ToggleFollowDto } from './dto/toggle-follow.dto';
import { ListenBatchDto, ListenDto } from './dto/listen.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('interactions')
export class InteractionsController {
  constructor(private readonly interactionsService: InteractionsService) {}

  @Post('likes')
  @HttpCode(200)
  like(@UserId() userId: string, @Body() dto: ToggleLikeDto) {
    return this.interactionsService.setLike(userId, dto);
  }

  @Get('me/likes')
  getMyLikes(@UserId() userId: string, @Query() pagination: PaginationDto) {
    return this.interactionsService.getMyLikedSongs(userId, pagination.page, pagination.size);
  }

  /** Every liked song id in one call, so hearts render instantly (and offline). */
  @Get('me/likes/ids')
  getMyLikeIds(@UserId() userId: string) {
    return this.interactionsService.getMyLikedSongIds(userId);
  }

  @Post('follows')
  @HttpCode(200)
  toggleFollow(@UserId() userId: string, @Body() dto: ToggleFollowDto) {
    return this.interactionsService.toggleFollow(userId, dto);
  }

  @Post('listen')
  @HttpCode(200)
  listen(@UserId() userId: string, @Body() dto: ListenDto) {
    return this.interactionsService.recordListens(userId, [dto]);
  }

  /** Flush listens queued while offline in a single request. */
  @Post('listens')
  @HttpCode(200)
  listens(@UserId() userId: string, @Body() dto: ListenBatchDto) {
    return this.interactionsService.recordListens(userId, dto.events);
  }
}
