import {
  createEmptyCard,
  fsrs,
  generatorParameters,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
} from 'ts-fsrs';
import type { SrsRating, SrsState } from '../schemas/core';

export interface SrsCardSnapshot {
  due: string; // ISO-8601
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: SrsState;
  lastReview: string | null;
}

export interface NextReviewPreview {
  rating: SrsRating;
  nextDue: string;
  scheduledDays: number;
  intervalMinutes: number;
  state: SrsState;
}

const FSRS_PARAMS = generatorParameters({
  enable_fuzz: false, // Deterministic across offline client & server replay
  enable_short_term: true,
  maximum_interval: 3650,
});

const scheduler = fsrs(FSRS_PARAMS);

const RATING_TO_FSRS: Record<SrsRating, Grade> = {
  AGAIN: Rating.Again,
  HARD: Rating.Hard,
  GOOD: Rating.Good,
  EASY: Rating.Easy,
};

const STATE_FROM_FSRS: Record<State, SrsState> = {
  [State.New]: 'NEW',
  [State.Learning]: 'LEARNING',
  [State.Review]: 'REVIEW',
  [State.Relearning]: 'RELEARNING',
};

const STATE_TO_FSRS: Record<SrsState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  RELEARNING: State.Relearning,
};

/**
 * Guard bounds for clientTimestamp submitted from offline review queues.
 * Prevents corrupted device clocks (far future or ancient past) from poisoning FSRS schedules.
 */
export const MAX_CLIENT_FUTURE_SKEW_MS = 5 * 60 * 1000; // +5 minutes
export const MAX_CLIENT_PAST_OFFLINE_MS = 30 * 24 * 60 * 60 * 1000; // -30 days

export function clampReviewTimestamp(
  clientTimestamp: Date,
  serverNow: Date = new Date(),
): { effectiveTimestamp: Date; wasClamped: boolean } {
  const clientMs = clientTimestamp.getTime();
  const serverMs = serverNow.getTime();

  if (Number.isNaN(clientMs)) {
    return { effectiveTimestamp: serverNow, wasClamped: true };
  }
  if (clientMs > serverMs + MAX_CLIENT_FUTURE_SKEW_MS) {
    return { effectiveTimestamp: serverNow, wasClamped: true };
  }
  if (clientMs < serverMs - MAX_CLIENT_PAST_OFFLINE_MS) {
    return {
      effectiveTimestamp: new Date(serverMs - MAX_CLIENT_PAST_OFFLINE_MS),
      wasClamped: true,
    };
  }
  return { effectiveTimestamp: clientTimestamp, wasClamped: false };
}

export function createInitialSrsState(now: Date = new Date()): SrsCardSnapshot {
  const card = createEmptyCard(now);
  return toSnapshot(card);
}

function toFsrsCard(snapshot: SrsCardSnapshot): FsrsCard {
  return {
    due: new Date(snapshot.due),
    stability: snapshot.stability,
    difficulty: snapshot.difficulty,
    elapsed_days: snapshot.elapsedDays,
    scheduled_days: snapshot.scheduledDays,
    reps: snapshot.reps,
    lapses: snapshot.lapses,
    state: STATE_TO_FSRS[snapshot.state],
    last_review: snapshot.lastReview ? new Date(snapshot.lastReview) : undefined,
  };
}

function toSnapshot(card: FsrsCard): SrsCardSnapshot {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsedDays: card.elapsed_days,
    scheduledDays: card.scheduled_days,
    reps: card.reps,
    lapses: card.lapses,
    state: STATE_FROM_FSRS[card.state],
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

export function scheduleNextReview(
  current: SrsCardSnapshot | null,
  rating: SrsRating,
  reviewedAt: Date = new Date(),
): SrsCardSnapshot {
  const baseCard = current ? toFsrsCard(current) : createEmptyCard(reviewedAt);
  const result = scheduler.next(baseCard, reviewedAt, RATING_TO_FSRS[rating]);
  return toSnapshot(result.card);
}

export function previewAllRatings(
  current: SrsCardSnapshot | null,
  now: Date = new Date(),
): Record<SrsRating, NextReviewPreview> {
  const baseCard = current ? toFsrsCard(current) : createEmptyCard(now);
  const outcomes = scheduler.repeat(baseCard, now);

  const build = (rating: SrsRating): NextReviewPreview => {
    const outcome = outcomes[RATING_TO_FSRS[rating]];
    const diffMs = Math.max(0, outcome.card.due.getTime() - now.getTime());
    return {
      rating,
      nextDue: outcome.card.due.toISOString(),
      scheduledDays: outcome.card.scheduled_days,
      intervalMinutes: Math.max(1, Math.round(diffMs / 60_000)),
      state: STATE_FROM_FSRS[outcome.card.state],
    };
  };

  return {
    AGAIN: build('AGAIN'),
    HARD: build('HARD'),
    GOOD: build('GOOD'),
    EASY: build('EASY'),
  };
}
