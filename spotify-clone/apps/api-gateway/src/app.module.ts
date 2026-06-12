import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { RouteProxyModule } from './proxies/route-proxy.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RequestIdMiddleware } from './middleware/request-id.middleware';
import { HealthController } from './health.controller';
import { PinoLoggerService } from '@spotify/common';

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    RouteProxyModule,
  ],
  controllers: [HealthController],
  providers: [
    PinoLoggerService,
    JwtAuthGuard,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
