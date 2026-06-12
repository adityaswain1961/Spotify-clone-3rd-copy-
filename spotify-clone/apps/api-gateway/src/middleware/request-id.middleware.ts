import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { requestContext } from '@spotify/common';

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incomingRequestId = req.header('x-request-id');
    const requestId = incomingRequestId ?? randomUUID();

    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    const store = new Map<string, string>();
    store.set('requestId', requestId);

    requestContext.run(store, () => next());
  }
}
