import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '@spotify/prisma';
import { HealthController, PinoLoggerService, RedisModule } from '@spotify/common';
import { PlaylistsModule } from './playlists/playlists.module';

@Module({
  imports: [PrismaModule, RedisModule, TerminusModule, PlaylistsModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
