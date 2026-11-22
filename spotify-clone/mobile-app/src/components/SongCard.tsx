import { memo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import type { Song } from '@/api/types';
import { useIsDownloaded } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { colors, spacing } from '@/theme';
import { openSongActions } from '@/ui/song-actions';
import { Artwork } from './Artwork';

export const CARD_SIZE = 140;

export const SongCard = memo(function SongCard({ song, onPress }: { song: Song; onPress: (song: Song) => void }) {
  const isDownloaded = useIsDownloaded(song.id);
  const isOnline = useNetwork((state) => state.isOnline);

  return (
    <Pressable
      onPress={() => onPress(song)}
      onLongPress={() => openSongActions(song)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, !isOnline && !isDownloaded && styles.unavailable]}
    >
      <Artwork uri={song.coverUrl} songId={song.id} size={CARD_SIZE} radius={6} />
      <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
      <Text style={styles.artist} numberOfLines={1}>{song.artistName}</Text>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { width: CARD_SIZE, marginRight: spacing.md },
  pressed: { opacity: 0.7 },
  unavailable: { opacity: 0.35 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600', marginTop: spacing.sm },
  artist: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
