import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface TransformResponse<T> {
  data: T;
  meta: {
    timestamp: string;
    path?: string;
  };
}

@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, TransformResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<TransformResponse<T>> {
    const req = context.switchToHttp().getRequest<{ originalUrl?: string }>();

    return next.handle().pipe(
      map((data) => ({
        data,
        meta: {
          timestamp: new Date().toISOString(),
          path: req?.originalUrl,
        },
      })),
    );
  }
}
