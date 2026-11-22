# Spotify Clone

A music streaming app: NestJS microservices behind an API gateway, and a React Native app that runs in **Expo Go**, with fast playback, offline mode and song downloads.

For the full picture, with architecture diagrams, every service and endpoint, the data model, the app's internals and what each file does, see the illustrated guide: [docs/Spotify-Clone-Repository-Guide.pdf](docs/Spotify-Clone-Repository-Guide.pdf).

```
mobile-app (Expo Go)  ──HTTP──▶  api-gateway :3000  ──▶  auth-service          :3001
                                  (auth, rate limit,      media-service         :3003  (stream/download URLs, files, transcoding)
                                   gzip, keep-alive)      playlist-service      :3004
                                                          interaction-service   :3005  (likes, listens)
                                                          search-service        :3006
                                                          recommendation-service:3007  (home feed)
                                                          notification-service        (queue worker)
                     Postgres (data) · Redis (cache, queues, refresh tokens) · local disk or S3 (audio)
```

## Quick start

Requirements: **Node 20.12+**, **pnpm** (`corepack enable`), Postgres 16 and Redis 7 (easiest via Docker), and the **Expo Go** app on your phone (SDK 58).

```bash
cp .env.example .env            # then set JWT_ACCESS_SECRET and SERVICE_API_KEY to random strings
docker compose up -d            # Postgres + Redis
pnpm install
pnpm db:migrate:deploy          # create / upgrade the schema
pnpm db:seed                    # demo accounts + 6 playable demo songs
pnpm dev                        # all backend services
```

In a second terminal:

```bash
cd mobile-app
npm install
npm start                       # scan the QR code with Expo Go
```

Log in with `listener@demo.dev` / `password123`, or register a new account.

- **Your own music:** `pnpm db:seed ~/Music/some-folder` imports every audio file in the folder. Name files `Artist - Title.mp3` to set the artist. Embedded cover art is extracted automatically.
- **Phone can't connect?** The phone must be on the same Wi-Fi as your computer, and the computer must allow inbound connections on port 3000. On Windows, allow Node.js on *Private* networks when the firewall asks. The login screen shows which server the app is calling.
- **Different networks or `npm run tunnel`?** Set `EXPO_PUBLIC_API_URL` in `mobile-app/.env` to a URL the phone can reach.

## Why playback starts fast

- **Progressive AAC instead of HLS.** Each song is transcoded once into two fast-start `.m4a` files: data saver at 96 kbps and high at 256 kbps. The MP4 index sits at the front of the file, so audio starts after roughly the first 14 KB, with no manifest, then variant, then segment round-trips.
- **Quality follows the connection.** In Auto mode the app streams high quality on Wi-Fi and data saver on mobile data. You can override this in Settings.
- **Zero-request taps.** Signed stream URLs for whatever is on screen are fetched in one batched call (`POST /songs/stream-urls`) and cached on disk until shortly before they expire. Tapping play usually needs no API call at all.
- **Native queue.** The whole queue is handed to `expo-audio`'s native `AudioPlaylist`. Tracks advance without JavaScript, including in the background and from lock-screen next/previous.
- **Instant screens.** API responses are persisted on the device, so every screen renders from cache immediately and refreshes in the background. The home screen is a single request (`GET /recommendations/home`).
- **Lean backend.** The gateway keeps connections to services alive and gzips JSON. Songs are hydrated in one query instead of N+1, there are new indexes on every hot query, and search runs its queries in parallel.

## Offline mode and downloads

- **Download anything.** Use the download button on a playlist or Liked Songs, or long-press any song. Downloads run two at a time, survive app restarts, resume after a connection drop, and wait for Wi-Fi unless you allow mobile data in Settings. Cover art is saved alongside the audio.
- **When the connection drops,** an offline banner appears, downloaded songs keep playing, un-downloaded songs dim, and the queue drops tracks that would need the network. Search switches to searching your downloads.
- **Nothing is lost while offline.** Likes are queued and replayed when you reconnect. They send the desired state rather than a toggle, so a replay can't undo them. Plays are queued on disk and sent in one batch later. Being offline never logs you out; refresh tokens last 30 days.
- **Quick restarts.** The last queue and position come back after an app restart.

