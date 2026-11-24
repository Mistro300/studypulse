import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CardSchema,
  DeckDetailResponseSchema,
  DeckListResponseSchema,
  DeckSchema,
  ImportResultResponseSchema,
  QuestionSourcesResponseSchema,
  type CardDto,
  type CreateCardInput,
  type CreateDeckInput,
  type DeckDetailResponse,
  type DeckDto,
  type GenerateFromNotesInput,
  type ImportQuestionsInput,
  type UpdateCardInput,
} from '@studypulse/shared';
import { z } from 'zod';
import { ApiClientError, apiRequest } from '@/core/api/client';
import { offlineDb } from '@/core/offline/db';

export const DECK_KEYS = {
  all: ['decks'] as const,
  list: (filters: { search?: string; topic?: string; language?: string }) =>
    ['decks', 'list', filters] as const,
  detail: (deckId: string) => ['decks', 'detail', deckId] as const,
  offlineIds: ['decks', 'offline-ids'] as const,
  sources: ['question-sources'] as const,
};

async function readOfflineDecksFallback(filters: {
  search?: string;
  topic?: string;
  language?: string;
}): Promise<DeckDto[]> {
  const rows = await offlineDb.offline_decks.toArray();
  const q = filters.search?.trim().toLowerCase();
  return rows
    .filter((d) => {
      if (filters.topic && d.topic.toLowerCase() !== filters.topic.toLowerCase()) return false;
      if (filters.language && d.language !== filters.language) return false;
      if (
        q &&
        !d.title.toLowerCase().includes(q) &&
        !(d.description ?? '').toLowerCase().includes(q) &&
        !d.topic.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    })
    .map((d) => ({
      id: d.id,
      ownerId: d.ownerId,
      title: d.title,
      description: d.description,
      topic: d.topic,
      language: d.language,
      isPublic: d.isPublic,
      cardCount: d.cardCount,
      dueCount: d.cardCount,
      createdAt: d.downloadedAt,
      updatedAt: d.updatedAt,
    }));
}

async function readOfflineDeckDetailFallback(deckId: string): Promise<DeckDetailResponse | null> {
  const deck = await offlineDb.offline_decks.get(deckId);
  if (!deck) return null;
  const cards = await offlineDb.offline_cards.where('deckId').equals(deckId).toArray();
  return {
    deck: {
      id: deck.id,
      ownerId: deck.ownerId,
      title: deck.title,
      description: deck.description,
      topic: deck.topic,
      language: deck.language,
      isPublic: deck.isPublic,
      cardCount: cards.length,
      dueCount: cards.length,
      createdAt: deck.downloadedAt,
      updatedAt: deck.updatedAt,
    },
    cards: cards.map((c) => ({
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
    })),
  };
}

export function useDecksQuery(filters: { search?: string; topic?: string; language?: string }) {
  return useQuery({
    queryKey: DECK_KEYS.list(filters),
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams();
      if (filters.search?.trim()) params.set('search', filters.search.trim());
      if (filters.topic) params.set('topic', filters.topic);
      if (filters.language) params.set('language', filters.language);
      const qs = params.toString();

      try {
        const res = await apiRequest(`/api/decks${qs ? `?${qs}` : ''}`, {
          schema: DeckListResponseSchema,
          signal,
        });
        return res.decks;
      } catch (err) {
        if (err instanceof ApiClientError && err.normalized.code === 'NETWORK_OFFLINE') {
          return readOfflineDecksFallback(filters);
        }
        throw err;
      }
    },
  });
}

export function useDeckDetailQuery(deckId: string) {
  return useQuery({
    queryKey: DECK_KEYS.detail(deckId),
    queryFn: async ({ signal }) => {
      try {
        const detail = await apiRequest(`/api/decks/${deckId}`, {
          schema: DeckDetailResponseSchema,
          signal,
        });
        // If this deck is pinned offline, keep its local IndexedDB copy fresh automatically
        const isPinned = await offlineDb.offline_decks.get(deckId);
        if (isPinned) {
          await saveDeckToOfflineDb(detail.deck, detail.cards);
        }
        return detail;
      } catch (err) {
        if (err instanceof ApiClientError && err.normalized.code === 'NETWORK_OFFLINE') {
          const fallback = await readOfflineDeckDetailFallback(deckId);
          if (fallback) return fallback;
        }
        throw err;
      }
    },
  });
}

