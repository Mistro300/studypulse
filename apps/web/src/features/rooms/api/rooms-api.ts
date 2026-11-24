import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  LiveRoomListResponseSchema,
  LiveRoomSummarySchema,
  type AddMistakesToDeckInput,
  type CreateLiveRoomInput,
} from '@studypulse/shared';
import { z } from 'zod';
import { apiRequest } from '@/core/api/client';

export const ROOM_KEYS = {
  list: ['rooms', 'public'] as const,
};

export function usePublicRoomsQuery(enabled: boolean) {
  return useQuery({
    queryKey: ROOM_KEYS.list,
    enabled,
    refetchInterval: 10_000,
    queryFn: async ({ signal }) => {
      const res = await apiRequest('/api/rooms', {
        schema: LiveRoomListResponseSchema,
        signal,
      });
      return res.rooms;
    },
  });
}

export function useCreateLiveRoomMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLiveRoomInput) =>
      apiRequest('/api/rooms', {
        method: 'POST',
        body: input,
        schema: z.object({ room: LiveRoomSummarySchema }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ROOM_KEYS.list });
    },
  });
}

export function useAddMistakesToDeckMutation(roomCode: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddMistakesToDeckInput) =>
      apiRequest(`/api/rooms/${roomCode}/mistakes-deck`, {
        method: 'POST',
        body: input,
        schema: z.object({ deckId: z.string().uuid(), cardCount: z.number().int() }),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['decks'] });
    },
  });
}
