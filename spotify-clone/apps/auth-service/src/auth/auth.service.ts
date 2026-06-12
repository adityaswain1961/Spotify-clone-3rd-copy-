import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { PrismaService } from '@spotify/prisma';
import * as bcrypt from 'bcrypt';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { randomUUID } from 'crypto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenBlacklistService } from './token-blacklist.service';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly tokenBlacklistService: TokenBlacklistService,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role ?? UserRole.LISTENER,
        profile: {
          create: {
            displayName: dto.displayName,
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await this.notificationQueue.add(
      'user.registered',
      { event: 'user.registered', userId: user.id },
      { removeOnComplete: true, attempts: 3 },
    );

    return this.issueTokens(user.id, user.email, user.role);
  }

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        role: true,
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueTokens(user.id, user.email, user.role);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const userId = await this.tokenBlacklistService.getRefreshTokenUserId(refreshToken);
    if (!userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found for refresh token');
    }

    await this.tokenBlacklistService.revokeRefreshToken(refreshToken);
    return this.issueTokens(user.id, user.email, user.role);
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    await this.tokenBlacklistService.revokeRefreshToken(refreshToken);
    return { success: true };
  }

  async validateToken(accessToken: string): Promise<{ valid: boolean; payload?: unknown }> {
    try {
      const payload = await this.jwtService.verifyAsync(accessToken, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      return { valid: true, payload };
    } catch {
      return { valid: false };
    }
  }

  private async issueTokens(userId: string, email: string, role: UserRole): Promise<AuthTokens> {
    const accessToken = await this.jwtService.signAsync(
      { sub: userId, email, role },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: '15m',
      },
    );

    const refreshToken = randomUUID();
    await this.tokenBlacklistService.setRefreshToken(refreshToken, userId);

    return { accessToken, refreshToken };
  }
}
