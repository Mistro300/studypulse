import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CreateDeckInputSchema, type Locale } from '@studypulse/shared';
import {
  CheckCircle2,
  CloudDownload,
  FolderOpen,
  Layers,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import {
  useCreateDeckMutation,
  useDecksQuery,
  useDeleteDeckMutation,
  useOfflineDeckIdsQuery,
  useToggleOfflineDeckMutation,
} from '@/features/decks/api/decks-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { CircularProgressRing, GlossySquircle } from '@/shared/ui/StudyPulseArtwork';

export function DecksLibraryPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();
  const isAr = i18n.language === 'ar';

  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Create modal form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [topic, setTopic] = useState('Frontend');
  const [language, setLanguage] = useState<Locale>(i18n.language === 'en' ? 'en' : 'ar');
  const [isPublic, setIsPublic] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const decksQuery = useDecksQuery({
    search: search || undefined,
    topic: topicFilter || undefined,
    language: languageFilter || undefined,
  });
  const offlineIdsQuery = useOfflineDeckIdsQuery();
  const createDeckMutation = useCreateDeckMutation();
  const deleteDeckMutation = useDeleteDeckMutation();
  const toggleOfflineMutation = useToggleOfflineDeckMutation();

  const decks = useMemo(() => decksQuery.data ?? [], [decksQuery.data]);
  const offlineIds = offlineIdsQuery.data ?? new Set<string>();

  const availableTopics = useMemo(() => {
    const set = new Set<string>(['Frontend', 'Backend', 'System Design', 'PWA']);
    for (const d of decks) set.add(d.topic);
    return Array.from(set);
  }, [decks]);

  const handleCreateDeck = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const parsed = CreateDeckInputSchema.safeParse({
      title,
      description: description.trim() || null,
      topic,
      language,
      isPublic,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Invalid deck fields');
      return;
    }

    try {
      await createDeckMutation.mutateAsync(parsed.data);
      setTitle('');
      setDescription('');
      setCreateOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'));
    }
  };

  const handleOpenImportOrGenerate = () => {
    const firstDeck = decks[0];
    if (firstDeck) {
      void navigate({ to: '/decks/$deckId', params: { deckId: firstDeck.id } });
    } else if (isOnline) {
      setCreateOpen(true);
    }
  };

  return (
    <div className="space-y-6 text-start">
      {/* Page Header with Breadcrumb & Glossy Violet CTA */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-text-secondary">
            {isAr ? 'مكتبة الرزم › Decks Library' : 'StudyPulse › Decks Library'}
          </p>
          <h1 className="mt-1 font-heading text-2xl font-extrabold text-text-primary sm:text-3xl">
            {t('decks.title')}
          </h1>
        </div>
        <button
          type="button"
          disabled={!isOnline}
          onClick={() => setCreateOpen(true)}
          className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>{t('decks.createDeck')}</span>
        </button>
      </div>

      {/* Unified Floating White Filter Bar */}
      <div className="sp-card flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:px-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('decks.searchPlaceholder')}
            className="w-full rounded-xl border border-border-default bg-surface-subtle/60 py-2.5 pe-3.5 ps-10 text-sm text-text-primary outline-none transition-colors focus:border-brand-primary focus:bg-surface-elevated"
          />
        </div>

        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="rounded-full border border-border-default bg-surface-elevated px-4 py-2 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-brand-primary"
        >
          <option value="">{t('decks.allTopics')}</option>
          {availableTopics.map((tp) => (
            <option key={tp} value={tp}>
              {tp}
            </option>
          ))}
        </select>

        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="rounded-full border border-border-default bg-surface-elevated px-4 py-2 text-xs font-semibold text-text-primary outline-none transition-colors focus:border-brand-primary"
        >
          <option value="">{t('decks.allLanguages')}</option>
          <option value="ar">العربية (AR)</option>
          <option value="en">English (EN)</option>
        </select>
      </div>

      {/* Loading Skeletons */}
      {decksQuery.isLoading && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sp-card animate-pulse space-y-3 rounded-[22px] p-5">
              <div className="h-5 w-2/3 rounded bg-surface-subtle" />
              <div className="h-3 w-full rounded bg-surface-subtle" />
              <div className="h-3 w-4/5 rounded bg-surface-subtle" />
              <div className="flex justify-between pt-3">
                <div className="h-7 w-20 rounded-full bg-surface-subtle" />
                <div className="h-7 w-24 rounded-xl bg-surface-subtle" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {decksQuery.isError && (
        <div role="alert" className="sp-card border-status-danger/40 p-6">
          <p className="font-semibold text-status-danger">{t('errors.unexpectedTitle')}</p>
          <p className="mt-1 text-sm text-text-secondary">
            {decksQuery.error instanceof ApiClientError
              ? decksQuery.error.normalized.message
              : t('errors.unexpectedDescription')}
          </p>
          <button
            type="button"
            onClick={() => void decksQuery.refetch()}
            className="sp-tactile-control mt-4 bg-surface-subtle px-4 py-2 text-xs font-semibold"
          >
            {t('common.retry')}
          </button>
        </div>
      )}

      {/* Empty State */}
      {!decksQuery.isLoading && !decksQuery.isError && decks.length === 0 && (
        <div className="sp-card flex flex-col items-center justify-center rounded-[24px] p-10 text-center">
          <GlossySquircle tone="violet" size="lg">
            <FolderOpen className="h-6 w-6" />
          </GlossySquircle>
          <h2 className="mt-4 font-heading text-lg font-bold">{t('decks.emptyTitle')}</h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">{t('decks.emptySubtitle')}</p>
          <button
            type="button"
            disabled={!isOnline}
            onClick={() => setCreateOpen(true)}
            className="sp-btn-violet mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{t('decks.createDeck')}</span>
          </button>
        </div>
      )}

      {/* 3-Column Decks Grid + Dashed AI/Import Card */}
      {!decksQuery.isLoading && decks.length > 0 && (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const isPinnedOffline = offlineIds.has(deck.id);
            const isToggling =
              toggleOfflineMutation.isPending &&
              toggleOfflineMutation.variables?.deckId === deck.id;
            const lowerTopic = deck.topic.toLowerCase();
            const isSystem = lowerTopic.includes('system') || lowerTopic.includes('backend');
            const masteredRatio =
              deck.cardCount > 0
                ? Math.round(
                    ((deck.cardCount - Math.min(deck.dueCount, deck.cardCount)) / deck.cardCount) *
                      100,
                  )
                : 0;

            return (
              <article
                key={deck.id}
                className="sp-card group flex flex-col justify-between rounded-[22px] p-5 transition-all hover:-translate-y-0.5 hover:border-brand-primary/35"
              >
                <div>
                  {/* Top Row: Topic & Lang Pills + Circular Mastery Ring */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-sm ${
                          isSystem
                            ? 'bg-gradient-to-r from-[#1E3A8A] to-[#312E81]'
                            : 'bg-gradient-to-r from-[#7C3AED] to-[#6366F1]'
                        }`}
                      >
                        {deck.topic}
                      </span>
                      <span className="sp-mono-numeric rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-[11px] font-bold uppercase text-text-secondary">
                        {deck.language}
                      </span>
                    </div>

                    <CircularProgressRing
                      percentage={masteredRatio}
                      size={50}
                      color={isSystem ? '#312E81' : '#7C3AED'}
                    />
                  </div>

                  {/* Deck Title & Card Count */}
                  <Link
                    to="/decks/$deckId"
                    params={{ deckId: deck.id }}
                    className="mt-4 block font-heading text-lg font-extrabold leading-snug text-text-primary transition-colors group-hover:text-brand-primary"
                  >
                    {deck.title}
                  </Link>
                  {deck.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">
                      {deck.description}
                    </p>
                  )}

                  <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-text-secondary">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-soft text-brand-primary">
                      <Layers className="h-3.5 w-3.5" />
                    </span>
                    <span className="sp-mono-numeric text-text-primary">
                      {t('decks.cardsCount', { count: deck.cardCount })}
                    </span>
                  </div>
                </div>

                {/* Bottom Action Row: Soft Emerald Offline Pill + Edit & Delete Icon Buttons */}
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-border-default/80 pt-3.5">
                  <button
                    type="button"
                    disabled={isToggling || (!isPinnedOffline && !isOnline)}
                    onClick={() =>
                      toggleOfflineMutation.mutate({
                        deckId: deck.id,
                        currentlyOffline: isPinnedOffline,
                      })
                    }
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${
                      isPinnedOffline
                        ? 'border-status-success/30 bg-status-success/15 text-status-success'
                        : 'border-status-success/20 bg-status-success/8 text-status-success hover:bg-status-success/15'
                    }`}
                  >
                    {isPinnedOffline ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <CloudDownload className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isPinnedOffline
                        ? isAr
                          ? 'محفوظة أوفلاين'
                          : t('decks.offlineAvailable')
                        : isAr
                          ? 'حفظ أوفلاين'
                          : t('decks.makeOffline')}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <Link
                      to="/decks/$deckId"
                      params={{ deckId: deck.id }}
                      aria-label={t('common.edit')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-default bg-surface-subtle/70 text-text-secondary transition-colors hover:border-brand-primary/40 hover:bg-brand-soft hover:text-brand-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <button
                      type="button"
                      disabled={!isOnline || deleteDeckMutation.isPending}
                      onClick={() => deleteDeckMutation.mutate(deck.id)}
                      aria-label={t('common.delete')}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-default bg-surface-subtle/70 text-text-secondary transition-colors hover:border-status-danger/40 hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          {/* Featured Dashed Violet-Glowing AI / Import Card */}
          <button
            type="button"
            onClick={handleOpenImportOrGenerate}
            className="group relative flex min-h-[240px] flex-col items-center justify-center rounded-[22px] border-2 border-dashed border-brand-primary/45 bg-surface-elevated p-6 text-center shadow-[0_18px_42px_-16px_rgba(124,58,237,0.34)] transition-all hover:-translate-y-0.5 hover:border-brand-primary hover:shadow-[0_22px_50px_-14px_rgba(124,58,237,0.45)]"
          >
            <GlossySquircle tone="violet" size="lg">
              <Sparkles className="h-6 w-6" />
            </GlossySquircle>
            <h3 className="mt-4 font-heading text-base font-extrabold text-brand-primary">
              {isAr ? 'استيراد أو توليد بالذكاء الاصطناعي' : 'Import or Generate Cards'}
            </h3>
            <p className="mt-1.5 text-xs font-medium text-text-secondary">
              {isAr ? '+ توليد جديد من ملاحظاتك أو CSV/JSON' : '+ Generate from notes or CSV/JSON'}
            </p>
          </button>
        </div>
      )}

      {/* Create Deck Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-md rounded-[24px] p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-extrabold">{t('decks.createDeck')}</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeck} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">
                  {t('decks.deckTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-text-secondary">
                  {t('decks.deckDescLabel')}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">
                    {t('decks.deckTopicLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">
                    {t('decks.deckLangLabel')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Locale)}
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-4 w-4 rounded accent-brand-primary"
                />
                <span>{t('decks.deckPublicLabel')}</span>
              </label>

              {formError && (
                <p role="alert" className="text-xs text-status-danger">
                  {formError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-xl border border-border-default px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-subtle"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createDeckMutation.isPending}
                  className="sp-btn-violet rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-60"
                >
                  {createDeckMutation.isPending ? t('common.loading') : t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
