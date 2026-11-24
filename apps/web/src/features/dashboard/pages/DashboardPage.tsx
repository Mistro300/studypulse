import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Layers, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth-store';
import { useDecksQuery, useOfflineDeckIdsQuery } from '@/features/decks/api/decks-api';

export function DashboardPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const decksQuery = useDecksQuery({});
  const offlineIdsQuery = useOfflineDeckIdsQuery();

  const decks = decksQuery.data ?? [];
  const offlineIds = offlineIdsQuery.data ?? new Set<string>();
  const totalDue = decks.reduce((acc, d) => acc + d.dueCount, 0);

  return (
    <div className="space-y-6 text-start">
      <section className="sp-card p-6">
        <h1 className="font-heading text-2xl font-bold text-text-primary">
          {t('dashboard.title', { name: user?.displayName ?? 'StudyPulse' })}
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary">{t('dashboard.subtitle')}</p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            to="/study"
            className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
          >
            <Sparkles className="h-4 w-4" />
            <span>{t('study.startDailySession')}</span>
          </Link>
          <Link
            to="/decks"
            className="sp-tactile-control inline-flex items-center gap-2 bg-surface-base px-4 py-2.5 text-sm font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary"
          >
            <Layers className="h-4 w-4" />
            <span>{t('dashboard.openLibrary')}</span>
          </Link>
        </div>
      </section>

      {/* Metrics Grid (fixed RTL inline-block alignment for .sp-mono-numeric) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sp-card p-4">
          <p className="text-xs font-medium text-text-secondary">{t('dashboard.dueToday')}</p>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-brand-primary">
              {totalDue}
            </span>
          </p>
        </div>
        <div className="sp-card p-4">
          <p className="text-xs font-medium text-text-secondary">{t('dashboard.streak')}</p>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-accent-pulse">
              {user?.streakDays ?? 0}
            </span>
          </p>
        </div>
        <div className="sp-card p-4">
          <p className="text-xs font-medium text-text-secondary">{t('dashboard.totalDecks')}</p>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-text-primary">
              {decks.length}
            </span>
          </p>
        </div>
        <div className="sp-card p-4">
          <p className="text-xs font-medium text-text-secondary">{t('dashboard.offlineReady')}</p>
          <p className="mt-2">
            <span className="sp-mono-numeric inline-block text-2xl font-bold text-status-success">
              {offlineIds.size}
            </span>
          </p>
        </div>
      </section>

      {/* Recent Decks */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-base font-bold text-text-primary">
            {t('dashboard.recentDecks')}
          </h2>
          <Link to="/decks" className="text-xs font-semibold text-brand-primary hover:underline">
            {t('dashboard.openLibrary')}
          </Link>
        </div>

        {decksQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="sp-card animate-pulse space-y-2 p-5">
                <div className="h-4 w-1/2 rounded bg-surface-subtle" />
                <div className="h-3 w-3/4 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {decks.slice(0, 4).map((deck) => (
              <Link
                key={deck.id}
                to="/decks/$deckId"
                params={{ deckId: deck.id }}
                className="sp-card block p-5 transition-colors hover:border-brand-primary/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                    {deck.topic}
                  </span>
                  {offlineIds.has(deck.id) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-success">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{t('decks.offlineAvailable')}</span>
                    </span>
                  )}
                </div>
                <h3 className="mt-2.5 font-heading text-base font-bold text-text-primary">
                  {deck.title}
                </h3>
                <p className="mt-1 text-xs text-text-secondary">
                  {t('decks.cardsCount', { count: deck.cardCount })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
