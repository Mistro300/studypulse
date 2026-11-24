import { z } from 'zod';

export const ThemeModeSchema = z.enum(['system', 'light', 'dark']);
export type ThemeMode = z.infer<typeof ThemeModeSchema>;

export const LocaleSchema = z.enum(['ar', 'en']);
export type Locale = z.infer<typeof LocaleSchema>;

export const CardTypeSchema = z.enum(['FLASHCARD', 'MCQ']);
export type CardType = z.infer<typeof CardTypeSchema>;

export const SrsRatingSchema = z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']);
export type SrsRating = z.infer<typeof SrsRatingSchema>;

export const SrsStateSchema = z.enum(['NEW', 'LEARNING', 'REVIEW', 'RELEARNING']);
export type SrsState = z.infer<typeof SrsStateSchema>;

export const CardChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(500),
});
export type CardChoice = z.infer<typeof CardChoiceSchema>;

export const CardSchema = z.object({
  id: z.string().uuid(),
  deckId: z.string().uuid(),
  type: CardTypeSchema,
  front: z.string().min(1).max(2000),
  back: z.string().min(1).max(4000),
  explanation: z.string().max(4000).nullable().optional(),
  choices: z.array(CardChoiceSchema).min(2).max(6).nullable().optional(),
  correctChoiceId: z.string().nullable().optional(),
  tags: z.array(z.string().max(40)).default([]),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type CardDto = z.infer<typeof CardSchema>;

export const DeckSchema = z.object({
  id: z.string().uuid(),
  ownerId: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  topic: z.string().min(1).max(60),
  language: LocaleSchema.default('ar'),
  isPublic: z.boolean().default(false),
  cardCount: z.number().int().nonnegative().default(0),
  dueCount: z.number().int().nonnegative().default(0),
  updatedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
});
export type DeckDto = z.infer<typeof DeckSchema>;

export const ReviewEventInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  cardId: z.string().uuid(),
  deckId: z.string().uuid(),
  rating: SrsRatingSchema,
  durationMs: z.number().int().min(0).max(600_000),
  clientTimestamp: z.string().datetime(),
});
export type ReviewEventInput = z.infer<typeof ReviewEventInputSchema>;

export const CachedSessionProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1).max(80),
  avatarUrl: z.string().url().nullable().optional(),
  locale: LocaleSchema,
  theme: ThemeModeSchema,
  dailyGoal: z.number().int().min(5).max(500),
  streakDays: z.number().int().nonnegative(),
  cachedAt: z.string().datetime(),
});
export type CachedSessionProfile = z.infer<typeof CachedSessionProfileSchema>;

export const NormalizedErrorCodeSchema = z.enum([
  'NETWORK_OFFLINE',
  'NETWORK_TIMEOUT',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION_ERROR',
  'CONFLICT',
  'RATE_LIMITED',
  'ROOM_FULL',
  'ROOM_CLOSED',
  'INTERNAL_ERROR',
]);
export type NormalizedErrorCode = z.infer<typeof NormalizedErrorCodeSchema>;

export const NormalizedAppErrorSchema = z.object({
  code: NormalizedErrorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  statusCode: z.number().int().optional(),
  retryAfterSec: z.number().int().positive().optional(),
  fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
});
export type NormalizedAppError = z.infer<typeof NormalizedAppErrorSchema>;
