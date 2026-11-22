import { CollectionScreen } from '@/components/CollectionScreen';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { useLikedSongs } from '@/hooks/queries';
import { pluralize } from '@/utils/format';

export default function LikedSongsScreen() {
  const liked = useLikedSongs();
  const songs = liked.data?.items ?? [];

  return (
    <CollectionScreen
      title="Liked Songs"
      subtitle={pluralize(liked.data?.total ?? songs.length, 'song')}
      icon="heart"
      songs={songs}
      refreshing={liked.isRefetching}
      onRefresh={() => void liked.refetch()}
      empty={
        liked.isPending ? (
          <LoadingState />
        ) : liked.isError && !songs.length ? (
          <ErrorState message={liked.error.message} onRetry={() => void liked.refetch()} />
        ) : (
          <EmptyState icon="heart-outline" title="Songs you like appear here" body="Long-press any song and choose Like." />
        )
      }
    />
  );
}
