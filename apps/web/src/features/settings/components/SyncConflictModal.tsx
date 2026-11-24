import { useTranslation } from 'react-i18next';
import { AlertTriangle, Check, Server, Smartphone, X } from 'lucide-react';
import type { SyncOutboxRecord } from '@/core/offline/db';

interface SyncConflictModalProps {
  conflict: SyncOutboxRecord | null;
  onResolve: (idempotencyKey: string, strategy: 'KEEP_LOCAL' | 'USE_SERVER') => Promise<void>;
  onClose: () => void;
}

export function SyncConflictModal({ conflict, onResolve, onClose }: SyncConflictModalProps) {
  const { t } = useTranslation();
  if (!conflict) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-conflict-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="sp-card w-full max-w-lg p-6 text-start">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-status-warning/15 text-status-warning">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 id="sync-conflict-title" className="font-heading text-lg font-bold">
                {t('settings.conflictTitle')}
              </h2>
              <p className="text-xs text-text-secondary">{t('settings.conflictSubtitle')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-control border border-border-default bg-surface-subtle p-3.5 text-xs">
          <p className="font-semibold text-text-primary">
            {conflict.kind} · <span className="sp-mono-numeric">{conflict.entityId.slice(0, 8)}</span>
          </p>
          <p className="mt-1 text-text-secondary">
            {conflict.lastError ?? t('settings.conflictDefaultDetail')}
          </p>
          <p className="sp-mono-numeric mt-1.5 text-[11px] text-text-secondary">
            {conflict.clientTimestamp}
          </p>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void onResolve(conflict.idempotencyKey, 'KEEP_LOCAL')}
            className="sp-tactile-control flex items-center justify-center gap-2 border-brand-hover bg-brand-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-brand-hover"
          >
            <Smartphone className="h-4 w-4" />
            <span>{t('settings.keepLocal')}</span>
          </button>
          <button
            type="button"
            onClick={() => void onResolve(conflict.idempotencyKey, 'USE_SERVER')}
            className="sp-tactile-control flex items-center justify-center gap-2 bg-surface-base px-4 py-2.5 text-xs font-semibold text-text-primary hover:bg-surface-subtle"
          >
            <Server className="h-4 w-4" />
            <span>{t('settings.useServer')}</span>
          </button>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-text-secondary">
          <Check className="h-3.5 w-3.5 text-status-success" />
          <span>{t('settings.conflictSafeNote')}</span>
        </p>
      </div>
    </div>
  );
}
