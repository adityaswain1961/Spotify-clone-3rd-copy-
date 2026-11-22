import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Song } from '@/api/types';
import { Artwork } from '@/components/Artwork';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorState } from '@/components/ScreenState';
import { SongRow } from '@/components/SongRow';
import { useDownloadedSongs } from '@/downloads/store';
import { useSearch } from '@/hooks/queries';
import { useNetwork } from '@/net/network';
import { player } from '@/player/engine';
import { colors, radius, spacing } from '@/theme';

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 250);
  const isOnline = useNetwork((state) => state.isOnline);
  const search = useSearch(isOnline ? query : '');
  const downloads = useDownloadedSongs();

  // Offline, search what's on the device instead.
  const offlineMatches = useMemo(() => {
    if (isOnline || !query) return [];
    const needle = query.toLowerCase();
    return downloads.filter(
      (song) => song.title.toLowerCase().includes(needle) || song.artistName.toLowerCase().includes(needle),
    );
  }, [isOnline, query, downloads]);

  const songs: Song[] = isOnline ? search.data?.songs ?? [] : offlineMatches;
  const play = useCallback((song: Song) => void player.playSongs(songs, song.id), [songs]);
  const artists = isOnline ? search.data?.artists ?? [] : [];
  const playlists = isOnline ? search.data?.playlists ?? [] : [];
  const nothingFound = query && !songs.length && !artists.length && !playlists.length && !search.isFetching;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />
      <Text style={styles.heading}>Search</Text>
      <View style={styles.inputWrap}>
        <Ionicons name="search" size={20} color="#000" />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={isOnline ? 'Songs, artists or playlists' : 'Search your downloads'}
          placeholderTextColor="#555"
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.isFetching ? <ActivityIndicator color="#000" size="small" /> : null}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss} contentContainerStyle={styles.results}>
        {!query ? (
          <EmptyState
            icon="search"
            title={isOnline ? 'Find something to play' : 'Search your downloads'}
            body={isOnline ? 'Results appear as you type.' : "You're offline, so results come from songs on this device."}
          />
        ) : search.isError && !songs.length ? (
          <ErrorState message={search.error.message} onRetry={() => void search.refetch()} />
        ) : nothingFound ? (
          <EmptyState icon="sad-outline" title={`No results for "${query}"`} />
        ) : null}

        {songs.length ? (
          <>
            <SectionTitle>Songs</SectionTitle>
            {songs.map((song) => (
              <SongRow key={song.id} song={song} onPress={play} />
            ))}
          </>
        ) : null}

        {artists.length ? (
          <>
            <SectionTitle>Artists</SectionTitle>
            {artists.map((artist) => (
              <View key={artist.id} style={styles.item}>
                <Artwork uri={artist.avatarUrl} size={48} radius={24} icon="person" />
                <Text style={styles.itemTitle} numberOfLines={1}>{artist.name}</Text>
              </View>
            ))}
          </>
        ) : null}

        {playlists.length ? (
          <>
            <SectionTitle>Playlists</SectionTitle>
            {playlists.map((playlist) => (
              <Pressable
                key={playlist.id}
                style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.surface }]}
                onPress={() => router.push({ pathname: '/playlist/[id]', params: { id: playlist.id } })}
              >
                <Artwork uri={playlist.coverUrl} size={48} icon="list" />
                <Text style={styles.itemTitle} numberOfLines={1}>{playlist.title}</Text>
              </Pressable>
            ))}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  heading: { color: colors.text, fontSize: 26, fontWeight: '800', paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.text,
    borderRadius: radius.md,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, color: '#000', fontSize: 16, paddingVertical: 12 },
  results: { paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  itemTitle: { color: colors.text, fontSize: 15, flex: 1 },
});
