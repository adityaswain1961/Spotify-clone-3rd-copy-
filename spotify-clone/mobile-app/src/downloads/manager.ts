import { DownloadTask, File } from 'expo-file-system';
import { isNetworkError } from '@/api/client';
import { absoluteUrl } from '@/api/config';
import { api } from '@/api/endpoints';
import type { Song } from '@/api/types';
import { useNetwork } from '@/net/network';
import { useSettings } from '@/settings/store';
import {
  audioFileFor,
  coverFileFor,
  DownloadItem,
  downloadsDirectory,
  updateDownload,
  useDownloadProgress,
  useDownloads,
} from './store';

/** Two parallel transfers saturate most connections without starving playback. */
const MAX_CONCURRENT = 2;
const PROGRESS_INTERVAL_MS = 250;

const MAX_RETRY_DELAY_MS = 60_000;

const active = new Map<string, DownloadTask>();
/** Backoff for transfers that failed while the device was online (server unreachable). */
const retryAt = new Map<string, number>();
const attempts = new Map<string, number>();
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;

function clearRetry(songId: string): void {
  retryAt.delete(songId);
  attempts.delete(songId);
}

/** Exponential backoff (2s, 4s, 8s ... 60s) so an unreachable server isn't hammered. */
function scheduleRetry(songId: string): void {
  const attempt = (attempts.get(songId) ?? 0) + 1;
  attempts.set(songId, attempt);
  retryAt.set(songId, Date.now() + Math.min(MAX_RETRY_DELAY_MS, 2000 * 2 ** (attempt - 1)));
  const next = Math.min(...retryAt.values());
  clearTimeout(retryTimer);
  retryTimer = setTimeout(pump, Math.max(0, next - Date.now()));
}

function canDownloadNow(): boolean {
  const { isOnline, isUnmetered } = useNetwork.getState();
  return isOnline && (isUnmetered || useSettings.getState().downloadOverCellular);
}

function ensureDirectory(): void {
  const dir = downloadsDirectory();
  if (!dir.exists) dir.create({ intermediates: true });
}

function deleteFiles(songId: string): void {
  for (const file of [audioFileFor(songId), coverFileFor(songId)]) {
    try {
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
  }
}

function setProgress(songId: string, value: number | undefined): void {
  useDownloadProgress.setState((state) => {
    const next = { ...state };
    if (value === undefined) delete next[songId];
    else next[songId] = value;
    return next;
  }, true);
}

async function run(item: DownloadItem): Promise<void> {
  const songId = item.song.id;
  updateDownload(songId, { status: 'downloading', error: undefined });
  setProgress(songId, 0);

  try {
    ensureDirectory();
    const target = audioFileFor(songId);
    if (target.exists) target.delete(); // leftover partial file from an interrupted run

    const { url } = await api.downloadUrl(songId, item.quality);
    let lastTick = 0;
    const task = File.createDownloadTask(absoluteUrl(url), target, {
      onProgress: ({ bytesWritten, totalBytes }) => {
        const now = Date.now();
        if (now - lastTick < PROGRESS_INTERVAL_MS || totalBytes <= 0) return;
        lastTick = now;
        setProgress(songId, bytesWritten / totalBytes);
      },
    });
    active.set(songId, task);

    const file = await task.downloadAsync();
    if (!useDownloads.getState().items[songId]) {
      deleteFiles(songId); // removed before the task could be cancelled
      return;
    }
    if (!file) {
      updateDownload(songId, { status: 'queued' }); // paused by the system; resume later
      return;
    }

    let hasCover = false;
    if (item.song.coverUrl) {
      try {
        const cover = coverFileFor(songId);
        if (cover.exists) cover.delete();
        await File.downloadFileAsync(absoluteUrl(item.song.coverUrl), cover, { idempotent: true });
        hasCover = true;
      } catch {
        hasCover = false; // artwork is optional for offline playback
      }
    }

    clearRetry(songId);
    updateDownload(songId, { status: 'done', bytes: file.size ?? 0, hasCover, completedAt: Date.now() });
  } catch (error) {
    if (!useDownloads.getState().items[songId]) return; // cancelled by removeDownload()
    deleteFiles(songId);
    // Connection problems go back to the queue: retried right away when the device
    // reconnects, or with backoff when it's online but the server can't be reached.
    if (isNetworkError(error) || !useNetwork.getState().isOnline) {
      updateDownload(songId, { status: 'queued' });
      if (useNetwork.getState().isOnline) scheduleRetry(songId);
    } else {
      updateDownload(songId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Download failed',
      });
    }
  } finally {
    active.delete(songId);
    setProgress(songId, undefined);
    pump();
  }
}

/** Start queued downloads up to the concurrency limit, if the network allows it. */
function pump(): void {
  if (!canDownloadNow()) return;
  const now = Date.now();
  const queued = Object.values(useDownloads.getState().items)
    .filter((item) => item.status === 'queued' && !active.has(item.song.id) && (retryAt.get(item.song.id) ?? 0) <= now)
    .sort((a, b) => a.addedAt - b.addedAt);
  for (const item of queued) {
    if (active.size >= MAX_CONCURRENT) break;
    active.set(item.song.id, null as unknown as DownloadTask); // reserve the slot synchronously
    void run(item);
  }
}

/** Queue songs for offline playback. Already downloaded/queued songs are skipped. */
export function downloadSongs(songs: Song[]): number {
  const quality = useSettings.getState().downloadQuality;
  let added = 0;
  useDownloads.setState((state) => {
    const items = { ...state.items };
    const now = Date.now();
    songs.forEach((song, index) => {
      const existing = items[song.id];
      if (existing && existing.status !== 'error') return;
      items[song.id] = { song, status: 'queued', quality, bytes: 0, hasCover: false, addedAt: now + index };
      added += 1;
    });
    return { items };
  });
  pump();
  return added;
}

export function removeDownload(songId: string): void {
  const task = active.get(songId);
  useDownloads.setState((state) => {
    const items = { ...state.items };
    delete items[songId];
    return { items };
  });
  try {
    task?.cancel();
  } catch {
    // not started yet
  }
  active.delete(songId);
  clearRetry(songId);
  setProgress(songId, undefined);
  deleteFiles(songId);
  pump();
}

export function removeDownloads(songIds: string[]): void {
  songIds.forEach(removeDownload);
}

export function retryDownload(songId: string): void {
  clearRetry(songId);
  updateDownload(songId, { status: 'queued', error: undefined });
  pump();
}

/**
 * Called once at startup: verify files still exist (the OS or user may have removed
 * them), requeue transfers interrupted by an app kill, and resume when connectivity
 * or the cellular setting changes.
 */
export function startDownloadManager(): void {
  if (started) return;
  started = true;

  const reconcile = () => {
    const items = { ...useDownloads.getState().items };
    for (const [songId, item] of Object.entries(items)) {
      if (item.status === 'downloading') items[songId] = { ...item, status: 'queued' };
      if (item.status === 'done' && !audioFileFor(songId).exists) items[songId] = { ...item, status: 'queued' };
    }
    useDownloads.setState({ items });
    pump();
  };

  if (useDownloads.getState().hydrated) reconcile();
  else {
    const unsubscribe = useDownloads.subscribe((state) => {
      if (state.hydrated) {
        unsubscribe();
        reconcile();
      }
    });
  }

  useNetwork.subscribe((state, previous) => {
    if (state.isOnline && !previous.isOnline) retryAt.clear(); // reconnected: retry immediately
    pump();
  });
  useSettings.subscribe(pump);
}
