import { Injectable } from '@nestjs/common';
import admin, { ServiceAccount } from 'firebase-admin';
import { PinoLoggerService } from '@spotify/common';

@Injectable()
export class FirebaseService {
  private initialized = false;

  constructor(private readonly logger: PinoLoggerService) {
    this.init();
  }

  private init(): void {
    if (this.initialized) return;

    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!json) {
      this.logger.warn('FIREBASE_SERVICE_ACCOUNT_JSON not set; notifications disabled');
      return;
    }

    try {
      const credentials = JSON.parse(json) as ServiceAccount;
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(credentials),
        });
      }
      this.initialized = true;
    } catch (error) {
      this.logger.error('Failed to initialize firebase-admin', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async sendToTokens(
    tokens: string[],
    title: string,
    body: string,
  ): Promise<{ successCount: number; failureCount: number }> {
    if (!this.initialized || !tokens.length) {
      return { successCount: 0, failureCount: 0 };
    }

    let successCount = 0;
    let failureCount = 0;

    // FCM multicast max 500 tokens per call.
    for (let i = 0; i < tokens.length; i += 500) {
      const batch = tokens.slice(i, i + 500);
      try {
        const response = await admin.messaging().sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
        });
        successCount += response.successCount;
        failureCount += response.failureCount;

        if (response.failureCount > 0) {
          const failedTokens = response.responses
            .map((r, idx) => (r.success ? null : batch[idx]))
            .filter((t): t is string => Boolean(t));
          this.logger.warn('FCM send failures in batch', { failedTokens });
        }
      } catch (error) {
        failureCount += batch.length;
        this.logger.error('FCM batch send failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { successCount, failureCount };
  }
}

