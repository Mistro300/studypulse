import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  previewAllRatings,
  type SrsRating,
  type StudyCardWithSrs,
} from '@studypulse/shared';
import {
  BarChart3,
  Check,
  CheckCircle2,
  CloudUpload,
  Eye,
  Gauge,
  Home,
  LogOut,
  RotateCcw,
  RotateCw,
  Sparkles,
  Star,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSyncStore } from '@/core/offline/sync-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { useStudyQueueQuery } from '@/features/study/api/study-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { StudyPulseLogo } from '@/shared/ui/StudyPulseArtwork';

interface SessionResultItem {
  cardId: string;
  rating: SrsRating;
  durationMs: number;
}

const ARABIC_CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];

function formatInterval(minutes: number, scheduledDays: number, locale: string): string {
  const isAr = locale === 'ar';
  if (scheduledDays >= 1) {
    return isAr ? `${scheduledDays}ي` : `${scheduledDays}d`;
  }
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60);
    return isAr ? `${hrs}س` : `${hrs}h`;
  }
  return isAr ? `${minutes}د` : `${minutes}m`;
}

const DOCK_RATINGS: Array<{
  rating: SrsRating;
  shortcut: string;
  labelKey: string;
  pillClass: string;
  Icon: typeof Star;
}> = [
  {
    rating: 'EASY',
    shortcut: '4',
    labelKey: 'srs.easy',
    pillClass:
      'bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9] text-white shadow-[0_8px_18px_-6px_rgba(109,40,217,0.65)]',
    Icon: Star,
  },
  {
    rating: 'GOOD',
    shortcut: '3',
    labelKey: 'srs.good',
    pillClass:
      'bg-gradient-to-r from-[#10B981] to-[#059669] text-white shadow-[0_8px_18px_-6px_rgba(5,150,105,0.6)]',
    Icon: Check,
  },
  {
    rating: 'HARD',
    shortcut: '2',
    labelKey: 'srs.hard',
    pillClass:
      'bg-gradient-to-r from-[#FBBF24] to-[#D97706] text-white shadow-[0_8px_18px_-6px_rgba(217,119,6,0.55)]',
    Icon: Gauge,
  },
  {
    rating: 'AGAIN',
    shortcut: '1',
    labelKey: 'srs.again',
    pillClass:
      'bg-gradient-to-r from-[#FB7185] to-[#E11D48] text-white shadow-[0_8px_18px_-6px_rgba(225,29,72,0.55)]',
    Icon: RotateCcw,
  },
];

