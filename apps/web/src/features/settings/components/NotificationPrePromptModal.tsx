import { useTranslation } from 'react-i18next';
import { Bell, CalendarClock, Radio, X } from 'lucide-react';

interface NotificationPrePromptModalProps {
  open: boolean;
  submitting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Notification Permission Pre-Prompt Modal.
 * Explains exact user value before invoking the browser's native Notification.requestPermission() dialog.
 */
export function NotificationPrePromptModal({
  open,
  submitting,
  onConfirm,
  onClose,
}: NotificationPrePromptModalProps) {
  const { t } = useTranslation();

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-preprompt-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="sp-card w-full max-w-md p-6 text-start">
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand-primary">
            <Bell className="h-5 w-5" />
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="flex h-8 w-8 items-center justify-center rounded-control text-text-secondary hover:bg-surface-subtle"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="push-preprompt-title" className="mt-4 font-heading text-lg font-bold">
          {t('settings.pushPrePromptTitle')}
        </h2>
        <p className="mt-1.5 text-sm text-text-secondary">{t('settings.pushPrePromptSubtitle')}</p>

        <ul className="mt-4 space-y-2.5 text-xs text-text-primary">
          <li className="flex items-center gap-2.5 rounded-control bg-surface-subtle p-2.5">
            <CalendarClock className="h-4 w-4 shrink-0 text-brand-primary" />
            <span>{t('settings.pushBenefit1')}</span>
          </li>
          <li className="flex items-center gap-2.5 rounded-control bg-surface-subtle p-2.5">
            <Radio className="h-4 w-4 shrink-0 text-accent-pulse" />
            <span>{t('settings.pushBenefit2')}</span>
          </li>
        </ul>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border border-border-default px-4 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-subtle"
          >
            {t('settings.pushNotNow')}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="sp-tactile-control border-brand-hover bg-brand-primary px-4 py-2 text-xs font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
          >
            {submitting ? t('common.loading') : t('settings.pushAllowAction')}
          </button>
        </div>
      </div>
    </div>
  );
}
