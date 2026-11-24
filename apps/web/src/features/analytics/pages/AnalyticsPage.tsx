import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { HeatmapDay } from '@studypulse/shared';
import { BarChart3, Clock, Flame, Play, Target, TrendingUp } from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import { useAnalyticsOverviewQuery } from '@/features/study/api/study-api';

const HEATMAP_LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-surface-subtle border-border-default',
  1: 'bg-brand-primary/25 border-brand-primary/20',
  2: 'bg-brand-primary/50 border-brand-primary/30',
  3: 'bg-brand-primary/75 border-brand-primary/50',
  4: 'bg-brand-primary border-brand-hover',
};

export function AnalyticsPage() {
  const { t } = useTranslation();
  const analyticsQuery = useAnalyticsOverviewQuery();
  const [activeDay, setActiveDay] = useState<HeatmapDay | null>(null);

  // Organize 91 days into 13 weekly columns (7 rows per column)
  const weeks = useMemo(() => {
    const days = analyticsQuery.data?.heatmap ?? [];
    const cols: HeatmapDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      cols.push(days.slice(i, i + 7));
    }
    return cols;
  }, [analyticsQuery.data?.heatmap]);

  if (analyticsQuery.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="sp-card animate-pulse space-y-2 p-4">
              <div className="h-3 w-1/2 rounded bg-surface-subtle" />
              <div className="h-7 w-1/3 rounded bg-surface-subtle" />
            </div>
          ))}
        </div>
        <div className="sp-card h-48 animate-pulse p-6" />
      </div>
    );
  }

  if (analyticsQuery.isError || !analyticsQuery.data) {
    return (
      <div role="alert" className="sp-card border-status-danger/40 p-6 text-start">
        <p className="font-semibold text-status-danger">{t('errors.unexpectedTitle')}</p>
        <p className="mt-1 text-sm text-text-secondary">
          {analyticsQuery.error instanceof ApiClientError
            ? analyticsQuery.error.normalized.message
            : t('errors.unexpectedDescription')}
        </p>
        <button
          type="button"
          onClick={() => void analyticsQuery.refetch()}
          className="sp-tactile-control mt-4 bg-surface-subtle px-4 py-2 text-xs font-semibold"
        >
          {t('common.retry')}
        </button>
      </div>
    );
  }

  const data = analyticsQuery.data;
  const goalPct = Math.min(100, Math.round((data.reviewedToday / Math.max(1, data.dailyGoal)) * 100));
  const maxDayMinutes = Math.max(1, ...data.studyTimeByDay.map((d) => d.minutes));

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">
            {t('analytics.title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('analytics.subtitle')}</p>
        </div>
        <Link
          to="/study"
          className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          <Play className="h-4 w-4" />
          <span>{t('study.startDailySession')}</span>
        </Link>
      </div>

      {/* KPI Metrics Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sp-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {t('analytics.streakLabel')}
            </span>
            <Flame className="h-4 w-4 text-accent-pulse" />
          </div>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-accent-pulse">
              {data.streakDays}
            </span>
          </p>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {t('analytics.retentionLabel')}
            </span>
            <TrendingUp className="h-4 w-4 text-status-success" />
          </div>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-status-success">
              {data.retentionRatePct}%
            </span>
          </p>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {t('analytics.totalReviewsLabel')}
            </span>
            <BarChart3 className="h-4 w-4 text-brand-primary" />
          </div>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-brand-primary">
              {data.totalReviews}
            </span>
          </p>
        </div>

        <div className="sp-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-secondary">
              {t('analytics.avgSpeedLabel')}
            </span>
            <Clock className="h-4 w-4 text-status-info" />
          </div>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-status-info">
              {(data.averageResponseMs / 1000).toFixed(1)}s
            </span>
          </p>
        </div>
      </section>

      {/* Daily Goal Progress Bar */}
      <section className="sp-card p-5">
        <div className="flex items-center justify-between gap-2 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5 text-text-primary">
            <Target className="h-4 w-4 text-brand-primary" />
            <span>
              {t('analytics.dailyGoalProgress', {
                done: data.reviewedToday,
                goal: data.dailyGoal,
              })}
            </span>
          </span>
          <span className="sp-mono-numeric text-brand-primary">{goalPct}%</span>
        </div>
        <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle">
          <div
            className="h-full rounded-full bg-brand-primary transition-[width] duration-300"
            style={{ width: `${goalPct}%` }}
          />
        </div>
      </section>

      {/* Retention Contribution Heatmap (Electric Violet Scale) */}
      <section className="sp-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-heading text-base font-bold text-text-primary">
            {t('analytics.heatmapTitle')}
          </h2>
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span>{t('analytics.heatmapLess')}</span>
            {([0, 1, 2, 3, 4] as const).map((lvl) => (
              <span
                key={lvl}
                className={`h-3.5 w-3.5 rounded-[4px] border ${HEATMAP_LEVEL_CLASSES[lvl]}`}
              />
            ))}
            <span>{t('analytics.heatmapMore')}</span>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto pb-2">
          <div dir="ltr" className="inline-flex gap-1.5">
            {weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    onMouseEnter={() => setActiveDay(day)}
                    onFocus={() => setActiveDay(day)}
                    aria-label={t('analytics.heatmapTooltip', {
                      date: day.date,
                      count: day.count,
                    })}
                    title={t('analytics.heatmapTooltip', {
                      date: day.date,
                      count: day.count,
                    })}
                    className={`h-4 w-4 rounded-[4px] border transition-transform hover:scale-125 sm:h-5 sm:w-5 ${HEATMAP_LEVEL_CLASSES[day.level]}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-2 min-h-[20px] text-xs text-text-secondary">
          {activeDay ? (
            <span className="sp-mono-numeric inline-block font-medium text-brand-primary">
              {t('analytics.heatmapTooltip', {
                date: activeDay.date,
                count: activeDay.count,
              })}
            </span>
          ) : (
            <span>&nbsp;</span>
          )}
        </div>
      </section>

      {/* Topic Retention + Last 7 Days Study Time */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="sp-card p-5">
          <h2 className="font-heading text-base font-bold text-text-primary">
            {t('analytics.topicRetentionTitle')}
          </h2>

          {data.topicRetention.length === 0 ? (
            <p className="mt-4 text-sm text-text-secondary">{t('analytics.emptySubtitle')}</p>
          ) : (
            <div className="mt-4 space-y-4">
              {data.topicRetention.map((item) => (
                <div key={item.topic} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-text-primary">{item.topic}</span>
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span>{t('analytics.topicReviewed', { count: item.reviewedCount })}</span>
                      <span>·</span>
                      <span className="sp-mono-numeric font-bold text-status-success">
                        {item.retentionRatePct}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-status-success transition-[width] duration-300"
                      style={{ width: `${item.retentionRatePct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="sp-card p-5">
          <h2 className="font-heading text-base font-bold text-text-primary">
            {t('analytics.studyTimeTitle')}
          </h2>

          <div dir="ltr" className="mt-5 grid h-44 grid-cols-7 items-end gap-2">
            {data.studyTimeByDay.map((day) => {
              const heightPct =
                day.minutes > 0 ? Math.max(12, Math.round((day.minutes / maxDayMinutes) * 100)) : 4;
              return (
                <div key={day.date} className="flex h-full flex-col items-center justify-end gap-1.5">
                  <span className="sp-mono-numeric text-[10px] font-semibold text-text-secondary">
                    {day.minutes > 0 ? `${day.minutes}${t('analytics.minutesUnit')}` : '0'}
                  </span>
                  <div className="flex h-28 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-[32px] rounded-t-md transition-all ${
                        day.minutes > 0 ? 'bg-brand-primary' : 'bg-surface-subtle'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="sp-mono-numeric text-[10px] text-text-secondary">
                    {day.date.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
