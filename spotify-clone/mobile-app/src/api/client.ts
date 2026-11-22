import { API_URL } from './config';

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the server could not be reached at all. */
    readonly status: number,
    readonly requestId: string | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.isNetworkError;
}

interface AuthHooks {
  /** Current access token, refreshed first if it is about to expire. */
  getAccessToken(): Promise<string | null>;
  /** Force a refresh after a 401. Resolves null when the session is gone. */
  refreshAccessToken(): Promise<string | null>;
}

let authHooks: AuthHooks | null = null;

/** Registered by the session store; keeps this module free of circular imports. */
export function configureAuth(hooks: AuthHooks): void {
  authHooks = hooks;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token (default true). */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const DEFAULT_TIMEOUT_MS = 15_000;

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const forwardAbort = () => controller.abort();
  options.signal?.addEventListener('abort', forwardAbort);

  try {
    return await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error; // caller cancelled (e.g. React Query) - not a network failure
    throw new ApiError(controller.signal.aborted ? 'The server took too long to respond' : "Can't reach the server", 0);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', forwardAbort);
  }
}

async function parse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const message = Array.isArray(json?.message) ? json.message[0] : json?.message;
    throw new ApiError(message ?? `Request failed (${response.status})`, response.status, json?.requestId ?? null);
  }
  // Services wrap payloads as { data, meta }; the gateway's own routes don't.
  if (json && typeof json === 'object' && 'data' in json && 'meta' in json) {
    return json.data as T;
  }
  return json as T;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth !== false && authHooks !== null;
  let token = withAuth ? await authHooks!.getAccessToken() : null;
  let response = await send(path, options, token);

  if (response.status === 401 && withAuth) {
    token = await authHooks!.refreshAccessToken();
    if (token) response = await send(path, options, token);
  }
  return parse<T>(response);
}
