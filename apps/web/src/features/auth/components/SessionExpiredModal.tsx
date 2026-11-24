import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, LogOut, Sparkles } from 'lucide-react';
import { ApiClientError } from '@/core/api/client';
import { useAuthStore } from '@/features/auth/auth-store';

/**
 * Non-destructive 401 Session Expired Modal.
 * Renders as an overlay over the active route so unsaved draft text is preserved while re-authenticating.
 */
export function SessionExpiredModal() {
  const { t } = useTranslation();
  const isOpen = useAuthStore((s) => s.sessionExpiredModalOpen);
  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);
  const loginDemo = useAuthStore((s) => s.loginDemo);
  const logout = useAuthStore((s) => s.logout);

  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email: email || user?.email || '', password });
      setPassword('');
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.normalized.message : t('auth.invalidCredentials'),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await loginDemo();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.normalized.message : t('errors.unexpectedTitle'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="sp-card w-full max-w-md p-6 text-start shadow-2xl">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-control bg-status-warning/15 text-status-warning">
            <Lock className="h-5 w-5" />
          </span>
          <div>
            <h2 id="session-expired-title" className="font-heading text-lg font-bold">
              {t('auth.sessionExpiredTitle')}
            </h2>
            <p className="text-xs text-text-secondary">{t('auth.sessionExpiredSubtitle')}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('auth.email')}
            </label>
            <input
              type="email"
              required
              dir="ltr"
              value={email || user?.email || ''}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">
              {t('auth.password')}
            </label>
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-control border border-border-default bg-surface-base px-3 py-2 text-sm text-text-primary"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-control bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="sp-tactile-control flex-1 border-brand-hover bg-brand-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-60"
            >
              {submitting ? t('common.loading') : t('auth.reauthenticate')}
            </button>
            <button
              type="button"
              onClick={handleDemo}
              disabled={submitting}
              className="sp-tactile-control inline-flex items-center gap-1.5 bg-surface-subtle px-3 py-2 text-xs font-semibold text-text-primary hover:bg-brand-soft"
            >
              <Sparkles className="h-3.5 w-3.5 text-brand-primary" />
              <span>{t('auth.demoQuick')}</span>
            </button>
          </div>
        </form>

        <div className="mt-4 border-t border-border-default pt-3">
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-status-danger hover:underline"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t('auth.logoutAndClear')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
