import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PlaylistsService } from './playlists.service';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { ReorderSongDto } from './dto/reorder-song.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('playlists')
export class PlaylistsController {
  constructor(private readonly playlistsService: PlaylistsService) {}

  @Post()
  create(
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: CreatePlaylistDto,
  ) {
    return this.playlistsService.create(userId, dto);
  }

  @Get('me')
  getMine(
    @Headers('x-user-id') userId: string | undefined,
    @Query() pagination: PaginationDto,
  ) {
    return this.playlistsService.getMine(userId, pagination.page, pagination.size);
  }

  @Get(':id')
  getById(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string | undefined,
  ) {
    return this.playlistsService.getById(id, userId);
  }

  @Post(':id/songs')
  addSong(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: AddSongDto,
  ) {
    return this.playlistsService.addSong(id, userId, dto);
  }

  @Delete(':id/songs/:songId')
  removeSong(
    @Param('id') id: string,
    @Param('songId') songId: string,
    @Headers('x-user-id') userId: string | undefined,
  ) {
    return this.playlistsService.removeSong(id, songId, userId);
  }

  @Patch(':id/songs/reorder')
  reorder(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string | undefined,
    @Body() dto: ReorderSongDto,
  ) {
    return this.playlistsService.reorder(id, userId, dto);
  }
}
