import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { configureAuth, isNetworkError } from '@/api/client';
import { api } from '@/api/endpoints';
import type { AuthSession, AuthUser } from '@/api/types';

const STORAGE_KEY = 'session.v1';
/** Refresh this long before expiry, so requests never pay for a 401 round-trip. */
const REFRESH_MARGIN_MS = 60_000;

interface StoredSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: AuthUser;
}

interface SessionState {
  status: 'loading' | 'signedIn' | 'signedOut';
  session: StoredSession | null;
  hydrate(): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  register(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
}

const signOutListeners = new Set<() => void>();

/** Lets the query cache, player and others reset on sign-out without import cycles. */
export function onSignOut(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => signOutListeners.delete(listener);
}

async function save(session: StoredSession | null): Promise<void> {
  if (session) await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(session));
  else await SecureStore.deleteItemAsync(STORAGE_KEY);
}

function toStored(response: AuthSession): StoredSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + response.expiresIn * 1000,
    user: response.user,
  };
}

export const useSession = create<SessionState>((set, get) => ({
  status: 'loading',
  session: null,

  async hydrate() {
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      const session = raw ? (JSON.parse(raw) as StoredSession) : null;
      // Signed in even if the access token expired: it refreshes on first use, and the
      // app must open straight into the library when offline.
      set({ session, status: session ? 'signedIn' : 'signedOut' });
    } catch {
      set({ session: null, status: 'signedOut' });
    }
  },

  async signIn(email, password) {
    const session = toStored(await api.login(email.trim().toLowerCase(), password));
    await save(session);
    set({ session, status: 'signedIn' });
  },

  async register(email, password, displayName) {
    const session = toStored(await api.register(email.trim().toLowerCase(), password, displayName.trim()));
    await save(session);
    set({ session, status: 'signedIn' });
  },

  async signOut() {
    const refreshToken = get().session?.refreshToken;
    await save(null);
    set({ session: null, status: 'signedOut' });
    signOutListeners.forEach((listener) => listener());
    if (refreshToken) api.logout(refreshToken).catch(() => undefined);
  },
}));

let refreshInFlight: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const current = useSession.getState().session;
  if (!current) return null;
  try {
    const session = toStored(await api.refresh(current.refreshToken));
    await save(session);
    useSession.setState({ session });
    return session.accessToken;
  } catch (error) {
    if (isNetworkError(error)) throw error; // offline: keep the session, try again later
    await useSession.getState().signOut(); // refresh token rejected: session is over
    return null;
  }
}

/** Single-flight: concurrent 401s share one refresh (refresh tokens are one-time use). */
function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    // .finally() runs after the assignment, so the slot is always released.
    refreshInFlight = performRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

configureAuth({
  async getAccessToken() {
    const session = useSession.getState().session;
    if (!session) return null;
    if (session.expiresAt - Date.now() > REFRESH_MARGIN_MS) return session.accessToken;
    try {
      return await refreshAccessToken();
    } catch {
      return session.accessToken; // offline: let the request fail on its own
    }
  },
  async refreshAccessToken() {
    try {
      return await refreshAccessToken();
    } catch {
      return null;
    }
  },
});
