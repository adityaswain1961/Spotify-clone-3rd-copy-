import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AudioMetadata,
  AudioPlaylist,
  AudioPlaylistStatus,
  createAudioPlaylist,
  setAudioModeAsync,
} from 'expo-audio';
import { AppState } from 'react-native';
import { absoluteUrl } from '@/api/config';
import type { Song } from '@/api/types';
import { onSignOut } from '@/auth/session';
import { isDownloaded, localAudioUri, localCoverUri } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { toast } from '@/ui/toast';
import { recordListen } from './listens';
import { initialPlayerState, PlayerState, RepeatMode, usePlayer } from './store';
import { prefetchStreamUrls, resolveSources } from './stream-urls';

const SNAPSHOT_KEY = 'player-snapshot.v1';
const SNAPSHOT_INTERVAL_MS = 5000;
/** A play counts once this much of the track was heard (or half of a short track). */
const LISTEN_THRESHOLD_SEC = 30;

let playlist: AudioPlaylist | null = null;
/** URI loaded at each native index; kept aligned with usePlayer().queue. */
let loadedUris: string[] = [];
let loadToken = 0;
let pendingSeek: number | null = null;
let listenCountedFor: string | null = null;
let lastSnapshotAt = 0;

function metadataFor(song: Song): AudioMetadata {
  return {
    title: song.title,
    artist: song.artistName,
    artworkUrl: localCoverUri(song.id) ?? absoluteUrl(song.coverUrl) ?? undefined,
  };
}

async function ensurePlaylist(): Promise<AudioPlaylist> {
  if (playlist) return playlist;
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    // Required for lock-screen controls, and pauses other apps' audio like a music app should.
    interruptionMode: 'doNotMix',
  });
  playlist = createAudioPlaylist({ updateInterval: 500, loop: usePlayer.getState().repeat });
  playlist.addListener('playlistStatusUpdate', onStatus);
  playlist.addListener('trackChanged', ({ currentIndex }) => onTrackChanged(currentIndex));
  return playlist;
}

function onStatus(status: AudioPlaylistStatus): void {
  const state = usePlayer.getState();
  if (!state.loaded) return;

  if (pendingSeek !== null && status.isLoaded && status.duration > 0) {
    const seek = pendingSeek;
    pendingSeek = null;
    void playlist?.seekTo(Math.min(seek, Math.max(0, status.duration - 1)));
  }

  const patch: Partial<PlayerState> = {
    isPlaying: status.playing,
    isBuffering: status.isBuffering,
    position: status.currentTime,
  };
  if (status.duration > 0) patch.duration = status.duration;
  if (status.currentIndex >= 0 && status.currentIndex !== state.index && status.currentIndex < state.queue.length) {
    patch.index = status.currentIndex;
  }
  usePlayer.setState(patch);

  const song = state.queue[patch.index ?? state.index];
  if (song && status.playing) {
    const threshold = Math.min(LISTEN_THRESHOLD_SEC, (status.duration || song.durationSec) / 2);
    const playKey = `${loadToken}:${patch.index ?? state.index}:${song.id}`;
    if (status.currentTime >= threshold && listenCountedFor !== playKey) {
      listenCountedFor = playKey;
      void recordListen(song.id);
    }
  }

  if (Date.now() - lastSnapshotAt > SNAPSHOT_INTERVAL_MS) void saveSnapshot();
}

function onTrackChanged(currentIndex: number): void {
  const { queue } = usePlayer.getState();
  const song = queue[currentIndex];
  if (!song) return;
  usePlayer.setState({ index: currentIndex, position: 0, duration: song.durationSec });
  playlist?.updateLockScreenMetadata(metadataFor(song));
  void saveSnapshot();
  void refreshUpcomingSources(currentIndex);
}

/**
 * Start playing `songs` from `startIndex`. The UI updates immediately; every source
 * (downloaded file or signed URL) is resolved in one step, then the whole queue is
 * handed to the native playlist so it can advance on its own in the background.
 */
