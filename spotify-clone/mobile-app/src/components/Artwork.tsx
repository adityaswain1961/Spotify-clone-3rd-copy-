import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { absoluteUrl } from '@/api/config';
import { coverFileFor, useDownloads } from '@/downloads/store';
import { colors } from '@/theme';

interface ArtworkProps {
  uri: string | null | undefined;
  /** When set, a downloaded cover file is preferred, so artwork also shows offline. */
  songId?: string;
  size: number;
  radius?: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

export const Artwork = memo(function Artwork({ uri, songId, size, radius = 4, icon = 'musical-notes' }: ArtworkProps) {
  const hasLocalCover = useDownloads((state) =>
    songId ? state.items[songId]?.status === 'done' && state.items[songId]?.hasCover : false,
  );
  const source = hasLocalCover && songId ? coverFileFor(songId).uri : absoluteUrl(uri);
  const box = { width: size, height: size, borderRadius: radius };

  if (!source) {
    return (
      <View style={[styles.placeholder, box]}>
        <Ionicons name={icon} size={size * 0.4} color={colors.textFaint} />
      </View>
    );
  }
  return (
    <Image
      source={source}
      style={[box, styles.image]}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={source}
      transition={120}
    />
  );
});

const styles = StyleSheet.create({
  placeholder: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  image: { backgroundColor: colors.surfaceRaised },
});
