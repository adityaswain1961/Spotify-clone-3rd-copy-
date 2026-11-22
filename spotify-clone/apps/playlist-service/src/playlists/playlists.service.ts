import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { assetUrl, PrismaService, SongDto, songSelect, toSongDto } from '@spotify/prisma';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { ReorderSongDto } from './dto/reorder-song.dto';
import { CacheService } from './cache.service';

export interface PlaylistSummaryDto {
  id: string;
  title: string;
  description: string | null;
  isPublic: boolean;
  ownerId: string;
  coverUrl: string | null;
  songCount: number;
  updatedAt: string;
}

export interface PlaylistDetailDto extends PlaylistSummaryDto {
  songs: SongDto[];
}

const CACHE_TTL_SECONDS = 60;
const cacheKey = (id: string) => `playlist:v2:${id}`;

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async create(userId: string, dto: CreatePlaylistDto): Promise<PlaylistDetailDto> {
    const playlist = await this.prisma.playlist.create({
      data: { userId, title: dto.title, description: dto.description, isPublic: dto.isPublic ?? true },
    });
    return {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      isPublic: playlist.isPublic,
      ownerId: playlist.userId,
      coverUrl: assetUrl(playlist.coverKey),
      songCount: 0,
      updatedAt: playlist.updatedAt.toISOString(),
      songs: [],
    };
  }

  async getMine(userId: string, page: number, size: number) {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.playlist.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        include: {
          _count: { select: { playlistSongs: true } },
          // First song's cover doubles as the playlist cover when none is set.
          playlistSongs: { orderBy: { position: 'asc' }, take: 1, select: { song: { select: { coverImageKey: true } } } },
        },
      }),
      this.prisma.playlist.count({ where: { userId } }),
    ]);

    const items: PlaylistSummaryDto[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      isPublic: row.isPublic,
      ownerId: row.userId,
      coverUrl: assetUrl(row.coverKey ?? row.playlistSongs[0]?.song.coverImageKey),
      songCount: row._count.playlistSongs,
      updatedAt: row.updatedAt.toISOString(),
    }));
    return { items, page, size, total };
  }

  async getById(id: string, userId?: string): Promise<PlaylistDetailDto> {
    const playlist = (await this.cache.get<PlaylistDetailDto>(cacheKey(id))) ?? (await this.loadAndCache(id));
    // Access check runs on every request, cached or not.
    if (!playlist.isPublic && playlist.ownerId !== userId) {
      throw new ForbiddenException('This playlist is private');
    }
    return playlist;
  }

  async remove(id: string, userId: string): Promise<{ success: true }> {
    await this.assertOwner(id, userId);
    await this.prisma.$transaction([
      this.prisma.playlistSong.deleteMany({ where: { playlistId: id } }),
      this.prisma.like.deleteMany({ where: { playlistId: id } }),
      this.prisma.playlist.delete({ where: { id } }),
    ]);
    await this.cache.del(cacheKey(id));
    return { success: true };
  }

  async addSong(playlistId: string, userId: string, dto: AddSongDto): Promise<PlaylistDetailDto> {
    await this.assertOwner(playlistId, userId);
    await this.prisma.$transaction(async (tx) => {
      const max = await tx.playlistSong.aggregate({ where: { playlistId }, _max: { position: true } });
      await tx.playlistSong.create({
        data: { playlistId, songId: dto.songId, position: (max._max.position ?? 0) + 1 },
      });
      await tx.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
    });
    return this.invalidateAndLoad(playlistId);
  }

  async removeSong(playlistId: string, songId: string, userId: string): Promise<PlaylistDetailDto> {
    await this.assertOwner(playlistId, userId);
    await this.prisma.$transaction(async (tx) => {
      const record = await tx.playlistSong.findUnique({ where: { playlistId_songId: { playlistId, songId } } });
      if (!record) throw new NotFoundException('Song is not in this playlist');

      await tx.playlistSong.delete({ where: { id: record.id } });
      // Shift one at a time in ascending order so the (playlist, position) unique index never collides.
      const after = await tx.playlistSong.findMany({
        where: { playlistId, position: { gt: record.position } },
        orderBy: { position: 'asc' },
        select: { id: true, position: true },
      });
      for (const row of after) {
        await tx.playlistSong.update({ where: { id: row.id }, data: { position: row.position - 1 } });
      }
      await tx.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
    });
    return this.invalidateAndLoad(playlistId);
  }

  async reorder(playlistId: string, userId: string, dto: ReorderSongDto): Promise<PlaylistDetailDto> {
    await this.assertOwner(playlistId, userId);
    await this.prisma.$transaction(async (tx) => {
      const ordered = await tx.playlistSong.findMany({
        where: { playlistId },
        orderBy: { position: 'asc' },
        select: { id: true, songId: true },
      });
      const from = ordered.findIndex((row) => row.songId === dto.songId);
      if (from === -1) throw new NotFoundException('Song is not in this playlist');

      const to = Math.min(Math.max(1, dto.newPosition), ordered.length) - 1;
      if (to === from) return;
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);

      // Two passes (negative, then final) avoid transient unique-index conflicts.
      for (const [index, row] of ordered.entries()) {
        await tx.playlistSong.update({ where: { id: row.id }, data: { position: -(index + 1) } });
      }
      for (const [index, row] of ordered.entries()) {
        await tx.playlistSong.update({ where: { id: row.id }, data: { position: index + 1 } });
      }
      await tx.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
    });
    return this.invalidateAndLoad(playlistId);
  }

  private async invalidateAndLoad(id: string): Promise<PlaylistDetailDto> {
    await this.cache.del(cacheKey(id));
    return this.loadAndCache(id);
  }

  private async loadAndCache(id: string): Promise<PlaylistDetailDto> {
    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        playlistSongs: {
          where: { song: { isPublished: true } },
          orderBy: { position: 'asc' },
          select: { song: { select: songSelect } },
        },
      },
    });
    if (!playlist) throw new NotFoundException('Playlist not found');

    const songs = playlist.playlistSongs.map((entry) => toSongDto(entry.song));
    const detail: PlaylistDetailDto = {
      id: playlist.id,
      title: playlist.title,
      description: playlist.description,
      isPublic: playlist.isPublic,
      ownerId: playlist.userId,
      coverUrl: assetUrl(playlist.coverKey) ?? songs[0]?.coverUrl ?? null,
      songCount: songs.length,
      updatedAt: playlist.updatedAt.toISOString(),
      songs,
    };
    await this.cache.set(cacheKey(id), detail, CACHE_TTL_SECONDS);
    return detail;
  }

  private async assertOwner(playlistId: string, userId: string): Promise<void> {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId }, select: { userId: true } });
    if (!playlist) throw new NotFoundException('Playlist not found');
    if (playlist.userId !== userId) throw new ForbiddenException('Only the owner can modify this playlist');
  }
}
