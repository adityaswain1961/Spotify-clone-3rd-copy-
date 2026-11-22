import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDownloadProgress, useDownloadStatus } from '@/downloads/store';
import { colors } from '@/theme';

/** Tiny per-song download indicator: queued, % progress, done or failed. */
export const DownloadBadge = memo(function DownloadBadge({ songId, size = 14 }: { songId: string; size?: number }) {
  const status = useDownloadStatus(songId);
  const progress = useDownloadProgress((state) => state[songId]);

  if (!status) return null;
  if (status === 'done') return <Ionicons name="arrow-down-circle" size={size} color={colors.accent} />;
  if (status === 'error') return <Ionicons name="alert-circle" size={size} color={colors.danger} />;
  if (status === 'queued') return <Ionicons name="time-outline" size={size} color={colors.textMuted} />;
  return (
    <View style={styles.progress}>
      <Ionicons name="arrow-down-circle-outline" size={size} color={colors.accent} />
      <Text style={styles.percent}>{Math.round((progress ?? 0) * 100)}%</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  percent: { fontSize: 10, color: colors.accent, fontVariant: ['tabular-nums'] },
});
