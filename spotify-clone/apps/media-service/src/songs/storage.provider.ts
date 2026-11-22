import { createStorage } from '@spotify/media';

export const STORAGE = Symbol('STORAGE');

export const storageProvider = { provide: STORAGE, useFactory: createStorage };
