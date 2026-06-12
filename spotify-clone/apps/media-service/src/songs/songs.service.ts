import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '@spotify/prisma';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATION_QUEUE, TRANSCODING_QUEUE } from '@spotify/bull-config';
import { SongMetadataDto } from './dto/song-metadata.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { randomUUID } from 'crypto';
import { S3Service } from './s3.service';
import { CloudFrontService } from './cloudfront.service';

@Injectable()
export class SongsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly cloudfrontService: CloudFrontService,
    @InjectQueue(TRANSCODING_QUEUE) private readonly transcodingQueue: Queue,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async createUploadUrl(
    dto: UploadUrlDto,
    userId?: string,
    role?: string,
  ): Promise<{ uploadUrl: string; s3Key: string }> {
    this.assertArtistRole(userId, role);
    const s3Key = `raw/${userId}/${Date.now()}-${randomUUID()}-${dto.filename}`;
    const uploadUrl = await this.s3Service.createUploadUrl(s3Key, dto.contentType);
    return { uploadUrl, s3Key };
  }

  async createMetadata(
    dto: SongMetadataDto,
    userId?: string,
    role?: string,
  ): Promise<{ songId: string }> {
    this.assertArtistRole(userId, role);
    const artist = await this.prisma.artist.findUnique({ where: { userId: userId! } });
    if (!artist) {
      throw new NotFoundException('Artist profile not found');
    }

    const song = await this.prisma.song.create({
      data: {
        title: dto.title,
        duration: dto.duration,
        artistId: artist.id,
        albumId: dto.albumId,
        genres: dto.genres,
        tags: dto.tags,
        coverImageKey: dto.coverImageKey,
        isPublished: false,
        hlsManifestKey: '',
      },
      select: { id: true, artistId: true },
    });

    await this.transcodingQueue.add(
      'song.transcode',
      { songId: song.id, s3Key: dto.s3Key },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
      },
    );

    return { songId: song.id };
  }

  async getStreamUrl(id: string): Promise<{ streamUrl: string }> {
    const song = await this.prisma.song.findUnique({
      where: { id },
      select: { hlsManifestKey: true, isPublished: true },
    });

    if (!song) {
      throw new NotFoundException('Song not found');
    }
    if (!song.isPublished) {
      throw new ForbiddenException('Song is not published yet');
    }

    return { streamUrl: this.cloudfrontService.createSignedStreamUrl(song.hlsManifestKey) };
  }

  async getSong(id: string) {
    const song = await this.prisma.song.findUnique({
      where: { id },
      include: {
        artist: {
          select: { id: true, stageName: true },
        },
      },
    });
    if (!song) {
      throw new NotFoundException('Song not found');
    }
    return song;
  }

  async publishSongNotification(artistId: string, songId: string): Promise<void> {
    await this.notificationQueue.add(
      'song.published',
      { event: 'song.published', artistId, songId },
      { removeOnComplete: true, attempts: 3 },
    );
  }

  private assertArtistRole(userId?: string, role?: string): void {
    if (!userId) {
      throw new UnauthorizedException('Missing X-User-Id');
    }
    if (role !== 'ARTIST') {
      throw new ForbiddenException('Only ARTIST role can upload songs');
    }
  }
}
