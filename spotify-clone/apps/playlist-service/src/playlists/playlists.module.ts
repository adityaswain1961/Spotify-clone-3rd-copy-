import { Module } from '@nestjs/common';
import { PlaylistsController } from './playlists.controller';
import { PlaylistsService } from './playlists.service';
import { CacheService } from './cache.service';

@Module({
  controllers: [PlaylistsController],
  providers: [PlaylistsService, CacheService],
})
export class PlaylistsModule {}
