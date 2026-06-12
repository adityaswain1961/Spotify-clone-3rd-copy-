import { AsyncLocalStorage } from 'async_hooks';

export type RequestContextStore = Map<string, string>;

export const requestContext = new AsyncLocalStorage<RequestContextStore>();
