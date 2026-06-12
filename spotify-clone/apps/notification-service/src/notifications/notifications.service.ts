import { Injectable } from '@nestjs/common';
import { PrismaService } from '@spotify/prisma';
import { FirebaseService } from './firebase.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly firebaseService: FirebaseService,
  ) {}

  async onUserRegistered(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fcmToken: true },
    });
    if (!user?.fcmToken) return;

    await this.firebaseService.sendToTokens(
      [user.fcmToken],
      'Welcome to Spotify Clone',
      'Your account is ready. Start listening now.',
    );
  }

  async onSongPublished(artistId: string, songId: string): Promise<void> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: { stageName: true },
    });
    const followers = await this.prisma.artistFollow.findMany({
      where: { artistId },
      select: {
        user: {
          select: { fcmToken: true },
        },
      },
    });
    const tokens = followers
      .map((f) => f.user.fcmToken)
      .filter((t): t is string => Boolean(t));

    if (!tokens.length) return;

    await this.firebaseService.sendToTokens(
      tokens,
      'New Track Released',
      `New track from ${artist?.stageName ?? 'your followed artist'}!`,
    );
  }

  async onArtistFollowed(artistId: string, followerId: string): Promise<void> {
    const artist = await this.prisma.artist.findUnique({
      where: { id: artistId },
      select: {
        user: { select: { fcmToken: true } },
      },
    });
    const follower = await this.prisma.userProfile.findUnique({
      where: { userId: followerId },
      select: { displayName: true },
    });

    const token = artist?.user.fcmToken;
    if (!token) return;

    await this.firebaseService.sendToTokens(
      [token],
      'New Follower',
      `${follower?.displayName ?? 'Someone'} started following you`,
    );
  }
}

