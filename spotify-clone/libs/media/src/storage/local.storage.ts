import { copyFile, mkdir, rm, stat } from 'fs/promises';
import { dirname, resolve, sep } from 'path';
import type { BucketName, ObjectStorage, PutOptions } from './types';
import { signLocalUrl } from './url-signer';

/**
 * Stores objects on local disk under STORAGE_LOCAL_DIR (default ./storage).
 * media-service serves them with HTTP Range support at /songs/files/... using
 * short-lived HMAC-signed URLs, so dev needs no S3 / LocalStack at all.
 */
export class LocalStorage implements ObjectStorage {
  readonly driver = 'local' as const;
  readonly root: string;
  private readonly urlBase: string;

  constructor(root = process.env.STORAGE_LOCAL_DIR ?? 'storage', urlBase = '/songs/files') {
    this.root = resolve(root);
    this.urlBase = urlBase;
  }

  /** Absolute path for an object; rejects keys that try to escape the bucket. */
  pathFor(bucket: BucketName, key: string): string {
    const bucketRoot = resolve(this.root, bucket);
    const full = resolve(bucketRoot, key);
    if (!full.startsWith(bucketRoot + sep)) {
      throw new Error(`Invalid object key: ${key}`);
    }
    return full;
  }

  async putFile(bucket: BucketName, key: string, filePath: string, _options: PutOptions): Promise<number> {
    const target = this.pathFor(bucket, key);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(filePath, target);
    return (await stat(target)).size;
  }

  async downloadToFile(bucket: BucketName, key: string, destination: string): Promise<void> {
    await copyFile(this.pathFor(bucket, key), destination);
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    await rm(this.pathFor(bucket, key), { force: true });
  }

  async signedGetUrl(bucket: BucketName, key: string, ttlSeconds: number): Promise<string> {
    return signLocalUrl(this.urlBase, 'GET', bucket, key, ttlSeconds);
  }

  async signedPutUrl(bucket: BucketName, key: string, _contentType: string, ttlSeconds: number): Promise<string> {
    return signLocalUrl(this.urlBase, 'PUT', bucket, key, ttlSeconds);
  }
}
