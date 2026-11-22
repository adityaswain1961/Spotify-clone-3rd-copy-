import { createReadStream, createWriteStream } from 'fs';
import { stat } from 'fs/promises';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from '@aws-sdk/client-s3';
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner';
import { getSignedUrl as cloudfrontSign } from '@aws-sdk/cloudfront-signer';
import type { BucketName, ObjectStorage, PutOptions } from './types';

function clientConfig(endpoint: string | undefined): S3ClientConfig {
  const { AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  return {
    region: process.env.AWS_REGION ?? 'us-east-1',
    endpoint,
    forcePathStyle: Boolean(endpoint) || process.env.S3_FORCE_PATH_STYLE === 'true',
    // Fall back to the default provider chain (IAM role, profile) when keys are not set.
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  };
}

interface CloudFrontConfig {
  domain: string;
  keyPairId: string;
  privateKey: string;
}

function cloudFrontConfig(): CloudFrontConfig | null {
  const domain = process.env.CLOUDFRONT_DOMAIN;
  const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
  const privateKey = process.env.CLOUDFRONT_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!domain || !keyPairId || !privateKey?.includes('PRIVATE KEY') || privateKey.includes('...')) {
    return null;
  }
  return { domain: domain.replace(/^https?:\/\//, '').replace(/\/$/, ''), keyPairId, privateKey };
}

/**
 * S3 driver. Media GETs are signed through CloudFront when it is configured (edge-cached,
 * one signed URL per file works because each rendition is a single object), otherwise
 * they are S3 presigned URLs. S3_ENDPOINT / S3_PUBLIC_ENDPOINT support MinIO and similar.
 */
export class S3Storage implements ObjectStorage {
  readonly driver = 's3' as const;
  private readonly client = new S3Client(clientConfig(process.env.S3_ENDPOINT));
  // Presigned URLs must use a host the phone can reach, which may differ from the internal one.
  private readonly presignClient = process.env.S3_PUBLIC_ENDPOINT
    ? new S3Client(clientConfig(process.env.S3_PUBLIC_ENDPOINT))
    : this.client;
  private readonly cloudFront = cloudFrontConfig();

  private bucket(name: BucketName): string {
    const bucket =
      name === 'uploads'
        ? process.env.S3_UPLOAD_BUCKET
        : (process.env.S3_MEDIA_BUCKET ?? process.env.S3_HLS_BUCKET);
    if (!bucket) {
      throw new Error(`S3 bucket for "${name}" is not configured (S3_UPLOAD_BUCKET / S3_MEDIA_BUCKET)`);
    }
    return bucket;
  }

  async putFile(bucket: BucketName, key: string, filePath: string, options: PutOptions): Promise<number> {
    const { size } = await stat(filePath);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket(bucket),
        Key: key,
        Body: createReadStream(filePath),
        ContentLength: size,
        ContentType: options.contentType,
        CacheControl: options.cacheControl,
      }),
    );
    return size;
  }

  async downloadToFile(bucket: BucketName, key: string, destination: string): Promise<void> {
    const object = await this.client.send(new GetObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
    if (!(object.Body instanceof Readable)) {
      throw new Error(`Empty body for s3://${this.bucket(bucket)}/${key}`);
    }
    await pipeline(object.Body, createWriteStream(destination));
  }

  async delete(bucket: BucketName, key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket(bucket), Key: key }));
  }

  async signedGetUrl(bucket: BucketName, key: string, ttlSeconds: number): Promise<string> {
    if (bucket === 'media' && this.cloudFront) {
      return cloudfrontSign({
        url: `https://${this.cloudFront.domain}/${key}`,
        keyPairId: this.cloudFront.keyPairId,
        privateKey: this.cloudFront.privateKey,
        dateLessThan: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      });
    }
    return presign(this.presignClient, new GetObjectCommand({ Bucket: this.bucket(bucket), Key: key }), {
      expiresIn: ttlSeconds,
    });
  }

  async signedPutUrl(bucket: BucketName, key: string, contentType: string, ttlSeconds: number): Promise<string> {
    return presign(
      this.presignClient,
      new PutObjectCommand({ Bucket: this.bucket(bucket), Key: key, ContentType: contentType }),
      { expiresIn: ttlSeconds },
    );
  }
}
