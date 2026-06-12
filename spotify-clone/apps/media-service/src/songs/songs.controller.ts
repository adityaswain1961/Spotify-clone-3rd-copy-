import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { SongMetadataDto } from './dto/song-metadata.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { SongsService } from './songs.service';

@Controller('songs')
export class SongsController {
  constructor(private readonly songsService: SongsService) {}

  @Post('upload-url')
  createUploadUrl(
    @Body() dto: UploadUrlDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.songsService.createUploadUrl(dto, userId, userRole);
  }

  @Post('metadata')
  createMetadata(
    @Body() dto: SongMetadataDto,
    @Headers('x-user-id') userId?: string,
    @Headers('x-user-role') userRole?: string,
  ) {
    return this.songsService.createMetadata(dto, userId, userRole);
  }

  @Get(':id/stream')
  getStream(@Param('id') id: string) {
    return this.songsService.getStreamUrl(id);
  }

  @Get(':id')
  getSong(@Param('id') id: string) {
    return this.songsService.getSong(id);
  }
}
