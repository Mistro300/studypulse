import { randomBytes, randomUUID } from 'node:crypto';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import {
  canTransitionRoomPhase,
  HOST_DISCONNECT_GRACE_MS,
  MAX_SIMULATED_BOTS,
  MIN_CARDS_FOR_LIVE_ROOM,
  type CardDto,
  type CreateLiveRoomInput,
  type LiveChoiceKey,
  type LiveLeaderboardEntry,
  type LiveParticipant,
  type LiveQuestionPayload,
  type LiveQuestionReveal,
  type LiveReviewItem,
  type LiveRoomPhase,
  type LiveRoomResults,
  type LiveRoomSnapshot,
  type LiveRoomSummary,
  type RedisLiveRoomState,
} from '@studypulse/shared';
import type { DataRepository } from '../../core/db/repository.js';
import { HttpError } from '../../core/errors/http-error.js';
import { buildAutoDistractorMcq } from '../questions/adapters.js';

interface PreparedQuestion {
  questionIndex: number;
  cardId: string;
  front: string;
  back: string;
  explanation: string | null;
  choices: Array<{ key: LiveChoiceKey; id: string; text: string }>;
  correctChoiceId: string;
}

interface RecordedAnswer {
  participantId: string;
  questionIndex: number;
  choiceId: string;
  choiceKey: LiveChoiceKey;
  isCorrect: boolean;
  pointsAwarded: number;
  responseTimeMs: number;
}

interface ActiveRoom {
  roomId: string;
  code: string;
  title: string;
  deckId: string;
  deckTitle: string;
  topic: string;
  hostUserId: string;
  hostName: string;
  isPublic: boolean;
  maxParticipants: number;
  questionDurationSec: number;
  phase: LiveRoomPhase;
  phaseStartedAtMs: number;
  phaseEndsAtMs: number | null;
  currentQuestionIndex: number;
  questions: PreparedQuestion[];
  hostDisconnectedAtMs: number | null;
  participants: Map<string, LiveParticipant>;
  userToParticipantId: Map<string, string>;
  socketToParticipant: Map<string, { code: string; participantId: string }>;
  answersByQuestion: Map<number, Map<string, RecordedAnswer>>;
  correctCounts: Map<string, number>;
  lastReveal: LiveQuestionReveal | null;
  phaseTimer: NodeJS.Timeout | null;
  earlyAdvanceTimer: NodeJS.Timeout | null;
  hostGraceTimer: NodeJS.Timeout | null;
  botTimers: NodeJS.Timeout[];
}

export interface RoomEngineTimings {
  countdownMs: number;
  revealMs: number;
  leaderboardMs: number;
  earlyAdvanceDelayMs: number;
  hostGraceMs: number;
}

const DEFAULT_TIMINGS: RoomEngineTimings = {
  countdownMs: 3_000,
  revealMs: 3_500,
  leaderboardMs: 3_000,
  earlyAdvanceDelayMs: 650,
  hostGraceMs: HOST_DISCONNECT_GRACE_MS,
};

const BOT_PERSONAS = [
  { id: 'bot-1', name: 'Nour (Bot)', accuracy: 0.78 },
  { id: 'bot-2', name: 'Kareem (Bot)', accuracy: 0.65 },
  { id: 'bot-3', name: 'Lina (Bot)', accuracy: 0.58 },
] as const;

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateRoomCode(): string {
  const bytes = randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  }
  return out;
}

function shuffleCards(cards: CardDto[]): CardDto[] {
  const copy = [...cards];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy;
}

export class LiveRoomEngine {
  private readonly rooms = new Map<string, ActiveRoom>();
  private readonly socketRoomMap = new Map<string, { code: string; participantId: string }>();
  private readonly timings: RoomEngineTimings;

  constructor(
    private readonly io: SocketIOServer,
    private readonly repo: DataRepository,
    timings?: Partial<RoomEngineTimings>,
  ) {
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
  }

  private roomChannel(code: string): string {
    return `room:${code}`;
  }

