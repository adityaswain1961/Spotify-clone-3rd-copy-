/**
 * Side-effect module: import it FIRST in every entrypoint (`import '@spotify/env';`).
 *
 * Nest module decorators (e.g. BullModule.forRoot) read process.env at import time,
 * so the .env file must be loaded before AppModule is imported. Variables already set
 * in the real environment win over the file.
 */
import { existsSync } from 'fs';
import { resolve } from 'path';

const envFile = process.env.ENV_FILE ?? resolve(process.cwd(), '.env');

if (existsSync(envFile) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envFile);
}
