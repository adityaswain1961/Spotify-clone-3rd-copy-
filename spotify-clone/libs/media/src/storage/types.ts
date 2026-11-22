/** Logical buckets. Each driver maps them to real locations. */
export type BucketName = 'uploads' | 'media';

export interface PutOptions {
  contentType: string;
  cacheControl?: string;
}

export interface ObjectStorage {
  readonly driver: 'local' | 's3';
  /** Upload a local file. Resolves with its size in bytes. */
  putFile(bucket: BucketName, key: string, filePath: string, options: PutOptions): Promise<number>;
  downloadToFile(bucket: BucketName, key: string, destination: string): Promise<void>;
  delete(bucket: BucketName, key: string): Promise<void>;
  /** A URL the client can GET without other credentials until it expires. May be gateway-relative. */
  signedGetUrl(bucket: BucketName, key: string, ttlSeconds: number): Promise<string>;
  /** A URL the client can PUT the raw file body to. May be gateway-relative. */
  signedPutUrl(bucket: BucketName, key: string, contentType: string, ttlSeconds: number): Promise<string>;
}

/** Media objects are content-addressed by song id and never change, so CDNs and devices may cache forever. */
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
