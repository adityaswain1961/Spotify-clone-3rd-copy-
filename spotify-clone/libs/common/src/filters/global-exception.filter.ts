import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  LoggerService,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';

/** Map well-known Prisma errors to proper HTTP statuses instead of opaque 500s. */
function fromPrisma(error: Prisma.PrismaClientKnownRequestError): { status: number; message: string } {
  switch (error.code) {
    case 'P2002':
      return { status: HttpStatus.CONFLICT, message: 'Resource already exists' };
    case 'P2003':
      return { status: HttpStatus.NOT_FOUND, message: 'Referenced resource does not exist' };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Resource not found' };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const payload = exception.getResponse();
      message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? (payload.message as string | string[])
          : exception.message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      ({ status: statusCode, message } = fromPrisma(exception));
    }

    if (statusCode >= 500) {
      this.logger?.error('Unhandled error', {
        path: request.originalUrl,
        error: exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      });
    }

    if (response.headersSent) return;

    const requestId = request.headers['x-request-id'];
    response.status(statusCode).json({
      statusCode,
      message,
      requestId: typeof requestId === 'string' ? requestId : null,
    });
  }
}
