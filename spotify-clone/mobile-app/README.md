# Mobile app (Expo Go, SDK 58)

```bash
npm install
npm start          # scan the QR code with Expo Go on the same Wi-Fi as this computer
npm run typecheck
```

The app finds the API gateway automatically at `http://<your computer's LAN IP>:3000`. To point it elsewhere, set `EXPO_PUBLIC_API_URL` in `.env` (see `.env.example`). You need this for tunnel mode and for production builds.

Every native module used here is bundled with Expo Go. Add libraries with `npx expo install <pkg>` so the versions match the SDK.

## Layout

```
src/
  app/            Expo Router screens: (auth), (tabs) home/search/library, player, playlist/[id], liked, downloads, settings
  api/            fetch client (timeouts, {data} unwrapping, 401 → single-flight refresh), endpoints, types
  auth/           session in expo-secure-store; proactive token refresh; offline never logs you out
  query/          TanStack Query client persisted to AsyncStorage (instant + offline screens), offline-safe likes
  player/         expo-audio AudioPlaylist engine, signed-URL cache + prefetch, offline listen queue
  downloads/      persisted download index, resumable download queue (2 at a time, Wi-Fi aware)
  net/            NetInfo → app state + React Query online manager
  components/     UI building blocks (SongRow, MiniPlayer, CollectionScreen, SongActionsSheet, …)
```
