import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE, TRANSCODING_QUEUE } from '@spotify/bull-config';
import { PinoLoggerService } from '@spotify/common';
import { FilesController } from './files.controller';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';
import { storageProvider } from './storage.provider';
import { TranscodingProcessor } from '../transcoding/transcoding.processor';

@Module({
  imports: [BullModule.registerQueue({ name: TRANSCODING_QUEUE }, { name: NOTIFICATION_QUEUE })],
  controllers: [FilesController, SongsController],
  providers: [SongsService, TranscodingProcessor, storageProvider, PinoLoggerService],
})
export class SongsModule {}
