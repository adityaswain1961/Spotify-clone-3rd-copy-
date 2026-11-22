import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/api/endpoints';
import { useNetwork } from '@/net/network';

const STORAGE_KEY = 'pending-listens.v1';
const MAX_PENDING = 1000;

type ListenEvent = { songId: string; listenedAt: string };

let pending: ListenEvent[] = [];
let loaded = false;
let flushing = false;

async function load(): Promise<void> {
  if (loaded) return;
  loaded = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    pending = [...(raw ? (JSON.parse(raw) as ListenEvent[]) : []), ...pending];
  } catch {
    // ignore corrupt queue
  }
}

function save(): Promise<void> {
  return AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending)).catch(() => undefined);
}

/**
 * Listens are queued on disk and sent in batches, so plays made offline still
 * count towards history and recommendations once the device reconnects.
 */
export async function recordListen(songId: string): Promise<void> {
  await load();
  pending = [...pending, { songId, listenedAt: new Date().toISOString() }].slice(-MAX_PENDING);
  await save();
  void flushListens();
}

export async function flushListens(): Promise<void> {
  await load();
  if (flushing || !pending.length || !useNetwork.getState().isOnline) return;
  flushing = true;
  try {
    while (pending.length) {
      const batch = pending.slice(0, 200);
      await api.recordListens(batch);
      pending = pending.slice(batch.length);
      await save();
    }
  } catch {
    // keep them for the next attempt
  } finally {
    flushing = false;
  }
}

export function startListenSync(): void {
  void flushListens();
  useNetwork.subscribe((state, previous) => {
    if (state.isOnline && !previous.isOnline) void flushListens();
  });
}

export async function clearPendingListens(): Promise<void> {
  pending = [];
  await AsyncStorage.removeItem(STORAGE_KEY);
}
