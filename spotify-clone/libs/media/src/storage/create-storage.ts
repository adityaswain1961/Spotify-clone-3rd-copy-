import { LocalStorage } from './local.storage';
import { S3Storage } from './s3.storage';
import type { ObjectStorage } from './types';

/** STORAGE_DRIVER=local (default, zero setup) or s3 (production). */
export function createStorage(): ObjectStorage {
  const driver = (process.env.STORAGE_DRIVER ?? 'local').toLowerCase();
  if (driver === 's3') return new S3Storage();
  if (driver === 'local') return new LocalStorage();
  throw new Error(`Unknown STORAGE_DRIVER "${driver}" (expected "local" or "s3")`);
}
