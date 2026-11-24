import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  PushStatusResponseSchema,
  UserProfileSchema,
  type PushSubscriptionInput,
  type UpdatePreferencesInput,
} from '@studypulse/shared';
import { z } from 'zod';
import { apiRequest } from '@/core/api/client';
import { offlineDb, type OfflineDeckRecord, type SyncOutboxRecord } from '@/core/offline/db';

export const SETTINGS_KEYS = {
  pushStatus: ['settings', 'push-status'] as const,
  offlineOverview: ['settings', 'offline-overview'] as const,
};

export interface OfflineStorageOverview {
  usageBytes: number;
  quotaBytes: number;
  usagePct: number;
  offlineDecks: OfflineDeckRecord[];
  cardsCount: number;
  srsStatesCount: number;
  outboxItems: SyncOutboxRecord[];
}

export function usePushStatusQuery(enabled: boolean) {
  return useQuery({
    queryKey: SETTINGS_KEYS.pushStatus,
    enabled,
    queryFn: ({ signal }) =>
      apiRequest('/api/push/status', {
        schema: PushStatusResponseSchema,
        signal,
      }),
  });
}

export function useUpdatePreferencesMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePreferencesInput) =>
      apiRequest('/api/settings/preferences', {
        method: 'PATCH',
        body: input,
        schema: z.object({ user: UserProfileSchema }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.pushStatus });
    },
  });
}

export function useSubscribePushMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sub: PushSubscriptionInput) =>
      apiRequest('/api/push/subscribe', {
        method: 'POST',
        body: sub,
        schema: PushStatusResponseSchema,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.pushStatus });
    },
  });
}

export function useOfflineStorageOverviewQuery() {
  return useQuery({
    queryKey: SETTINGS_KEYS.offlineOverview,
    queryFn: async (): Promise<OfflineStorageOverview> => {
      const [offlineDecks, cardsCount, srsStatesCount, outboxItems] = await Promise.all([
        offlineDb.offline_decks.toArray(),
        offlineDb.offline_cards.count(),
        offlineDb.local_srs_states.count(),
        offlineDb.sync_outbox.orderBy('createdAt').reverse().toArray(),
      ]);

      let usageBytes = 0;
      let quotaBytes = 50 * 1024 * 1024; // 50 MB fallback estimate

      if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
        try {
          const est = await navigator.storage.estimate();
          usageBytes = est.usage ?? 0;
          quotaBytes = est.quota && est.quota > 0 ? est.quota : quotaBytes;
        } catch {
          // Use fallback
        }
      }

      const usagePct = Math.min(100, Math.round((usageBytes / Math.max(1, quotaBytes)) * 1000) / 10);

      return {
        usageBytes,
        quotaBytes,
        usagePct,
        offlineDecks,
        cardsCount,
        srsStatesCount,
        outboxItems,
      };
    },
  });
}
