import { useMemo, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MAX_SIMULATED_BOTS, MIN_CARDS_FOR_LIVE_ROOM } from '@studypulse/shared';
import { Bot, KeyRound, Plus, Radio, Trophy, Users, WifiOff, X } from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import { useDecksQuery } from '@/features/decks/api/decks-api';
import {
  useCreateLiveRoomMutation,
  usePublicRoomsQuery,
} from '@/features/rooms/api/rooms-api';
import { useNetworkStatus } from '@/shared/hooks/useNetworkStatus';
import { GlossySquircle } from '@/shared/ui/StudyPulseArtwork';

const PLACEHOLDER_DIGITS = ['6', '5', '1', '2', '3', '6'];
const DEMO_AVATARS = [
  { initials: 'MB', bg: 'from-[#7C3AED] to-[#4F46E5]' },
  { initials: 'SA', bg: 'from-[#0EA5E9] to-[#2563EB]' },
  { initials: 'NK', bg: 'from-[#F59E0B] to-[#EA580C]' },
  { initials: 'OM', bg: 'from-[#10B981] to-[#059669]' },
];

export function LiveRoomsHubPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language === 'ar';
  const navigate = useNavigate();
  const { isOnline } = useNetworkStatus();

  const roomsQuery = usePublicRoomsQuery(isOnline);
  const decksQuery = useDecksQuery({});
  const createRoomMutation = useCreateLiveRoomMutation();

  const [codeChars, setCodeChars] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
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
  const joinedCode = codeChars.join('').trim().toUpperCase();

  const handleOtpChange = (index: number, raw: string) => {
    const cleaned = raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (!cleaned) {
      setCodeChars((prev) => prev.map((c, idx) => (idx === index ? '' : c)));
      return;
    }

    const chars = cleaned.slice(0, 6 - index).split('');
    setCodeChars((prev) => {
      const next = [...prev];
      chars.forEach((ch, offset) => {
        next[index + offset] = ch;
      });
      return next;
    });

    const nextIdx = Math.min(5, index + chars.length);
    otpRefs.current[nextIdx]?.focus();
  };

  const handleOtpKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codeChars[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < text.length; i++) next[i] = text[i] ?? '';
    setCodeChars(next);
    otpRefs.current[Math.min(5, text.length)]?.focus();
  };

  const handleJoinByCode = async (e: FormEvent) => {
    e.preventDefault();
    if (joinedCode.length < 6) return;
    await navigate({ to: '/rooms/$code', params: { code: joinedCode } });
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
        title:
          roomTitle.trim() ||
          eligibleDecks.find((d) => d.id === activeDeckId)?.title ||
          'Live Quiz',
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

  const handleQuickChallengeLaunch = async () => {
    if (!isOnline || !activeDeckId) {
      setCreateOpen(true);
      return;
    }
    try {
      const res = await createRoomMutation.mutateAsync({
        deckId: activeDeckId,
        title: isAr ? 'تحدي React & TypeScript' : 'React & TypeScript Challenge',
        isPublic: true,
        maxParticipants: 20,
        questionDurationSec: 15,
        questionCount: 4,
        simulatedBotsCount: 2,
      });
      await navigate({ to: '/rooms/$code', params: { code: res.room.code } });
    } catch {
      setCreateOpen(true);
    }
  };

  const rooms = roomsQuery.data ?? [];

  return (
    <div className="space-y-6 text-start">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-extrabold text-text-primary sm:text-3xl">
            {t('rooms.title')}
          </h1>
          <p className="mt-1 text-sm text-text-secondary">{t('rooms.subtitle')}</p>
        </div>

        <button
          type="button"
          disabled={!isOnline}
          onClick={() => {
            setFormError(null);
            setCreateOpen(true);
          }}
          className="sp-btn-violet inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold disabled:opacity-50"
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

      {/* Elevated Join-by-Code Card with 6 Individual OTP Boxes */}
      <form
        onSubmit={handleJoinByCode}
        className="sp-card flex flex-wrap items-center justify-between gap-5 rounded-[24px] p-5 sm:p-6"
      >
        <div className="flex items-center gap-3.5">
          <GlossySquircle tone="soft" size="lg">
            <KeyRound className="h-5 w-5 text-brand-primary" />
          </GlossySquircle>
          <div>
            <h2 className="font-heading text-base font-extrabold text-text-primary">
              {t('rooms.joinByCode')}
            </h2>
            <p className="text-xs text-text-secondary">
              {isAr ? 'أدخل رمز الغرفة المكوّن من 6 خانات' : 'Enter the 6-character room code'}
            </p>
          </div>
        </div>

        <div dir="ltr" className="flex items-center gap-2 sm:gap-2.5">
          {codeChars.map((ch, idx) => (
            <input
              key={idx}
              ref={(el) => {
                otpRefs.current[idx] = el;
              }}
              type="text"
              inputMode="text"
              maxLength={6}
              disabled={!isOnline}
              value={ch}
              placeholder={PLACEHOLDER_DIGITS[idx]}
              aria-label={`Code digit ${idx + 1}`}
              onChange={(e) => handleOtpChange(idx, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(idx, e)}
              onPaste={handleOtpPaste}
              className="sp-mono-numeric h-12 w-10 rounded-2xl border border-border-default bg-surface-elevated text-center text-base font-extrabold uppercase text-text-primary shadow-sm outline-none transition-all placeholder:text-text-secondary/35 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25 disabled:opacity-50 sm:h-14 sm:w-12 sm:text-lg"
            />
          ))}
        </div>

        <button
          type="submit"
          disabled={!isOnline || joinedCode.length < 6}
          className="sp-btn-violet rounded-xl px-7 py-3 text-sm font-bold disabled:opacity-50"
        >
          {t('rooms.joinAction')}
        </button>
      </form>

      {/* Public Active Rooms — 2-Column Bento Grid */}
      <section className="space-y-4">
        <h2 className="font-heading text-lg font-extrabold text-text-primary">
          {t('rooms.publicRoomsTitle')}
        </h2>

        {roomsQuery.isLoading ? (
          <div className="grid gap-5 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="sp-card animate-pulse space-y-3 rounded-[24px] p-6">
                <div className="h-5 w-1/2 rounded bg-surface-subtle" />
                <div className="h-4 w-3/4 rounded bg-surface-subtle" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {/* Featured Create-Your-Own Room Card */}
            <div className="sp-card flex flex-col items-center justify-center rounded-[24px] p-7 text-center">
              <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand-primary shadow-[0_14px_30px_-8px_rgba(124,58,237,0.45)]">
                <Radio className="h-8 w-8" />
              </div>
              <h3 className="font-heading text-lg font-extrabold text-text-primary">
                {isAr ? 'أنشئ غرفتك الخاصة' : 'Create Your Own Room'}
              </h3>
              <p className="mt-1.5 max-w-xs text-xs text-text-secondary sm:text-sm">
                {isAr
                  ? 'تنافس بمؤقت زمني مع أصدقائك أو مع Bots ذكية'
                  : 'Compete on a live timer with friends or simulated Bots'}
              </p>
              <button
                type="button"
                disabled={!isOnline}
                onClick={() => {
                  setFormError(null);
                  setCreateOpen(true);
                }}
                className="mt-5 inline-flex items-center gap-1.5 rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-xs font-bold text-text-primary shadow-sm transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>{isAr ? 'إنشاء غرفة' : t('rooms.createRoom')}</span>
              </button>
            </div>

            {/* Active Public Rooms OR Featured 1-Click Instant Challenge */}
            {rooms.length === 0 ? (
              <article className="sp-card flex flex-col justify-between rounded-[24px] p-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <GlossySquircle tone="amber" size="lg">
                      <Trophy className="h-6 w-6" />
                    </GlossySquircle>
                    <div>
                      <h3 className="font-heading text-lg font-extrabold leading-snug text-text-primary">
                        {isAr ? 'تحدي React & TypeScript' : 'React & TypeScript Challenge'}
                      </h3>
                      <p className="mt-1 text-xs text-text-secondary">
                        {isAr ? 'جلسة فورية مع Bots للمنافسة الآن' : 'Instant live match with Bots'}
                      </p>
                    </div>
                  </div>

                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-success/15 px-3 py-1 text-xs font-bold text-status-success shadow-[0_0_16px_rgba(16,185,129,0.28)]">
                    <span className="h-2 w-2 rounded-full bg-status-success" />
                    <span>{isAr ? 'مباشر' : 'Live'}</span>
                  </span>
                </div>

                <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-default/80 pt-4">
                  <div className="flex items-center gap-2.5">
                    <div className="flex -space-x-2 rtl:space-x-reverse">
                      {DEMO_AVATARS.map((av) => (
                        <span
                          key={av.initials}
                          className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-extrabold text-white ring-2 ring-surface-elevated ${av.bg}`}
                        >
                          {av.initials}
                        </span>
                      ))}
                    </div>
                    <span className="text-xs font-semibold text-text-secondary">
                      {isAr ? '2 Bots جاهزون' : '2 Bots Ready'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!isOnline || createRoomMutation.isPending}
                    onClick={() => void handleQuickChallengeLaunch()}
                    className="rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-xs font-bold text-text-primary shadow-sm transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
                  >
                    {createRoomMutation.isPending
                      ? t('common.loading')
                      : isAr
                        ? 'دخول الغرفة'
                        : 'Enter Room'}
                  </button>
                </div>
              </article>
            ) : (
              rooms.map((room) => (
                <article
                  key={room.code}
                  className="sp-card flex flex-col justify-between rounded-[24px] p-6 transition-all hover:-translate-y-0.5 hover:border-brand-primary/35"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3.5">
                      <GlossySquircle tone="amber" size="lg">
                        <Trophy className="h-6 w-6" />
                      </GlossySquircle>
                      <div>
                        <h3 className="font-heading text-lg font-extrabold leading-snug text-text-primary">
                          {room.title}
                        </h3>
                        <p className="mt-1 text-xs text-text-secondary">
                          {room.deckTitle} ·{' '}
                          <span className="sp-mono-numeric font-bold text-brand-primary">
                            {room.code}
                          </span>
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-status-success/15 px-3 py-1 text-xs font-bold text-status-success shadow-[0_0_16px_rgba(16,185,129,0.28)]">
                      <span className="h-2 w-2 rounded-full bg-status-success" />
                      <span>{isAr ? 'مباشر' : 'Live'}</span>
                    </span>
                  </div>

                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-border-default/80 pt-4">
                    <div className="flex items-center gap-3 text-xs font-semibold text-text-secondary">
                      <div className="flex -space-x-2 rtl:space-x-reverse">
                        {DEMO_AVATARS.slice(0, Math.max(2, Math.min(4, room.participantCount))).map(
                          (av) => (
                            <span
                              key={av.initials}
                              className={`inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-extrabold text-white ring-2 ring-surface-elevated ${av.bg}`}
                            >
                              {av.initials}
                            </span>
                          ),
                        )}
                      </div>
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
                      onClick={() =>
                        void navigate({ to: '/rooms/$code', params: { code: room.code } })
                      }
                      className="rounded-xl border border-border-default bg-surface-elevated px-5 py-2.5 text-xs font-bold text-text-primary shadow-sm transition-colors hover:border-brand-primary hover:bg-brand-soft hover:text-brand-primary disabled:opacity-50"
                    >
                      {isAr ? 'دخول الغرفة' : t('rooms.joinAction')}
                    </button>
                  </div>
                </article>
              ))
            )}
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
          <div className="sp-card w-full max-w-md rounded-[24px] p-6 text-start">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-extrabold">{t('rooms.createRoom')}</h2>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-surface-subtle"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {eligibleDecks.length === 0 ? (
              <p className="mt-4 text-sm text-status-warning">{t('rooms.noEligibleDecks')}</p>
            ) : (
              <form onSubmit={handleCreateRoom} className="mt-4 space-y-3.5">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">
                    {t('rooms.deckLabel')}
                  </label>
                  <select
                    value={activeDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                  >
                    {eligibleDecks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title} ({d.cardCount})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-text-secondary">
                    {t('rooms.roomTitleLabel')}
                  </label>
                  <input
                    type="text"
                    required
                    value={roomTitle}
                    onChange={(e) => setRoomTitle(e.target.value)}
                    placeholder="Frontend Sprint #1"
                    className="w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-secondary">
                      {t('rooms.durationLabel')}
                    </label>
                    <input
                      type="number"
                      min={8}
                      max={60}
                      value={durationSec}
                      onChange={(e) => setDurationSec(Number(e.target.value))}
                      className="sp-mono-numeric w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-text-secondary">
                      {t('rooms.questionsCountLabel')}
                    </label>
                    <input
                      type="number"
                      min={4}
                      max={20}
                      value={questionCount}
                      onChange={(e) => setQuestionCount(Number(e.target.value))}
                      className="sp-mono-numeric w-full rounded-xl border border-border-default bg-surface-base px-3.5 py-2.5 text-sm text-text-primary outline-none focus:border-brand-primary"
                    />
                  </div>
                </div>

                {/* Simulated Bots Selector (0-3) */}
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-text-secondary">
                    <Bot className="h-3.5 w-3.5 text-brand-primary" />
                    <span>{t('rooms.botsLabel')}</span>
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, MAX_SIMULATED_BOTS].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setBotsCount(n)}
                        className={`sp-mono-numeric rounded-xl border py-2 text-xs font-extrabold transition-colors ${
                          botsCount === n
                            ? 'border-brand-primary bg-brand-soft text-brand-primary'
                            : 'border-border-default bg-surface-base text-text-secondary hover:text-text-primary'
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
                    className="rounded-xl border border-border-default px-4 py-2 text-xs font-bold text-text-secondary hover:bg-surface-subtle"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={createRoomMutation.isPending}
                    className="sp-btn-violet rounded-xl px-5 py-2 text-xs font-bold disabled:opacity-50"
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
