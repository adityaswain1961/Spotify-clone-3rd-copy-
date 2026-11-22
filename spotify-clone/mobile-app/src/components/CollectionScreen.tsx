import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { ReactNode, useCallback } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Song } from '@/api/types';
import { isDownloaded } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { player } from '@/player/engine';
import { colors, spacing } from '@/theme';
import { Artwork } from './Artwork';
import { DownloadCollectionButton } from './DownloadCollectionButton';
import { OfflineBanner } from './OfflineBanner';
import { SongRow } from './SongRow';

interface CollectionScreenProps {
  title: string;
  subtitle?: string;
  coverUrl?: string | null;
  icon?: keyof typeof Ionicons.glyphMap;
  songs: Song[];
  playlistId?: string;
  showDownloadButton?: boolean;
  headerExtra?: ReactNode;
  empty?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Shared layout for playlists, liked songs and downloads. */
export function CollectionScreen({
  title,
  subtitle,
  coverUrl,
  icon = 'musical-notes',
  songs,
  playlistId,
  showDownloadButton = true,
  headerExtra,
  empty,
  refreshing = false,
  onRefresh,
}: CollectionScreenProps) {
  const insets = useSafeAreaInsets();
  const isOnline = useNetwork((state) => state.isOnline);
  const playable = isOnline ? songs : songs.filter((song) => isDownloaded(song.id));

  const play = useCallback((song: Song) => void player.playSongs(songs, song.id), [songs]);

  const header = (
    <View>
      <View style={styles.hero}>
        <Artwork uri={coverUrl} size={180} radius={6} icon={icon} />
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.actions}>
        {showDownloadButton && songs.length ? <DownloadCollectionButton songs={songs} /> : <View />}
        <View style={styles.playButtons}>
          <Pressable
            hitSlop={8}
            disabled={!playable.length}
            onPress={() => void player.playSongs(playable, undefined, true)}
            accessibilityLabel="Shuffle play"
          >
            <Ionicons name="shuffle" size={28} color={playable.length ? colors.textMuted : colors.textFaint} />
          </Pressable>
          <Pressable
            disabled={!playable.length}
            onPress={() => void player.playSongs(playable, playable[0]?.id)}
            style={({ pressed }) => [styles.play, pressed && { transform: [{ scale: 0.96 }] }, !playable.length && { opacity: 0.4 }]}
            accessibilityLabel="Play"
          >
            <Ionicons name="play" size={26} color="#000" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>
      </View>
      {headerExtra}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
      </View>
      <OfflineBanner />
      <FlashList
        data={songs}
        keyExtractor={(song) => song.id}
        renderItem={({ item }) => <SongRow song={item} onPress={play} playlistId={playlistId} showDuration />}
        ListHeaderComponent={header}
        ListEmptyComponent={() => <>{empty}</>}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  hero: { alignItems: 'center', paddingHorizontal: spacing.xl, gap: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '800', textAlign: 'center', marginTop: spacing.md },
  subtitle: { color: colors.textMuted, fontSize: 13 },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  playButtons: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  play: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