export function useOfflineDeckIdsQuery() {
  return useQuery({
    queryKey: DECK_KEYS.offlineIds,
    queryFn: async () => {
      const rows = await offlineDb.offline_decks.toArray();
      return new Set(rows.map((r) => r.id));
    },
  });
}

export async function saveDeckToOfflineDb(deck: DeckDto, cards: CardDto[]): Promise<void> {
  const now = new Date().toISOString();
  await offlineDb.transaction('rw', offlineDb.offline_decks, offlineDb.offline_cards, async () => {
    await offlineDb.offline_decks.put({
      id: deck.id,
      ownerId: deck.ownerId,
      title: deck.title,
      description: deck.description ?? null,
      topic: deck.topic,
      language: deck.language,
      isPublic: deck.isPublic,
      cardCount: cards.length,
      downloadedAt: now,
      updatedAt: deck.updatedAt,
    });
    await offlineDb.offline_cards.where('deckId').equals(deck.id).delete();
    await offlineDb.offline_cards.bulkPut(
      cards.map((c) => ({
        id: c.id,
        deckId: c.deckId,
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation ?? null,
        choices: c.choices ?? null,
        correctChoiceId: c.correctChoiceId ?? null,
        tags: c.tags,
        updatedAt: c.updatedAt,
      })),
    );
  });
}

export function useToggleOfflineDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { deckId: string; currentlyOffline: boolean }) => {
      if (params.currentlyOffline) {
        await offlineDb.transaction(
          'rw',
          offlineDb.offline_decks,
          offlineDb.offline_cards,
          async () => {
            await offlineDb.offline_decks.delete(params.deckId);
            await offlineDb.offline_cards.where('deckId').equals(params.deckId).delete();
          },
        );
        return false;
      }

      const detail = await apiRequest(`/api/decks/${params.deckId}`, {
        schema: DeckDetailResponseSchema,
      });
      await saveDeckToOfflineDb(detail.deck, detail.cards);
      return true;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.offlineIds });
    },
  });
}

export function useCreateDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDeckInput) =>
      apiRequest('/api/decks', {
        method: 'POST',
        body: input,
        schema: z.object({ deck: DeckSchema }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
    },
  });
}

export function useDeleteDeckMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (deckId: string) => {
      await apiRequest(`/api/decks/${deckId}`, { method: 'DELETE' });
      await offlineDb.offline_decks.delete(deckId);
      await offlineDb.offline_cards.where('deckId').equals(deckId).delete();
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
      void qc.invalidateQueries({ queryKey: DECK_KEYS.offlineIds });
    },
  });
}

export function useCreateCardMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCardInput) =>
      apiRequest(`/api/decks/${deckId}/cards`, {
        method: 'POST',
        body: input,
        schema: z.object({ card: CardSchema }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.detail(deckId) });
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
    },
  });
}

export function useUpdateCardMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, input }: { cardId: string; input: UpdateCardInput }) =>
      apiRequest(`/api/decks/${deckId}/cards/${cardId}`, {
        method: 'PATCH',
        body: input,
        schema: z.object({ card: CardSchema }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.detail(deckId) });
    },
  });
}

export function useDeleteCardMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cardId: string) =>
      apiRequest(`/api/decks/${deckId}/cards/${cardId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.detail(deckId) });
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
    },
  });
}

export function useQuestionSourcesQuery(enabled: boolean) {
  return useQuery({
    queryKey: DECK_KEYS.sources,
    enabled,
    queryFn: () =>
      apiRequest('/api/sources/packs', {
        schema: QuestionSourcesResponseSchema,
      }),
  });
}

export function useImportQuestionsMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ImportQuestionsInput) =>
      apiRequest(`/api/decks/${deckId}/import`, {
        method: 'POST',
        body: input,
        schema: ImportResultResponseSchema,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.detail(deckId) });
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
    },
  });
}

export function useGenerateFromNotesMutation(deckId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateFromNotesInput) =>
      apiRequest(`/api/decks/${deckId}/generate-from-notes`, {
        method: 'POST',
        body: input,
        schema: ImportResultResponseSchema,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DECK_KEYS.detail(deckId) });
      void qc.invalidateQueries({ queryKey: DECK_KEYS.all });
    },
  });
}
