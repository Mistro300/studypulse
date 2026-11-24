import { create } from 'zustand';
import {
  BatchReviewSyncResponseSchema,
  scheduleNextReview,
  type ReviewEventInput,
  type SrsCardSnapshot,
  type SrsRating,
} from '@studypulse/shared';
import { ApiClientError, apiRequest } from '@/core/api/client';
import { offlineDb, type ReviewOutboxPayload } from '@/core/offline/db';
import { queryClient } from '@/app/providers/query-client';

interface SyncStoreState {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  refreshPendingCount: (userId?: string) => Promise<number>;
  recordReviewOfflineFirst: (params: {
    userId: string;
    cardId: string;
    deckId: string;
    currentSrs: SrsCardSnapshot | null;
    rating: SrsRating;
    durationMs: number;
  }) => Promise<{ nextSrs: SrsCardSnapshot; syncedImmediately: boolean }>;
  flushOutbox: (userId?: string) => Promise<{ synced: number }>;
}

let flushInFlight: Promise<{ synced: number }> | null = null;
let syncListenersBound = false;

export const useSyncStore = create<SyncStoreState>((set, get) => {
  if (!syncListenersBound && typeof window !== 'undefined') {
    syncListenersBound = true;

    const triggerFlush = () => {
      if (navigator.onLine) {
        void get().flushOutbox();
      }
    };

    window.addEventListener('online', triggerFlush);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        triggerFlush();
      }
    });
  }

  return {
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    lastError: null,

    refreshPendingCount: async (userId) => {
      const count = userId
        ? await offlineDb.sync_outbox
            .where('[userId+status]')
            .equals([userId, 'PENDING'])
            .count()
        : await offlineDb.sync_outbox.where('status').equals('PENDING').count();
      set({ pendingCount: count });
      return count;
    },

    recordReviewOfflineFirst: async ({
      userId,
      cardId,
      deckId,
      currentSrs,
      rating,
      durationMs,
    }) => {
      const now = new Date();
      const nowIso = now.toISOString();
      const idempotencyKey = crypto.randomUUID();

      // 1. Run deterministic FSRS-5 locally for instant 0ms UI feedback
      const nextSrs = scheduleNextReview(currentSrs, rating, now);

      const payload: ReviewOutboxPayload = {
        cardId,
        deckId,
        rating,
        durationMs: Math.max(0, Math.round(durationMs)),
        clientTimestamp: nowIso,
      };

      // 2. Persist local SRS state & Outbox event atomically in IndexedDB
      await offlineDb.transaction(
        'rw',
        offlineDb.local_srs_states,
        offlineDb.sync_outbox,
        async () => {
          await offlineDb.local_srs_states.put({
            key: `${userId}:${cardId}`,
            userId,
            cardId,
            deckId,
            due: nextSrs.due,
            stability: nextSrs.stability,
            difficulty: nextSrs.difficulty,
            elapsedDays: nextSrs.elapsedDays,
            scheduledDays: nextSrs.scheduledDays,
            reps: nextSrs.reps,
            lapses: nextSrs.lapses,
            state: nextSrs.state,
            lastReview: nextSrs.lastReview,
            updatedAt: nowIso,
          });

          await offlineDb.sync_outbox.put({
            idempotencyKey,
            userId,
            kind: 'REVIEW_EVENT',
            entityId: cardId,
            payload: payload as unknown as Record<string, unknown>,
            clientTimestamp: nowIso,
            status: 'PENDING',
            attempts: 0,
            lastError: null,
            createdAt: nowIso,
          });
        },
      );

      await get().refreshPendingCount(userId);

      // 3. Flush immediately if online; otherwise stay safely queued in Dexie
      let syncedImmediately = false;
      if (typeof navigator === 'undefined' || navigator.onLine) {
        const res = await get().flushOutbox(userId);
        syncedImmediately = res.synced > 0;
      }

      return { nextSrs, syncedImmediately };
    },

    flushOutbox: async (userId) => {
      if (flushInFlight) return flushInFlight;

      flushInFlight = (async () => {
        try {
          const pending = userId
            ? await offlineDb.sync_outbox
                .where('[userId+status]')
                .equals([userId, 'PENDING'])
                .toArray()
            : await offlineDb.sync_outbox.filter((r) => r.status === 'PENDING').toArray();

          const reviewRecords = pending.filter((r) => r.kind === 'REVIEW_EVENT');
          if (reviewRecords.length === 0) {
            set({ pendingCount: pending.length, isSyncing: false });
            return { synced: 0 };
          }

          set({ isSyncing: true, lastError: null });

          const events: ReviewEventInput[] = reviewRecords.map((rec) => {
            const p = rec.payload as unknown as ReviewOutboxPayload;
            return {
              idempotencyKey: rec.idempotencyKey,
              cardId: p.cardId,
              deckId: p.deckId,
              rating: p.rating,
              durationMs: p.durationMs,
              clientTimestamp: p.clientTimestamp,
            };
          });

          await apiRequest('/api/study/reviews/batch', {
            method: 'POST',
            body: { events },
            schema: BatchReviewSyncResponseSchema,
          });

          await offlineDb.sync_outbox.bulkDelete(reviewRecords.map((r) => r.idempotencyKey));
          const remaining = await get().refreshPendingCount(userId);

          set({
            isSyncing: false,
            pendingCount: remaining,
            lastSyncedAt: new Date().toISOString(),
            lastError: null,
          });

          void queryClient.invalidateQueries({ queryKey: ['decks'] });
          void queryClient.invalidateQueries({ queryKey: ['analytics'] });

          return { synced: reviewRecords.length };
        } catch (err) {
          const isOffline =
            err instanceof ApiClientError && err.normalized.code === 'NETWORK_OFFLINE';
          set({
            isSyncing: false,
            lastError: isOffline
              ? null
              : err instanceof Error
                ? err.message
                : 'Sync failed',
          });
          return { synced: 0 };
        } finally {
          flushInFlight = null;
        }
      })();

      return flushInFlight;
    },
  };
});
