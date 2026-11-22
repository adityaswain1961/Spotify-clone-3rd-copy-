import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { PinoLoggerService } from '@spotify/common';
import { InteractionsController } from './interactions.controller';
import { InteractionsService } from './interactions.service';
import { PlayCountService } from './play-count.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  controllers: [InteractionsController],
  providers: [InteractionsService, PlayCountService, PinoLoggerService],
})
export class InteractionsModule {}
