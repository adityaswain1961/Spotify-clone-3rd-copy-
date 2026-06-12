import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string> }>();
    const headerKey = request.headers['x-service-api-key'];
    const expectedKey = process.env.SERVICE_API_KEY;

    if (!expectedKey || headerKey !== expectedKey) {
      throw new ForbiddenException('Invalid service API key');
    }

    return true;
  }
}
