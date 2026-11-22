import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATION_QUEUE } from '@spotify/bull-config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenStore } from './refresh-token.store';

@Module({
  imports: [JwtModule.register({}), BullModule.registerQueue({ name: NOTIFICATION_QUEUE })],
  controllers: [AuthController],
  providers: [AuthService, RefreshTokenStore],
})
export class AuthModule {}
