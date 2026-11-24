import { useState, type FormEvent } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  CreateCardInputSchema,
  MIN_CARDS_FOR_LIVE_ROOM,
  type CardDto,
  type CardType,
  type Locale,
} from '@studypulse/shared';
import {
  ArrowLeft,
  CheckCircle2,
  CloudDownload,
  CloudOff,
  Download,
  Edit3,
  FileText,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import {
  useCreateCardMutation,
  useDeckDetailQuery,
  useDeleteCardMutation,
  useGenerateFromNotesMutation,
  useImportQuestionsMutation,
  useOfflineDeckIdsQuery,
  useQuestionSourcesQuery,
  useToggleOfflineDeckMutation,
  useUpdateCardMutation,
} from '@/features/decks/api/decks-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

const DEFAULT_CHOICES = [
  { id: 'c1', text: '' },
  { id: 'c2', text: '' },
  { id: 'c3', text: '' },
  { id: 'c4', text: '' },
];

export function DeckDetailPage() {
  const { deckId = '' } = useParams({ strict: false }) as { deckId?: string };
  const { t, i18n } = useTranslation();
  const { isOnline } = useNetworkStatus();

  const detailQuery = useDeckDetailQuery(deckId);
  const offlineIdsQuery = useOfflineDeckIdsQuery();
  const toggleOfflineMutation = useToggleOfflineDeckMutation();
  const createCardMutation = useCreateCardMutation(deckId);
  const updateCardMutation = useUpdateCardMutation(deckId);
  const deleteCardMutation = useDeleteCardMutation(deckId);
  const importMutation = useImportQuestionsMutation(deckId);
  const generateNotesMutation = useGenerateFromNotesMutation(deckId);

  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardDto | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [notesModalOpen, setNotesModalOpen] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);

  const sourcesQuery = useQuestionSourcesQuery(importModalOpen);

  // Card form state
  const [cardType, setCardType] = useState<CardType>('FLASHCARD');
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [explanation, setExplanation] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [choices, setChoices] = useState(DEFAULT_CHOICES);
  const [correctChoiceId, setCorrectChoiceId] = useState('c1');
  const [cardFormError, setCardFormError] = useState<string | null>(null);

  // Import modal state
  const [importSource, setImportSource] = useState<'BUILTIN_TECH_PACK' | 'OPEN_TRIVIA'>(
    'BUILTIN_TECH_PACK',
  );
  const [packId, setPackId] = useState('react-ts-ar');
  const [categoryId, setCategoryId] = useState(18);
  const [amount, setAmount] = useState(5);
  const [importError, setImportError] = useState<string | null>(null);

  // Notes generator state
  const [notesText, setNotesText] = useState('');
  const [notesCardType, setNotesCardType] = useState<CardType>('FLASHCARD');
  const [notesCount, setNotesCount] = useState(5);
  const [notesError, setNotesError] = useState<string | null>(null);

  const openCreateCard = () => {
    setEditingCard(null);
    setCardType('FLASHCARD');
    setFront('');
    setBack('');
    setExplanation('');
    setTagsRaw('');
    setChoices(DEFAULT_CHOICES.map((c) => ({ ...c })));
    setCorrectChoiceId('c1');
    setCardFormError(null);
    setCardModalOpen(true);
  };

  const openEditCard = (card: CardDto) => {
    setEditingCard(card);
    setCardType(card.type);
    setFront(card.front);
    setBack(card.back);
    setExplanation(card.explanation ?? '');
    setTagsRaw(card.tags.join(', '));
    setChoices(
      card.choices && card.choices.length >= 2
        ? card.choices.map((c) => ({ ...c }))
        : DEFAULT_CHOICES.map((c) => ({ ...c })),
    );
    setCorrectChoiceId(card.correctChoiceId ?? 'c1');
    setCardFormError(null);
    setCardModalOpen(true);
  };

  const handleSaveCard = async (e: FormEvent) => {
    e.preventDefault();
    setCardFormError(null);

    const tags = tagsRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const cleanedChoices = choices
      .map((c) => ({ id: c.id, text: c.text.trim() }))
      .filter((c) => c.text.length > 0);

    const resolvedBack =
      cardType === 'MCQ' && !back.trim()
        ? (cleanedChoices.find((c) => c.id === correctChoiceId)?.text ?? back)
        : back;

    const payload = {
      type: cardType,
      front,
      back: resolvedBack,
      explanation: explanation.trim() || null,
      choices: cardType === 'MCQ' ? cleanedChoices : null,
      correctChoiceId: cardType === 'MCQ' ? correctChoiceId : null,
      tags,
    };

    const parsed = CreateCardInputSchema.safeParse(payload);
    if (!parsed.success) {
      setCardFormError(parsed.error.issues[0]?.message ?? 'Invalid card fields');
      return;
    }

    try {
      if (editingCard) {
        await updateCardMutation.mutateAsync({ cardId: editingCard.id, input: parsed.data });
      } else {
        await createCardMutation.mutateAsync(parsed.data);
      }
      setCardModalOpen(false);
    } catch (err) {
      setCardFormError(
        err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'),
      );
    }
  };

  const handleImportSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setImportError(null);
    try {
      const res = await importMutation.mutateAsync({
        source: importSource,
        ...(importSource === 'BUILTIN_TECH_PACK' ? { packId } : { categoryId }),
        amount,
      });
      setImportModalOpen(false);
      setBannerMessage(
        t('decks.importedSuccess', { count: res.importedCount, source: res.source }),
      );
    } catch (err) {
      setImportError(
        err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'),
      );
    }
  };

  const handleGenerateNotes = async (e: FormEvent) => {
    e.preventDefault();
    setNotesError(null);
    if (notesText.trim().length < 30) {
      setNotesError('Please paste at least 30 characters of study notes.');
      return;
    }
    try {
      const res = await generateNotesMutation.mutateAsync({
        notes: notesText,
        maxCards: notesCount,
        cardType: notesCardType,
        language: (i18n.language === 'en' ? 'en' : 'ar') as Locale,
      });
      setNotesModalOpen(false);
      setNotesText('');
      setBannerMessage(
        t('decks.importedSuccess', { count: res.importedCount, source: res.source }),
      );
    } catch (err) {
      setNotesError(
        err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'),
      );
    }
  };

  if (detailQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="sp-card animate-pulse space-y-3 p-6">
          <div className="h-6 w-1/2 rounded bg-surface-subtle" />
          <div className="h-4 w-2/3 rounded bg-surface-subtle" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="sp-card animate-pulse space-y-2 p-5">
            <div className="h-4 w-3/4 rounded bg-surface-subtle" />
            <div className="h-3 w-1/2 rounded bg-surface-subtle" />
          </div>
        ))}
      </div>
    );
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div role="alert" className="sp-card p-6 text-start">
        <h2 className="font-heading text-lg font-bold text-status-danger">
          {t('errors.unexpectedTitle')}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          {detailQuery.error instanceof ApiClientError
            ? detailQuery.error.normalized.message
            : t('errors.unexpectedDescription')}
        </p>
        <Link
          to="/decks"
          className="sp-tactile-control mt-4 inline-flex items-center gap-2 bg-surface-subtle px-4 py-2 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          <span>{t('decks.backToLibrary')}</span>
        </Link>
      </div>
    );
  }

  const { deck, cards } = detailQuery.data;
  const isPinnedOffline = offlineIdsQuery.data?.has(deck.id) ?? false;
  const cardsNeededForLive = Math.max(0, MIN_CARDS_FOR_LIVE_ROOM - cards.length);

  return (
    <div className="space-y-6 text-start">
      <Link
        to="/decks"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        <span>{t('decks.backToLibrary')}</span>
      </Link>

      {/* Deck Hero Header */}
      <section className="sp-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
                {deck.topic}
              </span>
              <span className="sp-mono-numeric rounded-full border border-border-default bg-surface-subtle px-2 py-0.5 text-xs uppercase text-text-secondary">
                {deck.language}
              </span>
              {cardsNeededForLive === 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-status-success/10 px-2.5 py-0.5 text-xs font-medium text-status-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>{t('decks.mcqReadyBadge')}</span>
                </span>
              ) : (
                <span className="rounded-full bg-surface-subtle px-2.5 py-0.5 text-xs text-text-secondary">
                  {t('decks.mcqNeedMore', { count: cardsNeededForLive })}
                </span>
              )}
            </div>
            <h1 className="font-heading text-2xl font-bold text-text-primary">{deck.title}</h1>
            {deck.description && (
              <p className="max-w-2xl text-sm text-text-secondary">{deck.description}</p>
            )}
          </div>

          <button
            type="button"
            disabled={toggleOfflineMutation.isPending || (!isPinnedOffline && !isOnline)}
            onClick={() =>
              toggleOfflineMutation.mutate({
                deckId: deck.id,
                currentlyOffline: isPinnedOffline,
              })
            }
            className={`sp-tactile-control inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${
              isPinnedOffline
                ? 'border-status-success/50 bg-status-success/10 text-status-success'
                : 'bg-surface-base text-text-primary hover:bg-surface-subtle'
            }`}
          >
            {isPinnedOffline ? (
              <CloudOff className="h-4 w-4" />
            ) : (
              <CloudDownload className="h-4 w-4" />
            )}
            <span>{isPinnedOffline ? t('decks.removeOffline') : t('decks.makeOffline')}</span>
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="mt-5 flex flex-wrap gap-2.5 border-t border-border-default pt-4">
          {cards.length > 0 && (
            <Link
              to="/study"
              search={{ deckId: deck.id }}
              className="sp-tactile-control inline-flex items-center gap-1.5 border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              <Sparkles className="h-4 w-4" />
              <span>{t('decks.studyThisDeck')}</span>
            </Link>
          )}

          <button
            type="button"
            disabled={!isOnline}
            onClick={openCreateCard}
            className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-base px-4 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>{t('decks.addCard')}</span>
          </button>

          <button
            type="button"
            disabled={!isOnline}
            onClick={() => {
              setImportError(null);
              setImportModalOpen(true);
            }}
            className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-base px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{t('decks.importQuestions')}</span>
          </button>

          <button
            type="button"
            disabled={!isOnline}
            onClick={() => {
              setNotesError(null);
              setNotesModalOpen(true);
            }}
            className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-base px-3.5 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4 text-accent-pulse" />
            <span>{t('decks.generateFromNotes')}</span>
          </button>
        </div>
      </section>

      {bannerMessage && (
        <div
          role="status"
          className="flex items-center justify-between rounded-control border border-status-success/40 bg-status-success/10 px-4 py-2.5 text-xs font-semibold text-status-success"
        >
          <span>{bannerMessage}</span>
          <button type="button" onClick={() => setBannerMessage(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Cards Empty State */}
      {cards.length === 0 ? (
        <div className="sp-card flex flex-col items-center justify-center p-10 text-center">
          <FileText className="h-10 w-10 text-text-secondary" />
          <h2 className="mt-3 font-heading text-lg font-bold">{t('decks.noCardsTitle')}</h2>
          <p className="mt-1 max-w-md text-sm text-text-secondary">{t('decks.noCardsSubtitle')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cards.map((card, idx) => (
            <article key={card.id} className="sp-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="sp-mono-numeric rounded bg-surface-subtle px-2 py-0.5 text-xs font-semibold text-text-secondary">
                    #{idx + 1}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                      card.type === 'MCQ'
                        ? 'bg-status-info/15 text-status-info'
                        : 'bg-brand-soft text-brand-primary'
                    }`}
                  >
                    {card.type}
                  </span>
                  {card.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-border-default px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={!isOnline}
                    onClick={() => openEditCard(card)}
                    aria-label={t('common.edit')}
                    className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle hover:text-text-primary disabled:opacity-40"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={!isOnline || deleteCardMutation.isPending}
                    onClick={() => deleteCardMutation.mutate(card.id)}
                    aria-label={t('common.delete')}
                    className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <h3 className="mt-3 text-sm font-semibold text-text-primary">{card.front}</h3>
              <p className="mt-1.5 text-sm text-text-secondary">{card.back}</p>

              {card.type === 'MCQ' && card.choices && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {card.choices.map((choice, cIdx) => {
                    const isCorrect = choice.id === card.correctChoiceId;
                    const letter = String.fromCharCode(65 + cIdx);
                    return (
                      <div
                        key={choice.id}
                        className={`flex items-center gap-2 rounded-control border px-3 py-2 text-xs ${
                          isCorrect
                            ? 'border-status-success/50 bg-status-success/10 font-semibold text-status-success'
                            : 'border-border-default bg-surface-base text-text-secondary'
                        }`}
                      >
                        <span className="sp-mono-numeric font-bold">{letter}</span>
                        <span>{choice.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {/* Create / Edit Card Modal (FLASHCARD + MCQ) */}
      {cardModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card my-auto w-full max-w-lg p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">
                {editingCard ? t('common.edit') : t('decks.addCard')}
              </h2>
              <button
                type="button"
                onClick={() => setCardModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCard} className="mt-4 space-y-3.5">
              {/* Card Type Selector */}
              <div className="grid grid-cols-2 gap-2">
                {(['FLASHCARD', 'MCQ'] as const).map((typeOpt) => (
                  <button
                    key={typeOpt}
                    type="button"
                    onClick={() => setCardType(typeOpt)}
                    className={`sp-tactile-control py-2 text-xs font-semibold ${
                      cardType === typeOpt
                        ? 'border-brand-primary bg-brand-soft text-brand-primary'
                        : 'bg-surface-base text-text-secondary'
                    }`}
                  >
                    {typeOpt === 'FLASHCARD'
                      ? t('decks.cardTypeFlashcard')
                      : t('decks.cardTypeMcq')}
                  </button>
                ))}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('decks.frontLabel')}
                </label>
                <textarea
                  rows={2}
                  required
                  value={front}
                  onChange={(e) => setFront(e.target.value)}
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </div>

              {cardType === 'MCQ' && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-text-secondary">
                    {t('decks.choicesLabel')}
                  </label>
                  {choices.map((choice, idx) => (
                    <div key={choice.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correctChoice"
                        checked={correctChoiceId === choice.id}
                        onChange={() => setCorrectChoiceId(choice.id)}
                        className="h-4 w-4 accent-status-success"
                      />
                      <span className="sp-mono-numeric w-5 text-xs font-bold text-text-secondary">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <input
                        type="text"
                        value={choice.text}
                        onChange={(e) =>
                          setChoices((prev) =>
                            prev.map((c) =>
                              c.id === choice.id ? { ...c, text: e.target.value } : c,
                            ),
                          )
                        }
                        placeholder={`Choice ${String.fromCharCode(65 + idx)}`}
                        className="flex-1 rounded-control border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('decks.backLabel')}
                </label>
                <textarea
                  rows={2}
                  required={cardType === 'FLASHCARD'}
                  value={back}
                  onChange={(e) => setBack(e.target.value)}
                  className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.explanationLabel')}
                  </label>
                  <input
                    type="text"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.tagsLabel')}
                  </label>
                  <input
                    type="text"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="React, Auth, PWA"
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  />
                </div>
              </div>

              {cardFormError && (
                <p role="alert" className="text-xs text-status-danger">
                  {cardFormError}
                </p>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCardModalOpen(false)}
                  className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={createCardMutation.isPending || updateCardMutation.isPending}
                  className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Questions Modal (Built-in Bilingual Packs + Open Trivia DB) */}
      {importModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-md p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{t('decks.importQuestions')}</h2>
              <button
                type="button"
                onClick={() => setImportModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleImportSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setImportSource('BUILTIN_TECH_PACK')}
                  className={`sp-tactile-control px-3 py-2.5 text-start text-xs font-semibold ${
                    importSource === 'BUILTIN_TECH_PACK'
                      ? 'border-brand-primary bg-brand-soft text-brand-primary'
                      : 'bg-surface-base text-text-secondary'
                  }`}
                >
                  {t('decks.importSourceBuiltin')}
                </button>
                <button
                  type="button"
                  onClick={() => setImportSource('OPEN_TRIVIA')}
                  className={`sp-tactile-control px-3 py-2.5 text-start text-xs font-semibold ${
                    importSource === 'OPEN_TRIVIA'
                      ? 'border-brand-primary bg-brand-soft text-brand-primary'
                      : 'bg-surface-base text-text-secondary'
                  }`}
                >
                  {t('decks.importSourceOpenTrivia')}
                </button>
              </div>

              {importSource === 'BUILTIN_TECH_PACK' ? (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.importPackLabel')}
                  </label>
                  <select
                    value={packId}
                    onChange={(e) => setPackId(e.target.value)}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  >
                    {(sourcesQuery.data?.builtinPacks ?? []).map((pack) => (
                      <option key={pack.id} value={pack.id}>
                        {pack.title} ({pack.cardCount})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('decks.importCategoryLabel')}
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(Number(e.target.value))}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  >
                    {(sourcesQuery.data?.openTriviaCategories ?? []).map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-text-secondary">
                  {t('decks.importAmountLabel')}
                </label>
                <input
                  type="number"
                  min={1}
                  max={15}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="sp-mono-numeric w-28 rounded-control border border-border-default bg-surface-base px-3 py-1.5 text-sm text-text-primary"
                />
              </div>

              {importError && (
                <p role="alert" className="text-xs text-status-danger">
                  {importError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={importMutation.isPending}
                  className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  {importMutation.isPending ? t('common.loading') : t('decks.importSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate from Notes Modal */}
      {notesModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-lg p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{t('decks.generateFromNotes')}</h2>
              <button
                type="button"
                onClick={() => setNotesModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{t('decks.notesHint')}</p>

            <form onSubmit={handleGenerateNotes} className="mt-4 space-y-3.5">
              <textarea
                rows={6}
                required
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                placeholder={t('decks.notesPlaceholder')}
                className="w-full rounded-control border border-border-default bg-surface-base p-3 text-sm text-text-primary"
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  value={notesCardType}
                  onChange={(e) => setNotesCardType(e.target.value as CardType)}
                  className="rounded-control border border-border-default bg-surface-base px-3 py-2 text-xs font-semibold text-text-primary"
                >
                  <option value="FLASHCARD">{t('decks.cardTypeFlashcard')}</option>
                  <option value="MCQ">{t('decks.cardTypeMcq')}</option>
                </select>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={notesCount}
                  onChange={(e) => setNotesCount(Number(e.target.value))}
                  className="sp-mono-numeric rounded-control border border-border-default bg-surface-base px-3 py-2 text-xs text-text-primary"
                />
              </div>

              {notesError && (
                <p role="alert" className="text-xs text-status-danger">
                  {notesError}
                </p>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setNotesModalOpen(false)}
                  className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={generateNotesMutation.isPending}
                  className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
                >
                  {generateNotesMutation.isPending ? t('common.loading') : t('decks.generateSubmit')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
