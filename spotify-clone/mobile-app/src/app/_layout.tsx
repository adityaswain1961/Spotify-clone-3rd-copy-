import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useSession } from '@/auth/session';
import { bootstrapApp } from '@/bootstrap';
import { SongActionsSheet } from '@/components/SongActionsSheet';
import { Toaster } from '@/components/Toaster';
import { persistOptions, queryClient } from '@/query/client';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();
bootstrapApp();

const theme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, primary: colors.accent },
};

export default function RootLayout() {
  const status = useSession((state) => state.status);

  useEffect(() => {
    void useSession.getState().hydrate();
  }, []);

  useEffect(() => {
    if (status !== 'loading') SplashScreen.hide();
  }, [status]);

  const signedIn = status === 'signedIn';

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={persistOptions}
      // Replay likes made offline (persisted as paused mutations) once the cache is restored.
      onSuccess={() => void queryClient.resumePausedMutations()}
    >
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
            <Stack.Protected guard={signedIn}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen
                name="player"
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom', gestureEnabled: true }}
              />
              <Stack.Screen name="playlist/[id]" />
              <Stack.Screen name="liked" />
              <Stack.Screen name="downloads" />
              <Stack.Screen name="settings" />
            </Stack.Protected>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
          </Stack>
          {signedIn ? <SongActionsSheet /> : null}
          <Toaster />
        </ThemeProvider>
      </SafeAreaProvider>
    </PersistQueryClientProvider>
  );
}
