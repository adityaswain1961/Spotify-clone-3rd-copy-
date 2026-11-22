import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_URL } from '@/api/config';
import { useSession } from '@/auth/session';
import { useDownloadedBytes } from '@/downloads/store';
import { useSettings } from '@/settings/store';
import { colors, radius, spacing } from '@/theme';
import { formatBytes } from '@/utils/format';

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          style={[styles.segment, value === option.value && styles.segmentActive]}
        >
          <Text style={[styles.segmentText, value === option.value && styles.segmentTextActive]}>{option.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const user = useSession((state) => state.session?.user);
  const signOut = useSession((state) => state.signOut);
  const downloadedBytes = useDownloadedBytes();

  const confirmSignOut = () =>
    Alert.alert('Log out?', 'Your downloads stay on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Back">
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </Pressable>
        <Text style={styles.heading}>Settings</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xxl }}>
        <Section title="Account">
          <Text style={styles.value}>{user?.displayName}</Text>
          <Text style={styles.hint}>{user?.email}</Text>
        </Section>

        <Section
          title="Streaming quality"
          hint="Auto streams high quality on Wi-Fi and data saver on mobile data, which starts faster and uses about 60% less data."
        >
          <Segmented
            value={settings.streamingQuality}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'low', label: 'Data saver' },
              { value: 'high', label: 'High' },
            ]}
            onChange={(streamingQuality) => settings.set({ streamingQuality })}
          />
        </Section>

        <Section title="Download quality" hint="Applies to new downloads. High is about 1.9 MB per minute, data saver about 0.7 MB.">
          <Segmented
            value={settings.downloadQuality}
            options={[
              { value: 'low', label: 'Data saver' },
              { value: 'high', label: 'High' },
            ]}
            onChange={(downloadQuality) => settings.set({ downloadQuality })}
          />
        </Section>

        <Section title="Downloads">
          <View style={styles.switchRow}>
            <Text style={styles.value}>Download using mobile data</Text>
            <Switch
              value={settings.downloadOverCellular}
              onValueChange={(downloadOverCellular) => settings.set({ downloadOverCellular })}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          <Pressable onPress={() => router.push('/downloads')} style={styles.linkRow}>
            <Text style={styles.value}>Manage downloads</Text>
            <Text style={styles.hint}>{formatBytes(downloadedBytes)}</Text>
          </Pressable>
        </Section>

        <Section title="Server" hint="Set EXPO_PUBLIC_API_URL to point the app somewhere else.">
          <Text style={styles.mono}>{API_URL}</Text>
        </Section>

        <Pressable onPress={confirmSignOut} style={styles.signOut}>
          <Text style={styles.signOutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  heading: { color: colors.text, fontSize: 17, fontWeight: '700' },
  section: { paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, gap: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700' },
  value: { color: colors.text, fontSize: 15 },
  hint: { color: colors.textMuted, fontSize: 13, lineHeight: 18 },
  mono: { color: colors.textMuted, fontFamily: 'monospace', fontSize: 13 },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceRaised, borderRadius: radius.pill, padding: 3 },
  segment: { flex: 1, paddingVertical: 9, borderRadius: radius.pill, alignItems: 'center' },
  segmentActive: { backgroundColor: colors.text },
  segmentText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  segmentTextActive: { color: '#000' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  signOut: {
    alignSelf: 'center',
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
  },
  signOutText: { color: colors.text, fontWeight: '700' },
});
