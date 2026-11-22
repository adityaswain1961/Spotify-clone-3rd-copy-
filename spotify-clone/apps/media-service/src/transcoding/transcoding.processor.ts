import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Inject } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { NOTIFICATION_QUEUE, TRANSCODING_QUEUE } from '@spotify/bull-config';
import { envInt, PinoLoggerService } from '@spotify/common';
import { ingestSongAudio, ObjectStorage } from '@spotify/media';
import { PrismaService } from '@spotify/prisma';
import type { TranscodeJob } from '../songs/songs.service';
import { STORAGE } from '../songs/storage.provider';

@Processor(TRANSCODING_QUEUE, { concurrency: envInt('TRANSCODE_CONCURRENCY', 2) })
export class TranscodingProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
    private readonly logger: PinoLoggerService,
  ) {
    super();
  }

  async process(job: Job<TranscodeJob>): Promise<void> {
    const { songId, uploadKey } = job.data;
    const workDir = await mkdtemp(join(tmpdir(), `upload-${songId}-`));
    try {
      const input = join(workDir, 'source');
      await this.storage.downloadToFile('uploads', uploadKey, input);
      await ingestSongAudio({ prisma: this.prisma, storage: this.storage }, songId, input);
      await this.storage.delete('uploads', uploadKey);

      const song = await this.prisma.song.findUnique({ where: { id: songId }, select: { artistId: true } });
      if (song) {
        await this.notificationQueue.add(
          'song.published',
          { event: 'song.published', artistId: song.artistId, songId },
          { removeOnComplete: true, attempts: 3 },
        );
      }
      this.logger.log('Song transcoded and published', { songId });
    } catch (error) {
      this.logger.error('Transcoding failed', {
        songId,
        attempt: job.attemptsMade + 1,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      await rm(workDir, { recursive: true, force: true });
    }
  }
}
