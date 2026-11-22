import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController, PinoLoggerService, RedisModule } from '@spotify/common';
import { PrismaModule } from '@spotify/prisma';
import { SearchModule } from './search/search.module';

@Module({
  imports: [PrismaModule, RedisModule, TerminusModule, SearchModule],
  controllers: [HealthController],
  providers: [PinoLoggerService],
})
export class AppModule {}
