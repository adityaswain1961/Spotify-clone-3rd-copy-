import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenBlacklistService } from './token-blacklist.service';
import { ServiceApiKeyGuard } from '../guards/service-api-key.guard';
import { UserRepository } from '../users/user.repository';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenBlacklistService,
    ServiceApiKeyGuard,
    UserRepository,
  ],
  exports: [AuthService],
})
export class AuthModule {}
