import { create } from 'zustand';
import {
  AuthSessionResponseSchema,
  UserProfileSchema,
  type AuthSessionResponse,
  type LoginInput,
  type RegisterInput,
  type UpdateOnboardingInput,
  type UserProfile,
} from '@studypulse/shared';
import { z } from 'zod';
import {
  ApiClientError,
  apiRequest,
  onSessionExpired,
  onTokenRefreshed,
  performSilentRefresh,
  setAccessToken,
} from '@/core/api/client';
import { setAppLocale } from '@/core/i18n';
import { clearAllLocalUserData, offlineDb } from '@/core/offline/db';
import { queryClient } from '@/app/providers/query-client';

export type AuthStatus = 'booting' | 'authenticated' | 'offline-cached' | 'unauthenticated';

interface AuthStoreState {
  status: AuthStatus;
  user: UserProfile | null;
  sessionExpiredModalOpen: boolean;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<UserProfile>;
  register: (input: RegisterInput) => Promise<UserProfile>;
  loginDemo: () => Promise<UserProfile>;
  completeOnboarding: (input: UpdateOnboardingInput) => Promise<UserProfile>;
  logout: () => Promise<void>;
  dismissSessionExpired: () => void;
  trySilentReconnect: () => Promise<void>;
}

async function persistCachedProfile(user: UserProfile): Promise<void> {
  await offlineDb.cached_session_profile.put({
    id: 'current',
    userId: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    locale: user.preferences.locale,
    theme: user.preferences.theme,
    dailyGoal: user.preferences.dailyGoal,
    streakDays: user.streakDays,
    cachedAt: new Date().toISOString(),
  });
}

async function readCachedProfile(): Promise<UserProfile | null> {
  const cached = await offlineDb.cached_session_profile.get('current');
  if (!cached) return null;
  return {
    id: cached.userId,
    email: cached.email,
    displayName: cached.displayName,
    avatarUrl: cached.avatarUrl ?? null,
    streakDays: cached.streakDays,
    preferences: {
      theme: cached.theme,
      locale: cached.locale,
      dailyGoal: cached.dailyGoal,
      interests: [],
      onboardingCompleted: true,
    },
  };
}

async function applySession(session: AuthSessionResponse): Promise<UserProfile> {
  setAccessToken(session.accessToken);
  await persistCachedProfile(session.user);
  return session.user;
}

let listenersBound = false;

export const useAuthStore = create<AuthStoreState>((set, get) => {
  if (!listenersBound && typeof window !== 'undefined') {
    listenersBound = true;

    onSessionExpired(() => {
      // Non-destructive: keep current route & unsaved inputs mounted behind the 401 modal
      set({ sessionExpiredModalOpen: true });
    });

    onTokenRefreshed((session) => {
      void persistCachedProfile(session.user);
      set({
        status: 'authenticated',
        user: session.user,
        sessionExpiredModalOpen: false,
      });
    });

    window.addEventListener('online', () => {
      if (get().status === 'offline-cached') {
        void get().trySilentReconnect();
      }
    });
  }

  return {
    status: 'booting',
    user: null,
    sessionExpiredModalOpen: false,

    bootstrap: async () => {
      try {
        const session = await performSilentRefresh();
        if (session) {
          await persistCachedProfile(session.user);
          set({
            status: 'authenticated',
            user: session.user,
            sessionExpiredModalOpen: false,
          });
          return;
        }
        // Server explicitly rejected refresh (HTTP 401)
        set({ status: 'unauthenticated', user: null, sessionExpiredModalOpen: false });
      } catch (err) {
        // Offline Auth Continuity: never kick the user to login on network outage!
        if (err instanceof ApiClientError && err.normalized.code === 'NETWORK_OFFLINE') {
          const cached = await readCachedProfile();
          if (cached) {
            set({ status: 'offline-cached', user: cached, sessionExpiredModalOpen: false });
            return;
          }
        }
        set({ status: 'unauthenticated', user: null, sessionExpiredModalOpen: false });
      }
    },

    trySilentReconnect: async () => {
      try {
        const session = await performSilentRefresh();
        if (session) {
          await persistCachedProfile(session.user);
          set({
            status: 'authenticated',
            user: session.user,
            sessionExpiredModalOpen: false,
          });
        } else {
          // Server explicitly rejected cookie after reconnecting -> non-destructive 401 modal
          set({ sessionExpiredModalOpen: true });
        }
      } catch {
        // Still offline — stay in offline-cached mode cleanly
      }
    },

    login: async (input) => {
      const session = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: input,
        schema: AuthSessionResponseSchema,
        skipAuthRefresh: true,
      });
      const user = await applySession(session);
      set({ status: 'authenticated', user, sessionExpiredModalOpen: false });
      return user;
    },

    register: async (input) => {
      const session = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: input,
        schema: AuthSessionResponseSchema,
        skipAuthRefresh: true,
      });
      const user = await applySession(session);
      setAppLocale(user.preferences.locale);
      set({ status: 'authenticated', user, sessionExpiredModalOpen: false });
      return user;
    },

    loginDemo: async () => {
      const session = await apiRequest('/api/auth/demo', {
        method: 'POST',
        schema: AuthSessionResponseSchema,
        skipAuthRefresh: true,
      });
      const user = await applySession(session);
      set({ status: 'authenticated', user, sessionExpiredModalOpen: false });
      return user;
    },

    completeOnboarding: async (input) => {
      const res = await apiRequest('/api/auth/onboarding', {
        method: 'PATCH',
        body: input,
        schema: z.object({ user: UserProfileSchema }),
      });
      await persistCachedProfile(res.user);
      set({ user: res.user });
      return res.user;
    },

    logout: async () => {
      try {
        await apiRequest('/api/auth/logout', {
          method: 'POST',
          skipAuthRefresh: true,
        });
      } catch {
        // Proceed with full local purge even if offline
      } finally {
        setAccessToken(null);
        queryClient.clear();
        await clearAllLocalUserData();
        set({
          status: 'unauthenticated',
          user: null,
          sessionExpiredModalOpen: false,
        });
      }
    },

    dismissSessionExpired: () => set({ sessionExpiredModalOpen: false }),
  };
});
