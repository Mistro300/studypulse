import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { MAX_SIMULATED_BOTS } from '@studypulse/shared';
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  Play,
  Users,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/auth-store';
import { useLiveRoomStore } from '@/features/rooms/live-room-store';

export function LiveRoomLobbyPage() {
  const { code = '' } = useParams({ strict: false }) as { code?: string };
  const { t } = useTranslation();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const roomState = useLiveRoomStore((s) => s.roomState);
  const connectionStatus = useLiveRoomStore((s) => s.connectionStatus);
  const error = useLiveRoomStore((s) => s.error);
  const joinRoom = useLiveRoomStore((s) => s.joinRoom);
  const updateBotsCount = useLiveRoomStore((s) => s.updateBotsCount);
  const toggleReady = useLiveRoomStore((s) => s.toggleReady);
  const startQuiz = useLiveRoomStore((s) => s.startQuiz);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (code) {
      void joinRoom(code);
    }
  }, [code, joinRoom]);

  // Automatically enter Distraction-Free Active Live Quiz screen when host starts the quiz
  useEffect(() => {
    if (roomState && roomState.code === code.toUpperCase() && roomState.phase !== 'LOBBY') {
      void navigate({
        to: '/rooms/$code/live',
        params: { code: roomState.code },
        replace: true,
      });
    }
  }, [roomState, code, navigate]);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(code.toUpperCase());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Ignore clipboard errors in restricted contexts
    }
  };

  if (error) {
    return (
      <div role="alert" className="sp-card mx-auto max-w-md p-6 text-start">
        <h2 className="font-heading text-lg font-bold text-status-danger">{error.code}</h2>
        <p className="mt-1 text-sm text-text-secondary">{error.message}</p>
        <Link
          to="/rooms"
          className="sp-tactile-control mt-4 inline-flex items-center gap-2 bg-surface-subtle px-4 py-2 text-xs font-semibold"
        >
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
          <span>{t('rooms.backToHub')}</span>
        </Link>
      </div>
    );
  }

  if (!roomState || roomState.code !== code.toUpperCase()) {
    return (
      <div className="sp-card mx-auto max-w-2xl animate-pulse space-y-4 p-6">
        <div className="h-6 w-1/3 rounded bg-surface-subtle" />
        <div className="h-12 w-full rounded bg-surface-subtle" />
        <div className="h-32 w-full rounded bg-surface-subtle" />
      </div>
    );
  }

  const isHost = user?.id === roomState.hostUserId;
  const currentBotsCount = roomState.participants.filter((p) => p.isBot).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 text-start">
      <Link
        to="/rooms"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-brand-primary"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        <span>{t('rooms.backToHub')}</span>
      </Link>

      {/* Lobby Header + Invite Code */}
      <section className="sp-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-semibold text-brand-primary">
              {t('rooms.lobbyTitle')} · {connectionStatus}
            </span>
            <h1 className="mt-2 font-heading text-2xl font-bold text-text-primary">
              {roomState.title}
            </h1>
            <p className="mt-1 text-xs text-text-secondary">
              {roomState.deckTitle} · {roomState.totalQuestions} Q · {roomState.questionDurationSec}s
            </p>
          </div>

          <div className="rounded-control border border-brand-primary/30 bg-brand-soft p-3 text-center">
            <p className="text-[11px] font-medium text-text-secondary">{t('rooms.roomCodeLabel')}</p>
            <p className="sp-mono-numeric mt-0.5 text-2xl font-extrabold tracking-widest text-brand-primary">
              {roomState.code}
            </p>
            <button
              type="button"
              onClick={() => void handleCopyCode()}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-primary hover:underline"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span>{copied ? t('rooms.copied') : t('rooms.copyCode')}</span>
            </button>
          </div>
        </div>

        {/* Host Simulated Bots Control (Portfolio Solo Demo Mode) */}
        {isHost && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-control border border-border-default bg-surface-subtle p-3.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-text-primary">
              <Bot className="h-4 w-4 text-brand-primary" />
              <span>{t('rooms.botsLobbyControl')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {[0, 1, 2, MAX_SIMULATED_BOTS].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => updateBotsCount(n)}
                  className={`sp-mono-numeric h-8 w-8 rounded-control border text-xs font-bold transition-colors ${
                    currentBotsCount === n
                      ? 'border-brand-primary bg-brand-primary text-white'
                      : 'border-border-default bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Live Presence Participant List */}
      <section className="sp-card p-6">
        <div className="flex items-center justify-between">
          <h2 className="inline-flex items-center gap-2 font-heading text-base font-bold">
            <Users className="h-4 w-4 text-brand-primary" />
            <span>
              {t('rooms.participantsTitle', {
                count: roomState.participants.length,
                max: roomState.maxParticipants,
              })}
            </span>
          </h2>
        </div>

        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {roomState.participants.map((p) => (
            <li
              key={p.participantId}
              className="flex items-center justify-between rounded-control border border-border-default bg-surface-base px-3.5 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    p.isOnline ? 'bg-status-success' : 'bg-text-secondary/40'
                  }`}
                />
                <span className="text-sm font-semibold text-text-primary">{p.displayName}</span>
                {p.isHost && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-pulse-soft px-2 py-0.5 text-[10px] font-bold text-accent-pulse">
                    <Crown className="h-3 w-3" />
                    <span>{t('rooms.hostBadge')}</span>
                  </span>
                )}
                {p.isBot && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand-primary">
                    <Bot className="h-3 w-3" />
                    <span>{t('rooms.botBadge')}</span>
                  </span>
                )}
              </div>

              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${
                  p.isReady ? 'text-status-success' : 'text-text-secondary'
                }`}
              >
                {p.isReady && <CheckCircle2 className="h-3.5 w-3.5" />}
                <span>{p.isReady ? t('rooms.readyBadge') : t('rooms.notReadyBadge')}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-4">
          {!isHost ? (
            <>
              <p className="text-xs text-text-secondary">{t('rooms.waitingForHost')}</p>
              <button
                type="button"
                onClick={toggleReady}
                className="sp-tactile-control bg-surface-subtle px-4 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft hover:text-brand-primary"
              >
                {t('rooms.toggleReady')}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={startQuiz}
              className="sp-tactile-control inline-flex w-full items-center justify-center gap-2 border-brand-hover bg-brand-primary px-6 py-3 text-sm font-bold text-white hover:bg-brand-hover sm:w-auto"
            >
              <Play className="h-4 w-4" />
              <span>{t('rooms.startQuiz')}</span>
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
