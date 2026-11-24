import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { usePwaStore } from '@/core/pwa/pwa-manager';
import { useLiveRoomStore } from '@/features/rooms/live-room-store';

/**
 * Deferred Service Worker Update Toast.
 * Automatically stays suppressed during active Focus Study or Live Quiz sessions
 * so a timed assessment is never interrupted by a reload prompt.
 */
export function PwaUpdateToast() {
  const { t } = useTranslation();
  const updateAvailable = usePwaStore((s) => s.updateAvailable);
  const applyUpdate = usePwaStore((s) => s.applyUpdate);
  const dismissUpdate = usePwaStore((s) => s.dismissUpdate);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const livePhase = useLiveRoomStore((s) => s.roomState?.phase ?? null);

  const isInActiveAssessment =
    pathname === '/study' ||
    (pathname.endsWith('/live') && livePhase !== null && livePhase !== 'FINISHED');

  if (!updateAvailable || isInActiveAssessment) return null;

  return (
    <div
      role="status"
      className="sp-card fixed bottom-20 end-4 z-50 flex max-w-sm items-center gap-3 border-brand-primary/50 p-3.5 shadow-xl md:bottom-5"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-brand-soft text-brand-primary">
        <RefreshCw className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-start">
        <p className="text-xs font-bold text-text-primary">{t('pwa.updateAvailableTitle')}</p>
        <p className="text-[11px] text-text-secondary">{t('pwa.updateAvailableSubtitle')}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="sp-tactile-control border-brand-hover bg-brand-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-hover"
        >
          {t('pwa.updateNow')}
        </button>
        <button
          type="button"
          onClick={dismissUpdate}
          aria-label={t('common.close')}
          className="flex h-7 w-7 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
