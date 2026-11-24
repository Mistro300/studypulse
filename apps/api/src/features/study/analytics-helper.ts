import type {
  AnalyticsOverviewResponse,
  HeatmapDay,
  SrsRating,
  StudyDayTime,
  TopicRetention,
} from '@studypulse/shared';

export interface RawReviewMetric {
  cardId: string;
  topic: string;
  rating: SrsRating;
  durationMs: number;
  effectiveTimestamp: Date;
}

export function formatUtcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countToLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 8) return 2;
  if (count <= 15) return 3;
  return 4;
}

export function computeAnalyticsOverview(params: {
  reviews: RawReviewMetric[];
  dueByTopic: Map<string, number>;
  streakDays: number;
  dailyGoal: number;
  now?: Date;
}): AnalyticsOverviewResponse {
  const now = params.now ?? new Date();
  const todayKey = formatUtcDateKey(now);

  const countByDate = new Map<string, number>();
  const durationMsByDate = new Map<string, number>();
  const topicStats = new Map<string, { total: number; passed: number }>();

  let passedTotal = 0;
  let totalDurationMs = 0;

  for (const r of params.reviews) {
    const dayKey = formatUtcDateKey(r.effectiveTimestamp);
    countByDate.set(dayKey, (countByDate.get(dayKey) ?? 0) + 1);
    durationMsByDate.set(dayKey, (durationMsByDate.get(dayKey) ?? 0) + r.durationMs);

    const passed = r.rating === 'GOOD' || r.rating === 'EASY';
    if (passed) passedTotal += 1;
    totalDurationMs += r.durationMs;

    const existing = topicStats.get(r.topic) ?? { total: 0, passed: 0 };
    existing.total += 1;
    if (passed) existing.passed += 1;
    topicStats.set(r.topic, existing);
  }

  // Build 91-day (13 weeks) Retention Contribution Heatmap
  const heatmap: HeatmapDay[] = [];
  for (let offset = 90; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = formatUtcDateKey(d);
    const count = countByDate.get(key) ?? 0;
    heatmap.push({ date: key, count, level: countToLevel(count) });
  }

  // Last 7 days study time
  const studyTimeByDay: StudyDayTime[] = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - offset));
    const key = formatUtcDateKey(d);
    const reviews = countByDate.get(key) ?? 0;
    const ms = durationMsByDate.get(key) ?? 0;
    studyTimeByDay.push({
      date: key,
      reviews,
      minutes: Math.round((ms / 60_000) * 10) / 10,
    });
  }

  // Topic retention breakdown
  const allTopics = new Set<string>([...topicStats.keys(), ...params.dueByTopic.keys()]);
  const topicRetention: TopicRetention[] = Array.from(allTopics)
    .map((topic) => {
      const stat = topicStats.get(topic);
      const reviewedCount = stat?.total ?? 0;
      const retentionRatePct =
        reviewedCount > 0 ? Math.round(((stat?.passed ?? 0) / reviewedCount) * 100) : 0;
      return {
        topic,
        reviewedCount,
        retentionRatePct,
        dueCount: params.dueByTopic.get(topic) ?? 0,
      };
    })
    .sort((a, b) => b.reviewedCount - a.reviewedCount);

  const totalReviews = params.reviews.length;
  const retentionRatePct = totalReviews > 0 ? Math.round((passedTotal / totalReviews) * 100) : 0;
  const averageResponseMs = totalReviews > 0 ? Math.round(totalDurationMs / totalReviews) : 0;

  return {
    streakDays: params.streakDays,
    totalReviews,
    retentionRatePct,
    averageResponseMs,
    reviewedToday: countByDate.get(todayKey) ?? 0,
    dailyGoal: params.dailyGoal,
    heatmap,
    topicRetention,
    studyTimeByDay,
  };
}
