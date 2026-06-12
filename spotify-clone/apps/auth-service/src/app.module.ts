import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '@spotify/prisma';
import { BullConfigModule } from '@spotify/bull-config';
import { AuthModule } from './auth/auth.module';
import { HealthController, PinoLoggerService } from '@spotify/common';
import { RedisModule } from './redis.module';

@Module({
  imports: [PrismaModule, BullConfigModule, RedisModule, TerminusModule, AuthModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
