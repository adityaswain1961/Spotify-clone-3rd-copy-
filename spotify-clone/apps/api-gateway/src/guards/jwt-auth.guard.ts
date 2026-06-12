import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export interface GatewayUser {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: GatewayUser;
    }>();
    const authHeader = request.headers.authorization;
    const token = this.extractBearerToken(authHeader);
    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      const payload = this.jwtService.verify<GatewayUser>(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  validateToken(token: string): GatewayUser {
    return this.jwtService.verify<GatewayUser>(token, {
      secret: process.env.JWT_ACCESS_SECRET,
    });
  }

  private extractBearerToken(authHeader?: string): string | null {
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.slice(7).trim();
  }
}
