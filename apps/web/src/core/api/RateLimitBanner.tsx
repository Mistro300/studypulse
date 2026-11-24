import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Hourglass, X } from 'lucide-react';
import { useRateLimitStore } from '@/core/api/rate-limit-store';

export function RateLimitBanner() {
  const { t } = useTranslation();
  const retryUntilMs = useRateLimitStore((s) => s.retryUntilMs);
  const clearRateLimit = useRateLimitStore((s) => s.clearRateLimit);
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    if (!retryUntilMs) {
      setSecondsLeft(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((retryUntilMs - Date.now()) / 1000);
      if (remaining <= 0) {
        clearRateLimit();
        setSecondsLeft(0);
      } else {
        setSecondsLeft(remaining);
      }
    };

    tick();
    const id = window.setInterval(tick, 500);
    return () => window.clearInterval(id);
  }, [retryUntilMs, clearRateLimit]);

  if (!retryUntilMs || secondsLeft <= 0) return null;

  return (
    <div
      role="alert"
      className="border-b border-status-warning/40 bg-status-warning/15 px-4 py-2 text-xs font-semibold text-status-warning"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2">
          <Hourglass className="h-4 w-4 shrink-0" />
          <span>{t('errors.rateLimitedBanner', { seconds: secondsLeft })}</span>
        </span>
        <button
          type="button"
          onClick={clearRateLimit}
          aria-label={t('common.close')}
          className="rounded p-1 hover:bg-status-warning/10"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
