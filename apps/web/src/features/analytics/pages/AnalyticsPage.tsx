import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { HeatmapDay } from '@studypulse/shared';
import {
  CheckCircle2,
  Flame,
  Layers,
  Play,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import { useAnalyticsOverviewQuery } from '@/features/study/api/study-api';
import { GlossySquircle } from '@/shared/ui/StudyPulseArtwork';

const HEATMAP_LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#EFEAFE] dark:bg-surface-subtle',
  1: 'bg-[#D4C5FD] dark:bg-[#4C1D95]/60',
  2: 'bg-[#B197FC] dark:bg-[#6D28D9]/80',
  3: 'bg-[#8B5CF6] dark:bg-[#7C3AED]',
  4: 'bg-[#5B21B6] dark:bg-[#A78BFA]',
};

const AR_WEEKDAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWeekday(dateStr: string, isAr: boolean): string {
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr.slice(5);
  const idx = parsed.getDay();
  return isAr ? (AR_WEEKDAYS[idx] ?? dateStr.slice(5)) : (EN_WEEKDAYS[idx] ?? dateStr.slice(5));
}

export function AnalyticsPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
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
            <div key={i} className="sp-card animate-pulse space-y-2 rounded-[20px] p-4">
              <div className="h-3 w-1/2 rounded bg-surface-subtle" />
              <div className="h-7 w-1/3 rounded bg-surface-subtle" />
            </div>
          ))}
        </div>
        <div className="sp-card h-56 animate-pulse rounded-[24px] p-6" />
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
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-text-primary sm:text-3xl">
            {t('analytics.title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('analytics.subtitle')}</p>
        </div>
        <Link
          to="/study"
          className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{t('study.startDailySession')}</span>
        </Link>
      </div>

      {/* 4 Elevated KPI Cards with 3D Glossy Squircle Icons */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="amber" size="lg">
            <Flame className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text-primary">
              {t('analytics.streakLabel')}:{' '}
              <span className="sp-mono-numeric inline-block text-base">{data.streakDays}</span>
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {isAr ? 'أيام متتالية' : 'Consecutive days'}
            </p>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="emerald" size="lg">
            <ShieldCheck className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text-primary">
              {t('analytics.retentionLabel')}:{' '}
              <span className="sp-mono-numeric inline-block text-base">
                {data.retentionRatePct}%
              </span>
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {data.retentionRatePct >= 70
                ? isAr
                  ? 'مستوى ممتاز'
                  : 'Excellent level'
                : isAr
                  ? 'في تحسن مستمر'
                  : 'Improving steadily'}
            </p>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="violet" size="lg">
            <Layers className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text-primary">
              {t('analytics.totalReviewsLabel')}:{' '}
              <span className="sp-mono-numeric inline-block text-base">{data.totalReviews}</span>
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {isAr ? 'بطاقة تمت مراجعتها' : 'Cards reviewed'}
            </p>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="cyan" size="lg">
            <Zap className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-text-primary">
              {t('analytics.avgSpeedLabel')}:{' '}
              <span className="sp-mono-numeric inline-block text-base">
                {(data.averageResponseMs / 1000).toFixed(1)}s
              </span>
            </p>
            <p className="mt-0.5 text-xs text-text-secondary">
              {isAr ? 'متوسط الاستجابة' : 'Average response'}
            </p>
          </div>
        </div>
      </section>

      {/* Asymmetric 2-Column Bento Layout */}
      <div className="grid gap-5 lg:grid-cols-12">
        {/* Start Column (7 cols): 13-Week Heatmap + Topic Retention */}
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/* 13-Week Violet Heatmap */}
          <section className="sp-card rounded-[24px] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-base font-extrabold text-text-primary sm:text-lg">
                {t('analytics.heatmapTitle')}
              </h2>
              {activeDay && (
                <span className="sp-mono-numeric rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand-primary">
                  {t('analytics.heatmapTooltip', {
                    date: activeDay.date,
                    count: activeDay.count,
                  })}
                </span>
              )}
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
                        className={`h-4 w-4 rounded-[5px] transition-transform hover:scale-125 sm:h-5 sm:w-5 ${HEATMAP_LEVEL_CLASSES[day.level]}`}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] font-semibold text-text-secondary">
              <span>{t('analytics.heatmapLess')}</span>
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <span
                  key={lvl}
                  className={`h-3.5 w-3.5 rounded-[4px] ${HEATMAP_LEVEL_CLASSES[lvl]}`}
                />
              ))}
              <span>{t('analytics.heatmapMore')}</span>
            </div>
          </section>

          {/* Topic Retention with Thick Glossy Emerald Bars */}
          <section className="sp-card flex-1 rounded-[24px] p-5 sm:p-6">
            <h2 className="font-heading text-base font-extrabold text-text-primary sm:text-lg">
              {t('analytics.topicRetentionTitle')}
            </h2>

            {data.topicRetention.length === 0 ? (
              <p className="mt-4 text-sm text-text-secondary">{t('analytics.emptySubtitle')}</p>
            ) : (
              <div className="mt-5 space-y-5">
                {data.topicRetention.map((item) => (
                  <div key={item.topic} className="space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
                      <span className="inline-flex items-center gap-1.5 font-bold text-text-primary">
                        <span>{item.topic}</span>
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                      </span>
                      <span className="sp-mono-numeric font-bold text-text-secondary">
                        {item.topic} ({item.retentionRatePct}%)
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-emerald-500/12">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#059669] shadow-[0_4px_12px_-3px_rgba(16,185,129,0.5)] transition-[width] duration-300"
                        style={{ width: `${Math.max(8, item.retentionRatePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* End Column (5 cols): Thick Pill Daily Goal + Tall Capsule 7-Day Activity Chart */}
        <div className="flex flex-col gap-5 lg:col-span-5">
          {/* Daily Goal Pill Card */}
          <section className="sp-card rounded-[24px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-heading text-base font-extrabold text-text-primary">
                {t('analytics.dailyGoalProgress', {
                  done: data.reviewedToday,
                  goal: data.dailyGoal,
                })}
              </h2>
            </div>

            <div className="mt-4 h-10 w-full overflow-hidden rounded-full bg-[#EFEAFE] p-1 dark:bg-surface-subtle">
              <div
                className="flex h-full items-center justify-end rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] px-3 text-xs font-extrabold text-white shadow-[0_6px_16px_-4px_rgba(109,40,217,0.65)] transition-[width] duration-300"
                style={{ width: `${Math.max(18, goalPct)}%` }}
              >
                <span className="sp-mono-numeric">{goalPct}%</span>
              </div>
            </div>
          </section>

          {/* Last 7 Days Study Activity — Tall Rounded Capsule Columns */}
          <section className="sp-card flex flex-1 flex-col justify-between rounded-[24px] p-5 sm:p-6">
            <h2 className="font-heading text-base font-extrabold text-text-primary sm:text-lg">
              {t('analytics.studyTimeTitle')}
            </h2>

            <div dir="ltr" className="mt-6 grid h-56 grid-cols-7 items-end gap-2.5 sm:gap-3">
              {data.studyTimeByDay.map((day) => {
                const heightPct =
                  day.minutes > 0
                    ? Math.max(18, Math.round((day.minutes / maxDayMinutes) * 100))
                    : 10;
                return (
                  <div
                    key={day.date}
                    title={`${day.date}: ${day.minutes} ${t('analytics.minutesUnit')}`}
                    className="flex h-full flex-col items-center justify-end gap-2"
                  >
                    <div className="flex h-44 w-full max-w-[36px] items-end overflow-hidden rounded-full bg-[#EFEAFE] p-0.5 dark:bg-surface-subtle">
                      <div
                        className={`w-full rounded-full transition-all duration-300 ${
                          day.minutes > 0
                            ? 'bg-gradient-to-t from-[#5B21B6] via-[#7C3AED] to-[#A78BFA] shadow-[0_6px_14px_-4px_rgba(109,40,217,0.55)]'
                            : 'bg-brand-primary/20'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="truncate text-[11px] font-bold text-text-secondary">
                      {formatWeekday(day.date, isAr)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
