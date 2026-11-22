import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Artwork } from '@/components/Artwork';
import { downloadSongs, removeDownload } from '@/downloads/manager';
import { useDownloadProgress, useDownloadStatus } from '@/downloads/store';
import { useLikedIds, useSetLike } from '@/hooks/queries';
import { useNetwork } from '@/net/network';
import { player } from '@/player/engine';
import { useCurrentSong, usePlayer } from '@/player/store';
import { currentStreamQuality } from '@/player/stream-urls';
import { colors, spacing } from '@/theme';
import { openSongActions } from '@/ui/song-actions';
import { toast } from '@/ui/toast';
import { formatDuration } from '@/utils/format';

function SeekBar() {
  const position = usePlayer((state) => state.position);
  const duration = usePlayer((state) => state.duration);
  // While dragging, show the thumb position instead of live playback position.
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const shown = scrubbing ?? position;

  return (
    <View>
      <Slider
        value={shown}
        minimumValue={0}
        maximumValue={Math.max(duration, 1)}
        minimumTrackTintColor={colors.text}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
        onSlidingStart={(value) => setScrubbing(value)}
        onValueChange={(value) => scrubbing !== null && setScrubbing(value)}
        onSlidingComplete={(value) => {
          setScrubbing(null);
          void player.seekTo(value);
        }}
        accessibilityLabel="Seek"
      />
      <View style={styles.times}>
        <Text style={styles.time}>{formatDuration(shown)}</Text>
        <Text style={styles.time}>-{formatDuration(Math.max(0, duration - shown))}</Text>
      </View>
    </View>
  );
}

function SourceLabel({ songId }: { songId: string }) {
  const status = useDownloadStatus(songId);
  const isOnline = useNetwork((state) => state.isOnline);
  const isUnmetered = useNetwork((state) => state.isUnmetered);
  if (status === 'done') return <Text style={styles.source}>Playing from your device</Text>;
  if (!isOnline) return <Text style={[styles.source, { color: colors.warning }]}>Offline</Text>;
  return (
    <Text style={styles.source}>
      Streaming · {currentStreamQuality() === 'high' ? 'High' : 'Data saver'} quality{isUnmetered ? '' : ' (mobile data)'}
    </Text>
  );
}

function DownloadButton({ songId }: { songId: string }) {
  const song = useCurrentSong();
  const status = useDownloadStatus(songId);
  const progress = useDownloadProgress((state) => state[songId]);
  if (!song) return null;

  if (status === 'downloading' || status === 'queued') {
    return (
      <Pressable onPress={() => removeDownload(songId)} hitSlop={12} accessibilityLabel="Cancel download">
        {status === 'downloading' ? (
          <Text style={styles.progress}>{Math.round((progress ?? 0) * 100)}%</Text>
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </Pressable>
    );
  }
  return (
    <Pressable
      hitSlop={12}
      accessibilityLabel={status === 'done' ? 'Remove download' : 'Download'}
      onPress={() => {
        if (status === 'done') {
          removeDownload(songId);
          toast('Removed from downloads');
        } else {
          downloadSongs([song]);
          toast('Downloading for offline listening');
        }
      }}
    >
      <Ionicons
        name={status === 'done' ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
        size={28}
        color={status === 'done' ? colors.accent : colors.textMuted}
      />
    </Pressable>
  );
}

export default function PlayerScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const song = useCurrentSong();
  const isPlaying = usePlayer((state) => state.isPlaying);
  const busy = usePlayer((state) => state.loading || (state.isBuffering && state.isPlaying));
  const repeat = usePlayer((state) => state.repeat);
  const hasNext = usePlayer((state) => state.index < state.queue.length - 1);
  const nextTitle = usePlayer((state) => state.queue[state.index + 1]?.title);
  const likedIds = useLikedIds();
  const setLike = useSetLike();

  useEffect(() => {
    if (!song) router.back();
  }, [song]);
  if (!song) return null;

  const liked = likedIds.has(song.id);
  const artSize = Math.min(width - spacing.xl * 2, 420);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close player">
          <Ionicons name="chevron-down" size={28} color={colors.text} />
        </Pressable>
        <SourceLabel songId={song.id} />
        <Pressable onPress={() => openSongActions(song)} hitSlop={12} accessibilityLabel="More options">
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.artWrap}>
        <Artwork uri={song.coverUrl} songId={song.id} size={artSize} radius={8} />
      </View>

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{song.artistName}</Text>
        </View>
        <Pressable
          hitSlop={12}
          onPress={() => setLike.mutate({ songId: song.id, liked: !liked, song })}
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? colors.accent : colors.text} />
        </Pressable>
      </View>

      <SeekBar />

      <View style={styles.controls}>
        <Pressable onPress={player.cycleRepeat} hitSlop={12} accessibilityLabel={`Repeat: ${repeat}`}>
          <Ionicons name="repeat" size={26} color={repeat === 'none' ? colors.textMuted : colors.accent} />
          {repeat === 'single' ? <Text style={styles.repeatOne}>1</Text> : null}
        </Pressable>
        <Pressable onPress={player.previous} hitSlop={12} accessibilityLabel="Previous">
          <Ionicons name="play-skip-back" size={34} color={colors.text} />
        </Pressable>
        <Pressable onPress={player.toggle} style={styles.playButton} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={34} color="#000" style={!isPlaying && { marginLeft: 4 }} />
          )}
        </Pressable>
        <Pressable onPress={player.next} disabled={!hasNext} hitSlop={12} accessibilityLabel="Next">
          <Ionicons name="play-skip-forward" size={34} color={hasNext ? colors.text : colors.textFaint} />
        </Pressable>
        <DownloadButton songId={song.id} />
      </View>

      {nextTitle ? (
        <Text style={styles.upNext} numberOfLines={1}>
          Up next · {nextTitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xl },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  source: { color: colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center', flex: 1, marginHorizontal: spacing.md },
  artWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  titleText: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800' },
  artist: { color: colors.textMuted, fontSize: 16, marginTop: 4 },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  time: { color: colors.textMuted, fontSize: 12, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  playButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOne: { position: 'absolute', right: -6, top: -4, color: colors.accent, fontSize: 10, fontWeight: '800' },
  progress: { color: colors.accent, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  upNext: { color: colors.textFaint, fontSize: 13, textAlign: 'center', marginTop: spacing.xl },
});
