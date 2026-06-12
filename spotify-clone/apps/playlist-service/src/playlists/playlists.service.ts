import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@spotify/prisma';
import { CreatePlaylistDto } from './dto/create-playlist.dto';
import { AddSongDto } from './dto/add-song.dto';
import { ReorderSongDto } from './dto/reorder-song.dto';
import { CacheService } from './cache.service';

@Injectable()
export class PlaylistsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(userId: string | undefined, dto: CreatePlaylistDto) {
    this.assertUser(userId);
    return this.prisma.playlist.create({
      data: {
        userId: userId!,
        title: dto.title,
        description: dto.description,
        isPublic: dto.isPublic ?? true,
      },
    });
  }

  async getMine(userId: string | undefined, page = 1, size = 10) {
    this.assertUser(userId);
    const skip = (page - 1) * size;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.playlist.findMany({
        where: { userId: userId! },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: size,
      }),
      this.prisma.playlist.count({ where: { userId: userId! } }),
    ]);
    return { items, page, size, total };
  }

  async getById(id: string, userId?: string) {
    const cacheKey = `playlist:${id}`;
    const cached = await this.cacheService.get<unknown>(cacheKey);
    if (cached) return cached;

    const playlist = await this.prisma.playlist.findUnique({
      where: { id },
      include: {
        playlistSongs: {
          include: {
            song: {
              include: {
                artist: { select: { id: true, stageName: true } },
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    if (!playlist.isPublic && playlist.userId !== userId) {
      throw new ForbiddenException('You are not allowed to view this playlist');
    }

    await this.cacheService.set(cacheKey, playlist, 60);
    return playlist;
  }

  async addSong(playlistId: string, userId: string | undefined, dto: AddSongDto) {
    this.assertUser(userId);
    const playlist = await this.assertOwner(playlistId, userId!);

    const max = await this.prisma.playlistSong.aggregate({
      where: { playlistId },
      _max: { position: true },
    });
    const nextPosition = (max._max.position ?? 0) + 1;

    await this.prisma.playlistSong.create({
      data: {
        playlistId,
        songId: dto.songId,
        position: nextPosition,
      },
    });

    await this.cacheService.del(`playlist:${playlistId}`);
    return this.getById(playlist.id, userId);
  }

  async removeSong(playlistId: string, songId: string, userId: string | undefined) {
    this.assertUser(userId);
    await this.assertOwner(playlistId, userId!);

    await this.prisma.$transaction(async (tx) => {
      const record = await tx.playlistSong.findUnique({
        where: {
          playlistId_songId: { playlistId, songId },
        },
      });
      if (!record) {
        throw new NotFoundException('Song is not in playlist');
      }

      await tx.playlistSong.delete({
        where: { id: record.id },
      });

      await tx.playlistSong.updateMany({
        where: {
          playlistId,
          position: { gt: record.position },
        },
        data: {
          position: { decrement: 1 },
        },
      });
    });

    await this.cacheService.del(`playlist:${playlistId}`);
    return this.getById(playlistId, userId);
  }

  async reorder(playlistId: string, userId: string | undefined, dto: ReorderSongDto) {
    this.assertUser(userId);
    await this.assertOwner(playlistId, userId!);

    await this.prisma.$transaction(async (tx) => {
      const target = await tx.playlistSong.findUnique({
        where: {
          playlistId_songId: { playlistId, songId: dto.songId },
        },
      });
      if (!target) {
        throw new NotFoundException('Song is not in playlist');
      }

      const total = await tx.playlistSong.count({ where: { playlistId } });
      const newPosition = Math.min(Math.max(1, dto.newPosition), total);
      if (newPosition === target.position) {
        return;
      }

      if (newPosition < target.position) {
        await tx.playlistSong.updateMany({
          where: {
            playlistId,
            position: { gte: newPosition, lt: target.position },
          },
          data: { position: { increment: 1 } },
        });
      } else {
        await tx.playlistSong.updateMany({
          where: {
            playlistId,
            position: { gt: target.position, lte: newPosition },
          },
          data: { position: { decrement: 1 } },
        });
      }

      await tx.playlistSong.update({
        where: { id: target.id },
        data: { position: newPosition },
      });
    });

    await this.cacheService.del(`playlist:${playlistId}`);
    return this.getById(playlistId, userId);
  }

  private async assertOwner(playlistId: string, userId: string) {
    const playlist = await this.prisma.playlist.findUnique({ where: { id: playlistId } });
    if (!playlist) {
      throw new NotFoundException('Playlist not found');
    }
    if (playlist.userId !== userId) {
      throw new ForbiddenException('Only owner can modify playlist');
    }
    return playlist;
  }

  private assertUser(userId?: string): void {
    if (!userId) {
      throw new UnauthorizedException('Missing X-User-Id');
    }
  }
}
