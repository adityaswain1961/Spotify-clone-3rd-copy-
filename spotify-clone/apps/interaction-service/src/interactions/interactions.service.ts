import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@spotify/prisma';
import { ToggleLikeDto } from './dto/toggle-like.dto';
import { ToggleFollowDto } from './dto/toggle-follow.dto';
import { ListenDto } from './dto/listen.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';

@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async toggleLike(userId: string | undefined, dto: ToggleLikeDto): Promise<{ liked: boolean }> {
    this.assertUser(userId);
    const { songId, playlistId } = dto;
    if (!songId && !playlistId) {
      throw new BadRequestException('Either songId or playlistId is required');
    }
    if (songId && playlistId) {
      throw new BadRequestException('Only one of songId or playlistId is allowed');
    }

    if (songId) {
      const existing = await this.prisma.like.findUnique({
        where: { userId_songId: { userId: userId!, songId } },
        select: { id: true },
      });
      if (existing) {
        await this.prisma.like.delete({ where: { id: existing.id } });
        return { liked: false };
      }
      await this.prisma.like.create({ data: { userId: userId!, songId } });
      return { liked: true };
    }

    const existing = await this.prisma.like.findUnique({
      where: { userId_playlistId: { userId: userId!, playlistId: playlistId! } },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
      return { liked: false };
    }
    await this.prisma.like.create({ data: { userId: userId!, playlistId: playlistId! } });
    return { liked: true };
  }

  async getMyLikedSongs(userId: string | undefined, page = 1, size = 10) {
    this.assertUser(userId);
    const skip = (page - 1) * size;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.like.findMany({
        where: { userId: userId!, songId: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: size,
        include: {
          song: {
            include: { artist: { select: { id: true, stageName: true } } },
          },
        },
      }),
      this.prisma.like.count({ where: { userId: userId!, songId: { not: null } } }),
    ]);

    return { items, page, size, total };
  }

  async toggleFollow(
    userId: string | undefined,
    dto: ToggleFollowDto,
  ): Promise<{ following: boolean }> {
    this.assertUser(userId);

    const existing = await this.prisma.artistFollow.findUnique({
      where: { userId_artistId: { userId: userId!, artistId: dto.artistId } },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.artistFollow.delete({ where: { id: existing.id } });
      return { following: false };
    }

    await this.prisma.artistFollow.create({
      data: { userId: userId!, artistId: dto.artistId },
    });

    await this.notificationQueue.add(
      'artist.followed',
      { event: 'artist.followed', artistId: dto.artistId, followerId: userId! },
      { removeOnComplete: true, attempts: 3 },
    );

    return { following: true };
  }

  async listen(userId: string | undefined, dto: ListenDto): Promise<{ success: boolean }> {
    this.assertUser(userId);

    await this.prisma.listenHistory.create({
      data: {
        userId: userId!,
        songId: dto.songId,
      },
    });

    await this.redis.incr(`song:${dto.songId}:plays`);
    return { success: true };
  }

  private assertUser(userId?: string): void {
    if (!userId) {
      throw new UnauthorizedException('Missing X-User-Id');
    }
  }
}

