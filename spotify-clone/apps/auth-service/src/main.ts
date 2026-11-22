import '@spotify/env';
import 'reflect-metadata';
import { bootstrapService, requireEnv } from '@spotify/common';
import { AppModule } from './app.module';

requireEnv('JWT_ACCESS_SECRET');
void bootstrapService(AppModule, { name: 'auth-service', port: 3001 });
