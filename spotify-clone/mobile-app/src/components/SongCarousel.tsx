import { memo, useCallback } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import type { Song } from '@/api/types';
import { player } from '@/player/engine';
import { colors, spacing } from '@/theme';
import { SongCard } from './SongCard';

export const SongCarousel = memo(function SongCarousel({ title, songs }: { title: string; songs: Song[] }) {
  const play = useCallback((song: Song) => void player.playSongs(songs, song.id), [songs]);

  return (
    <View style={styles.section}>
      <Text style={styles.title}>{title}</Text>
      <FlatList
        horizontal
        data={songs}
        keyExtractor={(song) => song.id}
        renderItem={({ item }) => <SongCard song={item} onPress={play} />}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        initialNumToRender={4}
        windowSize={5}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl },
  title: { color: colors.text, fontSize: 20, fontWeight: '700', marginBottom: spacing.md, paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg },
});
