import { Injectable } from '@nestjs/common';
import { getSignedUrl } from '@aws-sdk/cloudfront-signer';

@Injectable()
export class CloudFrontService {
  createSignedStreamUrl(key: string): string {
    const domain = process.env.CLOUDFRONT_DOMAIN ?? '';
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID ?? '';
    const privateKey = (process.env.CLOUDFRONT_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

    const url = `https://${domain}/${key}`;

    return getSignedUrl({
      url,
      keyPairId,
      privateKey,
      dateLessThan: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });
  }
}
