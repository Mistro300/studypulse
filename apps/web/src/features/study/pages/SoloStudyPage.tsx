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
  CheckCircle2,
  CloudUpload,
  Home,
  RotateCw,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { useSyncStore } from '@/core/offline/sync-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { useStudyQueueQuery } from '@/features/study/api/study-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

interface SessionResultItem {
  cardId: string;
  rating: SrsRating;
  durationMs: number;
}

function formatInterval(minutes: number, scheduledDays: number, locale: string): string {
  const isAr = locale === 'ar';
  if (scheduledDays >= 1) {
    return isAr ? `${scheduledDays} ي` : `${scheduledDays}d`;
  }
  if (minutes >= 60) {
    const hrs = Math.round(minutes / 60);
    return isAr ? `${hrs} س` : `${hrs}h`;
  }
  return isAr ? `${minutes} د` : `${minutes}m`;
}

const RATING_CONFIG: Array<{
  rating: SrsRating;
  shortcut: string;
  labelKey: string;
  borderClass: string;
  textClass: string;
  hoverClass: string;
}> = [
  {
    rating: 'AGAIN',
    shortcut: '1',
    labelKey: 'srs.again',
    borderClass: 'border-srs-again/50',
    textClass: 'text-srs-again',
    hoverClass: 'hover:bg-srs-again/10',
  },
  {
    rating: 'HARD',
    shortcut: '2',
    labelKey: 'srs.hard',
    borderClass: 'border-srs-hard/50',
    textClass: 'text-srs-hard',
    hoverClass: 'hover:bg-srs-hard/10',
  },
  {
    rating: 'GOOD',
    shortcut: '3',
    labelKey: 'srs.good',
    borderClass: 'border-srs-good/50',
    textClass: 'text-srs-good',
    hoverClass: 'hover:bg-srs-good/10',
  },
  {
    rating: 'EASY',
    shortcut: '4',
    labelKey: 'srs.easy',
    borderClass: 'border-srs-easy/50',
    textClass: 'text-srs-easy',
    hoverClass: 'hover:bg-srs-easy/10',
  },
];

