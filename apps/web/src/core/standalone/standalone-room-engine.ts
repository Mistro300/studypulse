import {
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
  type UserProfile,
} from '@studypulse/shared';
import {
  getStandaloneUserId,
  saveStandaloneDb,
  type loadStandaloneDb,
} from './standalone-api';

interface PreparedQuestion {
  questionIndex: number;
  cardId: string;
  front: string;
  back: string;
  explanation: string | null;
  choices: Array<{ key: LiveChoiceKey; id: string; text: string }>;
  correctChoiceId: string;
}

interface LocalRoom {
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
  participants: LiveParticipant[];
  answers: Map<number, Map<string, { choiceId: string; choiceKey: LiveChoiceKey; isCorrect: boolean; points: number }>>;
  correctCounts: Map<string, number>;
  lastReveal: LiveQuestionReveal | null;
  timers: number[];
}

export interface StandaloneRoomCallbacks {
  onStatus: (status: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected') => void;
  onClockOffset: (offsetMs: number) => void;
  onSnapshot: (snapshot: LiveRoomSnapshot) => void;
  onState: (state: RedisLiveRoomState) => void;
  onQuestion: (q: LiveQuestionPayload) => void;
  onReveal: (r: LiveQuestionReveal) => void;
  onLeaderboard: (lb: LiveLeaderboardEntry[], endsAtMs: number) => void;
  onFinished: (res: LiveRoomResults) => void;
  onError: (err: { code: string; message: string }) => void;
}

const BOTS = [
  { id: 'bot-1', name: 'Nour (Bot)', accuracy: 0.78 },
  { id: 'bot-2', name: 'Kareem (Bot)', accuracy: 0.65 },
  { id: 'bot-3', name: 'Lina (Bot)', accuracy: 0.58 },
] as const;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const rooms = new Map<string, LocalRoom>();
let activeCallbacks: StandaloneRoomCallbacks | null = null;
let joinedCode: string | null = null;

function shuffle<T>(arr: T[]): T[] {
  const c = [...arr];
  for (let i = c.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = c[i]!;
    c[i] = c[j]!;
    c[j] = t;
  }
  return c;
}

function makeCode(): string {
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

function buildMcq(target: CardDto, all: CardDto[]): {
  choices: Array<{ key: LiveChoiceKey; id: string; text: string }>;
  correctChoiceId: string;
} {
  const keys: LiveChoiceKey[] = ['A', 'B', 'C', 'D'];
  if (target.type === 'MCQ' && target.choices && target.choices.length >= 4 && target.correctChoiceId) {
    return {
      choices: target.choices.slice(0, 4).map((c, idx) => ({ key: keys[idx]!, id: c.id, text: c.text })),
      correctChoiceId: target.correctChoiceId,
    };
  }
  const distractors = shuffle(
    all.filter((c) => c.id !== target.id && c.back !== target.back).map((c) => c.back.slice(0, 160)),
  ).slice(0, 3);
  while (distractors.length < 3) distractors.push(`Option ${distractors.length + 2}`);
  const opts = shuffle([
    { id: 'correct', text: target.back.slice(0, 160) },
    ...distractors.map((text, idx) => ({ id: `d${idx + 1}`, text })),
  ]);
  return {
    choices: opts.map((o, idx) => ({ key: keys[idx]!, id: o.id, text: o.text })),
    correctChoiceId: 'correct',
  };
}

function toRedisState(room: LocalRoom): RedisLiveRoomState {
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
    hostDisconnectedAtMs: null,
    participants: [...room.participants],
    serverTimestampMs: Date.now(),
  };
}

function buildLeaderboard(room: LocalRoom): LiveLeaderboardEntry[] {
  return [...room.participants]
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : b.streak - a.streak))
    .map((p, idx) => ({
      participantId: p.participantId,
      displayName: p.displayName,
      isBot: p.isBot,
      score: p.score,
      streak: p.streak,
      correctCount: room.correctCounts.get(p.participantId) ?? 0,
      rank: idx + 1,
    }));
}

function buildSummary(room: LocalRoom): LiveRoomSummary {
  return {
    roomId: room.roomId,
    code: room.code,
    title: room.title,
    deckTitle: room.deckTitle,
    topic: room.topic,
    hostName: room.hostName,
    phase: room.phase,
    participantCount: room.participants.length,
    maxParticipants: room.maxParticipants,
    questionCount: room.questions.length,
    questionDurationSec: room.questionDurationSec,
    botsCount: room.participants.filter((p) => p.isBot).length,
  };
}

