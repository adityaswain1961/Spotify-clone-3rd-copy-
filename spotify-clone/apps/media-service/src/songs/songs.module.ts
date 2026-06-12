import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE, TRANSCODING_QUEUE } from '@spotify/bull-config';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { S3Service } from './s3.service';
import { CloudFrontService } from './cloudfront.service';
import { TranscodingService } from '../transcoding/transcoding.service';
import { TranscodingProcessor } from '../transcoding/transcoding.processor';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: TRANSCODING_QUEUE },
      { name: NOTIFICATION_QUEUE },
    ),
  ],
  controllers: [SongsController],
  providers: [
    SongsService,
    S3Service,
    CloudFrontService,
    TranscodingService,
    TranscodingProcessor,
  ],
  exports: [SongsService],
})
export class SongsModule {}
