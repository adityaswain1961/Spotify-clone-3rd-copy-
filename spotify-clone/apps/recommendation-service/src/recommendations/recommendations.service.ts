import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '@spotify/prisma';
import { computeTrending } from './engine/trending';
import { computeUserRecommendations } from './engine/collaborative-filter';

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async getForYou(userId?: string): Promise<{ songIds: string[]; source: 'personal' | 'trending' }> {
    if (!userId) {
      throw new UnauthorizedException('Missing X-User-Id');
    }

    const key = `recs:user:${userId}`;
    const ids = await this.redis.zrevrange(key, 0, 19);
    if (ids.length) {
      return { songIds: ids, source: 'personal' };
    }

    const trending = await this.redis.zrevrange('trending:global', 0, 19);
    return { songIds: trending, source: 'trending' };
  }

  async getTrending(): Promise<{ songIds: string[] }> {
    const ids = await this.redis.zrevrange('trending:global', 0, 19);
    return { songIds: ids };
  }

  async refreshTrending(): Promise<void> {
    const entries = await computeTrending(this.prisma, 50);
    const key = 'trending:global';

    const pipeline = this.redis.pipeline();
    pipeline.del(key);
    for (const e of entries) {
      pipeline.zadd(key, e.score, e.songId);
    }
    pipeline.expire(key, 15 * 60);
    await pipeline.exec();
  }

  async refreshCollaborativeForAllUsers(): Promise<void> {
    // Users with listen history in last 7 days
    const activeUsers = await this.prisma.listenHistory.findMany({
      where: { listenedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of activeUsers) {
      const recs = await computeUserRecommendations(this.prisma, userId, 3, 20);
      const key = `recs:user:${userId}`;

      const pipeline = this.redis.pipeline();
      pipeline.del(key);
      for (const r of recs) {
        pipeline.zadd(key, r.score, r.songId);
      }
      pipeline.expire(key, 2 * 60 * 60);
      await pipeline.exec();
    }
  }
}

