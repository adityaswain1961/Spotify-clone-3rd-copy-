import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { UserId, UserRole } from '@spotify/common';
import { SongMetadataDto } from './dto/song-metadata.dto';
import { QualityQueryDto, SongIdsQueryDto, StreamUrlsDto } from './dto/stream.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  /** GET /songs?ids=a,b,c - batch lookup, keeps the requested order. */
  @Get()
  getSongs(@Query() query: SongIdsQueryDto) {
    return this.songsService.getSongs(query.ids);
  }

  /** Signed URLs for several songs at once, used to prefetch a whole play queue. */
  @Post('stream-urls')
  @HttpCode(200)
  getStreamUrls(@UserId() _userId: string, @Body() dto: StreamUrlsDto) {
    return this.songsService.getStreamUrls(dto.ids, dto.quality);
  }

  @Get(':id/stream')
  getStream(@UserId() _userId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: QualityQueryDto) {
    return this.songsService.getMediaUrl(id, query.quality, 'stream');
  }

  @Get(':id/download')
  getDownload(@UserId() _userId: string, @Param('id', ParseUUIDPipe) id: string, @Query() query: QualityQueryDto) {
    return this.songsService.getMediaUrl(id, query.quality, 'download');
  }

  @Get(':id')
  getSong(@Param('id', ParseUUIDPipe) id: string) {
    return this.songsService.getSong(id);
  }

  @Post('upload-url')
  createUploadUrl(@UserId() userId: string, @UserRole() role: string | undefined, @Body() dto: UploadUrlDto) {
    return this.songsService.createUploadUrl(dto, userId, role);
  }

  @Post('metadata')
  createMetadata(@UserId() userId: string, @UserRole() role: string | undefined, @Body() dto: SongMetadataDto) {
    return this.songsService.createMetadata(dto, userId, role);
  }
}