export function SoloStudyPage() {
  const { t, i18n } = useTranslation();
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
  const isComplete = sessionQueue !== null && activeItems.length > 0 && currentIndex >= activeItems.length;
  const isEmpty = sessionQueue !== null && activeItems.length === 0;

  const previews = useMemo(
    () => (currentItem ? previewAllRatings(currentItem.srs) : null),
    [currentItem],
  );

  const handleRate = useCallback(
    async (rating: SrsRating) => {
      if (!currentItem || !user || !flipped || submitting) return;
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
    activeItems.length > 0 ? Math.min(100, Math.round((currentIndex / activeItems.length) * 100)) : 0;

  return (
    <div className="flex min-h-dvh flex-col bg-surface-base text-text-primary">
      {/* Slim Distraction-Free Focus Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border-default bg-surface-elevated">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between gap-3 px-4">
          <Link
            to="/"
            aria-label={t('study.exitSession')}
            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">{t('study.exitSession')}</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-xs font-semibold text-text-primary">
              {currentItem?.deckTitle ?? t('common.appName')}
            </span>
            {activeItems.length > 0 && (
              <span className="sp-mono-numeric shrink-0 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand-primary">
                {Math.min(currentIndex + (isComplete ? 0 : 1), activeItems.length)} / {activeItems.length}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                isSyncing
                  ? 'bg-brand-soft text-brand-primary'
                  : !isOnline
                    ? 'bg-surface-subtle text-status-warning'
                    : pendingCount > 0
                      ? 'bg-accent-pulse-soft text-accent-pulse'
                      : 'bg-surface-subtle text-status-success'
              }`}
            >
              {isSyncing ? (
                <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
              ) : isOnline ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">
                {isSyncing
                  ? t('common.syncing')
                  : pendingCount > 0
                    ? t('common.pendingSync', { count: pendingCount })
                    : isOnline
                      ? t('common.synced')
                      : t('common.offline')}
              </span>
            </span>
          </div>
        </div>
        {/* Slim Progress Line */}
        <div className="h-1 w-full bg-surface-subtle">
          <div
            className="h-full bg-brand-primary transition-[width] duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-6">
        {/* Loading Skeleton */}
        {queueQuery.isLoading && sessionQueue === null && (
          <div className="sp-card animate-pulse space-y-4 p-8">
            <div className="h-4 w-24 rounded bg-surface-subtle" />
            <div className="h-8 w-3/4 rounded bg-surface-subtle" />
            <div className="h-24 w-full rounded bg-surface-subtle" />
          </div>
        )}

        {/* Empty State (All Caught Up) */}
        {isEmpty && (
          <div className="sp-card flex flex-col items-center p-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-card bg-status-success/15 text-status-success">
              <CheckCircle2 className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold">{t('study.allCaughtUpTitle')}</h1>
            <p className="mt-2 max-w-md text-sm text-text-secondary">
              {t('study.allCaughtUpSubtitle')}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/analytics"
                className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t('study.viewAnalytics')}</span>
              </Link>
              <Link
                to="/"
                className="sp-tactile-control inline-flex items-center gap-2 bg-surface-base px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-subtle"
              >
                <Home className="h-4 w-4" />
                <span>{t('study.backToDashboard')}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Session Complete Summary */}
        {isComplete && (
          <div className="sp-card p-8 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-card bg-brand-soft text-brand-primary">
              <Sparkles className="h-7 w-7" />
            </span>
            <h1 className="mt-4 font-heading text-2xl font-bold">
              {t('study.sessionCompleteTitle')}
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
              {t('study.sessionCompleteSubtitle')}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-control border border-border-default bg-surface-base p-4">
                <p className="text-xs text-text-secondary">{t('study.reviewedCount')}</p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-bold text-brand-primary">
                    {results.length}
                  </span>
                </p>
              </div>
              <div className="rounded-control border border-border-default bg-surface-base p-4">
                <p className="text-xs text-text-secondary">{t('study.retentionLabel')}</p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-bold text-status-success">
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
              <div className="rounded-control border border-border-default bg-surface-base p-4">
                <p className="text-xs text-text-secondary">{t('study.avgSpeedLabel')}</p>
                <p className="mt-1">
                  <span className="sp-mono-numeric inline-block text-2xl font-bold text-accent-pulse">
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
              <p className="mt-4 rounded-control bg-accent-pulse-soft px-3 py-2 text-xs font-medium text-accent-pulse">
                {t('study.queuedOfflineNote')}
              </p>
            )}

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/analytics"
                className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
              >
                <BarChart3 className="h-4 w-4" />
                <span>{t('study.viewAnalytics')}</span>
              </Link>
              <Link
                to="/"
                className="sp-tactile-control inline-flex items-center gap-2 bg-surface-base px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-subtle"
              >
                <Home className="h-4 w-4" />
                <span>{t('study.backToDashboard')}</span>
              </Link>
            </div>
          </div>
        )}

        {/* Active 3D Flip Study Card */}
        {currentItem && !isComplete && (
          <div className="space-y-5">
            <div className="sp-flip-scene">
              <div
                className="sp-flip-card min-h-[300px] sm:min-h-[340px]"
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
                  className="sp-card sp-flip-face sp-flip-front absolute inset-0 flex cursor-pointer flex-col justify-between p-6 text-start sm:p-8"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                        {t('study.questionBadge')}
                      </span>
                      <span className="rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-[11px] font-semibold text-text-secondary">
                        {currentItem.card.type}
                      </span>
                    </div>

                    <h2 className="mt-5 font-heading text-lg font-bold leading-relaxed text-text-primary sm:text-xl">
                      {currentItem.card.front}
                    </h2>

                    {/* Optional interactive MCQ preview choices on front face */}
                    {currentItem.card.type === 'MCQ' && currentItem.card.choices && (
                      <div
                        className="mt-5 grid gap-2 sm:grid-cols-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {currentItem.card.choices.map((choice, idx) => {
                          const letter = String.fromCharCode(65 + idx);
                          const isPicked = selectedChoiceId === choice.id;
                          return (
                            <button
                              key={choice.id}
                              type="button"
                              onClick={() => {
                                setSelectedChoiceId(choice.id);
                                setFlipped(true);
                              }}
                              className={`sp-tactile-control flex items-center gap-2.5 px-3.5 py-2.5 text-start text-xs font-medium transition-colors ${
                                isPicked
                                  ? 'border-brand-primary bg-brand-soft text-brand-primary'
                                  : 'bg-surface-base text-text-primary hover:bg-surface-subtle'
                              }`}
                            >
                              <span className="sp-mono-numeric flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-[11px] font-bold">
                                {letter}
                              </span>
                              <span>{choice.text}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between border-t border-border-default pt-4 text-xs text-text-secondary">
                    <span>{t('study.flipCard')}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-brand-primary">
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{t('study.showAnswer')}</span>
                    </span>
                  </div>
                </div>

                {/* Back Face */}
                <div className="sp-card sp-flip-face sp-flip-back absolute inset-0 flex flex-col justify-between border-brand-primary/40 p-6 text-start sm:p-8">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full bg-status-success/15 px-2.5 py-0.5 text-xs font-semibold text-status-success">
                        {t('study.answerBadge')}
                      </span>
                      {selectedChoiceId && currentItem.card.correctChoiceId && (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            selectedChoiceId === currentItem.card.correctChoiceId
                              ? 'bg-status-success/15 text-status-success'
                              : 'bg-status-danger/15 text-status-danger'
                          }`}
                        >
                          {selectedChoiceId === currentItem.card.correctChoiceId ? '✓' : '✕'}
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-xs font-medium text-text-secondary">
                      {currentItem.card.front}
                    </p>
                    <p className="mt-3 text-base font-semibold leading-relaxed text-text-primary sm:text-lg">
                      {currentItem.card.back}
                    </p>

                    {currentItem.card.explanation && (
                      <div className="mt-4 rounded-control border border-border-default bg-surface-subtle p-3.5 text-xs leading-relaxed text-text-secondary">
                        {currentItem.card.explanation}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-default pt-3 text-[11px] text-text-secondary">
                    <div className="flex flex-wrap gap-1.5">
                      {currentItem.card.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-border-default px-2 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setFlipped(false)}
                      className="inline-flex items-center gap-1 font-medium hover:text-text-primary"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      <span>{t('study.questionBadge')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Controls: Reveal CTA OR 4-Button FSRS-5 Rating Spectrum */}
            {!flipped ? (
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFlipped(true)}
                  className="sp-tactile-control w-full max-w-sm border-brand-hover bg-brand-primary px-6 py-3 text-sm font-semibold text-white hover:bg-brand-hover"
                >
                  {t('study.showAnswer')}
                </button>
                <p className="text-[11px] text-text-secondary">{t('study.shortcutsHint')}</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="text-center text-xs font-medium text-text-secondary">
                  {t('study.ratePrompt')}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {RATING_CONFIG.map(({ rating, shortcut, labelKey, borderClass, textClass, hoverClass }) => {
                    const preview = previews?.[rating];
                    return (
                      <button
                        key={rating}
                        type="button"
                        disabled={submitting}
                        onClick={() => void handleRate(rating)}
                        className={`sp-tactile-control relative flex flex-col items-center justify-center bg-surface-elevated px-3 py-3 transition-colors disabled:opacity-50 ${borderClass} ${hoverClass}`}
                      >
                        <kbd className="sp-mono-numeric absolute end-2 top-2 rounded border border-border-default bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-text-secondary">
                          {shortcut}
                        </kbd>
                        <span className={`text-sm font-bold ${textClass}`}>{t(labelKey)}</span>
                        {preview && (
                          <span className="sp-mono-numeric mt-0.5 text-xs text-text-secondary">
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
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
