import { Module } from '@nestjs/common';
import { PrismaModule } from '@spotify/prisma';
import { BullConfigModule } from '@spotify/bull-config';
import { PinoLoggerService } from '@spotify/common';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [PrismaModule, BullConfigModule, NotificationsModule],
  providers: [PinoLoggerService],
})
export class AppModule {}

