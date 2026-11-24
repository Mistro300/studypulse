import { useMemo, useState, type FormEvent } from 'react';
import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { CreateDeckInputSchema, type Locale } from '@studypulse/shared';
import {
  CheckCircle2,
  CloudDownload,
  CloudOff,
  FolderOpen,
  Plus,
  Search,
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

export function DecksLibraryPage() {
  const { t, i18n } = useTranslation();
  const { isOnline } = useNetworkStatus();
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

  return (
    <div className="space-y-6 text-start">
      {/* Page Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{t('decks.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('decks.subtitle')}</p>
        </div>
        <button
          type="button"
          disabled={!isOnline}
          onClick={() => setCreateOpen(true)}
          className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>{t('decks.createDeck')}</span>
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className="sp-card grid gap-3 p-3.5 sm:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('decks.searchPlaceholder')}
            className="w-full rounded-control border border-border-default bg-surface-base py-2 pe-3 ps-9 text-sm text-text-primary"
          />
        </div>

        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
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
          className="rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
        >
          <option value="">{t('decks.allLanguages')}</option>
          <option value="ar">العربية (AR)</option>
          <option value="en">English (EN)</option>
        </select>
      </div>

      {/* Loading Skeletons */}
      {decksQuery.isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="sp-card animate-pulse space-y-3 p-5">
              <div className="h-5 w-2/3 rounded bg-surface-subtle" />
              <div className="h-3 w-full rounded bg-surface-subtle" />
              <div className="h-3 w-4/5 rounded bg-surface-subtle" />
              <div className="flex justify-between pt-3">
                <div className="h-7 w-20 rounded-full bg-surface-subtle" />
                <div className="h-7 w-24 rounded-control bg-surface-subtle" />
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
        <div className="sp-card flex flex-col items-center justify-center p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-primary">
            <FolderOpen className="h-6 w-6" />
          </span>
          <h2 className="mt-4 font-heading text-lg font-bold">{t('decks.emptyTitle')}</h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">{t('decks.emptySubtitle')}</p>
          <button
            type="button"
            disabled={!isOnline}
            onClick={() => setCreateOpen(true)}
            className="sp-tactile-control mt-5 inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{t('decks.createDeck')}</span>
          </button>
        </div>
      )}

      {/* Decks Grid */}
      {!decksQuery.isLoading && decks.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {decks.map((deck) => {
            const isPinnedOffline = offlineIds.has(deck.id);
            const isToggling =
              toggleOfflineMutation.isPending &&
              toggleOfflineMutation.variables?.deckId === deck.id;

            return (
              <article key={deck.id} className="sp-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                      {deck.topic}
                    </span>
                    <span className="sp-mono-numeric rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-[11px] uppercase text-text-secondary">
                      {deck.language}
                    </span>
                  </div>

                  <Link
                    to="/decks/$deckId"
                    params={{ deckId: deck.id }}
                    className="mt-3 block font-heading text-base font-bold text-text-primary hover:text-brand-primary"
                  >
                    {deck.title}
                  </Link>
                  {deck.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-text-secondary">
                      {deck.description}
                    </p>
                  )}
                </div>

                <div className="mt-4 space-y-3 border-t border-border-default pt-3">
                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span className="sp-mono-numeric inline-block font-semibold text-text-primary">
                      {t('decks.cardsCount', { count: deck.cardCount })}
                    </span>
                    {isPinnedOffline && (
                      <span className="inline-flex items-center gap-1 font-medium text-status-success">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{t('decks.offlineAvailable')}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={isToggling || (!isPinnedOffline && !isOnline)}
                      onClick={() =>
                        toggleOfflineMutation.mutate({
                          deckId: deck.id,
                          currentlyOffline: isPinnedOffline,
                        })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-control border px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                        isPinnedOffline
                          ? 'border-status-success/40 bg-status-success/10 text-status-success'
                          : 'border-border-default bg-surface-base text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {isPinnedOffline ? (
                        <CloudOff className="h-3.5 w-3.5" />
                      ) : (
                        <CloudDownload className="h-3.5 w-3.5" />
                      )}
                      <span>
                        {isPinnedOffline ? t('decks.removeOffline') : t('decks.makeOffline')}
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <Link
                        to="/decks/$deckId"
                        params={{ deckId: deck.id }}
                        className="rounded-control bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary"
                      >
                        {t('common.edit')}
                      </Link>
                      <button
                        type="button"
                        disabled={!isOnline || deleteDeckMutation.isPending}
                        onClick={() => deleteDeckMutation.mutate(deck.id)}
                        aria-label={t('common.delete')}
                        className="flex h-7 w-7 items-center justify-center rounded-control text-text-secondary hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Create Deck Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-md p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{t('decks.createDeck')}</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDeck} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('decks.deckTitleLabel')}
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('decks.deckDescLabel')}
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.deckTopicLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.deckLangLabel')}
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as Locale)}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
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
                  className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createDeckMutation.isPending}
                  className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
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