function clearTimers(room: LocalRoom): void {
  for (const id of room.timers) window.clearTimeout(id);
  room.timers = [];
}

function applyBots(room: LocalRoom, count: number): void {
  const clamped = Math.max(0, Math.min(MAX_SIMULATED_BOTS, count));
  room.participants = room.participants.filter((p) => !p.isBot);
  for (let i = 0; i < clamped; i += 1) {
    const b = BOTS[i]!;
    room.participants.push({
      participantId: `${room.code}-${b.id}`,
      userId: null,
      displayName: b.name,
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

function recordAnswer(room: LocalRoom, participantId: string, questionIndex: number, choiceId: string): void {
  if (room.phase !== 'QUESTION_ACTIVE' || room.currentQuestionIndex !== questionIndex) return;
  const q = room.questions[questionIndex];
  const p = room.participants.find((item) => item.participantId === participantId);
  if (!q || !p) return;
  const choice = q.choices.find((c) => c.id === choiceId);
  if (!choice) return;

  let qMap = room.answers.get(questionIndex);
  if (!qMap) {
    qMap = new Map();
    room.answers.set(questionIndex, qMap);
  }
  if (qMap.has(participantId)) return;

  const elapsed = Math.max(100, Date.now() - room.phaseStartedAtMs);
  const isCorrect = choice.id === q.correctChoiceId;
  let points = 0;
  if (isCorrect) {
    const ratio = Math.max(0, Math.min(1, 1 - elapsed / (room.questionDurationSec * 1000)));
    points = Math.round(500 + 500 * ratio) + Math.min(300, p.streak * 100);
    p.score += points;
    p.streak += 1;
    room.correctCounts.set(participantId, (room.correctCounts.get(participantId) ?? 0) + 1);
  } else {
    p.streak = 0;
  }
  p.answeredCurrentQuestion = true;
  qMap.set(participantId, { choiceId, choiceKey: choice.key, isCorrect, points });
  activeCallbacks?.onState(toRedisState(room));

  if (room.participants.every((item) => item.answeredCurrentQuestion)) {
    const id = window.setTimeout(() => revealQuestion(room), 600);
    room.timers.push(id);
  }
}

function revealQuestion(room: LocalRoom): void {
  if (room.phase !== 'QUESTION_ACTIVE') return;
  clearTimers(room);
  const q = room.questions[room.currentQuestionIndex];
  if (!q) {
    finishRoom(room);
    return;
  }

  room.phase = 'QUESTION_REVEAL';
  room.phaseEndsAtMs = Date.now() + 3500;
  const qMap = room.answers.get(q.questionIndex);
  const distribution: Record<LiveChoiceKey, number> = { A: 0, B: 0, C: 0, D: 0 };
  if (qMap) {
    for (const ans of qMap.values()) {
      distribution[ans.choiceKey] += 1;
    }
  }

  const reveal: LiveQuestionReveal = {
    questionIndex: q.questionIndex,
    correctChoiceId: q.correctChoiceId,
    correctAnswerText: q.choices.find((c) => c.id === q.correctChoiceId)?.text ?? q.back,
    explanation: q.explanation,
    distribution,
    totalAnswered: qMap?.size ?? 0,
    endsAtMs: room.phaseEndsAtMs,
    serverTimestampMs: Date.now(),
  };
  room.lastReveal = reveal;
  activeCallbacks?.onState(toRedisState(room));
  activeCallbacks?.onReveal(reveal);

  room.timers.push(window.setTimeout(() => showLeaderboard(room), 3500));
}

function showLeaderboard(room: LocalRoom): void {
  if (room.phase !== 'QUESTION_REVEAL') return;
  clearTimers(room);
  if (room.currentQuestionIndex + 1 >= room.questions.length) {
    finishRoom(room);
    return;
  }
  room.phase = 'LEADERBOARD';
  room.phaseEndsAtMs = Date.now() + 2800;
  activeCallbacks?.onState(toRedisState(room));
  activeCallbacks?.onLeaderboard(buildLeaderboard(room), room.phaseEndsAtMs);
  room.timers.push(window.setTimeout(() => startQuestion(room, room.currentQuestionIndex + 1), 2800));
}

function startQuestion(room: LocalRoom, index: number): void {
  clearTimers(room);
  const q = room.questions[index];
  if (!q) {
    finishRoom(room);
    return;
  }
  room.phase = 'QUESTION_ACTIVE';
  room.currentQuestionIndex = index;
  room.phaseStartedAtMs = Date.now();
  room.phaseEndsAtMs = Date.now() + room.questionDurationSec * 1000;
  room.lastReveal = null;
  for (const p of room.participants) p.answeredCurrentQuestion = false;

  activeCallbacks?.onState(toRedisState(room));
  activeCallbacks?.onQuestion({
    questionIndex: q.questionIndex,
    totalQuestions: room.questions.length,
    cardId: q.cardId,
    prompt: q.front,
    choices: q.choices,
    endsAtMs: room.phaseEndsAtMs,
    serverTimestampMs: Date.now(),
  });

  // Schedule Simulated Bots
  let bIdx = 0;
  for (const p of room.participants) {
    if (!p.isBot) continue;
    const persona = BOTS[bIdx % BOTS.length]!;
    bIdx += 1;
    const delay = 1400 + Math.floor(Math.random() * Math.max(1200, room.questionDurationSec * 500));
    room.timers.push(
      window.setTimeout(() => {
        const correct = Math.random() < persona.accuracy;
        const picked = correct
          ? q.choices.find((c) => c.id === q.correctChoiceId)
          : q.choices.find((c) => c.id !== q.correctChoiceId);
        if (picked) recordAnswer(room, p.participantId, q.questionIndex, picked.id);
      }, delay),
    );
  }

  room.timers.push(window.setTimeout(() => revealQuestion(room), room.questionDurationSec * 1000));
}

function finishRoom(room: LocalRoom): void {
  clearTimers(room);
  room.phase = 'FINISHED';
  room.phaseEndsAtMs = null;
  const uid = getStandaloneUserId();
  const me = room.participants.find((p) => p.userId === uid);
  const leaderboard = buildLeaderboard(room);
  const myReviewItems: LiveReviewItem[] = room.questions.map((q) => {
    const ans = me ? room.answers.get(q.questionIndex)?.get(me.participantId) : undefined;
    return {
      questionIndex: q.questionIndex,
      cardId: q.cardId,
      front: q.front,
      back: q.back,
      selectedChoiceId: ans?.choiceId ?? null,
      selectedChoiceText: ans ? (q.choices.find((c) => c.id === ans.choiceId)?.text ?? null) : null,
      correctChoiceId: q.correctChoiceId,
      correctChoiceText: q.choices.find((c) => c.id === q.correctChoiceId)?.text ?? q.back,
      isCorrect: ans?.isCorrect ?? false,
      pointsAwarded: ans?.points ?? 0,
    };
  });

  activeCallbacks?.onState(toRedisState(room));
  activeCallbacks?.onFinished({
    roomCode: room.code,
    title: room.title,
    deckId: room.deckId,
    podium: leaderboard.slice(0, 3),
    leaderboard,
    myReviewItems,
  });
}

export const standaloneRealtime = {
  bindCallbacks(cb: StandaloneRoomCallbacks) {
    activeCallbacks = cb;
  },
  connectAndJoin(rawCode: string) {
    const code = rawCode.trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) {
      activeCallbacks?.onError({ code: 'NOT_FOUND', message: 'Live room not found' });
      return;
    }
    joinedCode = code;
    activeCallbacks?.onStatus('connected');
    activeCallbacks?.onClockOffset(0);
    const uid = getStandaloneUserId();
    const me = room.participants.find((p) => p.userId === uid);
    const q = room.questions[room.currentQuestionIndex];
    activeCallbacks?.onSnapshot({
      state: toRedisState(room),
      myParticipantId: me?.participantId ?? null,
      mySelectedChoiceId:
        me && q ? (room.answers.get(q.questionIndex)?.get(me.participantId)?.choiceId ?? null) : null,
      activeQuestion:
        (room.phase === 'QUESTION_ACTIVE' || room.phase === 'QUESTION_REVEAL') && q && room.phaseEndsAtMs
          ? {
              questionIndex: q.questionIndex,
              totalQuestions: room.questions.length,
              cardId: q.cardId,
              prompt: q.front,
              choices: q.choices,
              endsAtMs: room.phaseEndsAtMs,
              serverTimestampMs: Date.now(),
            }
          : null,
      lastReveal: room.phase === 'QUESTION_REVEAL' ? room.lastReveal : null,
      leaderboard: buildLeaderboard(room),
      results: null,
    });
  },
  updateBotsCount(count: number) {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || room.phase !== 'LOBBY') return;
    applyBots(room, count);
    activeCallbacks?.onState(toRedisState(room));
  },
  toggleReady() {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    const uid = getStandaloneUserId();
    const me = room?.participants.find((p) => p.userId === uid);
    if (room && me) {
      me.isReady = !me.isReady;
      activeCallbacks?.onState(toRedisState(room));
    }
  },
  startQuiz() {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    if (!room || room.phase !== 'LOBBY') return;
    room.phase = 'COUNTDOWN';
    room.phaseEndsAtMs = Date.now() + 3000;
    activeCallbacks?.onState(toRedisState(room));
    room.timers.push(window.setTimeout(() => startQuestion(room, 0), 3000));
  },
  submitAnswer(questionIndex: number, choiceId: string) {
    if (!joinedCode) return;
    const room = rooms.get(joinedCode);
    const uid = getStandaloneUserId();
    const me = room?.participants.find((p) => p.userId === uid);
    if (room && me) {
      recordAnswer(room, me.participantId, questionIndex, choiceId);
    }
  },
  disconnect() {
    joinedCode = null;
    activeCallbacks?.onStatus('idle');
  },
};

export function handleStandaloneRoomApi(
  pathname: string,
  method: string,
  body: unknown,
  db: ReturnType<typeof loadStandaloneDb>,
  user: UserProfile,
): unknown {
  if (pathname === '/api/rooms' && method === 'GET') {
    const list = Array.from(rooms.values())
      .filter((r) => r.isPublic && r.phase !== 'FINISHED')
      .map(buildSummary);
    return { rooms: list };
  }

  if (pathname === '/api/rooms' && method === 'POST') {
    const input = body as CreateLiveRoomInput;
    const deck = db.decks.find((d) => d.id === input.deckId);
    if (!deck) throw Object.assign(new Error('Deck not found'), { statusCode: 404, code: 'NOT_FOUND' });
    const deckCards = db.cards.filter((c) => c.deckId === deck.id);
    if (deckCards.length < MIN_CARDS_FOR_LIVE_ROOM) {
      throw Object.assign(new Error('Deck needs at least 4 cards'), {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
      });
    }

    const picked = shuffle(deckCards).slice(0, Math.min(input.questionCount ?? 6, deckCards.length));
    const questions: PreparedQuestion[] = picked.map((card, idx) => {
      const mcq = buildMcq(card, deckCards);
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

    const code = makeCode();
    const room: LocalRoom = {
      roomId: crypto.randomUUID(),
      code,
      title: input.title,
      deckId: deck.id,
      deckTitle: deck.title,
      topic: deck.topic,
      hostUserId: user.id,
      hostName: user.displayName,
      isPublic: input.isPublic ?? true,
      maxParticipants: input.maxParticipants ?? 20,
      questionDurationSec: input.questionDurationSec ?? 15,
      phase: 'LOBBY',
      phaseStartedAtMs: Date.now(),
      phaseEndsAtMs: null,
      currentQuestionIndex: -1,
      questions,
      participants: [
        {
          participantId: crypto.randomUUID(),
          userId: user.id,
          displayName: user.displayName,
          isHost: true,
          isBot: false,
          isReady: true,
          isOnline: true,
          score: 0,
          streak: 0,
          answeredCurrentQuestion: false,
        },
      ],
      answers: new Map(),
      correctCounts: new Map(),
      lastReveal: null,
      timers: [],
    };
    applyBots(room, input.simulatedBotsCount ?? 2);
    rooms.set(code, room);
    return { room: buildSummary(room) };
  }

  const mistakesMatch = /^\/api\/rooms\/([^/]+)\/mistakes-deck$/.exec(pathname);
  if (mistakesMatch && method === 'POST') {
    const code = mistakesMatch[1]!.toUpperCase();
    const room = rooms.get(code);
    if (!room) throw Object.assign(new Error('Room not found'), { statusCode: 404, code: 'NOT_FOUND' });
    const { cardIds } = body as { cardIds: string[] };
    const picked = db.cards.filter((c) => c.deckId === room.deckId && cardIds.includes(c.id));
    const nowIso = new Date().toISOString();
    const deckId = crypto.randomUUID();
    db.decks.push({
      id: deckId,
      ownerId: user.id,
      title: `مراجعة أخطاء: ${room.title}`,
      description: `Cards missed in Live Room ${room.code}`,
      topic: room.topic,
      language: 'ar',
      isPublic: false,
      cardCount: picked.length,
      dueCount: picked.length,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    for (const c of picked) {
      db.cards.push({
        ...c,
        id: crypto.randomUUID(),
        deckId,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }
    saveStandaloneDb(db);
    return { deckId, cardCount: picked.length };
  }

  throw Object.assign(new Error('Endpoint not found'), { statusCode: 404, code: 'NOT_FOUND' });
}
