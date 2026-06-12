import { Injectable } from '@nestjs/common';
import { PrismaService } from '@spotify/prisma';
import { S3Service } from '../songs/s3.service';
import { SongsService } from '../songs/songs.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';

ffmpeg.setFfmpegPath(ffmpegPath as string);

@Injectable()
export class TranscodingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly songsService: SongsService,
  ) {}

  async processSong(jobData: { songId: string; s3Key: string }): Promise<void> {
    const { songId, s3Key } = jobData;
    const uploadBucket = process.env.S3_UPLOAD_BUCKET ?? '';
    const hlsBucket = process.env.S3_HLS_BUCKET ?? '';

    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `song-${songId}-`));
    const inputFile = path.join(tempDir, 'input-audio');
    const outputDir = path.join(tempDir, 'hls');
    await fs.mkdir(outputDir, { recursive: true });

    try {
      const object = await this.s3Service.getObject(uploadBucket, s3Key);
      const bytes = await object.Body?.transformToByteArray();
      if (!bytes) {
        throw new Error(`Failed to download source audio for ${songId}`);
      }
      await fs.writeFile(inputFile, Buffer.from(bytes));

      await this.generateHls(inputFile, outputDir);
      const files = await fs.readdir(outputDir);

      await Promise.all(
        files.map(async (fileName) => {
          const content = await fs.readFile(path.join(outputDir, fileName));
          await this.s3Service.putObject(hlsBucket, `songs/${songId}/${fileName}`, content);
        }),
      );

      const song = await this.prisma.song.update({
        where: { id: songId },
        data: {
          hlsManifestKey: `songs/${songId}/master.m3u8`,
          isPublished: true,
        },
        select: {
          artistId: true,
        },
      });

      await this.s3Service.deleteObject(uploadBucket, s3Key);
      await this.songsService.publishSongNotification(song.artistId, songId);
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private async generateHls(inputFile: string, outputDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg(inputFile)
        .outputOptions([
          '-preset veryfast',
          '-g 48',
          '-sc_threshold 0',
          '-map 0:a',
          '-c:a aac',
          '-b:a:0 128k',
          '-b:a:1 256k',
          '-b:a:2 320k',
          '-f hls',
          '-hls_time 6',
          '-hls_playlist_type vod',
          '-hls_flags independent_segments',
          '-master_pl_name master.m3u8',
          '-var_stream_map a:0 a:1 a:2',
          '-hls_segment_filename ' + path.join(outputDir, 'v%v_seg_%03d.ts'),
        ])
        .output(path.join(outputDir, 'v%v.m3u8'))
        .on('end', () => resolve())
        .on('error', (error) => reject(error))
        .run();
    });
  }
}
