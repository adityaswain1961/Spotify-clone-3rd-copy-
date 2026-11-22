import { useLocalSearchParams } from 'expo-router';
import { useSession } from '@/auth/session';
import { CollectionScreen } from '@/components/CollectionScreen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { usePlaylist } from '@/hooks/queries';
import { pluralize } from '@/utils/format';

export default function PlaylistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const playlist = usePlaylist(id);
  const userId = useSession((state) => state.session?.user.id);
  const data = playlist.data;
  const isOwner = Boolean(data && data.ownerId === userId);

  return (
    <CollectionScreen
      title={data?.title ?? 'Playlist'}
      subtitle={data ? `${data.isPublic ? 'Public' : 'Private'} playlist · ${pluralize(data.songs.length, 'song')}` : undefined}
      coverUrl={data?.coverUrl}
      icon="list"
      songs={data?.songs ?? []}
      playlistId={isOwner ? id : undefined}
      refreshing={playlist.isRefetching}
      onRefresh={() => void playlist.refetch()}
      empty={
        playlist.isPending ? (
          <LoadingState />
        ) : playlist.isError && !data ? (
          <ErrorState message={playlist.error.message} onRetry={() => void playlist.refetch()} />
        ) : (
          <EmptyState icon="musical-notes-outline" title="This playlist is empty" body="Long-press a song anywhere and choose Add to playlist." />
        )
      }
    />
  );
}