async function playQueue(songs: Song[], startIndex: number, options: { startAt?: number } = {}): Promise<void> {
  const target = songs[startIndex];
  if (!target) return;
  const token = ++loadToken;
  const online = useNetwork.getState().isOnline;

  if (!online && !isDownloaded(target.id)) {
    toast("You're offline and this song isn't downloaded");
    return;
  }
  const candidates = online ? songs : songs.filter((song) => isDownloaded(song.id));

  usePlayer.setState({
    queue: candidates,
    index: candidates.indexOf(target),
    loading: true,
    loaded: false,
    position: options.startAt ?? 0,
    duration: target.durationSec,
    isPlaying: false,
    error: null,
  });

  // Never throws: unreachable server -> downloads and cached URLs still resolve.
  const sources = await resolveSources(candidates);
  if (token !== loadToken) return; // a newer tap won

  const queue = candidates.filter((song) => sources.has(song.id));
  const index = queue.findIndex((song) => song.id === target.id);
  if (index === -1) {
    const message = "Couldn't load this song - check your connection";
    usePlayer.setState({ loading: false, error: message });
    toast(message);
    return;
  }

  const player = await ensurePlaylist();
  if (token !== loadToken) return;
  player.pause();
  player.clear();
  loadedUris = queue.map((song) => sources.get(song.id)!);
  queue.forEach((song, i) => player.add({ uri: loadedUris[i], name: song.title }));
  player.skipTo(index);
  pendingSeek = options.startAt && options.startAt > 1 ? options.startAt : null;
  player.play();
  player.setActiveForLockScreen(true, metadataFor(queue[index]), {
    showNextTrack: true,
    showPreviousTrack: true,
  });

  usePlayer.setState({ queue, index, loaded: true, loading: false, isPlaying: true });
  void saveSnapshot();
}

/** Re-sign the next few streamed tracks if their URLs are close to expiring (long sessions). */
async function refreshUpcomingSources(fromIndex: number): Promise<void> {
  const { queue } = usePlayer.getState();
  const upcoming = queue.slice(fromIndex + 1, fromIndex + 4);
  if (!upcoming.length || !playlist) return;
  const token = loadToken;
  const sources = await resolveSources(upcoming).catch(() => null);
  if (!sources || token !== loadToken || !playlist) return;

  upcoming.forEach((song, offset) => {
    const nativeIndex = fromIndex + 1 + offset;
    const uri = sources.get(song.id);
    if (uri && uri !== loadedUris[nativeIndex]) {
      playlist!.remove(nativeIndex);
      playlist!.insert({ uri, name: song.title }, nativeIndex);
      loadedUris[nativeIndex] = uri;
    }
  });
}

/** Going offline: drop upcoming tracks that would need the network, keep what's playing. */
function pruneUnplayableUpcoming(): void {
  const state = usePlayer.getState();
  if (!state.loaded || !playlist) return;
  for (let i = state.queue.length - 1; i > state.index; i -= 1) {
    if (!localAudioUri(state.queue[i].id)) {
      playlist.remove(i);
      loadedUris.splice(i, 1);
    }
  }
  const queue = state.queue.filter((song, i) => i <= state.index || Boolean(localAudioUri(song.id)));
  if (queue.length !== state.queue.length) {
    usePlayer.setState({ queue });
    toast('Offline: playing downloaded songs only');
  }
}

async function saveSnapshot(): Promise<void> {
  lastSnapshotAt = Date.now();
  const { queue, index, position, repeat } = usePlayer.getState();
  if (!queue.length) return;
  await AsyncStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ queue, index, position, repeat })).catch(() => undefined);
}

/** Show the last queue in the mini player after a restart; audio loads on the first tap. */
async function restoreSnapshot(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(SNAPSHOT_KEY);
    if (!raw || usePlayer.getState().queue.length) return;
    const snapshot = JSON.parse(raw) as Pick<PlayerState, 'queue' | 'index' | 'position' | 'repeat'>;
    if (!snapshot.queue?.[snapshot.index]) return;
    usePlayer.setState({
      ...snapshot,
      loaded: false,
      duration: snapshot.queue[snapshot.index].durationSec,
    });
    prefetchStreamUrls(snapshot.queue.slice(snapshot.index, snapshot.index + 10));
  } catch {
    // ignore corrupt snapshot
  }
}

