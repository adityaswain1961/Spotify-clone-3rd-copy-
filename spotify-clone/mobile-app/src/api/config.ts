import Constants from 'expo-constants';
import { Platform } from 'react-native';

const GATEWAY_PORT = 3000;

/** IP of the computer running `expo start` (Expo Go reports it as "192.168.x.x:8081"). */
function devServerHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  const host = hostUri?.split(':')[0];
  // Tunnel hosts (*.exp.direct) don't expose the gateway; set EXPO_PUBLIC_API_URL instead.
  return host && !host.endsWith('.exp.direct') ? host : null;
}

function resolveApiUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_API_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const host = devServerHost();
  if (host) return `http://${host}:${GATEWAY_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${GATEWAY_PORT}` : `http://localhost:${GATEWAY_PORT}`;
}

export const API_URL = resolveApiUrl();

/** Media and cover URLs may be gateway-relative ("/songs/files/..."); make them absolute. */
export function absoluteUrl(url: string): string;
export function absoluteUrl(url: string | null | undefined): string | null;
export function absoluteUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return /^(https?|file):/i.test(url) ? url : `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
}
