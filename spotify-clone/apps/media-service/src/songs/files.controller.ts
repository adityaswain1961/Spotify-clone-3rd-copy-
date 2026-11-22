import { createWriteStream } from 'fs';
import { mkdir, rename, rm } from 'fs/promises';
import { dirname } from 'path';
import { pipeline } from 'stream/promises';
import {
  Controller,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { envInt } from '@spotify/common';
import { AUDIO_MIME_TYPE, BucketName, LocalStorage, ObjectStorage, verifyLocalSignature } from '@spotify/media';
import { STORAGE } from './storage.provider';

const BUCKETS: readonly BucketName[] = ['uploads', 'media'];
const PUBLIC_ASSET_PREFIXES = ['covers/', 'avatars/'];

/** Express 5 returns `*wildcard` params as an array of path segments. */
function joinKey(value: string | string[]): string {
  return Array.isArray(value) ? value.join('/') : value;
}

const CONTENT_TYPES: Record<string, string> = {
  '.m4a': AUDIO_MIME_TYPE,
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function contentTypeFor(key: string): string | undefined {
  const dot = key.lastIndexOf('.');
  return dot === -1 ? undefined : CONTENT_TYPES[key.slice(dot).toLowerCase()];
}

/**
 * Object delivery for the local storage driver (dev / single-box deployments).
 * With the S3 driver, clients receive S3/CloudFront URLs and only /assets is used here.
 */
@Controller('songs')
export class FilesController {
  private readonly maxUploadBytes = envInt('MAX_UPLOAD_MB', 200) * 1024 * 1024;

  constructor(@Inject(STORAGE) private readonly storage: ObjectStorage) {}

  /** Signed, byte-range capable audio delivery. Players seek with Range requests. */
  @Get('files/:bucket/*key')
  serveFile(
    @Param('bucket') bucket: string,
    @Param('key') rawKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Res() res: Response,
  ): void {
    const local = this.localStorage();
    const key = joinKey(rawKey);
    if (!BUCKETS.includes(bucket as BucketName) || !verifyLocalSignature('GET', bucket as BucketName, key, exp, sig)) {
      throw new ForbiddenException('Invalid or expired media URL');
    }
    this.send(res, local.pathFor(bucket as BucketName, key), key, 'private, max-age=86400');
  }

  /** Signed upload target for the local driver (mirrors an S3 presigned PUT). */
  @Put('files/:bucket/*key')
  async receiveFile(
    @Param('bucket') bucket: string,
    @Param('key') rawKey: string | string[],
    @Query('exp') exp: string | undefined,
    @Query('sig') sig: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const local = this.localStorage();
    const key = joinKey(rawKey);
    if (bucket !== 'uploads' || !verifyLocalSignature('PUT', 'uploads', key, exp, sig)) {
      throw new ForbiddenException('Invalid or expired upload URL');
    }
    if (Number(req.header('content-length') ?? 0) > this.maxUploadBytes) {
      throw new PayloadTooLargeException(`Uploads are limited to ${this.maxUploadBytes / 1024 / 1024} MB`);
    }

    const target = local.pathFor('uploads', key);
    const partial = `${target}.part`;
    await mkdir(dirname(target), { recursive: true });
    let received = 0;
    req.on('data', (chunk: Buffer) => {
      received += chunk.length;
      if (received > this.maxUploadBytes) req.destroy(new PayloadTooLargeException('Upload too large'));
    });
    try {
      await pipeline(req, createWriteStream(partial));
      await rename(partial, target);
    } catch (error) {
      await rm(partial, { force: true });
      throw error;
    }
    res.status(200).json({ data: { uploadKey: key, bytes: received } });
  }

  /** Public, immutable images (covers). Cached forever by devices and CDNs. */
  @Get('assets/*key')
  async serveAsset(@Param('key') rawKey: string | string[], @Res() res: Response): Promise<void> {
    const key = joinKey(rawKey);
    if (!PUBLIC_ASSET_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      throw new NotFoundException();
    }
    if (this.storage instanceof LocalStorage) {
      this.send(res, this.storage.pathFor('media', key), key, 'public, max-age=31536000, immutable');
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.redirect(302, await this.storage.signedGetUrl('media', key, 24 * 60 * 60));
  }

  private localStorage(): LocalStorage {
    if (!(this.storage instanceof LocalStorage)) {
      throw new NotFoundException('Direct file delivery is only enabled for STORAGE_DRIVER=local');
    }
    return this.storage;
  }

  private send(res: Response, path: string, key: string, cacheControl: string): void {
    const type = contentTypeFor(key);
    if (type) res.type(type);
    res.sendFile(path, { acceptRanges: true, cacheControl: false, headers: { 'Cache-Control': cacheControl } }, (error) => {
      if (error && !res.headersSent) {
        res.status(404).json({ statusCode: 404, message: 'File not found' });
      }
    });
  }
}
