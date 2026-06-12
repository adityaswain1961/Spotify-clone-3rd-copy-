import { Prisma } from '@prisma/client';
import { PrismaService } from '@spotify/prisma';

export interface TrendingEntry {
  songId: string;
  score: number;
}

export async function computeTrending(
  prisma: PrismaService,
  limit = 50,
): Promise<TrendingEntry[]> {
  // Time-decayed score:
  // plays / POW(age_in_hours + 2, 1.5)
  // where age is since MIN(listened_at) for that song in last 24h window
  const rows = await prisma.$queryRaw<Array<{ song_id: string; score: number }>>(Prisma.sql`
    WITH recent AS (
      SELECT
        song_id,
        COUNT(*)::float AS plays,
        MIN(listened_at) AS first_listen
      FROM listen_history
      WHERE listened_at > NOW() - INTERVAL '24 hours'
      GROUP BY song_id
    )
    SELECT
      song_id,
      (plays / POW((EXTRACT(EPOCH FROM (NOW() - first_listen)) / 3600.0) + 2, 1.5)) AS score
    FROM recent
    ORDER BY score DESC
    LIMIT ${limit}
  `);

  return rows.map((r) => ({ songId: r.song_id, score: Number(r.score) }));
}

