import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useShallow } from 'zustand/react/shallow';
import type { Song } from '@/api/types';
import { downloadSongs, removeDownloads } from '@/downloads/manager';
import { useDownloads } from '@/downloads/store';
import { useNetwork } from '@/net/network';
import { useSettings } from '@/settings/store';
import { colors, spacing } from '@/theme';
import { toast } from '@/ui/toast';

/** One-tap "make this whole list available offline", with live collection progress. */
export function DownloadCollectionButton({ songs }: { songs: Song[] }) {
  const statuses = useDownloads(useShallow((state) => songs.map((song) => state.items[song.id]?.status ?? null)));
  const done = statuses.filter((status) => status === 'done').length;
  const pending = statuses.filter((status) => status === 'queued' || status === 'downloading').length;
  const allDone = songs.length > 0 && done === songs.length;

  const onPress = () => {
    if (allDone) {
      Alert.alert('Remove downloads?', `${songs.length} songs will no longer be available offline.`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeDownloads(songs.map((song) => song.id)) },
      ]);
      return;
    }
    const added = downloadSongs(songs);
    const { isOnline, isUnmetered } = useNetwork.getState();
    if (!isOnline) toast('Will download when you are back online');
    else if (!isUnmetered && !useSettings.getState().downloadOverCellular) toast('Waiting for Wi-Fi (change in Settings)');
    else if (added) toast(`Downloading ${added} song${added === 1 ? '' : 's'}`);
  };

  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.button} accessibilityLabel="Download all">
      <Ionicons
        name={allDone ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
        size={30}
        color={allDone || pending ? colors.accent : colors.textMuted}
      />
      {pending > 0 ? <Text style={styles.label}>{done}/{songs.length}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  label: { color: colors.accent, fontSize: 12, fontVariant: ['tabular-nums'] },
});