export function SoloStudyPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const search = useSearch({ strict: false }) as { deckId?: string };
  const deckId = search.deckId;

  const user = useAuthStore((s) => s.user);
  const { isOnline } = useNetworkStatus();
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const recordReviewOfflineFirst = useSyncStore((s) => s.recordReviewOfflineFirst);

  const queueQuery = useStudyQueueQuery(user?.id, deckId);

  // Freeze queue snapshot for the active session so background refetches don't jump cards mid-session
  const [sessionQueue, setSessionQueue] = useState<StudyCardWithSrs[] | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [results, setResults] = useState<SessionResultItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const cardStartedAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (queueQuery.data && sessionQueue === null) {
      setSessionQueue(queueQuery.data.items);
      cardStartedAtRef.current = Date.now();
    }
  }, [queueQuery.data, sessionQueue]);

  const activeItems = sessionQueue ?? [];
  const currentItem = activeItems[currentIndex] ?? null;
  const isComplete =
    sessionQueue !== null && activeItems.length > 0 && currentIndex >= activeItems.length;
  const isEmpty = sessionQueue !== null && activeItems.length === 0;

  const previews = useMemo(
    () => (currentItem ? previewAllRatings(currentItem.srs) : null),
    [currentItem],
  );

  const handleRate = useCallback(
    async (rating: SrsRating) => {
      if (!currentItem || !user || submitting) return;
      if (!flipped) {
        setFlipped(true);
        return;
      }
      setSubmitting(true);
      const durationMs = Math.max(200, Date.now() - cardStartedAtRef.current);

      try {
        await recordReviewOfflineFirst({
          userId: user.id,
          cardId: currentItem.card.id,
          deckId: currentItem.card.deckId,
          currentSrs: currentItem.srs,
          rating,
          durationMs,
        });

        setResults((prev) => [...prev, { cardId: currentItem.card.id, rating, durationMs }]);
        setFlipped(false);
        setSelectedChoiceId(null);
        setCurrentIndex((idx) => idx + 1);
        cardStartedAtRef.current = Date.now();
      } finally {
        setSubmitting(false);
      }
    },
    [currentItem, user, flipped, submitting, recordReviewOfflineFirst],
  );

  // Keyboard shortcuts: Space to flip, 1-4 to rate
  useEffect(() => {
    if (!currentItem || isComplete || isEmpty) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        setFlipped((f) => !f);
        return;
      }

      if (!flipped) return;
      if (e.key === '1') void handleRate('AGAIN');
      else if (e.key === '2') void handleRate('HARD');
      else if (e.key === '3') void handleRate('GOOD');
      else if (e.key === '4') void handleRate('EASY');
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentItem, flipped, isComplete, isEmpty, handleRate]);

  const progressPct =
    activeItems.length > 0
      ? Math.min(100, Math.round(((currentIndex + (isComplete ? 0 : 1)) / activeItems.length) * 100))
      : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-base text-text-primary">
      {/* Floating Rounded Distraction-Free Top Bar */}
      <header className="sticky top-3 z-30 mx-auto w-[calc(100%-24px)] max-w-5xl">
        <div className="sp-card overflow-hidden rounded-2xl">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-5">
            <Link
              to="/"
              aria-label={t('study.exitSession')}
              className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-elevated px-3.5 py-1.5 text-xs font-bold text-text-secondary transition-colors hover:border-brand-primary/40 hover:bg-brand-soft hover:text-brand-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('study.exitSession')}</span>
            </Link>

            <div className="flex min-w-0 items-center gap-2.5">
              {activeItems.length > 0 && (
                <span className="sp-mono-numeric shrink-0 rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs font-extrabold text-text-primary">
                  {Math.min(currentIndex + (isComplete ? 0 : 1), activeItems.length)} /{' '}
                  {activeItems.length}
                </span>
              )}
              <span className="truncate text-xs font-bold text-text-primary sm:text-sm">
                {currentItem?.deckTitle ?? t('common.appName')}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`hidden items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:inline-flex ${
                  isSyncing
                    ? 'bg-brand-soft text-brand-primary'
                    : !isOnline
                      ? 'bg-status-warning/15 text-status-warning'
                      : pendingCount > 0
                        ? 'bg-accent-pulse-soft text-accent-pulse'
                        : 'bg-status-success/12 text-status-success'
                }`}
              >
                {isSyncing ? (
                  <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
                ) : isOnline ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                <span>
                  {isSyncing
                    ? t('common.syncing')
                    : pendingCount > 0
                      ? t('common.pendingSync', { count: pendingCount })
                      : isOnline
                        ? t('common.synced')
                        : t('common.offline')}
                </span>
              </span>
              <div className="hidden md:block">
                <StudyPulseLogo compact />
              </div>
            </div>
          </div>

          {/* Slim Gradient Progress Track */}
          <div className="h-1.5 w-full bg-brand-soft">
            <div
              className="h-full rounded-e-full bg-gradient-to-r from-[#7C3AED] to-[#6366F1] transition-[width] duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-8">
        {/* Loading Skeleton */}
        {queueQuery.isLoading && sessionQueue === null && (
          <div className="sp-card animate-pulse space-y-4 rounded-[28px] p-8">
            <div className="h-4 w-24 rounded bg-surface-subtle" />
            <div className="h-8 w-3/4 rounded bg-surface-subtle" />
            <div className="h-24 w-full rounded bg-surface-subtle" />
          </div>
        )}

        {/* Empty State (All Caught Up) */}
        {isEmpty && (
          <div className="sp-card sp-halo-card flex flex-col items-center rounded-[28px] p-10 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-status-success/15 text-status-success">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-extrabold">
              {t('study.allCaughtUpTitle')}
            </h1>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              {t('study.allCaughtUpSubtitle')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/analytics"
                className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t('study.viewAnalytics')}</span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-bold text-text-primary hover:bg-surface-subtle"
              >
                <Home className="h-4 w-4" />
                <span>{t('study.backToDashboard')}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Session Complete Summary */}
        {isComplete && (
          <div className="sp-card sp-halo-card rounded-[28px] p-8 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-primary">
              <Sparkles className="h-8 w-8" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-extrabold">
              {t('study.sessionCompleteTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {t('study.sessionCompleteSubtitle')}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border-default bg-surface-base p-4">
                <p className="text-xs font-semibold text-text-secondary">
                  {t('study.reviewedCount')}
                </p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-extrabold text-brand-primary">
                    {results.length}
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-base p-4">
                <p className="text-xs font-semibold text-text-secondary">
                  {t('study.retentionLabel')}
                </p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-extrabold text-status-success">
                    {results.length > 0
                      ? Math.round(
                          (results.filter((r) => r.rating === 'GOOD' || r.rating === 'EASY')
                            .length /
                            results.length) *
                            100,
                        )
                      : 0}
                    %
                  </span>
                </p>
              </div>
              <div className="rounded-2xl border border-border-default bg-surface-base p-4">
                <p className="text-xs font-semibold text-text-secondary">
                  {t('study.avgSpeedLabel')}
                </p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-extrabold text-accent-pulse">
                    {results.length > 0
                      ? (
                          results.reduce((s, r) => s + r.durationMs, 0) /
                          results.length /
                          1000
                        ).toFixed(1)
                      : '0.0'}
                    s
                  </span>
                </p>
              </div>
            </div>

            {pendingCount > 0 && (
              <p className="mt-4 rounded-xl bg-accent-pulse-soft px-3.5 py-2 text-xs font-semibold text-accent-pulse">
                {t('study.queuedOfflineNote')}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/analytics"
                className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t('study.viewAnalytics')}</span>
              </Link>
              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-sm font-bold text-text-primary hover:bg-surface-subtle"
              >
                <Home className="h-4 w-4" />
                <span>{t('study.backToDashboard')}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Active 3D Flip Card with Ambient Violet Halo + Floating Bottom Action Pill Dock */}
        {currentItem && !isComplete && (
          <div className="space-y-6">
            <div className="relative">
              {/* Soft Ambient Lilac Halo Behind Active Card */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-4 rounded-[36px] bg-gradient-to-tr from-[#8B5CF6]/20 via-[#A78BFA]/25 to-[#38BDF8]/15 blur-2xl dark:from-[#7C3AED]/25 dark:via-[#6D28D9]/20"
              />

              <div className="sp-flip-scene relative z-10">
                <div
                  className="sp-flip-card min-h-[340px] sm:min-h-[380px]"
                  data-flipped={flipped ? 'true' : 'false'}
                >
                  {/* Front Face */}
                  <div
                    onClick={() => !flipped && setFlipped(true)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.code === 'Space') && !flipped) {
                        e.preventDefault();
                        setFlipped(true);
                      }
                    }}
                    className="sp-card sp-halo-card sp-flip-face sp-flip-front absolute inset-0 flex cursor-pointer flex-col justify-between rounded-[28px] p-6 text-start sm:p-8"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-bold text-text-secondary">
                          {t('study.questionBadge')}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-[#22D3EE] to-[#06B6D4] px-3 py-1 text-[11px] font-extrabold text-white shadow-sm">
                          <Sparkles className="h-3 w-3" />
                          <span>{currentItem.card.type}</span>
                        </span>
                      </div>

                      <h2 className="mt-6 font-heading text-xl font-extrabold leading-relaxed text-text-primary sm:text-2xl">
                        {currentItem.card.front}
                      </h2>

                      {/* 2x2 Interactive MCQ Choice Cards */}
                      {currentItem.card.type === 'MCQ' && currentItem.card.choices && (
                        <div
                          className="mt-6 grid gap-3 sm:grid-cols-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {currentItem.card.choices.map((choice, idx) => {
                            const letter = isAr
                              ? (ARABIC_CHOICE_LETTERS[idx] ?? String.fromCharCode(65 + idx))
                              : String.fromCharCode(65 + idx);
                            const isPicked = selectedChoiceId === choice.id;
                            return (
                              <button
                                key={choice.id}
                                type="button"
                                onClick={() => {
                                  setSelectedChoiceId(choice.id);
                                  setFlipped(true);
                                }}
                                className={`flex items-center gap-3 rounded-2xl border p-3.5 text-start text-sm font-semibold transition-all ${
                                  isPicked
                                    ? 'border-brand-primary bg-brand-soft/80 text-brand-primary shadow-sm'
                                    : 'border-border-default bg-surface-elevated text-text-primary hover:border-brand-primary/45 hover:bg-brand-soft/35'
                                }`}
                              >
                                <span
                                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                                    isPicked
                                      ? 'bg-brand-primary text-white'
                                      : 'bg-surface-subtle text-text-secondary'
                                  }`}
                                >
                                  {letter}
                                </span>
                                <span className="leading-snug">{choice.text}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 text-xs text-text-secondary">
                      <span>{t('study.shortcutsHint')}</span>
                      <span className="inline-flex items-center gap-1 font-bold text-brand-primary">
                        <RotateCw className="h-3.5 w-3.5" />
                        <span>{t('study.flipCard')}</span>
                      </span>
                    </div>
                  </div>

                  {/* Back Face */}
                  <div className="sp-card sp-halo-card sp-flip-face sp-flip-back absolute inset-0 flex flex-col justify-between rounded-[28px] border-brand-primary/35 p-6 text-start sm:p-8">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-status-success/15 px-3 py-1 text-xs font-bold text-status-success">
                          {t('study.answerBadge')}
                        </span>
                        {selectedChoiceId && currentItem.card.correctChoiceId && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-extrabold ${
                              selectedChoiceId === currentItem.card.correctChoiceId
                                ? 'bg-status-success/15 text-status-success'
                                : 'bg-status-danger/15 text-status-danger'
                            }`}
                          >
                            {selectedChoiceId === currentItem.card.correctChoiceId ? '✓' : '✕'}
                          </span>
                        )}
                      </div>

                      <p className="mt-4 text-xs font-semibold text-text-secondary">
                        {currentItem.card.front}
                      </p>
                      <p className="mt-3 font-heading text-lg font-extrabold leading-relaxed text-text-primary sm:text-xl">
                        {currentItem.card.back}
                      </p>

                      {currentItem.card.explanation && (
                        <div className="mt-4 rounded-2xl border border-border-default bg-surface-subtle/70 p-4 text-xs leading-relaxed text-text-secondary">
                          {currentItem.card.explanation}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default/80 pt-3.5 text-[11px] text-text-secondary">
                      <div className="flex flex-wrap gap-1.5">
                        {currentItem.card.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border-default bg-surface-subtle/60 px-2.5 py-0.5 font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setFlipped(false)}
                        className="inline-flex items-center gap-1 font-bold text-brand-primary hover:underline"
                      >
                        <RotateCw className="h-3.5 w-3.5" />
                        <span>{t('study.questionBadge')}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Bottom Action Pill Dock */}
            <div className="flex flex-col items-center gap-2">
              <div className="sp-card inline-flex flex-wrap items-center justify-center gap-2 rounded-[22px] p-2.5">
                <button
                  type="button"
                  onClick={() => setFlipped((f) => !f)}
                  className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-extrabold sm:text-sm"
                >
                  <Eye className="h-4 w-4" />
                  <span>{flipped ? t('study.questionBadge') : t('study.showAnswer')}</span>
                </button>

                {DOCK_RATINGS.map(({ rating, shortcut, labelKey, pillClass, Icon }) => {
                  const preview = previews?.[rating];
                  return (
                    <button
                      key={rating}
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleRate(rating)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-xs font-extrabold transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 sm:text-sm ${pillClass} ${
                        !flipped ? 'opacity-80 hover:opacity-100' : 'opacity-100'
                      }`}
                    >
                      <span className="sp-mono-numeric rounded-md bg-white/20 px-1.5 py-0.5 text-[11px] font-extrabold">
                        {shortcut}
                      </span>
                      <span>{t(labelKey)}</span>
                      <Icon className="h-3.5 w-3.5" />
                      {flipped && preview && (
                        <span className="sp-mono-numeric ms-0.5 rounded-md bg-black/15 px-1.5 py-0.5 text-[10px]">
                          {formatInterval(
                            preview.intervalMinutes,
                            preview.scheduledDays,
                            i18n.language,
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {flipped && (
                <p className="text-xs font-medium text-text-secondary">{t('study.ratePrompt')}</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
