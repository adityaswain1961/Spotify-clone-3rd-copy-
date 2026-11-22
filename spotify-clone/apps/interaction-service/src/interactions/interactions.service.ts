import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { REDIS_CLIENT } from '@spotify/common';
import { PrismaService, songSelect, toSongDto } from '@spotify/prisma';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { ToggleFollowDto } from './dto/toggle-follow.dto';
import { ListenDto } from './dto/listen.dto';

const MAX_LISTEN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async setLike(userId: string, dto: ToggleLikeDto): Promise<{ liked: boolean }> {
    const { songId, playlistId } = dto;
    if (Boolean(songId) === Boolean(playlistId)) {
      throw new BadRequestException('Provide exactly one of songId or playlistId');
    }
    const target = songId ? { songId } : { playlistId: playlistId! };
    const where = songId
      ? { userId_songId: { userId, songId } }
      : { userId_playlistId: { userId, playlistId: playlistId! } };

    const desired =
      dto.liked ?? !(await this.prisma.like.findUnique({ where, select: { id: true } }));

    if (desired) {
      // upsert keeps this idempotent and safe against concurrent double-taps.
      await this.prisma.like.upsert({ where, create: { userId, ...target }, update: {} });
    } else {
      await this.prisma.like.deleteMany({ where: { userId, ...target } });
    }
    return { liked: desired };
  }

  async getMyLikedSongs(userId: string, page: number, size: number) {
    const where = { userId, songId: { not: null }, song: { isPublished: true } };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        select: { createdAt: true, song: { select: songSelect } },
      }),
      this.prisma.like.count({ where }),
    ]);

    const items = rows
      .filter((row) => row.song)
      .map((row) => ({ ...toSongDto(row.song!), likedAt: row.createdAt.toISOString() }));
    return { items, page, size, total };
  }

  async getMyLikedSongIds(userId: string): Promise<{ songIds: string[] }> {
    const rows = await this.prisma.like.findMany({
      where: { userId, songId: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { songId: true },
      take: 5000,
    });
    return { songIds: rows.map((row) => row.songId!) };
  }

  async toggleFollow(userId: string, dto: ToggleFollowDto): Promise<{ following: boolean }> {
    const where = { userId_artistId: { userId, artistId: dto.artistId } };
    const existing = await this.prisma.artistFollow.findUnique({ where, select: { id: true } });
    if (existing) {
      await this.prisma.artistFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }

    await this.prisma.artistFollow.create({ data: { userId, artistId: dto.artistId } });
    await this.notificationQueue
      .add('artist.followed', { event: 'artist.followed', artistId: dto.artistId, followerId: userId }, { removeOnComplete: true, attempts: 3 })
      .catch(() => undefined);
    return { following: true };
  }

  async recordListens(userId: string, events: ListenDto[]): Promise<{ recorded: number }> {
    const now = Date.now();
    const valid = events
      .map((event) => ({
        songId: event.songId,
        // Clamp client clocks: no future timestamps, nothing older than 30 days.
        listenedAt: new Date(Math.min(now, Math.max(now - MAX_LISTEN_AGE_MS, Date.parse(event.listenedAt ?? '') || now))),
      }));

    // Ignore ids that don't exist instead of failing the whole offline batch.
    const known = await this.prisma.song.findMany({
      where: { id: { in: [...new Set(valid.map((event) => event.songId))] } },
      select: { id: true },
    });
    const knownIds = new Set(known.map((song) => song.id));
    const rows = valid.filter((event) => knownIds.has(event.songId)).map((event) => ({ userId, ...event }));
    if (!rows.length) return { recorded: 0 };

    await this.prisma.listenHistory.createMany({ data: rows });
    const pipeline = this.redis.pipeline();
    for (const row of rows) pipeline.incr(`song:${row.songId}:plays`);
    await pipeline.exec();
    return { recorded: rows.length };
  }
}
