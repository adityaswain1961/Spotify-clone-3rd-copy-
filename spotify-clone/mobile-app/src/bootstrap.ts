import { startDownloadManager } from '@/downloads/manager';
import { startNetworkMonitoring } from '@/net/network';
import { startPlayer } from '@/player/engine';
import { startListenSync } from '@/player/listens';
import { loadStreamUrlCache } from '@/player/stream-urls';

let booted = false;

/** Start app-wide services exactly once, before the first screen renders. */
export function bootstrapApp(): void {
  if (booted) return;
  booted = true;
  startNetworkMonitoring();
  void loadStreamUrlCache();
  startDownloadManager();
  startPlayer();
  startListenSync();
}
