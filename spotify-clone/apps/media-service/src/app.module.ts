import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '@spotify/prisma';
import { BullConfigModule } from '@spotify/bull-config';
import { HealthController, PinoLoggerService, RedisModule } from '@spotify/common';
import { SongsModule } from './songs/songs.module';

@Module({
  imports: [PrismaModule, BullConfigModule, RedisModule, TerminusModule, SongsModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
