import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Song } from '@/api/types';
import { useIsDownloaded } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { useIsCurrentSong } from '@/player/store';
import { colors, spacing } from '@/theme';
import { openSongActions } from '@/ui/song-actions';
import { formatDuration } from '@/utils/format';
import { Artwork } from './Artwork';
import { DownloadBadge } from './DownloadBadge';

interface SongRowProps {
  song: Song;
  onPress: (song: Song) => void;
  /** Pass when listed inside a playlist the user owns. */
  playlistId?: string;
  showDuration?: boolean;
}

export const SongRow = memo(function SongRow({ song, onPress, playlistId, showDuration }: SongRowProps) {
  const isCurrent = useIsCurrentSong(song.id);
  const isDownloaded = useIsDownloaded(song.id);
  const isOnline = useNetwork((state) => state.isOnline);
  const unavailable = !isOnline && !isDownloaded;

  return (
    <Pressable
      onPress={() => onPress(song)}
      onLongPress={() => openSongActions(song, playlistId)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, unavailable && styles.unavailable]}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} by ${song.artistName}`}
    >
      <Artwork uri={song.coverUrl} songId={song.id} size={48} />
      <View style={styles.text}>
        <Text style={[styles.title, isCurrent && styles.current]} numberOfLines={1}>
          {song.title}
        </Text>
        <View style={styles.meta}>
          <DownloadBadge songId={song.id} size={13} />
          <Text style={styles.artist} numberOfLines={1}>
            {song.artistName}
            {showDuration ? ` · ${formatDuration(song.durationSec)}` : ''}
          </Text>
        </View>
      </View>
      <Pressable
        hitSlop={12}
        onPress={() => openSongActions(song, playlistId)}
        accessibilityLabel="More options"
        style={styles.more}
      >
        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  pressed: { backgroundColor: colors.surface },
  unavailable: { opacity: 0.35 },
  text: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 15, fontWeight: '500' },
  current: { color: colors.accent },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  artist: { color: colors.textMuted, fontSize: 13, flexShrink: 1 },
  more: { padding: spacing.xs },
});
