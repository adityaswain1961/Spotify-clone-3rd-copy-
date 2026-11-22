import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { TRANSCODING_QUEUE } from '@spotify/bull-config';
import { envInt } from '@spotify/common';
import { AUDIO_MIME_TYPE, AudioQuality, ObjectStorage } from '@spotify/media';
import { hydrateSongs, PrismaService, SongDto } from '@spotify/prisma';
import { SongMetadataDto } from './dto/song-metadata.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import { STORAGE } from './storage.provider';

export interface MediaUrlDto {
  songId: string;
  quality: AudioQuality;
  url: string;
  mimeType: string;
  sizeBytes: number | null;
  /** ISO time after which the URL stops working. Clients cache the URL until shortly before this. */
  expiresAt: string;
}

export interface TranscodeJob {
  songId: string;
  uploadKey: string;
}

const audioSelect = {
  id: true,
  isPublished: true,
  audioLowKey: true,
  audioHighKey: true,
  audioLowBytes: true,
  audioHighBytes: true,
} as const;

type AudioRow = {
  id: string;
  isPublished: boolean;
  audioLowKey: string | null;
  audioHighKey: string | null;
  audioLowBytes: number | null;
  audioHighBytes: number | null;
};

@Injectable()
export class SongsService {
  private readonly streamTtl = envInt('STREAM_URL_TTL_SECONDS', 6 * 60 * 60);
  private readonly downloadTtl = envInt('DOWNLOAD_URL_TTL_SECONDS', 30 * 60);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE) private readonly storage: ObjectStorage,
    @InjectQueue(TRANSCODING_QUEUE) private readonly transcodingQueue: Queue<TranscodeJob>,
  ) {}

  async getSong(id: string): Promise<SongDto> {
    const [song] = await hydrateSongs(this.prisma, [id]);
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }

  getSongs(ids: string[]): Promise<SongDto[]> {
    return hydrateSongs(this.prisma, ids);
  }

  async getMediaUrl(id: string, quality: AudioQuality, purpose: 'stream' | 'download'): Promise<MediaUrlDto> {
    const song = await this.prisma.song.findUnique({ where: { id }, select: audioSelect });
    if (!song) throw new NotFoundException('Song not found');
    const url = await this.signRendition(song, quality, purpose === 'stream' ? this.streamTtl : this.downloadTtl);
    if (!url) throw new ForbiddenException('Song is still processing');
    return url;
  }

  /** Sign URLs for a whole queue in one round-trip. Unplayable ids are skipped. */
  async getStreamUrls(ids: string[], quality: AudioQuality): Promise<{ items: MediaUrlDto[] }> {
    const rows = await this.prisma.song.findMany({ where: { id: { in: ids } }, select: audioSelect });
    const signed = await Promise.all(rows.map((row) => this.signRendition(row, quality, this.streamTtl)));
    return { items: signed.filter((item): item is MediaUrlDto => item !== null) };
  }

  async createUploadUrl(dto: UploadUrlDto, userId: string, role?: string) {
    this.assertArtist(role);
    const extension = extname(dto.filename).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 6);
    const uploadKey = `raw/${userId}/${randomUUID()}${extension}`;
    const uploadUrl = await this.storage.signedPutUrl('uploads', uploadKey, dto.contentType, 15 * 60);
    return { uploadUrl, uploadKey, method: 'PUT', headers: { 'Content-Type': dto.contentType } };
  }

  async createMetadata(dto: SongMetadataDto, userId: string, role?: string): Promise<{ songId: string }> {
    this.assertArtist(role);
    if (!dto.uploadKey.startsWith(`raw/${userId}/`)) {
      throw new BadRequestException('uploadKey does not belong to this artist');
    }
    const artist = await this.prisma.artist.findUnique({ where: { userId }, select: { id: true } });
    if (!artist) throw new NotFoundException('Artist profile not found');

    const song = await this.prisma.song.create({
      data: {
        title: dto.title,
        duration: dto.duration ?? 0,
        artistId: artist.id,
        albumId: dto.albumId,
        genres: dto.genres ?? [],
        tags: dto.tags ?? [],
        coverImageKey: dto.coverImageKey,
        isPublished: false,
      },
      select: { id: true },
    });

    await this.transcodingQueue.add(
      'song.transcode',
      { songId: song.id, uploadKey: dto.uploadKey },
      { jobId: song.id, attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true },
    );
    return { songId: song.id };
  }

  private async signRendition(row: AudioRow, requested: AudioQuality, ttlSeconds: number): Promise<MediaUrlDto | null> {
    if (!row.isPublished) return null;
    // Fall back to the other rendition if the requested one is missing.
    const order: AudioQuality[] = requested === 'low' ? ['low', 'high'] : ['high', 'low'];
    for (const quality of order) {
      const key = quality === 'low' ? row.audioLowKey : row.audioHighKey;
      if (!key) continue;
      return {
        songId: row.id,
        quality,
        url: await this.storage.signedGetUrl('media', key, ttlSeconds),
        mimeType: AUDIO_MIME_TYPE,
        sizeBytes: quality === 'low' ? row.audioLowBytes : row.audioHighBytes,
        expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      };
    }
    return null;
  }

  private assertArtist(role?: string): void {
    if (role !== 'ARTIST') throw new ForbiddenException('Only artists can upload songs');
  }
}
