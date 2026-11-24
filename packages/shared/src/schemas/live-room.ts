import { z } from 'zod';

/**
 * Strict server-authoritative state machine for Live Quiz Rooms.
 * Transitions:
 *   LOBBY -> COUNTDOWN -> QUESTION_ACTIVE -> QUESTION_REVEAL -> LEADERBOARD -> (QUESTION_ACTIVE | FINISHED)
 *   Any active phase -> FINISHED (host end / 45s host timeout / room aborted)
 */
export const LiveRoomPhaseSchema = z.enum([
  'LOBBY',
  'COUNTDOWN',
  'QUESTION_ACTIVE',
  'QUESTION_REVEAL',
  'LEADERBOARD',
  'FINISHED',
]);
export type LiveRoomPhase = z.infer<typeof LiveRoomPhaseSchema>;

export const ALLOWED_ROOM_TRANSITIONS: Record<LiveRoomPhase, readonly LiveRoomPhase[]> = {
  LOBBY: ['COUNTDOWN', 'FINISHED'],
  COUNTDOWN: ['QUESTION_ACTIVE', 'FINISHED'],
  QUESTION_ACTIVE: ['QUESTION_REVEAL', 'FINISHED'],
  QUESTION_REVEAL: ['LEADERBOARD', 'FINISHED'],
  LEADERBOARD: ['QUESTION_ACTIVE', 'FINISHED'],
  FINISHED: [],
};

export function canTransitionRoomPhase(from: LiveRoomPhase, to: LiveRoomPhase): boolean {
  return ALLOWED_ROOM_TRANSITIONS[from].includes(to);
}

export const HOST_DISCONNECT_GRACE_MS = 45_000;
export const MAX_SIMULATED_BOTS = 3;
export const MIN_CARDS_FOR_LIVE_ROOM = 4;

export const CreateLiveRoomInputSchema = z.object({
  deckId: z.string().uuid(),
  title: z.string().trim().min(2).max(100),
  isPublic: z.boolean().default(true),
  maxParticipants: z.number().int().min(2).max(50).default(20),
  questionDurationSec: z.number().int().min(8).max(60).default(15),
  questionCount: z.number().int().min(4).max(30).default(6),
  simulatedBotsCount: z.number().int().min(0).max(MAX_SIMULATED_BOTS).default(2),
});
export type CreateLiveRoomInput = z.infer<typeof CreateLiveRoomInputSchema>;

export const LiveParticipantSchema = z.object({
  participantId: z.string(),
  userId: z.string().uuid().nullable(),
  displayName: z.string().min(1).max(60),
  isHost: z.boolean(),
  isBot: z.boolean(),
  isReady: z.boolean(),
  isOnline: z.boolean(),
  score: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  answeredCurrentQuestion: z.boolean(),
});
export type LiveParticipant = z.infer<typeof LiveParticipantSchema>;

export const LiveChoiceKeySchema = z.enum(['A', 'B', 'C', 'D']);
export type LiveChoiceKey = z.infer<typeof LiveChoiceKeySchema>;

export const LiveQuestionPayloadSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  totalQuestions: z.number().int().positive(),
  cardId: z.string().uuid(),
  prompt: z.string(),
  choices: z
    .array(
      z.object({
        key: LiveChoiceKeySchema,
        id: z.string(),
        text: z.string(),
      }),
    )
    .length(4),
  endsAtMs: z.number().int().positive(),
  serverTimestampMs: z.number().int().positive(),
});
export type LiveQuestionPayload = z.infer<typeof LiveQuestionPayloadSchema>;

export const LiveQuestionRevealSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  correctChoiceId: z.string(),
  correctAnswerText: z.string(),
  explanation: z.string().nullable(),
  distribution: z.object({
    A: z.number().int().nonnegative(),
    B: z.number().int().nonnegative(),
    C: z.number().int().nonnegative(),
    D: z.number().int().nonnegative(),
  }),
  totalAnswered: z.number().int().nonnegative(),
  endsAtMs: z.number().int().positive(),
  serverTimestampMs: z.number().int().positive(),
});
export type LiveQuestionReveal = z.infer<typeof LiveQuestionRevealSchema>;

export const LiveLeaderboardEntrySchema = z.object({
  participantId: z.string(),
  displayName: z.string(),
  isBot: z.boolean(),
  score: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  correctCount: z.number().int().nonnegative(),
  rank: z.number().int().positive(),
});
export type LiveLeaderboardEntry = z.infer<typeof LiveLeaderboardEntrySchema>;