  private clearAllRoomTimers(room: ActiveRoom): void {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
    if (room.earlyAdvanceTimer) {
      clearTimeout(room.earlyAdvanceTimer);
      room.earlyAdvanceTimer = null;
    }
    if (room.hostGraceTimer) {
      clearTimeout(room.hostGraceTimer);
      room.hostGraceTimer = null;
    }
    for (const t of room.botTimers) {
      clearTimeout(t);
    }
    room.botTimers = [];
  }

  shutdown(): void {
    for (const room of this.rooms.values()) {
      this.clearAllRoomTimers(room);
    }
    this.rooms.clear();
    this.socketRoomMap.clear();
  }

  private transitionPhase(room: ActiveRoom, next: LiveRoomPhase): void {
    if (!canTransitionRoomPhase(room.phase, next)) {
      throw new HttpError(409, 'CONFLICT', `Invalid room transition: ${room.phase} -> ${next}`);
    }
    room.phase = next;
    room.phaseStartedAtMs = Date.now();
  }

  private toRedisState(room: ActiveRoom): RedisLiveRoomState {
    return {
      roomId: room.roomId,
      code: room.code,
      title: room.title,
      deckId: room.deckId,
      deckTitle: room.deckTitle,
      hostUserId: room.hostUserId,
      isPublic: room.isPublic,
      maxParticipants: room.maxParticipants,
      questionDurationSec: room.questionDurationSec,
      phase: room.phase,
      phaseEndsAtMs: room.phaseEndsAtMs,
      currentQuestionIndex: room.currentQuestionIndex,
      totalQuestions: room.questions.length,
      hostDisconnectedAtMs: room.hostDisconnectedAtMs,
      participants: Array.from(room.participants.values()),
      serverTimestampMs: Date.now(),
    };
  }

