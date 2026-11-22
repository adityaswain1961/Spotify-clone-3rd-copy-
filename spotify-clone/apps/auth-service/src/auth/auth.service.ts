import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectQueue } from '@nestjs/bullmq';
import { UserRole } from '@prisma/client';
import { Queue } from 'bullmq';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { envInt } from '@spotify/common';
import { PrismaService } from '@spotify/prisma';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenStore } from './refresh-token.store';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  displayName: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds, so clients can refresh before it expires. */
  expiresIn: number;
  user: AuthUser;
}

const userSelect = {
  id: true,
  email: true,
  role: true,
  profile: { select: { displayName: true } },
} as const;

type UserRow = { id: string; email: string; role: UserRole; profile: { displayName: string } | null };

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    displayName: user.profile?.displayName ?? user.email.split('@')[0],
  };
}

@Injectable()
export class AuthService {
  private readonly accessTtlSeconds = envInt('ACCESS_TOKEN_TTL_SECONDS', 15 * 60);
  /** Compared against when the email is unknown, so response time doesn't reveal which emails exist. */
  private readonly dummyHash = bcrypt.hash(randomUUID(), 12);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly refreshTokens: RefreshTokenStore,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSession> {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email }, select: { id: true } });
    if (exists) {
      throw new ConflictException('Email is already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role ?? UserRole.LISTENER,
        profile: { create: { displayName: dto.displayName } },
        ...(dto.role === UserRole.ARTIST ? { artist: { create: { stageName: dto.displayName } } } : {}),
      },
      select: userSelect,
    });

    await this.notificationQueue
      .add('user.registered', { event: 'user.registered', userId: user.id }, { removeOnComplete: true, attempts: 3 })
      .catch(() => undefined); // a notification hiccup must never block sign-up

    return this.createSession(toAuthUser(user));
  }

  async login(dto: LoginDto): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { ...userSelect, passwordHash: true },
    });

    const valid = await bcrypt.compare(dto.password, user?.passwordHash ?? (await this.dummyHash));
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.createSession(toAuthUser(user));
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const userId = await this.refreshTokens.consume(refreshToken);
    if (!userId) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }
    return this.createSession(toAuthUser(user));
  }

  async logout(refreshToken: string): Promise<{ success: true }> {
    await this.refreshTokens.revoke(refreshToken);
    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return toAuthUser(user);
  }

  private async createSession(user: AuthUser): Promise<AuthSession> {
    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, role: user.role },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: this.accessTtlSeconds },
    );
    const refreshToken = randomUUID();
    await this.refreshTokens.save(refreshToken, user.id);
    return { accessToken, refreshToken, expiresIn: this.accessTtlSeconds, user };
  }
}
