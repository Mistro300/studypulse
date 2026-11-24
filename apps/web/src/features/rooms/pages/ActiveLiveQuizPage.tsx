import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Flame,
  Loader2,
  Lock,
  PlusCircle,
  Trophy,
  Wifi,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { useAddMistakesToDeckMutation } from '@/features/rooms/api/rooms-api';
import { LiveCountdownTimer } from '@/features/rooms/components/LiveCountdownTimer';
import { useLiveRoomStore } from '@/features/rooms/live-room-store';

export function ActiveLiveQuizPage() {
  const { code = '' } = useParams({ strict: false }) as { code?: string };
  const { t } = useTranslation();

  const connectionStatus = useLiveRoomStore((s) => s.connectionStatus);
  const roomState = useLiveRoomStore((s) => s.roomState);
  const activeQuestion = useLiveRoomStore((s) => s.activeQuestion);
  const lastReveal = useLiveRoomStore((s) => s.lastReveal);
  const mySelectedChoiceId = useLiveRoomStore((s) => s.mySelectedChoiceId);
  const leaderboard = useLiveRoomStore((s) => s.leaderboard);
  const results = useLiveRoomStore((s) => s.results);
  const joinRoom = useLiveRoomStore((s) => s.joinRoom);
  const leaveRoom = useLiveRoomStore((s) => s.leaveRoom);
  const submitAnswer = useLiveRoomStore((s) => s.submitAnswer);
  const reconnectNow = useLiveRoomStore((s) => s.reconnectNow);

  const addMistakesMutation = useAddMistakesToDeckMutation(code.toUpperCase());
  const [createdMistakesDeck, setCreatedMistakesDeck] = useState<{
    deckId: string;
    cardCount: number;
  } | null>(null);

  useEffect(() => {
    if (code && (!roomState || roomState.code !== code.toUpperCase())) {
      void joinRoom(code);
    }
  }, [code, roomState, joinRoom]);

  const isReconnecting =
    connectionStatus === 'reconnecting' || connectionStatus === 'disconnected';

  const answeredCount = roomState
    ? roomState.participants.filter((p) => p.answeredCurrentQuestion).length
    : 0;
  const totalOnline = roomState
    ? roomState.participants.filter((p) => p.isOnline).length
    : 0;

  const missedCardIds = results
    ? Array.from(new Set(results.myReviewItems.filter((item) => !item.isCorrect).map((i) => i.cardId)))
    : [];

  const handleSaveMistakes = async () => {
    if (missedCardIds.length === 0) return;
    const res = await addMistakesMutation.mutateAsync({ cardIds: missedCardIds });
    setCreatedMistakesDeck(res);
  };

  return (
    <div className="relative flex min-h-dvh flex-col bg-surface-base text-text-primary">
      {/* Slim Distraction-Free Focus Top Bar */}
      <header className="sticky top-0 z-30 border-b border-border-default bg-surface-elevated">
        <div className="mx-auto flex h-12 max-w-4xl items-center justify-between gap-3 px-4">
          <Link
            to="/rooms"
            onClick={() => leaveRoom()}
            className="inline-flex items-center gap-1.5 rounded-control px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-surface-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">{t('rooms.backToHub')}</span>
          </Link>

          <div className="flex items-center gap-2">
            <span className="truncate text-xs font-bold">{roomState?.title ?? code}</span>
            {roomState && roomState.currentQuestionIndex >= 0 && roomState.phase !== 'FINISHED' && (
              <span className="sp-mono-numeric rounded-full bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                {roomState.currentQuestionIndex + 1} / {roomState.totalQuestions}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {roomState &&
              (roomState.phase === 'QUESTION_ACTIVE' ||
                roomState.phase === 'QUESTION_REVEAL' ||
                roomState.phase === 'LEADERBOARD') && (
                <LiveCountdownTimer endsAtMs={roomState.phaseEndsAtMs} />
              )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                connectionStatus === 'connected'
                  ? 'bg-surface-subtle text-status-success'
                  : 'bg-status-warning/15 text-status-warning'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <Wifi className="h-3.5 w-3.5" />
              ) : (
                <WifiOff className="h-3.5 w-3.5" />
              )}
            </span>
          </div>
        </div>
      </header>

      {/* 45s Host Disconnect Grace Banner */}
      {roomState?.hostDisconnectedAtMs && roomState.phase !== 'FINISHED' && (
        <div
          role="status"
          className="flex items-center justify-center gap-2 border-b border-status-warning/30 bg-status-warning/10 px-4 py-2 text-xs font-semibold text-status-warning"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{t('rooms.hostGraceWarning')}</span>
        </div>
      )}

      {/* Reconnecting Overlay — freezes answer buttons to prevent duplicate submissions */}
      {isReconnecting && roomState?.phase !== 'FINISHED' && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
        >
          <div className="sp-card max-w-sm p-6 text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent-pulse" />
            <h2 className="mt-3 font-heading text-lg font-bold">{t('rooms.reconnectingTitle')}</h2>
            <p className="mt-1.5 text-xs text-text-secondary">{t('rooms.reconnectingSubtitle')}</p>
            <button
              type="button"
              onClick={reconnectNow}
              className="sp-tactile-control mt-5 border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover"
            >
              {t('rooms.reconnectButton')}
            </button>
          </div>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-6">
        {/* PHASE: COUNTDOWN (3-2-1) */}
        {roomState?.phase === 'COUNTDOWN' && (
          <div className="sp-card mx-auto flex w-full max-w-md flex-col items-center p-12 text-center">
            <p className="text-sm font-semibold text-text-secondary">{t('rooms.countdownTitle')}</p>
            <div className="mt-6">
              <LiveCountdownTimer endsAtMs={roomState.phaseEndsAtMs} large />
            </div>
          </div>
        )}

        {/* PHASE: QUESTION_ACTIVE & QUESTION_REVEAL */}
        {(roomState?.phase === 'QUESTION_ACTIVE' || roomState?.phase === 'QUESTION_REVEAL') &&
          activeQuestion && (
            <div className="space-y-5 text-start">
              <div className="sp-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
                  <span className="rounded-full bg-brand-soft px-2.5 py-0.5 font-semibold text-brand-primary">
                    {t('rooms.questionProgress', {
                      current: activeQuestion.questionIndex + 1,
                      total: activeQuestion.totalQuestions,
                    })}
                  </span>
                  <span className="sp-mono-numeric font-semibold">
                    {t('rooms.answeredCount', { answered: answeredCount, total: totalOnline })}
                  </span>
                </div>

                <h1 className="mt-4 font-heading text-xl font-bold leading-relaxed text-text-primary sm:text-2xl">
                  {activeQuestion.prompt}
                </h1>
              </div>

              {/* 4 Tactile A/B/C/D Choice Buttons */}
              <div className="grid gap-3 sm:grid-cols-2">
                {activeQuestion.choices.map((choice) => {
                  const isSelected = mySelectedChoiceId === choice.id;
                  const isReveal = roomState.phase === 'QUESTION_REVEAL' && lastReveal;
                  const isCorrect = isReveal && lastReveal.correctChoiceId === choice.id;
                  const isWrongSelected = isReveal && isSelected && !isCorrect;
                  const locked =
                    Boolean(mySelectedChoiceId) ||
                    roomState.phase !== 'QUESTION_ACTIVE' ||
                    isReconnecting;

                  const distCount = isReveal ? lastReveal.distribution[choice.key] : 0;
                  const distPct =
                    isReveal && lastReveal.totalAnswered > 0
                      ? Math.round((distCount / lastReveal.totalAnswered) * 100)
                      : 0;

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      disabled={locked}
                      onClick={() => submitAnswer(choice.id)}
                      className={`sp-tactile-control relative overflow-hidden p-4 text-start transition-all ${
                        isCorrect
                          ? 'border-status-success bg-status-success/15 text-text-primary'
                          : isWrongSelected
                            ? 'border-status-danger bg-status-danger/15 text-text-primary'
                            : isSelected
                              ? 'border-brand-primary bg-brand-soft text-text-primary'
                              : 'bg-surface-elevated text-text-primary hover:border-brand-primary/60 hover:bg-surface-subtle disabled:opacity-80'
                      }`}
                    >
                      <div className="relative z-10 flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={`sp-mono-numeric flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-extrabold ${
                              isCorrect
                                ? 'bg-status-success text-white'
                                : isWrongSelected
                                  ? 'bg-status-danger text-white'
                                  : isSelected
                                    ? 'bg-brand-primary text-white'
                                    : 'bg-surface-subtle text-text-primary'
                            }`}
                          >
                            {choice.key}
                          </span>
                          <span className="pt-0.5 text-sm font-semibold">{choice.text}</span>
                        </div>

                        {isReveal && (
                          <span className="sp-mono-numeric shrink-0 text-xs font-bold text-text-secondary">
                            {distPct}%
                          </span>
                        )}
                      </div>

                      {/* Reveal Distribution Progress Bar */}
                      {isReveal && (
                        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                          <div
                            className={`h-full rounded-full transition-[width] duration-300 ${
                              isCorrect ? 'bg-status-success' : 'bg-brand-primary/60'
                            }`}
                            style={{ width: `${distPct}%` }}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Answer Locked Status */}
              {roomState.phase === 'QUESTION_ACTIVE' && mySelectedChoiceId && (
                <div className="flex items-center justify-center gap-2 rounded-control border border-brand-primary/30 bg-brand-soft px-4 py-2.5 text-xs font-semibold text-brand-primary">
                  <Lock className="h-3.5 w-3.5" />
                  <span>{t('rooms.answerLocked')}</span>
                </div>
              )}

              {/* Reveal Feedback Banner */}
              {roomState.phase === 'QUESTION_REVEAL' && lastReveal && (
                <div
                  className={`sp-card p-4 ${
                    mySelectedChoiceId === lastReveal.correctChoiceId
                      ? 'border-status-success/50 bg-status-success/10'
                      : 'border-status-danger/40 bg-status-danger/10'
                  }`}
                >
                  <p className="flex items-center gap-2 text-sm font-bold">
                    {mySelectedChoiceId === lastReveal.correctChoiceId ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-status-success" />
                        <span className="text-status-success">{t('rooms.correctFeedback')}</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-status-danger" />
                        <span className="text-status-danger">{t('rooms.wrongFeedback')}</span>
                      </>
                    )}
                  </p>
                  {lastReveal.explanation && (
                    <p className="mt-1.5 text-xs text-text-secondary">{lastReveal.explanation}</p>
                  )}
                </div>
              )}
            </div>
          )}

        {/* PHASE: LEADERBOARD (Between Questions) */}
        {roomState?.phase === 'LEADERBOARD' && (
          <div className="sp-card mx-auto w-full max-w-xl p-6 text-start">
            <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
              <Trophy className="h-5 w-5 text-accent-pulse" />
              <span>{t('rooms.miniLeaderboardTitle')}</span>
            </h2>
            <div className="mt-4 space-y-2.5">
              {leaderboard.map((entry) => (
                <div
                  key={entry.participantId}
                  className="flex items-center justify-between rounded-control border border-border-default bg-surface-base px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="sp-mono-numeric flex h-7 w-7 items-center justify-center rounded-full bg-brand-soft text-xs font-extrabold text-brand-primary">
                      #{entry.rank}
                    </span>
                    <span className="text-sm font-bold">{entry.displayName}</span>
                    {entry.isBot && <Bot className="h-3.5 w-3.5 text-text-secondary" />}
                  </div>
                  <div className="flex items-center gap-3">
                    {entry.streak > 1 && (
                      <span className="inline-flex items-center gap-0.5 text-xs font-bold text-accent-pulse">
                        <Flame className="h-3.5 w-3.5" />
                        <span className="sp-mono-numeric">{entry.streak}</span>
                      </span>
                    )}
                    <span className="sp-mono-numeric text-sm font-extrabold text-brand-primary">
                      {entry.score} {t('rooms.pointsUnit')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE: FINISHED (Top 3 Podium + Answer Breakdown + Add Mistakes to Review Deck) */}
        {roomState?.phase === 'FINISHED' && results && (
          <div className="space-y-6 text-start">
            <section className="sp-card p-6 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-accent-pulse-soft text-accent-pulse">
                <Trophy className="h-6 w-6" />
              </span>
              <h1 className="mt-3 font-heading text-2xl font-bold">{t('rooms.resultsTitle')}</h1>
              <p className="mt-1 text-xs text-text-secondary">{results.title}</p>

              {/* Top 3 Podium */}
              <div className="mt-6 grid items-end gap-3 sm:grid-cols-3">
                {results.podium.map((entry) => (
                  <div
                    key={entry.participantId}
                    className={`rounded-card border p-4 ${
                      entry.rank === 1
                        ? 'border-accent-pulse bg-accent-pulse-soft sm:order-2 sm:py-6'
                        : entry.rank === 2
                          ? 'border-brand-primary/40 bg-brand-soft sm:order-1'
                          : 'border-border-default bg-surface-subtle sm:order-3'
                    }`}
                  >
                    <span className="sp-mono-numeric inline-block text-lg font-extrabold text-brand-primary">
                      #{entry.rank}
                    </span>
                    <p className="mt-1 truncate text-sm font-bold text-text-primary">
                      {entry.displayName}
                    </p>
                    <p className="sp-mono-numeric mt-1 text-base font-extrabold text-accent-pulse">
                      {entry.score} {t('rooms.pointsUnit')}
                    </p>
                  </div>
                ))}
              </div>

              {/* Add Mistakes to Review Deck CTA */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                {missedCardIds.length > 0 && !createdMistakesDeck && (
                  <button
                    type="button"
                    disabled={addMistakesMutation.isPending}
                    onClick={() => void handleSaveMistakes()}
                    className="sp-tactile-control inline-flex items-center gap-2 border-brand-hover bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-hover"
                  >
                    <PlusCircle className="h-4 w-4" />
                    <span>{t('rooms.addMistakesButton', { count: missedCardIds.length })}</span>
                  </button>
                )}

                {createdMistakesDeck && (
                  <Link
                    to="/decks/$deckId"
                    params={{ deckId: createdMistakesDeck.deckId }}
                    className="sp-tactile-control inline-flex items-center gap-2 border-status-success bg-status-success/15 px-5 py-2.5 text-sm font-semibold text-status-success"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{t('rooms.openMistakesDeck')}</span>
                  </Link>
                )}

                {missedCardIds.length === 0 && (
                  <span className="rounded-full bg-status-success/15 px-4 py-1.5 text-xs font-semibold text-status-success">
                    {t('rooms.allCorrectTitle')}
                  </span>
                )}

                <Link
                  to="/rooms"
                  onClick={() => leaveRoom()}
                  className="sp-tactile-control bg-surface-base px-5 py-2.5 text-sm font-semibold text-text-primary hover:bg-surface-subtle"
                >
                  {t('rooms.backToHub')}
                </Link>
              </div>
            </section>

            {/* Personal Question-by-Question Review */}
            <section className="sp-card p-6">
              <h2 className="font-heading text-base font-bold">{t('rooms.reviewAnswersTitle')}</h2>
              <div className="mt-4 space-y-3">
                {results.myReviewItems.map((item) => (
                  <div
                    key={item.questionIndex}
                    className="rounded-control border border-border-default bg-surface-base p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-text-primary">
                        #{item.questionIndex + 1} · {item.front}
                      </p>
                      <span
                        className={`sp-mono-numeric shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                          item.isCorrect
                            ? 'bg-status-success/15 text-status-success'
                            : 'bg-status-danger/15 text-status-danger'
                        }`}
                      >
                        {item.isCorrect ? `+${item.pointsAwarded}` : '0'}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-status-success">
                      ✓ {item.correctChoiceText}
                    </p>
                    {!item.isCorrect && item.selectedChoiceText && (
                      <p className="mt-0.5 text-xs text-status-danger">
                        ✕ {item.selectedChoiceText}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
