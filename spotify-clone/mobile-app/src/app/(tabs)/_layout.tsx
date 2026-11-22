import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs } from 'expo-router/tabs';
import { ColorValue, View } from 'react-native';
import { MiniPlayer } from '@/components/MiniPlayer';
import { colors } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} size={24} color={color as string} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      // The mini player lives inside the tab bar slot, so every screen is laid out above it.
      tabBar={(props) => (
        <View style={{ backgroundColor: colors.background }}>
          <MiniPlayer />
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.border },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home', 'home-outline') }} />
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarIcon: tabIcon('search', 'search-outline') }} />
      <Tabs.Screen name="library" options={{ title: 'Your Library', tabBarIcon: tabIcon('library', 'library-outline') }} />
    </Tabs>
  );
}
