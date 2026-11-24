import { z } from 'zod';
import { CardSchema, ReviewEventInputSchema, SrsStateSchema } from './core';

export const SrsCardSnapshotSchema = z.object({
  due: z.string().datetime(),
  stability: z.number(),
  difficulty: z.number(),
  elapsedDays: z.number().int().nonnegative(),
  scheduledDays: z.number().int().nonnegative(),
  reps: z.number().int().nonnegative(),
  lapses: z.number().int().nonnegative(),
  state: SrsStateSchema,
  lastReview: z.string().datetime().nullable(),
});

export const StudyCardWithSrsSchema = z.object({
  card: CardSchema,
  deckTitle: z.string(),
  srs: SrsCardSnapshotSchema.nullable(),
});
export type StudyCardWithSrs = z.infer<typeof StudyCardWithSrsSchema>;

export const StudyQueueResponseSchema = z.object({
  items: z.array(StudyCardWithSrsSchema),
  dueTotal: z.number().int().nonnegative(),
  reviewedToday: z.number().int().nonnegative(),
  dailyGoal: z.number().int().positive(),
});
export type StudyQueueResponse = z.infer<typeof StudyQueueResponseSchema>;

export const BatchReviewSyncInputSchema = z.object({
  events: z.array(ReviewEventInputSchema).min(1).max(100),
});
export type BatchReviewSyncInput = z.infer<typeof BatchReviewSyncInputSchema>;

export const BatchReviewSyncResponseSchema = z.object({
  acceptedCount: z.number().int().nonnegative(),
  deduplicatedCount: z.number().int().nonnegative(),
  clampedCount: z.number().int().nonnegative(),
  streakDays: z.number().int().nonnegative(),
  updatedStates: z.array(
    z.object({
      cardId: z.string().uuid(),
      srs: SrsCardSnapshotSchema,
    }),
  ),
});
export type BatchReviewSyncResponse = z.infer<typeof BatchReviewSyncResponseSchema>;

export const HeatmapDaySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  count: z.number().int().nonnegative(),
  level: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});
export type HeatmapDay = z.infer<typeof HeatmapDaySchema>;

export const TopicRetentionSchema = z.object({
  topic: z.string(),
  reviewedCount: z.number().int().nonnegative(),
  retentionRatePct: z.number().min(0).max(100),
  dueCount: z.number().int().nonnegative(),
});
export type TopicRetention = z.infer<typeof TopicRetentionSchema>;

export const StudyDayTimeSchema = z.object({
  date: z.string(),
  minutes: z.number().nonnegative(),
  reviews: z.number().int().nonnegative(),
});
export type StudyDayTime = z.infer<typeof StudyDayTimeSchema>;

export const AnalyticsOverviewResponseSchema = z.object({
  streakDays: z.number().int().nonnegative(),
  totalReviews: z.number().int().nonnegative(),
  retentionRatePct: z.number().min(0).max(100),
  averageResponseMs: z.number().int().nonnegative(),
  reviewedToday: z.number().int().nonnegative(),
  dailyGoal: z.number().int().positive(),
  heatmap: z.array(HeatmapDaySchema),
  topicRetention: z.array(TopicRetentionSchema),
  studyTimeByDay: z.array(StudyDayTimeSchema),
});
export type AnalyticsOverviewResponse = z.infer<typeof AnalyticsOverviewResponseSchema>;
