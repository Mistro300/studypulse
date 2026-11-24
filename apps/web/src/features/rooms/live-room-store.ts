import { create } from 'zustand';
import type {
  LiveLeaderboardEntry,
  LiveQuestionPayload,
  LiveQuestionReveal,
  LiveRoomResults,
  RedisLiveRoomState,
} from '@studypulse/shared';
import {
  realtimeManager,
  type RealtimeConnectionStatus,
} from '@/core/realtime/socket-manager';

interface LiveRoomStoreState {
  connectionStatus: RealtimeConnectionStatus;
  clockOffsetMs: number;
  roomState: RedisLiveRoomState | null;
  myParticipantId: string | null;
  mySelectedChoiceId: string | null;
  activeQuestion: LiveQuestionPayload | null;
  lastReveal: LiveQuestionReveal | null;
  leaderboard: LiveLeaderboardEntry[];
  results: LiveRoomResults | null;
  error: { code: string; message: string } | null;

  joinRoom: (code: string) => Promise<void>;
  leaveRoom: () => void;
  toggleReady: () => void;
  updateBotsCount: (count: number) => void;
  startQuiz: () => void;
  submitAnswer: (choiceId: string) => void;
  reconnectNow: () => void;
  clearError: () => void;
}

let bound = false;

export const useLiveRoomStore = create<LiveRoomStoreState>((set, get) => {
  if (!bound) {
    bound = true;
    realtimeManager.bindCallbacks({
      onStatus: (connectionStatus) => set({ connectionStatus }),
      onClockOffset: (clockOffsetMs) => set({ clockOffsetMs }),
      onSnapshot: (snapshot) =>
        set({
          roomState: snapshot.state,
          myParticipantId: snapshot.myParticipantId,
          mySelectedChoiceId: snapshot.mySelectedChoiceId,
          activeQuestion: snapshot.activeQuestion,
          lastReveal: snapshot.lastReveal,
          leaderboard: snapshot.leaderboard,
          results: snapshot.results,
          error: null,
        }),
      onState: (roomState) => set({ roomState }),
      onQuestion: (activeQuestion) =>
        set({
          activeQuestion,
          lastReveal: null,
          mySelectedChoiceId: null,
        }),
      onReveal: (lastReveal) => set({ lastReveal }),
      onLeaderboard: (leaderboard) => set({ leaderboard }),
      onFinished: (results) => set({ results, activeQuestion: null }),
      onError: (error) => set({ error }),
    });
  }

  return {
    connectionStatus: 'idle',
    clockOffsetMs: 0,
    roomState: null,
    myParticipantId: null,
    mySelectedChoiceId: null,
    activeQuestion: null,
    lastReveal: null,
    leaderboard: [],
    results: null,
    error: null,

    joinRoom: async (code) => {
      set({ error: null });
      await realtimeManager.connectAndJoin(code);
    },

    leaveRoom: () => {
      realtimeManager.disconnect(true);
      set({
        roomState: null,
        myParticipantId: null,
        mySelectedChoiceId: null,
        activeQuestion: null,
        lastReveal: null,
        leaderboard: [],
        results: null,
        error: null,
      });
    },

    toggleReady: () => realtimeManager.toggleReady(),
    updateBotsCount: (count) => realtimeManager.updateBotsCount(count),
    startQuiz: () => realtimeManager.startQuiz(),

    submitAnswer: (choiceId) => {
      const { activeQuestion, mySelectedChoiceId, connectionStatus } = get();
      if (!activeQuestion || mySelectedChoiceId || connectionStatus !== 'connected') return;
      set({ mySelectedChoiceId: choiceId });
      realtimeManager.submitAnswer(activeQuestion.questionIndex, choiceId);
    },

    reconnectNow: () => realtimeManager.reconnectNow(),
    clearError: () => set({ error: null }),
  };
});
