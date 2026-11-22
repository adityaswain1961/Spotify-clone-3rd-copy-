import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AudioQuality } from '@/api/types';

interface SettingsState {
  /** auto = high on Wi-Fi, low on mobile data (starts faster, uses ~60% less data). */
  streamingQuality: 'auto' | AudioQuality;
  downloadQuality: AudioQuality;
  downloadOverCellular: boolean;
  set(patch: Partial<Omit<SettingsState, 'set'>>): void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      streamingQuality: 'auto',
      downloadQuality: 'high',
      downloadOverCellular: false,
      set: (patch) => set(patch),
    }),
    {
      name: 'settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ set: _set, ...rest }) => rest,
    },
  ),
);
