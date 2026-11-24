import { useQuery } from '@tanstack/react-query';
import {
  AnalyticsOverviewResponseSchema,
  StudyQueueResponseSchema,
  type StudyCardWithSrs,
  type StudyQueueResponse,
} from '@studypulse/shared';
import { ApiClientError, apiRequest } from '@/core/api/client';
import { offlineDb } from '@/core/offline/db';

export const STUDY_KEYS = {
  queue: (deckId?: string) => ['study', 'queue', deckId ?? 'all'] as const,
  analytics: ['analytics', 'overview'] as const,
};

async function readOfflineStudyQueueFallback(
  userId: string,
  deckId?: string,
): Promise<StudyQueueResponse> {
  const nowMs = Date.now();
  const [decks, cards, localStates, cachedProfile] = await Promise.all([
    offlineDb.offline_decks.toArray(),
    deckId
      ? offlineDb.offline_cards.where('deckId').equals(deckId).toArray()
      : offlineDb.offline_cards.toArray(),
    offlineDb.local_srs_states.where('userId').equals(userId).toArray(),
    offlineDb.cached_session_profile.get('current'),
  ]);

  const deckTitles = new Map(decks.map((d) => [d.id, d.title]));
  const srsByCard = new Map(localStates.map((s) => [s.cardId, s]));

  const items: StudyCardWithSrs[] = [];
  for (const c of cards) {
    const local = srsByCard.get(c.id);
    if (local && new Date(local.due).getTime() > nowMs) continue;

    items.push({
      deckTitle: deckTitles.get(c.deckId) ?? 'Offline Deck',
      card: {
        id: c.id,
        deckId: c.deckId,
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation,
        choices: c.choices,
        correctChoiceId: c.correctChoiceId,
        tags: c.tags,
        createdAt: c.updatedAt,
        updatedAt: c.updatedAt,
      },
      srs: local
        ? {
            due: local.due,
            stability: local.stability,
            difficulty: local.difficulty,
            elapsedDays: local.elapsedDays,
            scheduledDays: local.scheduledDays,
            reps: local.reps,
            lapses: local.lapses,
            state: local.state,
            lastReview: local.lastReview,
          }
        : null,
    });
  }

  return {
    items,
    dueTotal: items.length,
    reviewedToday: 0,
    dailyGoal: cachedProfile?.dailyGoal ?? 20,
  };
}

export function useStudyQueueQuery(userId: string | undefined, deckId?: string) {
  return useQuery({
    queryKey: STUDY_KEYS.queue(deckId),
    enabled: Boolean(userId),
    queryFn: async ({ signal }) => {
      const qs = deckId ? `?deckId=${encodeURIComponent(deckId)}` : '';
      try {
        return await apiRequest(`/api/study/queue${qs}`, {
          schema: StudyQueueResponseSchema,
          signal,
        });
      } catch (err) {
        if (err instanceof ApiClientError && err.normalized.code === 'NETWORK_OFFLINE' && userId) {
          return readOfflineStudyQueueFallback(userId, deckId);
        }
        throw err;
      }
    },
  });
}

export function useAnalyticsOverviewQuery() {
  return useQuery({
    queryKey: STUDY_KEYS.analytics,
    queryFn: ({ signal }) =>
      apiRequest('/api/analytics/overview', {
        schema: AnalyticsOverviewResponseSchema,
        signal,
      }),
  });
}
