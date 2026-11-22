# Mobile: Kotlin → Expo Go (done)

The mobile client is the Expo app in [`mobile-app/`](../mobile-app/README.md). It runs in **Expo Go**, so no native build is needed during development.

The plan this file used to describe (expo-dev-client, react-native-track-player, HLS) was replaced:

| Concern | Now |
| --- | --- |
| Runtime | Expo SDK 58 in Expo Go |
| Playback | `expo-audio` `AudioPlaylist`: native queue, background audio, lock-screen controls |
| Media format | Progressive fast-start AAC (`.m4a`), 96 kbps / 256 kbps, instead of HLS |
| Offline data | TanStack Query persisted to AsyncStorage; queued likes and listens |
| Downloads | `expo-file-system` `DownloadTask` with a persistent, Wi-Fi-aware queue |

The legacy Kotlin app in `android-app/` is no longer used and can be deleted.

See the root [README](../README.md) for setup, and for how speed, offline mode and downloads work.
