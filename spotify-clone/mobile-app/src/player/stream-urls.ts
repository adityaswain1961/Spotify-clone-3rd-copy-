import AsyncStorage from '@react-native-async-storage/async-storage';
import { absoluteUrl } from '@/api/config';
import { api } from '@/api/endpoints';
import type { AudioQuality, MediaUrl, Song } from '@/api/types';
import { localAudioUri } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { useSettings } from '@/settings/store';

const STORAGE_KEY = 'stream-urls.v1';
/** Treat URLs as stale this long before they expire, so playback never hits an expired link. */
const FRESHNESS_MARGIN_MS = 15 * 60 * 1000;
const BATCH_SIZE = 100;

const cache = new Map<string, MediaUrl>();
const inFlight = new Map<string, Promise<void>>();
let loaded = false;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

const cacheKey = (songId: string, quality: AudioQuality) => `${songId}:${quality}`;

function isFresh(entry: MediaUrl | undefined): entry is MediaUrl {
  return Boolean(entry) && Date.parse(entry!.expiresAt) - Date.now() > FRESHNESS_MARGIN_MS;
}

/** Restore signed URLs from the last session: a cold-start tap can play with zero API calls. */
export async function loadStreamUrlCache(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const entries = raw ? (JSON.parse(raw) as MediaUrl[]) : [];
    for (const entry of entries) if (isFresh(entry)) cache.set(cacheKey(entry.songId, entry.quality), entry);
  } catch {
    // corrupt cache: start empty
  }
}

function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const fresh = [...cache.values()].filter(isFresh).slice(-500);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)).catch(() => undefined);
  }, 1500);
}

/** Quality for streaming right now: the user's choice, or auto by connection type. */
export function currentStreamQuality(): AudioQuality {
  const preference = useSettings.getState().streamingQuality;
  if (preference !== 'auto') return preference;
  return useNetwork.getState().isUnmetered ? 'high' : 'low';
}

async function fetchMissing(songIds: string[], quality: AudioQuality): Promise<void> {
  const missing = songIds.filter((id) => !isFresh(cache.get(cacheKey(id, quality))) && !inFlight.has(cacheKey(id, quality)));
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const batch = missing.slice(i, i + BATCH_SIZE);
    const promise = api.streamUrls(batch, quality).then(({ items }) => {
      // The server may fall back to another quality; cache under the requested one.
      for (const item of items) cache.set(cacheKey(item.songId, quality), item);
      scheduleSave();
    });
    batch.forEach((id) => inFlight.set(cacheKey(id, quality), promise));
    try {
      await promise;
    } finally {
      batch.forEach((id) => inFlight.delete(cacheKey(id, quality)));
    }
  }
  // Wait for batches another caller already started for some of these ids.
  await Promise.all(songIds.map((id) => inFlight.get(cacheKey(id, quality))).filter(Boolean));
}

/**
 * Playable URI for each song: the downloaded file when available (instant, offline),
 * otherwise a cached or freshly signed stream URL (one batched request for the queue).
 */
export async function resolveSources(songs: Song[], quality = currentStreamQuality()): Promise<Map<string, string>> {
  const sources = new Map<string, string>();
  const remote: string[] = [];
  for (const song of songs) {
    const local = localAudioUri(song.id);
    if (local) sources.set(song.id, local);
    else remote.push(song.id);
  }

  if (remote.length && useNetwork.getState().isOnline) {
    try {
      await fetchMissing(remote, quality);
    } catch {
      // Server unreachable: still play downloads and any URLs cached earlier.
    }
  }
  for (const id of remote) {
    const entry = cache.get(cacheKey(id, quality));
    if (isFresh(entry)) sources.set(id, absoluteUrl(entry.url));
  }
  return sources;
}

/** Sign URLs for songs the user is likely to play next, so tapping play starts instantly. */
export function prefetchStreamUrls(songs: Song[]): void {
  if (!useNetwork.getState().isOnline || !songs.length) return;
  const quality = currentStreamQuality();
  const ids = songs.filter((song) => !localAudioUri(song.id)).map((song) => song.id);
  if (ids.length) void fetchMissing(ids, quality).catch(() => undefined);
}

export function clearStreamUrlCache(): void {
  cache.clear();
  void AsyncStorage.removeItem(STORAGE_KEY);
}
