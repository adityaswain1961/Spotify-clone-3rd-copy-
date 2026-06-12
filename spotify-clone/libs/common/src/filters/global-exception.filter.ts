import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorPayload = isHttpException ? exception.getResponse() : null;
    const message =
      typeof errorPayload === 'object' &&
      errorPayload !== null &&
      'message' in errorPayload
        ? (errorPayload.message as string | string[])
        : isHttpException
          ? exception.message
          : 'Internal server error';

    const requestId = request.headers['x-request-id'];

    response.status(statusCode).json({
      statusCode,
      message,
      requestId: typeof requestId === 'string' ? requestId : null,
    });
  }
}
