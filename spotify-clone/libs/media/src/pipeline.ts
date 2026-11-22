import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import type { PrismaClient } from '@prisma/client';
import { AUDIO_MIME_TYPE, AUDIO_QUALITIES, audioKey, coverKey } from './quality';
import { extractCoverArt, transcodeAudio } from './transcode';
import { IMMUTABLE_CACHE_CONTROL, ObjectStorage } from './storage/types';

export interface IngestDeps {
  prisma: PrismaClient;
  storage: ObjectStorage;
}

export interface IngestOptions {
  /** Use this image as the cover instead of artwork embedded in the audio file. */
  coverFile?: string;
}

/**
 * Transcode a source audio file into every rendition, store them, attach cover art
 * and publish the song. Used by the transcoding worker and by the seed script.
 */
export async function ingestSongAudio(
  { prisma, storage }: IngestDeps,
  songId: string,
  inputFile: string,
  options: IngestOptions = {},
): Promise<void> {
  const workDir = await mkdtemp(join(tmpdir(), `song-${songId}-`));
  try {
    const { durationSec, files } = await transcodeAudio(inputFile, workDir);

    const sizes = await Promise.all(
      AUDIO_QUALITIES.map((quality) =>
        storage.putFile('media', audioKey(songId, quality), files[quality].path, {
          contentType: AUDIO_MIME_TYPE,
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        }),
      ),
    );

    const existing = await prisma.song.findUnique({ where: { id: songId }, select: { coverImageKey: true } });
    let coverImageKey: string | undefined;
    if (!existing?.coverImageKey) {
      const coverPath = options.coverFile ?? join(workDir, 'cover.jpg');
      const hasCover = options.coverFile ? true : await extractCoverArt(inputFile, coverPath);
      if (hasCover) {
        await storage.putFile('media', coverKey(songId), coverPath, {
          contentType: 'image/jpeg',
          cacheControl: IMMUTABLE_CACHE_CONTROL,
        });
        coverImageKey = coverKey(songId);
      }
    }

    const [lowBytes, highBytes] = sizes;
    await prisma.song.update({
      where: { id: songId },
      data: {
        audioLowKey: audioKey(songId, 'low'),
        audioHighKey: audioKey(songId, 'high'),
        audioLowBytes: lowBytes,
        audioHighBytes: highBytes,
        ...(durationSec ? { duration: durationSec } : {}),
        ...(coverImageKey ? { coverImageKey } : {}),
        isPublished: true,
      },
    });
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
