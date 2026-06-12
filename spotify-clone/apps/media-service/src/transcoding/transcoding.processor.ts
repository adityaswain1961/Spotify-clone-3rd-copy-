import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TRANSCODING_QUEUE } from '@spotify/bull-config';
import { PinoLoggerService } from '@spotify/common';
import { TranscodingService } from './transcoding.service';

@Processor(TRANSCODING_QUEUE)
export class TranscodingProcessor extends WorkerHost {
  constructor(
    private readonly logger: PinoLoggerService,
    private readonly transcodingService: TranscodingService,
  ) {
    super();
  }

  async process(job: Job<{ songId: string; s3Key: string }>): Promise<void> {
    try {
      await this.transcodingService.processSong(job.data);
    } catch (error) {
      this.logger.error('Transcoding failed', {
        songId: job.data.songId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}
