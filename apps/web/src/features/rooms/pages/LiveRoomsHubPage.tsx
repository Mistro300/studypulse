import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MAX_SIMULATED_BOTS, MIN_CARDS_FOR_LIVE_ROOM } from '@studypulse/shared';
import { Bot, Plus, Radio, Users, WifiOff, X } from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import { useDecksQuery } from '@/features/decks/api/decks-api';
import {
  useCreateLiveRoomMutation,
  usePublicRoomsQuery,
} from '@/features/rooms/api/rooms-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';

export function LiveRoomsHubPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();

  const roomsQuery = usePublicRoomsQuery(isOnline);
  const decksQuery = useDecksQuery({});
  const createRoomMutation = useCreateLiveRoomMutation();

  const [joinCode, setJoinCode] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const eligibleDecks = useMemo(
    () => (decksQuery.data ?? []).filter((d) => d.cardCount >= MIN_CARDS_FOR_LIVE_ROOM),
    [decksQuery.data],
  );

  // Create form state
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [roomTitle, setRoomTitle] = useState('');
  const [durationSec, setDurationSec] = useState(15);
  const [questionCount, setQuestionCount] = useState(4);
  const [botsCount, setBotsCount] = useState(2);
  const [isPublic, setIsPublic] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const activeDeckId = selectedDeckId || eligibleDecks[0]?.id || '';

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    const cleaned = joinCode.trim().toUpperCase();
    if (cleaned.length < 6) return;
    await navigate({ to: '/rooms/$code', params: { code: cleaned } });
  };

  const handleCreateRoom = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!activeDeckId) {
      setFormError(t('rooms.noEligibleDecks'));
      return;
    }

    try {
      const res = await createRoomMutation.mutateAsync({
        deckId: activeDeckId,
        title: roomTitle.trim() || eligibleDecks.find((d) => d.id === activeDeckId)?.title || 'Live Quiz',
        isPublic,
        maxParticipants: 20,
        questionDurationSec: durationSec,
        questionCount,
        simulatedBotsCount: botsCount,
      });
      setCreateOpen(false);
      await navigate({ to: '/rooms/$code', params: { code: res.room.code } });
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'));
    }
  };

  const rooms = roomsQuery.data ?? [];

  return (
    <div className="space-y-6 text-start">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-text-primary">{t('rooms.title')}</h1>
          <p className="mt-1 text-sm text-text-secondary">{t('rooms.subtitle')}</p>
        </div>

        <button
          type="button"
          disabled={!isOnline}
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
          className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          <span>{t('rooms.createRoom')}</span>
        </button>
      </div>

      {/* Offline Guard Notice */}
      {!isOnline && (
        <div
          role="status"
          className="sp-card flex items-center gap-3 border-status-warning/40 bg-status-warning/10 p-4 text-sm text-status-warning"
        >
          <WifiOff className="h-5 w-5 shrink-0" />
          <span>{t('rooms.offlineNotice')}</span>
        </div>
      )}

      {/* Join by 6-char Code */}
      <form
        onSubmit={handleJoinByCode}
        className="sp-card flex flex-wrap items-center gap-3 p-4"
      >
        <label className="text-xs font-semibold text-text-secondary">
          {t('rooms.joinByCode')}:
        </label>
        <input
          type="text"
          dir="ltr"
          maxLength={6}
          disabled={!isOnline}
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          placeholder={t('rooms.codePlaceholder')}
          className="sp-mono-numeric w-44 rounded-control border border-border-default bg-surface-base px-3 py-2 text-center text-sm font-bold uppercase tracking-widest text-text-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isOnline || joinCode.trim().length < 6}
          className="sp-tactile-control bg-surface-subtle px-4 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
        >
          {t('rooms.joinAction')}
        </button>
      </form>

      {/* Public Active Rooms */}
      <section className="space-y-3">
        <h2 className="font-heading text-base font-bold text-text-primary">
          {t('rooms.publicRoomsTitle')}
        </h2>

        {roomsQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="sp-card animate-pulse space-y-3 p-5">
                <div className="h-4 w-2/3 rounded bg-surface-subtle" />
                <div className="h-3 w-1/2 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="sp-card flex flex-col items-center p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-card bg-brand-soft text-brand-primary">
              <Radio className="h-6 w-6" />
            </span>
            <h3 className="mt-4 font-heading text-lg font-bold">{t('rooms.noRoomsTitle')}</h3>
            <p className="mt-1 max-w-md text-sm text-text-secondary">{t('rooms.noRoomsSubtitle')}</p>
            <button
              type="button"
              disabled={!isOnline}
              onClick={() => setCreateOpen(true)}
              className="sp-tactile-control mt-5 inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>{t('rooms.createRoom')}</span>
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((room) => (
              <article key={room.code} className="sp-card flex flex-col justify-between p-5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-semibold text-brand-primary">
                      {room.topic}
                    </span>
                    <span className="sp-mono-numeric rounded-full border border-border-default bg-surface-subtle px-2.5 py-0.5 text-xs font-bold text-text-primary">
                      {room.code}
                    </span>
                  </div>
                  <h3 className="mt-3 font-heading text-base font-bold text-text-primary">
                    {room.title}
                  </h3>
                  <p className="mt-1 text-xs text-text-secondary">{room.deckTitle}</p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border-default pt-3">
                  <div className="flex items-center gap-3 text-xs text-text-secondary">
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      <span className="sp-mono-numeric">
                        {room.participantCount}/{room.maxParticipants}
                      </span>
                    </span>
                    {room.botsCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-brand-primary">
                        <Bot className="h-3.5 w-3.5" />
                        <span className="sp-mono-numeric">{room.botsCount}</span>
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!isOnline}
                    onClick={() => void navigate({ to: '/rooms/$code', params: { code: room.code } })}
                    className="sp-tactile-control bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
                  >
                    {t('rooms.joinAction')}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Create Live Room Modal */}
      {createOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        >
          <div className="sp-card w-full max-w-md p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">{t('rooms.createRoom')}</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {eligibleDecks.length === 0 ? (
              <p className="mt-4 text-sm text-status-warning">{t('rooms.noEligibleDecks')}</p>
            ) : (
              <form onSubmit={handleCreateRoom} className="mt-4 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('rooms.deckLabel')}
                  </label>
                  <select
                    value={activeDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  >
                    {eligibleDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.cardCount})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-text-secondary">
                    {t('rooms.roomTitleLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    placeholder="Frontend Sprint #1"
                    className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      {t('rooms.durationLabel')}
                    </label>
                    <input
                      type="number"
                      min={8}
                      max={60}
                      value={durationSec}
                      onChange={(e) => setDurationSec(Number(e.target.value))}
                      className="sp-mono-numeric w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-text-secondary">
                      {t('rooms.questionsCountLabel')}
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="sp-mono-numeric w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
                    />
                  </div>
                </div>

                {/* Simulated Bots Selector (0-3) */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-text-secondary">
                    <Bot className="h-3.5 w-3.5 text-brand-primary" />
                    <span>{t('rooms.botsLabel')}</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, MAX_SIMULATED_BOTS].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBotsCount(n)}
                        className={`sp-tactile-control sp-mono-numeric py-2 text-xs font-bold ${
                          botsCount === n
                            ? 'border-brand-primary bg-brand-soft text-brand-primary'
                            : 'bg-surface-base text-text-secondary'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-text-secondary">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="h-4 w-4 rounded accent-brand-primary"
                  />
                  <span>{t('rooms.publicToggle')}</span>
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
                    className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createRoomMutation.isPending}
                    className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
                  >
                    {createRoomMutation.isPending ? t('common.loading') : t('rooms.createRoom')}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
