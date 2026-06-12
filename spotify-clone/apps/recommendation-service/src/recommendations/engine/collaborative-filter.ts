import { Prisma } from '@prisma/client';
import { PrismaService } from '@spotify/prisma';

export interface RecommendationEntry {
  songId: string;
  score: number;
}

export async function computeUserRecommendations(
  prisma: PrismaService,
  userId: string,
  minSharedSongs = 3,
  limit = 20,
): Promise<RecommendationEntry[]> {
  // 1) User's recent listens (7 days)
  const userSongRows = await prisma.listenHistory.findMany({
    where: {
      userId,
      listenedAt: { gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
    select: { songId: true },
    distinct: ['songId'],
  });
  const userSongIds = userSongRows.map((r) => r.songId);
  if (userSongIds.length === 0) return [];

  // 2) Find similar users who share >= minSharedSongs
  const similarUsers = await prisma.$queryRaw<Array<{ user_id: string; shared: number }>>(
    Prisma.sql`
      SELECT user_id, COUNT(DISTINCT song_id)::int AS shared
      FROM listen_history
      WHERE listened_at > NOW() - INTERVAL '7 days'
        AND song_id IN (${Prisma.join(userSongIds)})
        AND user_id <> ${userId}
      GROUP BY user_id
      HAVING COUNT(DISTINCT song_id) >= ${minSharedSongs}
      ORDER BY shared DESC
      LIMIT 200
    `,
  );

  const similarUserIds = similarUsers.map((u) => u.user_id);
  if (similarUserIds.length === 0) return [];

  // 3) Candidate songs: listens from similar users that current user hasn't listened to
  const candidates = await prisma.$queryRaw<Array<{ song_id: string; score: number }>>(
    Prisma.sql`
      SELECT lh.song_id, COUNT(DISTINCT lh.user_id)::int AS score
      FROM listen_history lh
      WHERE lh.listened_at > NOW() - INTERVAL '7 days'
        AND lh.user_id IN (${Prisma.join(similarUserIds)})
        AND lh.song_id NOT IN (${Prisma.join(userSongIds)})
      GROUP BY lh.song_id
      ORDER BY score DESC
      LIMIT ${limit}
    `,
  );

  return candidates.map((c) => ({ songId: c.song_id, score: Number(c.score) }));
}

