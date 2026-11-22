import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PlaylistSummary } from '@/api/types';
import { Artwork } from '@/components/Artwork';
import { OfflineBanner } from '@/components/OfflineBanner';
import { useDownloadedBytes, useDownloadedSongs, usePendingDownloads } from '@/downloads/store';
import { useCreatePlaylist, useLikedIds, useMyPlaylists } from '@/hooks/queries';
import { useNetwork } from '@/net/network';
import { colors, radius, spacing } from '@/theme';
import { toast } from '@/ui/toast';
import { formatBytes, pluralize } from '@/utils/format';

function ShortcutRow({
  icon,
  tint,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <View style={[styles.shortcutIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={24} color={colors.text} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
    </Pressable>
  );
}

export default function LibraryScreen() {
  const insets = useSafeAreaInsets();
  const playlists = useMyPlaylists();
  const likedIds = useLikedIds();
  const downloaded = useDownloadedSongs();
  const pending = usePendingDownloads();
  const bytes = useDownloadedBytes();
  const isOnline = useNetwork((state) => state.isOnline);
  const createPlaylist = useCreatePlaylist();

  const create = async () => {
    try {
      const playlist = await createPlaylist.mutateAsync(`My playlist #${(playlists.data?.total ?? 0) + 1}`);
      router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } });
    } catch {
      toast('Could not create playlist');
    }
  };

  const downloadsSubtitle = pending.length
    ? `${pluralize(downloaded.length, 'song')} · ${pending.length} in progress`
    : `${pluralize(downloaded.length, 'song')} · ${formatBytes(bytes)}`;

  const header = (
    <View>
      <ShortcutRow
        icon="heart"
        tint="#4f3bd1"
        title="Liked Songs"
        subtitle={pluralize(likedIds.size, 'song')}
        onPress={() => router.push('/liked')}
      />
      <ShortcutRow
        icon="arrow-down-circle"
        tint="#1a7f45"
        title="Downloads"
        subtitle={downloadsSubtitle}
        onPress={() => router.push('/downloads')}
      />
      <Text style={styles.sectionTitle}>Playlists</Text>
    </View>
  );

  const renderPlaylist = ({ item }: { item: PlaylistSummary }) => (
    <Pressable
      onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: item.id } })}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <Artwork uri={item.coverUrl} size={56} icon="list" />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.rowSubtitle}>Playlist · {pluralize(item.songCount, 'song')}</Text>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />
      <View style={styles.header}>
        <Text style={styles.heading}>Your Library</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={create} disabled={!isOnline} hitSlop={10} accessibilityLabel="Create playlist">
            <Ionicons name="add" size={28} color={isOnline ? colors.text : colors.textFaint} />
          </Pressable>
          <Pressable onPress={() => router.push('/settings')} hitSlop={10} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
      </View>
      <FlashList
        data={playlists.data?.items ?? []}
        keyExtractor={(item) => item.id}
        renderItem={renderPlaylist}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {playlists.isPending && isOnline ? 'Loading…' : 'No playlists yet. Tap + to create one.'}
          </Text>
        }
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            refreshing={playlists.isRefetching}
            onRefresh={() => void playlists.refetch()}
            tintColor={colors.accent}
            enabled={isOnline}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  pressed: { backgroundColor: colors.surface },
  shortcutIcon: { width: 56, height: 56, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '600' },
  rowSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 3 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg },
});
