import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useNetwork } from '@/net/network';
import { colors, spacing } from '@/theme';

export function OfflineBanner() {
  const isOnline = useNetwork((state) => state.isOnline);
  if (isOnline) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="cloud-offline" size={14} color="#000" />
      <Text style={styles.text}>Offline · your downloads still play</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.warning,
    paddingVertical: 6,
  },
  text: { color: '#000', fontSize: 12, fontWeight: '700' },
});
