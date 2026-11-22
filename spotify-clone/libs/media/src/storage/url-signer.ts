import { createHmac, timingSafeEqual } from 'crypto';
import type { BucketName } from './types';

let warned = false;

function signingSecret(): string {
  const secret = process.env.STORAGE_SIGNING_SECRET ?? process.env.SERVICE_API_KEY;
  if (secret) return secret;
  if (!warned) {
    warned = true;
    console.warn('[storage] STORAGE_SIGNING_SECRET is not set; using an insecure development secret');
  }
  return 'insecure-dev-signing-secret';
}

function signature(method: string, bucket: BucketName, key: string, expires: number): string {
  return createHmac('sha256', signingSecret())
    .update(`${method.toUpperCase()}\n${bucket}\n${key}\n${expires}`)
    .digest('base64url');
}

/** Encode each path segment but keep the slashes, so keys stay readable in URLs. */
export function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export function signLocalUrl(
  base: string,
  method: 'GET' | 'PUT',
  bucket: BucketName,
  key: string,
  ttlSeconds: number,
): string {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = signature(method, bucket, key, expires);
  return `${base}/${bucket}/${encodeKey(key)}?exp=${expires}&sig=${sig}`;
}

export function verifyLocalSignature(
  method: string,
  bucket: BucketName,
  key: string,
  expires: string | undefined,
  sig: string | undefined,
): boolean {
  const exp = Number(expires);
  if (!sig || !Number.isFinite(exp) || exp < Date.now() / 1000) return false;
  const expected = Buffer.from(signature(method, bucket, key, exp));
  const provided = Buffer.from(sig);
  return expected.length === provided.length && timingSafeEqual(expected, provided);
}
