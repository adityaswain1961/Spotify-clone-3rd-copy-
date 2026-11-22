import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { player } from '@/player/engine';
import { useCurrentSong, usePlayer } from '@/player/store';
import { colors, MINI_PLAYER_HEIGHT, radius, spacing } from '@/theme';
import { Artwork } from './Artwork';

function ProgressLine() {
  const ratio = usePlayer((state) => (state.duration > 0 ? Math.min(1, state.position / state.duration) : 0));
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
    </View>
  );
}

export function MiniPlayer() {
  const song = useCurrentSong();
  const isPlaying = usePlayer((state) => state.isPlaying);
  const busy = usePlayer((state) => state.loading || (state.isBuffering && state.isPlaying));
  if (!song) return null;

  return (
    <Pressable
      onPress={() => router.push('/player')}
      style={({ pressed }) => [styles.container, pressed && { opacity: 0.9 }]}
      accessibilityLabel={`Now playing ${song.title}. Open player`}
    >
      <View style={styles.row}>
        <Artwork uri={song.coverUrl} songId={song.id} size={44} />
        <View style={styles.text}>
          <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
          <Text style={styles.artist} numberOfLines={1}>{song.artistName}</Text>
        </View>
        <Pressable onPress={player.toggle} hitSlop={10} style={styles.control} accessibilityLabel={isPlaying ? 'Pause' : 'Play'}>
          {busy ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={26} color={colors.text} />
          )}
        </Pressable>
        <Pressable onPress={player.next} hitSlop={10} style={styles.control} accessibilityLabel="Next">
          <Ionicons name="play-skip-forward" size={22} color={colors.text} />
        </Pressable>
      </View>
      <ProgressLine />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    height: MINI_PLAYER_HEIGHT,
    marginHorizontal: spacing.sm,
    marginBottom: spacing.xs,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.sm, gap: spacing.md },
  text: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  artist: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  control: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', left: spacing.sm, right: spacing.sm, bottom: 0, height: 2, backgroundColor: colors.border },
  fill: { height: 2, backgroundColor: colors.text },
});