  private buildLeaderboard(room: ActiveRoom): LiveLeaderboardEntry[] {
    const sorted = Array.from(room.participants.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.streak - a.streak;
    });
    return sorted.map((p, idx) => ({
      participantId: p.participantId,
      displayName: p.displayName,
      isBot: p.isBot,
      score: p.score,
      streak: p.streak,
      correctCount: room.correctCounts.get(p.participantId) ?? 0,
      rank: idx + 1,
    }));
  }

  private buildActiveQuestionPayload(room: ActiveRoom): LiveQuestionPayload | null {
    if (room.phase !== 'QUESTION_ACTIVE' && room.phase !== 'QUESTION_REVEAL') return null;
    const q = room.questions[room.currentQuestionIndex];
    if (!q || !room.phaseEndsAtMs) return null;
    return {
      questionIndex: q.questionIndex,
      totalQuestions: room.questions.length,
      cardId: q.cardId,
      prompt: q.front,
      choices: q.choices,
      endsAtMs: room.phaseEndsAtMs,
      serverTimestampMs: Date.now(),
    };
  }

  private buildResultsForParticipant(
    room: ActiveRoom,
    participantId: string | null,
  ): LiveRoomResults {
    const leaderboard = this.buildLeaderboard(room);
    const myReviewItems: LiveReviewItem[] = room.questions.map((q) => {
      const qAnswers = room.answersByQuestion.get(q.questionIndex);
      const ans = participantId ? qAnswers?.get(participantId) : undefined;
      const selectedChoice = ans ? q.choices.find((c) => c.id === ans.choiceId) : undefined;
      const correctChoice = q.choices.find((c) => c.id === q.correctChoiceId);

      return {
        questionIndex: q.questionIndex,
        cardId: q.cardId,
        front: q.front,
        back: q.back,
        selectedChoiceId: ans?.choiceId ?? null,
        selectedChoiceText: selectedChoice?.text ?? null,
        correctChoiceId: q.correctChoiceId,
        correctChoiceText: correctChoice?.text ?? q.back,
        isCorrect: ans?.isCorrect ?? false,
        pointsAwarded: ans?.pointsAwarded ?? 0,
      };
    });

    return {
      roomCode: room.code,
      title: room.title,
      deckId: room.deckId,
      podium: leaderboard.slice(0, 3),
      leaderboard,
      myReviewItems,
    };
  }

  buildSnapshotForUser(code: string, userId: string): LiveRoomSnapshot {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new HttpError(404, 'NOT_FOUND', 'Live room not found or already expired');
    }

    const participantId = room.userToParticipantId.get(userId) ?? null;
    const currentAnswers = room.answersByQuestion.get(room.currentQuestionIndex);
    const mySelectedChoiceId =
      participantId && currentAnswers ? (currentAnswers.get(participantId)?.choiceId ?? null) : null;

    return {
      state: this.toRedisState(room),
      myParticipantId: participantId,
      mySelectedChoiceId,
      activeQuestion: this.buildActiveQuestionPayload(room),
      lastReveal: room.phase === 'QUESTION_REVEAL' ? room.lastReveal : null,
      leaderboard: this.buildLeaderboard(room),
      results:
        room.phase === 'FINISHED' ? this.buildResultsForParticipant(room, participantId) : null,
    };
  }

  private toSummary(room: ActiveRoom): LiveRoomSummary {
    const participants = Array.from(room.participants.values());
    return {
      roomId: room.roomId,
      code: room.code,
      title: room.title,
      deckTitle: room.deckTitle,
      topic: room.topic,
      hostName: room.hostName,
      phase: room.phase,
      participantCount: participants.length,
      maxParticipants: room.maxParticipants,
      questionCount: room.questions.length,
      questionDurationSec: room.questionDurationSec,
      botsCount: participants.filter((p) => p.isBot).length,
    };
  }

  listPublicRooms(): LiveRoomSummary[] {
    const list: LiveRoomSummary[] = [];
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.phase !== 'FINISHED') {
        list.push(this.toSummary(room));
      }
    }
    return list;
  }

  getRoomSummary(code: string): LiveRoomSummary {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new HttpError(404, 'NOT_FOUND', 'Room code not found');
    }
    return this.toSummary(room);
  }

  async createRoom(
    hostUser: { id: string; displayName: string },
    input: CreateLiveRoomInput,
  ): Promise<LiveRoomSummary> {
    const deck = await this.repo.getDeckById(input.deckId, hostUser.id);
    if (!deck) {
      throw new HttpError(404, 'NOT_FOUND', 'Deck not found');
    }

    const deckCards = await this.repo.listCardsByDeck(deck.id);
    if (deckCards.length < MIN_CARDS_FOR_LIVE_ROOM) {
      throw new HttpError(
        400,
        'VALIDATION_ERROR',
        `A deck needs at least ${MIN_CARDS_FOR_LIVE_ROOM} cards to host a live quiz room`,
      );
    }

    const pickedCards = shuffleCards(deckCards).slice(
      0,
      Math.min(input.questionCount, deckCards.length),
    );
    const preparedQuestions: PreparedQuestion[] = pickedCards.map((card, idx) => {
      const mcq = buildAutoDistractorMcq(card, deckCards);
      return {
        questionIndex: idx,
        cardId: card.id,
        front: card.front,
        back: card.back,
        explanation: card.explanation ?? null,
        choices: mcq.choices,
        correctChoiceId: mcq.correctChoiceId,
      };
    });

    let code = generateRoomCode();
    while (this.rooms.has(code)) {
      code = generateRoomCode();
    }

    const hostParticipantId = randomUUID();
    const participants = new Map<string, LiveParticipant>();
    participants.set(hostParticipantId, {
      participantId: hostParticipantId,
      userId: hostUser.id,
      displayName: hostUser.displayName,
      isHost: true,
      isBot: false,
      isReady: true,
      isOnline: true,
      score: 0,
      streak: 0,
      answeredCurrentQuestion: false,
    });

    const room: ActiveRoom = {
      roomId: randomUUID(),
      code,
      title: input.title,
      deckId: deck.id,
      deckTitle: deck.title,
      topic: deck.topic,
      hostUserId: hostUser.id,
      hostName: hostUser.displayName,
      isPublic: input.isPublic,
      maxParticipants: input.maxParticipants,
      questionDurationSec: input.questionDurationSec,
      phase: 'LOBBY',
      phaseStartedAtMs: Date.now(),
      phaseEndsAtMs: null,
      currentQuestionIndex: -1,
      questions: preparedQuestions,
      hostDisconnectedAtMs: null,
      participants,
      userToParticipantId: new Map([[hostUser.id, hostParticipantId]]),
      socketToParticipant: new Map(),
      answersByQuestion: new Map(),
      correctCounts: new Map(),
      lastReveal: null,
      phaseTimer: null,
      earlyAdvanceTimer: null,
      hostGraceTimer: null,
      botTimers: [],
    };

    this.applySimulatedBotsCount(room, input.simulatedBotsCount);
    this.rooms.set(code, room);
    return this.toSummary(room);
  }

  private applySimulatedBotsCount(room: ActiveRoom, desiredCount: number): void {
    const clamped = Math.max(0, Math.min(MAX_SIMULATED_BOTS, desiredCount));
    // Remove existing bots first
    for (const [pid, p] of room.participants.entries()) {
      if (p.isBot) room.participants.delete(pid);
    }
    for (let i = 0; i < clamped; i += 1) {
      const persona = BOT_PERSONAS[i]!;
      const botPid = `${room.code}-${persona.id}`;
      room.participants.set(botPid, {
        participantId: botPid,
        userId: null,
        displayName: persona.name,
        isHost: false,
        isBot: true,
        isReady: true,
        isOnline: true,
        score: 0,
        streak: 0,
        answeredCurrentQuestion: false,
      });
    }
  }

  async joinRoom(
    socket: Socket,
    user: { id: string; displayName: string },
    rawCode: string,
  ): Promise<LiveRoomSnapshot> {
    const code = rawCode.trim().toUpperCase();
    const room = this.rooms.get(code);
    if (!room) {
      throw new HttpError(404, 'NOT_FOUND', 'Room not found');
    }

    let participantId = room.userToParticipantId.get(user.id);
    if (!participantId) {
      if (room.phase === 'FINISHED') {
        throw new HttpError(410, 'ROOM_CLOSED', 'This live room has already finished');
      }
      if (room.participants.size >= room.maxParticipants) {
        throw new HttpError(409, 'ROOM_FULL', 'This live room is full');
      }

      participantId = randomUUID();
      room.participants.set(participantId, {
        participantId,
        userId: user.id,
        displayName: user.displayName,
        isHost: room.hostUserId === user.id,
        isBot: false,
        isReady: false,
        isOnline: true,
        score: 0,
        streak: 0,
        answeredCurrentQuestion: false,
      });
      room.userToParticipantId.set(user.id, participantId);
    } else {
      const existing = room.participants.get(participantId);
      if (existing) {
        existing.isOnline = true;
        // Host reconnected within the 45s grace window!
        if (existing.isHost && room.hostGraceTimer) {
          clearTimeout(room.hostGraceTimer);
          room.hostGraceTimer = null;
          room.hostDisconnectedAtMs = null;
        }
      }
    }

    await socket.join(this.roomChannel(code));
    this.socketRoomMap.set(socket.id, { code, participantId });

    this.broadcastRoomState(room);
    return this.buildSnapshotForUser(code, user.id);
  }

  updateSimulatedBots(code: string, userId: string, botsCount: number): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new HttpError(404, 'NOT_FOUND', 'Room not found');
    if (room.hostUserId !== userId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the room host can configure simulated bots');
    }
    if (room.phase !== 'LOBBY') {
      throw new HttpError(409, 'CONFLICT', 'Simulated bots can only be changed in the Lobby');
    }

    this.applySimulatedBotsCount(room, botsCount);
    this.broadcastRoomState(room);
  }

  toggleReady(code: string, userId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room || room.phase !== 'LOBBY') return;
    const pid = room.userToParticipantId.get(userId);
    if (!pid) return;
    const participant = room.participants.get(pid);
    if (!participant) return;
    participant.isReady = !participant.isReady;
    this.broadcastRoomState(room);
  }

  startRoom(code: string, userId: string): void {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new HttpError(404, 'NOT_FOUND', 'Room not found');
    if (room.hostUserId !== userId) {
      throw new HttpError(403, 'FORBIDDEN', 'Only the room host can start the quiz');
    }
    if (room.phase !== 'LOBBY') {
      throw new HttpError(409, 'CONFLICT', 'Quiz has already started');
    }

    this.transitionPhase(room, 'COUNTDOWN');
    room.phaseEndsAtMs = Date.now() + this.timings.countdownMs;
    this.broadcastRoomState(room);

    room.phaseTimer = setTimeout(() => {
      this.startQuestion(room, 0);
    }, this.timings.countdownMs);
  }

  private startQuestion(room: ActiveRoom, index: number): void {
    this.clearQuestionTimers(room);
    const q = room.questions[index];
    if (!q) {
      this.finishRoom(room);
      return;
    }

    this.transitionPhase(room, 'QUESTION_ACTIVE');
    room.currentQuestionIndex = index;
    room.lastReveal = null;
    room.phaseEndsAtMs = Date.now() + room.questionDurationSec * 1000;

    for (const p of room.participants.values()) {
      p.answeredCurrentQuestion = false;
    }

    this.broadcastRoomState(room);
    const payload = this.buildActiveQuestionPayload(room);
    if (payload) {
      this.io.to(this.roomChannel(room.code)).emit('room:question', payload);
    }

    // Schedule Simulated Bots to answer with realistic timing
    this.scheduleBotsForQuestion(room, q);

    // Server-authoritative deadline for this question
    room.phaseTimer = setTimeout(() => {
      this.revealCurrentQuestion(room);
    }, room.questionDurationSec * 1000);
  }

  private clearQuestionTimers(room: ActiveRoom): void {
    if (room.phaseTimer) {
      clearTimeout(room.phaseTimer);
      room.phaseTimer = null;
    }
    if (room.earlyAdvanceTimer) {
      clearTimeout(room.earlyAdvanceTimer);
      room.earlyAdvanceTimer = null;
    }
    for (const t of room.botTimers) {
      clearTimeout(t);
    }
    room.botTimers = [];
  }

  private scheduleBotsForQuestion(room: ActiveRoom, q: PreparedQuestion): void {
    const durationMs = room.questionDurationSec * 1000;
    const minDelay = Math.min(1400, Math.floor(durationMs * 0.25));
    const maxDelay = Math.max(minDelay + 500, Math.floor(durationMs * 0.65));

    let botIdx = 0;
    for (const participant of room.participants.values()) {
      if (!participant.isBot) continue;
      const persona = BOT_PERSONAS[botIdx % BOT_PERSONAS.length]!;
      botIdx += 1;

      const delayMs = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));
      const timer = setTimeout(() => {
        if (room.phase !== 'QUESTION_ACTIVE' || room.currentQuestionIndex !== q.questionIndex) {
          return;
        }
        const willBeCorrect = Math.random() < persona.accuracy;
        const choice = willBeCorrect
          ? q.choices.find((c) => c.id === q.correctChoiceId)
          : q.choices.find((c) => c.id !== q.correctChoiceId);
        if (choice) {
          this.recordParticipantAnswer(room, participant.participantId, q.questionIndex, choice.id);
        }
      }, delayMs);

      room.botTimers.push(timer);
    }
  }

  submitAnswer(
    code: string,
    userId: string,
    questionIndex: number,
    choiceId: string,
  ): { accepted: boolean; choiceId: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new HttpError(404, 'NOT_FOUND', 'Room not found');
    const participantId = room.userToParticipantId.get(userId);
    if (!participantId) throw new HttpError(403, 'FORBIDDEN', 'Not a participant in this room');

    const accepted = this.recordParticipantAnswer(room, participantId, questionIndex, choiceId);
    return { accepted, choiceId };
  }

  private recordParticipantAnswer(
    room: ActiveRoom,
    participantId: string,
    questionIndex: number,
    choiceId: string,
  ): boolean {
    if (room.phase !== 'QUESTION_ACTIVE' || room.currentQuestionIndex !== questionIndex) {
      return false;
    }

    const now = Date.now();
    // Server-authoritative clock check (+400ms network jitter grace)
    if (room.phaseEndsAtMs && now > room.phaseEndsAtMs + 400) {
      return false;
    }

    const q = room.questions[questionIndex];
    const participant = room.participants.get(participantId);
    if (!q || !participant) return false;

    const choice = q.choices.find((c) => c.id === choiceId);
    if (!choice) return false;

    let qMap = room.answersByQuestion.get(questionIndex);
    if (!qMap) {
      qMap = new Map();
      room.answersByQuestion.set(questionIndex, qMap);
    }
    if (qMap.has(participantId)) {
      return false; // Answer already locked
    }

    const responseTimeMs = Math.max(100, now - room.phaseStartedAtMs);
    const isCorrect = choice.id === q.correctChoiceId;
    let pointsAwarded = 0;

    if (isCorrect) {
      const durationMs = room.questionDurationSec * 1000;
      const remainingRatio = Math.max(0, Math.min(1, 1 - responseTimeMs / durationMs));
      const speedPoints = Math.round(500 + 500 * remainingRatio);
      const streakBonus = Math.min(300, participant.streak * 100);
      pointsAwarded = speedPoints + streakBonus;
      participant.score += pointsAwarded;
      participant.streak += 1;
      room.correctCounts.set(participantId, (room.correctCounts.get(participantId) ?? 0) + 1);
    } else {
      participant.streak = 0;
    }

    participant.answeredCurrentQuestion = true;
    qMap.set(participantId, {
      participantId,
      questionIndex,
      choiceId: choice.id,
      choiceKey: choice.key,
      isCorrect,
      pointsAwarded,
      responseTimeMs,
    });

    this.broadcastRoomState(room);

    // Early reveal if every online participant has locked an answer
    const allOnlineAnswered = Array.from(room.participants.values())
      .filter((p) => p.isOnline)
      .every((p) => p.answeredCurrentQuestion);

    if (allOnlineAnswered && !room.earlyAdvanceTimer) {
      room.earlyAdvanceTimer = setTimeout(() => {
        this.revealCurrentQuestion(room);
      }, this.timings.earlyAdvanceDelayMs);
    }

    return true;
  }

  private revealCurrentQuestion(room: ActiveRoom): void {
    if (room.phase !== 'QUESTION_ACTIVE') return;
    this.clearQuestionTimers(room);

    const q = room.questions[room.currentQuestionIndex];
    if (!q) {
      this.finishRoom(room);
      return;
    }

    this.transitionPhase(room, 'QUESTION_REVEAL');
    const endsAtMs = Date.now() + this.timings.revealMs;
    room.phaseEndsAtMs = endsAtMs;

    const qAnswers = room.answersByQuestion.get(q.questionIndex) ?? new Map<string, RecordedAnswer>();
    const distribution = { A: 0, B: 0, C: 0, D: 0 };
    for (const ans of qAnswers.values()) {
      distribution[ans.choiceKey] += 1;
    }

    // Reset streak for anyone who did not answer in time
    for (const p of room.participants.values()) {
      if (!qAnswers.has(p.participantId)) {
        p.streak = 0;
      }
    }

    const correctChoice = q.choices.find((c) => c.id === q.correctChoiceId);
    const reveal: LiveQuestionReveal = {
      questionIndex: q.questionIndex,
      correctChoiceId: q.correctChoiceId,
      correctAnswerText: correctChoice?.text ?? q.back,
      explanation: q.explanation,
      distribution,
      totalAnswered: qAnswers.size,
      endsAtMs,
      serverTimestampMs: Date.now(),
    };
    room.lastReveal = reveal;

    this.broadcastRoomState(room);
    this.io.to(this.roomChannel(room.code)).emit('room:reveal', reveal);

    room.phaseTimer = setTimeout(() => {
      this.showLeaderboard(room);
    }, this.timings.revealMs);
  }

  private showLeaderboard(room: ActiveRoom): void {
    if (room.phase !== 'QUESTION_REVEAL') return;
    this.clearQuestionTimers(room);

    const isLastQuestion = room.currentQuestionIndex + 1 >= room.questions.length;
    if (isLastQuestion) {
      this.finishRoom(room);
      return;
    }

    this.transitionPhase(room, 'LEADERBOARD');
    room.phaseEndsAtMs = Date.now() + this.timings.leaderboardMs;

    const leaderboard = this.buildLeaderboard(room);
    this.broadcastRoomState(room);
    this.io.to(this.roomChannel(room.code)).emit('room:leaderboard', {
      leaderboard,
      endsAtMs: room.phaseEndsAtMs,
      serverTimestampMs: Date.now(),
    });

    room.phaseTimer = setTimeout(() => {
      this.startQuestion(room, room.currentQuestionIndex + 1);
    }, this.timings.leaderboardMs);
  }

  private finishRoom(room: ActiveRoom): void {
    if (room.phase === 'FINISHED') return;
    this.clearAllRoomTimers(room);
    this.transitionPhase(room, 'FINISHED');
    room.phaseEndsAtMs = null;

    this.broadcastRoomState(room);

    // Emit tailored final results (with personal myReviewItems) to each connected socket in the room
    const channel = this.io.sockets.adapter.rooms.get(this.roomChannel(room.code));
    if (channel) {
      for (const socketId of channel) {
        const meta = this.socketRoomMap.get(socketId);
        const target = this.io.sockets.sockets.get(socketId);
        if (target) {
          target.emit(
            'room:finished',
            this.buildResultsForParticipant(room, meta?.participantId ?? null),
          );
        }
      }
    }
  }

  handleSocketDisconnect(socketId: string): void {
    const binding = this.socketRoomMap.get(socketId);
    if (!binding) return;
    this.socketRoomMap.delete(socketId);

    const room = this.rooms.get(binding.code);
    if (!room) return;
    const participant = room.participants.get(binding.participantId);
    if (!participant) return;

    participant.isOnline = false;

    // 45s Host Disconnect Grace Window -> Host Migration or Clean Closure
    if (participant.isHost && room.phase !== 'FINISHED') {
      room.hostDisconnectedAtMs = Date.now();
      if (!room.hostGraceTimer) {
        room.hostGraceTimer = setTimeout(() => {
          room.hostGraceTimer = null;
          if (room.phase === 'FINISHED') return;
          const currentHost = room.participants.get(binding.participantId);
          if (currentHost?.isOnline) return;

          const nextHuman = Array.from(room.participants.values()).find(
            (p) => !p.isBot && p.isOnline && p.userId !== null,
          );
          if (nextHuman && nextHuman.userId) {
            if (currentHost) currentHost.isHost = false;
            nextHuman.isHost = true;
            room.hostUserId = nextHuman.userId;
            room.hostName = nextHuman.displayName;
            room.hostDisconnectedAtMs = null;
            this.broadcastRoomState(room);
          } else {
            this.finishRoom(room);
          }
        }, this.timings.hostGraceMs);
      }
    }

    this.broadcastRoomState(room);
  }

  async createMistakesReviewDeck(
    code: string,
    userId: string,
    cardIds: string[],
    customTitle?: string,
  ): Promise<{ deckId: string; cardCount: number }> {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) {
      throw new HttpError(404, 'NOT_FOUND', 'Room not found');
    }

    const sourceCards = await this.repo.listCardsByDeck(room.deckId);
    const picked = sourceCards.filter((c) => cardIds.includes(c.id));
    if (picked.length === 0) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'No matching mistake cards found');
    }

    const newDeck = await this.repo.createDeck(userId, {
      title: customTitle ?? `مراجعة أخطاء: ${room.title}`,
      description: `Cards missed during Live Quiz Room ${room.code}`,
      topic: room.topic,
      language: 'ar',
      isPublic: false,
    });

    await this.repo.createCardsBulk(
      newDeck.id,
      picked.map((c) => ({
        type: c.type,
        front: c.front,
        back: c.back,
        explanation: c.explanation ?? null,
        choices: c.type === 'MCQ' ? (c.choices ?? null) : null,
        correctChoiceId: c.type === 'MCQ' ? (c.correctChoiceId ?? null) : null,
        tags: [...c.tags.filter((t) => t !== 'Mistakes'), 'Mistakes'],
      })),
    );

    return { deckId: newDeck.id, cardCount: picked.length };
  }

  private broadcastRoomState(room: ActiveRoom): void {
    this.io.to(this.roomChannel(room.code)).emit('room:state', this.toRedisState(room));
  }
}
