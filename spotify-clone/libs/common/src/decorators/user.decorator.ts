import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

/** Headers the API gateway sets after verifying the access token. Never trust them from clients. */
export const USER_ID_HEADER = 'x-user-id';
export const USER_ROLE_HEADER = 'x-user-role';

/**
 * Injects the authenticated user id forwarded by the gateway.
 * `@UserId()` throws 401 when missing; `@UserId({ optional: true })` returns undefined instead.
 */
export const UserId = createParamDecorator(
  (options: { optional?: boolean } | undefined, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const userId = request.header(USER_ID_HEADER);
    if (!userId && !options?.optional) {
      throw new UnauthorizedException('Authentication required');
    }
    return userId || undefined;
  },
);

export const UserRole = createParamDecorator((_: unknown, ctx: ExecutionContext): string | undefined => {
  return ctx.switchToHttp().getRequest<Request>().header(USER_ROLE_HEADER) || undefined;
});
