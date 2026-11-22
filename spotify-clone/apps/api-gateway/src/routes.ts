export interface ServiceRoute {
  prefix: string;
  target: string;
  /** Upstream timeout. Media uploads/streams need much longer than JSON calls. */
  timeoutMs: number;
}

const local = (port: number) => `http://127.0.0.1:${port}`;

export function serviceRoutes(): ServiceRoute[] {
  const env = process.env;
  return [
    { prefix: '/auth', target: env.AUTH_SERVICE_URL ?? local(3001), timeoutMs: 15_000 },
    { prefix: '/songs', target: env.MEDIA_SERVICE_URL ?? local(3003), timeoutMs: 300_000 },
    { prefix: '/playlists', target: env.PLAYLIST_SERVICE_URL ?? local(3004), timeoutMs: 15_000 },
    { prefix: '/interactions', target: env.INTERACTION_SERVICE_URL ?? local(3005), timeoutMs: 15_000 },
    { prefix: '/search', target: env.SEARCH_SERVICE_URL ?? local(3006), timeoutMs: 15_000 },
    { prefix: '/recommendations', target: env.RECOMMENDATION_SERVICE_URL ?? local(3007), timeoutMs: 15_000 },
  ];
}

/**
 * Routes reachable without an access token. Everything else requires one.
 * A valid token on a public route is still forwarded, so services can personalise.
 */
const PUBLIC_ROUTES: Array<[method: string, pattern: RegExp]> = [
  ['POST', /^\/auth\/(login|register|refresh|logout)$/],
  ['GET', /^\/search\/?$/],
  ['GET', /^\/songs\/?$/],
  ['GET', /^\/songs\/[^/]+$/],
  ['GET', /^\/recommendations\/trending$/],
  ['GET', /^\/playlists\/(?!me$)[^/]+$/],
  // Media files carry their own short-lived HMAC signature (or are public covers).
  ['GET', /^\/songs\/(files|assets)\//],
  ['HEAD', /^\/songs\/(files|assets)\//],
  ['PUT', /^\/songs\/files\//],
  ['GET', /^\/health$/],
];

export function isPublicRoute(method: string, path: string): boolean {
  return PUBLIC_ROUTES.some(([m, pattern]) => m === method && pattern.test(path));
}

/** Byte-range media traffic: excluded from rate limiting and compression. */
export function isMediaFileRoute(path: string): boolean {
  return path.startsWith('/songs/files/') || path.startsWith('/songs/assets/');
}
