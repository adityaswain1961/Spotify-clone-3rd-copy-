import { Ionicons } from '@expo/vector-icons';
import { Paths } from 'expo-file-system';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Artwork } from '@/components/Artwork';
import { CollectionScreen } from '@/components/CollectionScreen';
import { DownloadBadge } from '@/components/DownloadBadge';
import { EmptyState } from '@/components/ScreenState';
import { removeDownload, removeDownloads, retryDownload } from '@/downloads/manager';
import { useDownloadedBytes, useDownloadedSongs, usePendingDownloads } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { useSettings } from '@/settings/store';
import { colors, spacing } from '@/theme';
import { formatBytes, pluralize } from '@/utils/format';

function freeSpace(): string | null {
  try {
    return formatBytes(Paths.availableDiskSpace);
  } catch {
    return null;
  }
}

function PendingDownloads() {
  const pending = usePendingDownloads();
  const { isOnline, isUnmetered } = useNetwork();
  const cellularAllowed = useSettings((state) => state.downloadOverCellular);
  if (!pending.length) return null;

  const waitingReason = !isOnline
    ? 'Waiting for a connection'
    : !isUnmetered && !cellularAllowed
      ? 'Waiting for Wi-Fi · allow mobile data in Settings'
      : null;

  return (
    <View style={styles.pending}>
      <Text style={styles.sectionTitle}>In progress · {pending.length}</Text>
      {waitingReason ? <Text style={styles.waiting}>{waitingReason}</Text> : null}
      {pending.map((item) => (
        <View key={item.song.id} style={styles.pendingRow}>
          <Artwork uri={item.song.coverUrl} size={40} />
          <View style={styles.pendingText}>
            <Text style={styles.pendingTitle} numberOfLines={1}>{item.song.title}</Text>
            <View style={styles.pendingMeta}>
              <DownloadBadge songId={item.song.id} size={12} />
              <Text style={[styles.pendingStatus, item.status === 'error' && { color: colors.danger }]} numberOfLines={1}>
                {item.status === 'error' ? item.error ?? 'Failed' : item.status === 'queued' ? 'Queued' : 'Downloading'}
              </Text>
            </View>
          </View>
          {item.status === 'error' ? (
            <Pressable onPress={() => retryDownload(item.song.id)} hitSlop={10} accessibilityLabel="Retry">
              <Ionicons name="refresh" size={20} color={colors.text} />
            </Pressable>
          ) : null}
          <Pressable onPress={() => removeDownload(item.song.id)} hitSlop={10} accessibilityLabel="Cancel">
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

export default function DownloadsScreen() {
  const songs = useDownloadedSongs();
  const bytes = useDownloadedBytes();
  const free = freeSpace();

  const removeAll = () =>
    Alert.alert('Remove all downloads?', `This frees ${formatBytes(bytes)}.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove all', style: 'destructive', onPress: () => removeDownloads(songs.map((song) => song.id)) },
    ]);

  return (
    <CollectionScreen
      title="Downloads"
      subtitle={`${pluralize(songs.length, 'song')} · ${formatBytes(bytes)}${free ? ` · ${free} free` : ''}`}
      icon="arrow-down-circle"
      songs={songs}
      showDownloadButton={false}
      headerExtra={
        <View>
          <PendingDownloads />
          {songs.length ? (
            <Pressable onPress={removeAll} style={styles.removeAll}>
              <Text style={styles.removeAllText}>Remove all downloads</Text>
            </Pressable>
          ) : null}
        </View>
      }
      empty={
        <EmptyState
          icon="arrow-down-circle-outline"
          title="No downloads yet"
          body="Tap the download button on a playlist or Liked Songs, or long-press any song, to listen offline."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  pending: { paddingBottom: spacing.md },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: '700', paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  waiting: { color: colors.warning, fontSize: 13, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: 6 },
  pendingText: { flex: 1, minWidth: 0 },
  pendingTitle: { color: colors.text, fontSize: 14 },
  pendingMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  pendingStatus: { color: colors.textMuted, fontSize: 12, flexShrink: 1 },
  removeAll: { alignSelf: 'flex-start', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  removeAllText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
});
