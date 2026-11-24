import { describe, expect, it } from 'vitest';
import {
  canTransitionRoomPhase,
  clampReviewTimestamp,
  createInitialSrsState,
  previewAllRatings,
  scheduleNextReview,
} from '../index';

describe('FSRS-5 deterministic scheduler', () => {
  it('produces identical schedules offline and online for the same timestamp', () => {
    const t0 = new Date('2026-11-24T10:00:00.000Z');
    const initial = createInitialSrsState(t0);

    const offlineResult = scheduleNextReview(initial, 'GOOD', t0);
    const serverResult = scheduleNextReview(initial, 'GOOD', t0);

    expect(offlineResult).toEqual(serverResult);
    expect(offlineResult.reps).toBe(1);
    expect(new Date(offlineResult.due).getTime()).toBeGreaterThan(t0.getTime());
  });

  it('previews all 4 SRS ratings for UI buttons', () => {
    const t0 = new Date('2026-11-24T10:00:00.000Z');
    const previews = previewAllRatings(null, t0);

    expect(previews.AGAIN.intervalMinutes).toBeGreaterThan(0);
    expect(previews.EASY.intervalMinutes).toBeGreaterThanOrEqual(previews.GOOD.intervalMinutes);
  });

  it('clamps future or ancient client timestamps to protect FSRS schedules', () => {
    const serverNow = new Date('2026-11-24T10:00:00.000Z');
    const farFuture = new Date('2028-01-01T00:00:00.000Z');
    const ancient = new Date('2020-01-01T00:00:00.000Z');
    const validOffline = new Date('2026-11-23T10:00:00.000Z');

    expect(clampReviewTimestamp(farFuture, serverNow).wasClamped).toBe(true);
    expect(clampReviewTimestamp(farFuture, serverNow).effectiveTimestamp).toEqual(serverNow);
    expect(clampReviewTimestamp(ancient, serverNow).wasClamped).toBe(true);
    expect(clampReviewTimestamp(validOffline, serverNow).wasClamped).toBe(false);
  });
});

describe('Live Room State Machine', () => {
  it('enforces valid phase transitions only', () => {
    expect(canTransitionRoomPhase('LOBBY', 'COUNTDOWN')).toBe(true);
    expect(canTransitionRoomPhase('LOBBY', 'QUESTION_ACTIVE')).toBe(false);
    expect(canTransitionRoomPhase('QUESTION_ACTIVE', 'QUESTION_REVEAL')).toBe(true);
    expect(canTransitionRoomPhase('FINISHED', 'LOBBY')).toBe(false);
  });
});
