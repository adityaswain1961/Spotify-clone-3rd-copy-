import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { downloadSongs, removeDownload } from '@/downloads/manager';
import { useDownloadStatus } from '@/downloads/store';
import {
  useAddToPlaylist,
  useCreatePlaylist,
  useLikedIds,
  useMyPlaylists,
  useRemoveFromPlaylist,
  useSetLike,
} from '@/hooks/queries';
import { useNetwork } from '@/net/network';
import { player } from '@/player/engine';
import { colors, radius, spacing } from '@/theme';
import { closeSongActions, useSongActions } from '@/ui/song-actions';
import { toast } from '@/ui/toast';
import { Artwork } from './Artwork';

function Action({
  icon,
  label,
  onPress,
  disabled,
  tint = colors.text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tint?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name={icon} size={22} color={tint} />
      <Text style={[styles.actionLabel, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

export function SongActionsSheet() {
  const { song, playlistId } = useSongActions();
  const insets = useSafeAreaInsets();
  const isOnline = useNetwork((state) => state.isOnline);
  const likedIds = useLikedIds();
  const setLike = useSetLike();
  const downloadStatus = useDownloadStatus(song?.id ?? '');
  const playlists = useMyPlaylists();
  const addToPlaylist = useAddToPlaylist();
  const createPlaylist = useCreatePlaylist();
  const removeFromPlaylist = useRemoveFromPlaylist();
  const [pickingPlaylist, setPickingPlaylist] = useState(false);

  const close = () => {
    setPickingPlaylist(false);
    closeSongActions();
  };

  if (!song) return null;
  const liked = likedIds.has(song.id);

  const add = async (targetId: string, title: string) => {
    close();
    try {
      await addToPlaylist.mutateAsync({ playlistId: targetId, songId: song.id });
      toast(`Added to ${title}`);
    } catch (error) {
      toast(error instanceof Error && /exists/i.test(error.message) ? `Already in ${title}` : 'Could not add to playlist');
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Artwork uri={song.coverUrl} songId={song.id} size={48} />
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>{song.title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{song.artistName}</Text>
          </View>
        </View>

        {pickingPlaylist ? (
          <ScrollView style={styles.list}>
            <Action
              icon="add-circle-outline"
              label="New playlist"
              disabled={!isOnline}
              onPress={async () => {
                try {
                  const created = await createPlaylist.mutateAsync(`My playlist #${(playlists.data?.total ?? 0) + 1}`);
                  await add(created.id, created.title);
                } catch {
                  toast('Could not create playlist');
                }
              }}
            />
            {playlists.data?.items.map((playlist) => (
              <Action key={playlist.id} icon="list" label={playlist.title} onPress={() => add(playlist.id, playlist.title)} />
            ))}
          </ScrollView>
        ) : (
          <View>
            <Action
              icon="play-forward-outline"
              label="Play next"
              onPress={() => {
                close();
                void player.playNext(song);
              }}
            />
            <Action
              icon={liked ? 'heart' : 'heart-outline'}
              tint={liked ? colors.accent : colors.text}
              label={liked ? 'Remove from Liked Songs' : 'Add to Liked Songs'}
              onPress={() => {
                close();
                setLike.mutate({ songId: song.id, liked: !liked, song });
                if (!isOnline) toast('Saved - will sync when you are back online');
              }}
            />
            {downloadStatus ? (
              <Action
                icon="trash-outline"
                label={downloadStatus === 'done' ? 'Remove download' : 'Cancel download'}
                onPress={() => {
                  close();
                  removeDownload(song.id);
                }}
              />
            ) : (
              <Action
                icon="arrow-down-circle-outline"
                label="Download"
                onPress={() => {
                  close();
                  downloadSongs([song]);
                  toast(isOnline ? 'Downloading' : 'Will download when you are back online');
                }}
              />
            )}
            <Action icon="add" label="Add to playlist" disabled={!isOnline} onPress={() => setPickingPlaylist(true)} />
            {playlistId ? (
              <Action
                icon="remove-circle-outline"
                label="Remove from this playlist"
                disabled={!isOnline}
                onPress={() => {
                  close();
                  removeFromPlaylist.mutate({ playlistId, songId: song.id });
                }}
              />
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    marginBottom: spacing.sm,
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 16, fontWeight: '600' },
  subtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  list: { maxHeight: 360 },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, paddingVertical: 14 },
  actionLabel: { fontSize: 16 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.35 },
});