## What changed in this cleanup

- **New mobile app.** Expo Go (SDK 58) replaces the Kotlin app. Everything it uses ships inside Expo Go, so no native build is needed.
- **Gateway fixes:**
  - POST bodies no longer hang. Nest's body parser was consuming them before the proxy.
  - Spoofed `X-User-Id` headers are stripped on every route.
  - Services are reached on localhost by default instead of on Docker hostnames that didn't exist.
  - CORS now works.
  - Internal services accept requests only from the gateway (`SERVICE_API_KEY`).
- **Security and correctness fixes:**
  - Private playlists could be read for 60 seconds after their owner opened them, because the cache was checked before the privacy check.
  - Removing or reordering playlist songs violated the position unique index.
  - Like toggles could double-apply.
  - Refresh tokens could be replayed concurrently.
  - Artist sign-ups never created the artist profile that uploads require.
  - The HLS transcode mapped one audio stream to three variants.
  - CloudFront signatures didn't cover HLS segments.
- **Tightened dependencies.** Nest 10 → 11, matching the Express 5 the repo already declared. `.env` loading now works for every service. OpenTelemetry is opt-in. The schema and migrations no longer drift. `fluent-ffmpeg`, Passport, Throttler and LocalStack were removed: dev storage is now local disk, and production uses S3 or CloudFront via `STORAGE_DRIVER=s3`.
- **Services can actually start now.** `pnpm dev` used to run on `tsx`, which can't emit the decorator metadata Nest needs for dependency injection, so every service except the gateway crashed on boot. This was broken before the cleanup too. Dev now runs on SWC (`@swc-node/register`) with Node's built-in watch mode. The notification worker was also missing its logger provider.
- **Breaking migration.** `20261106120000_progressive_audio_and_indexes` drops the old `hls_manifest_key` column. Songs uploaded before it need to be re-uploaded or re-seeded.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run every backend service with reload |
| `pnpm typecheck` | Typecheck the whole backend |
| `pnpm db:migrate` | Create a new migration after editing `libs/prisma/schema.prisma` |
| `pnpm db:seed [folder]` | Add demo or your own songs (idempotent) |
| `pnpm mobile` | Start the Expo dev server |
| `pnpm mobile:typecheck` | Typecheck the app |

## API overview (through the gateway)

| Method & path | Auth | Purpose |
| --- | --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | – | Sessions (`{ accessToken, refreshToken, expiresIn, user }`) |
| `GET /auth/me` | ✓ | Current user |
| `GET /recommendations/home` | ✓ | Every home section in one call |
| `GET /search?q=` | – | Prefix search across songs (including artist names), artists and playlists |
| `GET /songs?ids=a,b` · `GET /songs/:id` | – | Song metadata |
| `POST /songs/stream-urls` | ✓ | Signed URLs for a whole queue |
| `GET /songs/:id/stream` · `/download?quality=low\|high` | ✓ | Signed URL for one song |
| `GET /playlists/me` · `GET /playlists/:id` · `POST/DELETE …/songs` | ✓ | Playlists |
| `POST /interactions/likes` `{ songId, liked }` · `GET /interactions/me/likes[/ids]` | ✓ | Likes (idempotent) |
| `POST /interactions/listens` `{ events: [...] }` | ✓ | Batched play history |

Service responses are wrapped as `{ data, meta }`. Errors are `{ statusCode, message, requestId }`.

## Production notes

- Set `STORAGE_DRIVER=s3` with `S3_UPLOAD_BUCKET` and `S3_MEDIA_BUCKET`. Optionally add the `CLOUDFRONT_*` settings so media is served from the edge, and `ASSETS_BASE_URL` for covers.
- Use real secrets for `JWT_ACCESS_SECRET` and `SERVICE_API_KEY`, set `ALLOWED_ORIGINS`, and put HTTPS in front of the gateway.
- Expo Go is for development. For store builds, use `eas build` and set `EXPO_PUBLIC_API_URL` to your HTTPS gateway.
