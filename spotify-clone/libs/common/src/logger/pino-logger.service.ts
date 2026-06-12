import { Injectable, LoggerService } from '@nestjs/common';
import pino, { Logger } from 'pino';
import { requestContext } from './request-context';

@Injectable()
export class PinoLoggerService implements LoggerService {
  private readonly logger: Logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  log(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.info(this.withContext({ message, optionalParams }));
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.error(this.withContext({ message, optionalParams }));
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.warn(this.withContext({ message, optionalParams }));
  }

  debug?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.debug(this.withContext({ message, optionalParams }));
  }

  verbose?(message: unknown, ...optionalParams: unknown[]): void {
    this.logger.trace(this.withContext({ message, optionalParams }));
  }

  child(bindings: Record<string, unknown>): Logger {
    return this.logger.child(bindings);
  }

  private withContext(payload: Record<string, unknown>): Record<string, unknown> {
    const store = requestContext.getStore();
    const requestId = store?.get('requestId');

    return {
      requestId: requestId ?? null,
      ...payload,
    };
  }
}