async function stop(): Promise<void> {
  loadToken += 1;
  if (playlist) {
    playlist.pause();
    playlist.clear();
    playlist.clearLockScreenControls();
  }
  loadedUris = [];
  usePlayer.setState({ ...initialPlayerState, repeat: usePlayer.getState().repeat });
  await AsyncStorage.removeItem(SNAPSHOT_KEY).catch(() => undefined);
}

export const player = {
  playQueue,

  /** Play a list starting at a song; shuffled lists put that song first. */
  playSongs(songs: Song[], startSongId?: string, shuffle = false): Promise<void> {
    if (!songs.length) return Promise.resolve();
    if (shuffle) {
      const rest = songs.filter((song) => song.id !== startSongId);
      for (let i = rest.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const first = songs.find((song) => song.id === startSongId);
      return playQueue(first ? [first, ...rest] : rest, 0);
    }
    const index = Math.max(0, songs.findIndex((song) => song.id === startSongId));
    return playQueue(songs, index);
  },

  toggle(): void {
    const state = usePlayer.getState();
    if (!state.loaded) {
      if (state.queue.length && !state.loading) void playQueue(state.queue, state.index, { startAt: state.position });
      return;
    }
    if (state.isPlaying) {
      playlist?.pause();
      usePlayer.setState({ isPlaying: false });
      void saveSnapshot();
    } else {
      playlist?.play();
      usePlayer.setState({ isPlaying: true });
    }
  },

  next(): void {
    const { loaded, index, queue } = usePlayer.getState();
    if (loaded && index < queue.length - 1) playlist?.next();
  },

  /** Restart the track if we're past 3s, otherwise go to the previous one. */
  previous(): void {
    const { loaded, position, index } = usePlayer.getState();
    if (!loaded) return;
    if (position > 3 || index === 0) void player.seekTo(0);
    else playlist?.previous();
  },

  async seekTo(seconds: number): Promise<void> {
    const { loaded } = usePlayer.getState();
    usePlayer.setState({ position: seconds });
    if (loaded) await playlist?.seekTo(seconds);
  },

  /** Jump to a song that is already in the queue. */
  skipTo(index: number): void {
    const { loaded, queue, position } = usePlayer.getState();
    if (!queue[index]) return;
    if (!loaded) {
      void playQueue(queue, index, { startAt: index === usePlayer.getState().index ? position : 0 });
      return;
    }
    playlist?.skipTo(index);
    playlist?.play();
  },

  /** Insert a song right after the current one without interrupting playback. */
  async playNext(song: Song): Promise<void> {
    const state = usePlayer.getState();
    if (!state.loaded || !playlist) {
      await playQueue([song], 0);
      return;
    }
    const sources = await resolveSources([song]).catch(() => new Map<string, string>());
    const uri = sources.get(song.id);
    if (!uri) {
      toast(useNetwork.getState().isOnline ? 'Could not queue this song' : "You're offline and this song isn't downloaded");
      return;
    }
    const at = usePlayer.getState().index + 1;
    playlist.insert({ uri, name: song.title }, at);
    loadedUris.splice(at, 0, uri);
    const queue = [...usePlayer.getState().queue];
    queue.splice(at, 0, song);
    usePlayer.setState({ queue });
    toast('Playing next');
  },

  cycleRepeat(): void {
    const order: RepeatMode[] = ['none', 'all', 'single'];
    const repeat = order[(order.indexOf(usePlayer.getState().repeat) + 1) % order.length];
    usePlayer.setState({ repeat });
    if (playlist) playlist.loop = repeat;
  },

  stop,
};

let started = false;

export function startPlayer(): void {
  if (started) return;
  started = true;
  void restoreSnapshot();
  AppState.addEventListener('change', (state) => {
    if (state !== 'active') void saveSnapshot();
  });
  useNetwork.subscribe((state, previous) => {
    if (!state.isOnline && previous.isOnline) pruneUnplayableUpcoming();
  });
  onSignOut(() => void stop());
}
