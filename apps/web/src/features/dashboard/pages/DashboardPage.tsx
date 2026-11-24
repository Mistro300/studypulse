import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Clock,
  CloudDownload,
  Flame,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth-store';
import { useDecksQuery, useOfflineDeckIdsQuery } from '@/features/decks/api/decks-api';
import { DeckTopicIllustration, GlossySquircle } from '@/shared/ui/StudyPulseArtwork';

export function DashboardPage() {
  const { t, i18n } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const decksQuery = useDecksQuery({});
  const offlineIdsQuery = useOfflineDeckIdsQuery();

  const decks = decksQuery.data ?? [];
  const offlineIds = offlineIdsQuery.data ?? new Set<string>();
  const totalDue = decks.reduce((acc, d) => acc + d.dueCount, 0);
  const totalCards = decks.reduce((acc, d) => acc + d.cardCount, 0);

  const dueProgress = totalCards > 0 ? Math.min(100, Math.max(18, Math.round((totalDue / totalCards) * 100))) : 20;
  const streakProgress = Math.min(100, Math.max(18, ((user?.streakDays ?? 0) / 7) * 100));
  const decksProgress = Math.min(100, Math.max(18, (decks.length / 6) * 100));
  const offlineProgress =
    decks.length > 0 ? Math.min(100, Math.max(12, Math.round((offlineIds.size / decks.length) * 100))) : 12;

  return (
    <div className="space-y-6 text-start">
      {/* Hero Welcome Banner with Violet Wave Mesh */}
      <section className="sp-card relative overflow-hidden rounded-[24px] p-6 sm:p-8">
        {/* Soft Lavender & Violet Wave Mesh Artwork (Seamless Full-Width Fade) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-l from-[#7C3AED]/15 via-[#A78BFA]/10 to-transparent dark:from-[#7C3AED]/25 dark:via-[#6D28D9]/10 dark:to-transparent"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 900 220"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-75"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M900 0H560c-60 48-95 102-38 164 26 28 18 44 4 56h374V0z"
            fill="url(#heroWaveGrad)"
            opacity="0.38"
          />
          <path
            d="M900 18c-125 22-215 74-182 138 22 42 74 52 182 64V18z"
            fill="url(#heroWaveGrad2)"
            opacity="0.52"
          />
          <path
            d="M860 0c-95 44-126 112-84 184M820 0c-104 52-134 120-94 196M776 0c-108 58-138 128-98 208"
            stroke="#8B5CF6"
            strokeWidth="1.2"
            strokeDasharray="3 5"
            opacity="0.5"
          />
          <defs>
            <linearGradient id="heroWaveGrad" x1="900" y1="0" x2="480" y2="220" gradientUnits="userSpaceOnUse">
              <stop stopColor="#6D28D9" />
              <stop offset="1" stopColor="#A78BFA" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="heroWaveGrad2" x1="900" y1="20" x2="620" y2="210" gradientUnits="userSpaceOnUse">
              <stop stopColor="#4C1D95" />
              <stop offset="1" stopColor="#7C3AED" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>

        <div className="relative z-10 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div className="max-w-xl">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              {t('dashboard.title', { name: user?.displayName ?? 'StudyPulse' })}
            </h1>
            <p className="mt-2 text-sm text-text-secondary sm:text-base">{t('dashboard.subtitle')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/study"
              className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('study.startDailySession')}</span>
            </Link>
            <Link
              to="/decks"
              className="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-elevated/90 px-5 py-2.5 text-sm font-bold text-text-primary shadow-sm transition-colors hover:border-brand-primary/40 hover:bg-brand-soft hover:text-brand-primary"
            >
              <Layers className="h-4 w-4" />
              <span>{t('dashboard.openLibrary')}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* 4 Elevated KPI Cards with 3D Glossy Squircle Icons & Progress Tracks */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="violet" size="lg">
            <Clock className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-semibold text-text-secondary">
                {t('dashboard.dueToday')}
              </p>
              <span className="sp-mono-numeric inline-block text-xl font-extrabold text-text-primary">
                {totalDue}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-brand-primary/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#8B5CF6] to-[#6D28D9]"
                style={{ width: `${dueProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="amber" size="lg">
            <Flame className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-semibold text-text-secondary">
                {t('dashboard.streak')}
              </p>
              <span className="sp-mono-numeric inline-block text-xl font-extrabold text-text-primary">
                {user?.streakDays ?? 0}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-amber-500/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#FBBF24] to-[#EA580C]"
                style={{ width: `${streakProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="indigo" size="lg">
            <Layers className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-semibold text-text-secondary">
                {t('dashboard.totalDecks')}
              </p>
              <span className="sp-mono-numeric inline-block text-xl font-extrabold text-text-primary">
                {decks.length}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-indigo-500/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#6366F1] to-[#3730A3]"
                style={{ width: `${decksProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="sp-card flex items-center gap-3.5 rounded-[20px] p-4">
          <GlossySquircle tone="emerald" size="lg">
            <CloudDownload className="h-5 w-5" />
          </GlossySquircle>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-semibold text-text-secondary">
                {t('dashboard.offlineReady')}
              </p>
              <span className="sp-mono-numeric inline-block text-xl font-extrabold text-text-primary">
                {offlineIds.size}
              </span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-emerald-500/15">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#34D399] to-[#059669]"
                style={{ width: `${offlineProgress}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Recent Decks — Illustrated 2-Column Horizontal Cards */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-extrabold text-text-primary">
            {t('dashboard.recentDecks')}
          </h2>
          <Link to="/decks" className="text-xs font-bold text-brand-primary hover:underline">
            {t('dashboard.openLibrary')}
          </Link>
        </div>

        {decksQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="sp-card animate-pulse space-y-2 rounded-[22px] p-5">
                <div className="h-4 w-1/2 rounded bg-surface-subtle" />
                <div className="h-3 w-3/4 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {decks.slice(0, 4).map((deck) => {
              const lowerTopic = deck.topic.toLowerCase();
              const isSystem = lowerTopic.includes('system') || lowerTopic.includes('backend');
              const isAr = i18n.language === 'ar';

              return (
                <Link
                  key={deck.id}
                  to="/decks/$deckId"
                  params={{ deckId: deck.id }}
                  className="sp-card group flex items-center justify-between gap-4 overflow-hidden rounded-[22px] p-5 transition-all hover:-translate-y-0.5 hover:border-brand-primary/40"
                >
                  <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                    <div>
                      <h3 className="font-heading text-base font-extrabold leading-snug text-text-primary transition-colors group-hover:text-brand-primary sm:text-lg">
                        {deck.title}
                      </h3>
                      {deck.description && (
                        <p className="mt-1 line-clamp-1 text-xs text-text-secondary">
                          {deck.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm ${
                          isSystem
                            ? 'bg-gradient-to-r from-[#1E3A8A] to-[#312E81]'
                            : 'bg-gradient-to-r from-[#7C3AED] to-[#6366F1]'
                        }`}
                      >
                        {deck.topic}
                      </span>
                      <span className="sp-mono-numeric text-xs font-semibold text-text-secondary">
                        {t('decks.cardsCount', { count: deck.cardCount })}
                      </span>
                      {offlineIds.has(deck.id) && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-status-success/12 px-2 py-0.5 text-[11px] font-semibold text-status-success">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{isAr ? 'أوفلاين' : 'Offline'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-2xl bg-brand-soft/50 p-1.5 transition-transform duration-200 group-hover:scale-105">
                    <DeckTopicIllustration topic={deck.topic} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
