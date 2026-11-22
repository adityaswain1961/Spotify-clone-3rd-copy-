import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState, ErrorState, LoadingState } from '@/components/ScreenState';
import { SongCarousel } from '@/components/SongCarousel';
import { useDownloadedSongs } from '@/downloads/store';
import { useHome } from '@/hooks/queries';
import { useNetwork } from '@/net/network';
import { colors, spacing } from '@/theme';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const home = useHome();
  const downloads = useDownloadedSongs();
  const isOnline = useNetwork((state) => state.isOnline);
  const name = useSession((state) => state.session?.user.displayName);

  const sections = home.data?.sections ?? [];
  const downloadsSection = downloads.length ? <SongCarousel title="Your downloads" songs={downloads} /> : null;

  let body: React.ReactNode;
  if (sections.length) {
    body = sections.map((section) => <SongCarousel key={section.id} title={section.title} songs={section.items} />);
  } else if (home.isPending && isOnline) {
    body = <LoadingState />;
  } else if (!isOnline) {
    body = downloads.length ? null : (
      <EmptyState
        icon="cloud-offline-outline"
        title="You're offline"
        body="Download songs while you're online and they'll play here without a connection."
      />
    );
  } else if (home.isError) {
    body = <ErrorState message={home.error.message} onRetry={() => void home.refetch()} />;
  } else {
    body = <EmptyState icon="musical-notes-outline" title="No music yet" body="Run `pnpm db:seed` on the server to add demo songs." />;
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={home.isRefetching}
            onRefresh={() => void home.refetch()}
            tintColor={colors.accent}
            enabled={isOnline}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            {name ? <Text style={styles.name}>{name}</Text> : null}
          </View>
          <Pressable onPress={() => router.push('/settings')} hitSlop={12} accessibilityLabel="Settings">
            <Ionicons name="settings-outline" size={24} color={colors.text} />
          </Pressable>
        </View>
        {/* Offline, downloads are what matters - show them first. */}
        {!isOnline ? downloadsSection : null}
        {body}
        {isOnline ? downloadsSection : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  greeting: { color: colors.text, fontSize: 26, fontWeight: '800' },
  name: { color: colors.textMuted, fontSize: 14, marginTop: 2 },
});