export const LiveReviewItemSchema = z.object({
  questionIndex: z.number().int().nonnegative(),
  cardId: z.string().uuid(),
  front: z.string(),
  back: z.string(),
  selectedChoiceId: z.string().nullable(),
  selectedChoiceText: z.string().nullable(),
  correctChoiceId: z.string(),
  correctChoiceText: z.string(),
  isCorrect: z.boolean(),
  pointsAwarded: z.number().int().nonnegative(),
});
export type LiveReviewItem = z.infer<typeof LiveReviewItemSchema>;

export const LiveRoomResultsSchema = z.object({
  roomCode: z.string(),
  title: z.string(),
  deckId: z.string().uuid(),
  podium: z.array(LiveLeaderboardEntrySchema).max(3),
  leaderboard: z.array(LiveLeaderboardEntrySchema),
  myReviewItems: z.array(LiveReviewItemSchema),
});
export type LiveRoomResults = z.infer<typeof LiveRoomResultsSchema>;

/**
 * Canonical Redis room state shape stored under key `studypulse:room:{code}` with sliding TTL.
 */
export const RedisLiveRoomStateSchema = z.object({
  roomId: z.string().uuid(),
  code: z.string().length(6),
  title: z.string(),
  deckId: z.string().uuid(),
  deckTitle: z.string().default(''),
  hostUserId: z.string().uuid(),
  isPublic: z.boolean(),
  maxParticipants: z.number().int().min(2).max(50),
  questionDurationSec: z.number().int().min(8).max(60),
  phase: LiveRoomPhaseSchema,
  phaseEndsAtMs: z.number().int().nullable(),
  currentQuestionIndex: z.number().int().min(-1),
  totalQuestions: z.number().int().positive(),
  hostDisconnectedAtMs: z.number().int().nullable(),
  participants: z.array(LiveParticipantSchema),
  serverTimestampMs: z.number().int().positive(),
});
export type RedisLiveRoomState = z.infer<typeof RedisLiveRoomStateSchema>;

export const LiveRoomSummarySchema = z.object({
  roomId: z.string().uuid(),
  code: z.string().length(6),
  title: z.string(),
  deckTitle: z.string(),
  topic: z.string(),
  hostName: z.string(),
  phase: LiveRoomPhaseSchema,
  participantCount: z.number().int().nonnegative(),
  maxParticipants: z.number().int().positive(),
  questionCount: z.number().int().positive(),
  questionDurationSec: z.number().int().positive(),
  botsCount: z.number().int().nonnegative(),
});
export type LiveRoomSummary = z.infer<typeof LiveRoomSummarySchema>;

export const LiveRoomListResponseSchema = z.object({
  rooms: z.array(LiveRoomSummarySchema),
});
export type LiveRoomListResponse = z.infer<typeof LiveRoomListResponseSchema>;

export const LiveRoomSnapshotSchema = z.object({
  state: RedisLiveRoomStateSchema,
  myParticipantId: z.string().nullable(),
  mySelectedChoiceId: z.string().nullable(),
  activeQuestion: LiveQuestionPayloadSchema.nullable(),
  lastReveal: LiveQuestionRevealSchema.nullable(),
  leaderboard: z.array(LiveLeaderboardEntrySchema),
  results: LiveRoomResultsSchema.nullable(),
});
export type LiveRoomSnapshot = z.infer<typeof LiveRoomSnapshotSchema>;

export const SubmitLiveAnswerInputSchema = z.object({
  roomCode: z.string().length(6),
  questionIndex: z.number().int().nonnegative(),
  choiceId: z.string().min(1),
});
export type SubmitLiveAnswerInput = z.infer<typeof SubmitLiveAnswerInputSchema>;

export const AddMistakesToDeckInputSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1).max(50),
  deckTitle: z.string().trim().min(2).max(120).optional(),
});
export type AddMistakesToDeckInput = z.infer<typeof AddMistakesToDeckInputSchema>;

export const QuestionSourceKindSchema = z.enum([
  'OPEN_TRIVIA',
  'BUILTIN_TECH_PACK',
  'LLM_NOTES',
  'MOCK_LLM',
]);
export type QuestionSourceKind = z.infer<typeof QuestionSourceKindSchema>;
