import { io, type Socket } from 'socket.io-client';
import {
  LiveLeaderboardEntrySchema,
  LiveQuestionPayloadSchema,
  LiveQuestionRevealSchema,
  LiveRoomResultsSchema,
  LiveRoomSnapshotSchema,
  RedisLiveRoomStateSchema,
  type LiveLeaderboardEntry,
  type LiveQuestionPayload,
  type LiveQuestionReveal,
  type LiveRoomResults,
  type LiveRoomSnapshot,
  type RedisLiveRoomState,
} from '@studypulse/shared';
import { z } from 'zod';
import { getAccessToken, performSilentRefresh } from '@/core/api/client';

export type RealtimeConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface RealtimeCallbacks {
  onStatus: (status: RealtimeConnectionStatus) => void;
  onClockOffset: (offsetMs: number) => void;
  onSnapshot: (snapshot: LiveRoomSnapshot) => void;
  onState: (state: RedisLiveRoomState) => void;
  onQuestion: (question: LiveQuestionPayload) => void;
  onReveal: (reveal: LiveQuestionReveal) => void;
  onLeaderboard: (leaderboard: LiveLeaderboardEntry[], endsAtMs: number) => void;
  onFinished: (results: LiveRoomResults) => void;
  onError: (error: { code: string; message: string }) => void;
}

function resolveSocketUrl(): string {
  const configured = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    // Use same-origin Vite WebSocket proxy in dev
    return window.location.origin;
  }
  return configured || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');
}

class RealtimeManager {
  private socket: Socket | null = null;
  private activeRoomCode: string | null = null;
  private callbacks: RealtimeCallbacks | null = null;

  bindCallbacks(callbacks: RealtimeCallbacks): void {
    this.callbacks = callbacks;
  }

  private updateClockOffset(serverTimestampMs: number): void {
    const offset = serverTimestampMs - Date.now();
    this.callbacks?.onClockOffset(offset);
  }

  async connectAndJoin(rawCode: string): Promise<void> {
    const code = rawCode.trim().toUpperCase();
    this.activeRoomCode = code;

    let token = getAccessToken();
    if (!token) {
      const refreshed = await performSilentRefresh().catch(() => null);
      token = refreshed?.accessToken ?? null;
    }
    if (!token) {
      this.callbacks?.onError({ code: 'UNAUTHORIZED', message: 'Authentication required' });
      this.callbacks?.onStatus('disconnected');
      return;
    }

    if (this.socket && this.socket.connected) {
      this.emitJoin(code);
      return;
    }

    this.disconnect(false);
    this.callbacks?.onStatus('connecting');

    const socket = io(resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 800,
      reconnectionDelayMax: 6_000,
      randomizationFactor: 0.4, // Jitter
    });

    this.socket = socket;

    socket.on('connect', () => {
      this.callbacks?.onStatus('connected');
      if (this.activeRoomCode) {
        this.emitJoin(this.activeRoomCode);
      }
    });

    socket.io.on('reconnect_attempt', () => {
      this.callbacks?.onStatus('reconnecting');
      const freshToken = getAccessToken();
      if (freshToken) {
        socket.auth = { token: freshToken };
      }
    });

    socket.io.on('reconnect', () => {
      this.callbacks?.onStatus('connected');
      if (this.activeRoomCode) {
        socket.emit('room:resync', { code: this.activeRoomCode });
      }
    });

    socket.on('disconnect', () => {
      this.callbacks?.onStatus(socket.active ? 'reconnecting' : 'disconnected');
    });

    socket.on('connect_error', (err) => {
      this.callbacks?.onStatus(socket.active ? 'reconnecting' : 'disconnected');
      this.callbacks?.onError({
        code: err.message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : 'NETWORK_OFFLINE',
        message: err.message || 'Could not connect to live room server',
      });
    });

    socket.on('room:snapshot', (raw: unknown) => {
      const parsed = LiveRoomSnapshotSchema.safeParse(raw);
      if (!parsed.success) return;
      this.updateClockOffset(parsed.data.state.serverTimestampMs);
      this.callbacks?.onSnapshot(parsed.data);
    });

    socket.on('room:state', (raw: unknown) => {
      const parsed = RedisLiveRoomStateSchema.safeParse(raw);
      if (!parsed.success) return;
      this.updateClockOffset(parsed.data.serverTimestampMs);
      this.callbacks?.onState(parsed.data);
    });

    socket.on('room:question', (raw: unknown) => {
      const parsed = LiveQuestionPayloadSchema.safeParse(raw);
      if (!parsed.success) return;
      this.updateClockOffset(parsed.data.serverTimestampMs);
      this.callbacks?.onQuestion(parsed.data);
    });

    socket.on('room:reveal', (raw: unknown) => {
      const parsed = LiveQuestionRevealSchema.safeParse(raw);
      if (!parsed.success) return;
      this.updateClockOffset(parsed.data.serverTimestampMs);
      this.callbacks?.onReveal(parsed.data);
    });

    socket.on('room:leaderboard', (raw: unknown) => {
      const parsed = z
        .object({
          leaderboard: z.array(LiveLeaderboardEntrySchema),
          endsAtMs: z.number().int(),
          serverTimestampMs: z.number().int(),
        })
        .safeParse(raw);
      if (!parsed.success) return;
      this.updateClockOffset(parsed.data.serverTimestampMs);
      this.callbacks?.onLeaderboard(parsed.data.leaderboard, parsed.data.endsAtMs);
    });

    socket.on('room:finished', (raw: unknown) => {
      const parsed = LiveRoomResultsSchema.safeParse(raw);
      if (!parsed.success) return;
      this.callbacks?.onFinished(parsed.data);
    });

    socket.on('room:error', (raw: unknown) => {
      const parsed = z.object({ code: z.string(), message: z.string() }).safeParse(raw);
      if (parsed.success) {
        this.callbacks?.onError(parsed.data);
      }
    });
  }

  private emitJoin(code: string): void {
    this.socket?.emit('room:join', { code });
  }

  toggleReady(): void {
    if (!this.activeRoomCode) return;
    this.socket?.emit('room:ready', { code: this.activeRoomCode });
  }

  updateBotsCount(count: number): void {
    if (!this.activeRoomCode) return;
    this.socket?.emit('room:bots:update', { code: this.activeRoomCode, count });
  }

  startQuiz(): void {
    if (!this.activeRoomCode) return;
    this.socket?.emit('room:start', { code: this.activeRoomCode });
  }

  submitAnswer(questionIndex: number, choiceId: string): void {
    if (!this.activeRoomCode) return;
    this.socket?.emit('room:answer', {
      roomCode: this.activeRoomCode,
      questionIndex,
      choiceId,
    });
  }

  reconnectNow(): void {
    if (this.activeRoomCode) {
      void this.connectAndJoin(this.activeRoomCode);
    }
  }

  disconnect(clearRoom = true): void {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    if (clearRoom) {
      this.activeRoomCode = null;
      this.callbacks?.onStatus('idle');
    }
  }
}

export const realtimeManager = new RealtimeManager();
