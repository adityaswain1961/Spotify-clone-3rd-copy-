import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { PinoLoggerService } from '@spotify/common';
import { NotificationProcessor } from './notification.processor';
import { NotificationsService } from './notifications.service';
import { FirebaseService } from './firebase.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  providers: [NotificationProcessor, NotificationsService, FirebaseService, PinoLoggerService],
})
export class NotificationsModule {}
