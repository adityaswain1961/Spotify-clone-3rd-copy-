import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { create } from 'zustand';

interface NetworkState {
  isOnline: boolean;
  /** Unmetered connection (Wi-Fi / ethernet): stream high quality, allow downloads. */
  isUnmetered: boolean;
  type: NetInfoState['type'];
}

export const useNetwork = create<NetworkState>(() => ({
  isOnline: true,
  isUnmetered: true,
  type: 'unknown' as NetInfoState['type'],
}));

function apply(state: NetInfoState): void {
  // isConnected only: isInternetReachable pings public hosts and reports false on a
  // LAN-only dev setup even though the gateway is reachable.
  const isOnline = state.isConnected !== false;
  const isUnmetered = state.type === 'wifi' || state.type === 'ethernet' || state.details?.isConnectionExpensive === false;
  useNetwork.setState({ isOnline, isUnmetered, type: state.type });
  onlineManager.setOnline(isOnline);
}

let started = false;

/** Feeds connectivity into the app and into React Query (pauses fetches/mutations offline). */
export function startNetworkMonitoring(): void {
  if (started) return;
  started = true;
  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      apply(state);
      setOnline(state.isConnected !== false);
    }),
  );
  void NetInfo.fetch().then(apply);
}

/** Resolve once the device is online (immediately if it already is). */
export function whenOnline(): Promise<void> {
  if (useNetwork.getState().isOnline) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useNetwork.subscribe((state) => {
      if (state.isOnline) {
        unsubscribe();
        resolve();
      }
    });
  });
}
