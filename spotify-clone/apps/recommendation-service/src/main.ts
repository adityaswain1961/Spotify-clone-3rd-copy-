import '@spotify/env';
import 'reflect-metadata';
import { bootstrapService } from '@spotify/common';
import { AppModule } from './app.module';

void bootstrapService(AppModule, { name: 'recommendation-service', port: 3007 });
