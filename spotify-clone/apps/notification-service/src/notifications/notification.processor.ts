import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { NotificationsService } from './notifications.service';
import { PinoLoggerService } from '@spotify/common';

type NotificationJob =
  | { event: 'user.registered'; userId: string }
  | { event: 'song.published'; artistId: string; songId: string }
  | { event: 'artist.followed'; artistId: string; followerId: string };

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly logger: PinoLoggerService,
  ) {
    super();
  }

  async process(job: Job<NotificationJob>): Promise<void> {
    const data = job.data;
    switch (data.event) {
      case 'user.registered':
        await this.notificationsService.onUserRegistered(data.userId);
        return;
      case 'song.published':
        await this.notificationsService.onSongPublished(data.artistId, data.songId);
        return;
      case 'artist.followed':
        await this.notificationsService.onArtistFollowed(data.artistId, data.followerId);
        return;
      default:
        this.logger.warn('Unknown notification event', { event: (data as { event?: string }).event });
    }
  }
}

