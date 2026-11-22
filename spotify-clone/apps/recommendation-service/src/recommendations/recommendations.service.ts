import { Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '@spotify/common';
import { hydrateSongs, playableSongWhere, PrismaService, SongDto, songSelect, toSongDto } from '@spotify/prisma';
import { computeTrending } from './engine/trending';
import { computeUserRecommendations } from './engine/collaborative-filter';

export interface SongSectionDto {
  id: 'for-you' | 'recently-played' | 'trending' | 'new-releases' | 'popular';
  title: string;
  items: SongDto[];
}

const TRENDING_KEY = 'trending:global';
const userRecsKey = (userId: string) => `recs:user:${userId}`;
const SECTION_SIZE = 20;

@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async getHome(userId: string): Promise<{ sections: SongSectionDto[] }> {
    const [forYou, recent, trending, fresh] = await Promise.all([
      this.getForYou(userId),
      this.getRecentlyPlayed(userId),
      this.getTrending(),
      this.getNewReleases(),
    ]);

    const sections: SongSectionDto[] = [];
    if (recent.length) sections.push({ id: 'recently-played', title: 'Jump back in', items: recent });
    if (forYou.items.length && forYou.source === 'personal') {
      sections.push({ id: 'for-you', title: 'Made for you', items: forYou.items });
    }
    if (trending.items.length) sections.push({ id: trending.id, title: trending.title, items: trending.items });
    if (fresh.length) sections.push({ id: 'new-releases', title: 'New releases', items: fresh });
    return { sections };
  }

  async getForYou(userId: string): Promise<{ items: SongDto[]; source: 'personal' | 'trending' }> {
    const ids = await this.redis.zrevrange(userRecsKey(userId), 0, SECTION_SIZE - 1);
    if (ids.length) {
      const items = await hydrateSongs(this.prisma, ids);
      if (items.length) return { items, source: 'personal' };
    }
    return { items: (await this.getTrending()).items, source: 'trending' };
  }

  /** Trending from listens in the last 24h, falling back to all-time popular so it's never empty. */
  async getTrending(): Promise<{ id: 'trending' | 'popular'; title: string; items: SongDto[] }> {
    const ids = await this.redis.zrevrange(TRENDING_KEY, 0, SECTION_SIZE - 1);
    const items = ids.length ? await hydrateSongs(this.prisma, ids) : [];
    if (items.length) return { id: 'trending', title: 'Trending now', items };

    const popular = await this.prisma.song.findMany({
      where: playableSongWhere,
      orderBy: [{ playCount: 'desc' }, { createdAt: 'desc' }],
      take: SECTION_SIZE,
      select: songSelect,
    });
    return { id: 'popular', title: 'Popular', items: popular.map(toSongDto) };
  }

  async getNewReleases(): Promise<SongDto[]> {
    const rows = await this.prisma.song.findMany({
      where: playableSongWhere,
      orderBy: { createdAt: 'desc' },
      take: SECTION_SIZE,
      select: songSelect,
    });
    return rows.map(toSongDto);
  }

  async getRecentlyPlayed(userId: string): Promise<SongDto[]> {
    const rows = await this.prisma.listenHistory.findMany({
      where: { userId },
      orderBy: { listenedAt: 'desc' },
      take: 100,
      select: { songId: true },
    });
    return hydrateSongs(this.prisma, rows.map((row) => row.songId).slice(0, 100)).then((songs) =>
      songs.slice(0, SECTION_SIZE),
    );
  }

  async refreshTrending(): Promise<void> {
    const entries = await computeTrending(this.prisma, 50);
    const pipeline = this.redis.multi();
    pipeline.del(TRENDING_KEY);
    for (const entry of entries) pipeline.zadd(TRENDING_KEY, entry.score, entry.songId);
    pipeline.expire(TRENDING_KEY, 15 * 60);
    await pipeline.exec();
  }

  async refreshCollaborativeForAllUsers(): Promise<void> {
    const activeUsers = await this.prisma.listenHistory.findMany({
      where: { listenedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of activeUsers) {
      const recs = await computeUserRecommendations(this.prisma, userId, 3, SECTION_SIZE);
      const pipeline = this.redis.multi();
      pipeline.del(userRecsKey(userId));
      for (const rec of recs) pipeline.zadd(userRecsKey(userId), rec.score, rec.songId);
      pipeline.expire(userRecsKey(userId), 2 * 60 * 60);
      await pipeline.exec();
    }
  }
}
