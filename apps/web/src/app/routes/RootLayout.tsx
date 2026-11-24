import { useEffect } from 'react';
import { Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { AppShell } from '@/app/layout/AppShell';
import { RateLimitBanner } from '@/core/api/RateLimitBanner';
import { useSyncStore } from '@/core/offline/sync-manager';
import { PwaInstallBanner } from '@/core/pwa/PwaInstallBanner';
import { PwaUpdateToast } from '@/core/pwa/PwaUpdateToast';
import { usePwaStore } from '@/core/pwa/pwa-manager';
import { useAuthStore } from '@/features/auth/auth-store';
import { SessionExpiredModal } from '@/features/auth/components/SessionExpiredModal';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const FOCUS_ROUTES = new Set(['/study']);

export function RootLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const refreshPendingCount = useSyncStore((s) => s.refreshPendingCount);
  const flushOutbox = useSyncStore((s) => s.flushOutbox);
  const initPwa = usePwaStore((s) => s.initPwa);

  useEffect(() => {
    initPwa();
  }, [initPwa]);

  useEffect(() => {
    if (status === 'booting') {
      void bootstrap();
    }
  }, [status, bootstrap]);

  useEffect(() => {
    if (user?.id) {
      void refreshPendingCount(user.id);
      if (status === 'authenticated' && navigator.onLine) {
        void flushOutbox(user.id);
      }
    }
  }, [user?.id, status, refreshPendingCount, flushOutbox]);

  useEffect(() => {
    if (status === 'unauthenticated' && pathname !== '/auth') {
      void navigate({ to: '/auth', replace: true });
    } else if (
      (status === 'authenticated' || status === 'offline-cached') &&
      pathname === '/auth'
    ) {
      void navigate({ to: '/', replace: true });
    }
  }, [status, pathname, navigate]);

  if (status === 'booting') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-base p-6">
        <div className="sp-card w-full max-w-sm animate-pulse space-y-3 p-6">
          <div className="h-6 w-1/2 rounded bg-surface-subtle" />
          <div className="h-3 w-full rounded bg-surface-subtle" />
          <div className="h-3 w-2/3 rounded bg-surface-subtle" />
        </div>
      </div>
    );
  }

  if (pathname === '/auth') {
    return (
      <ErrorBoundary scope="auth">
        <RateLimitBanner />
        <PwaInstallBanner />
        <Outlet />
        <PwaUpdateToast />
      </ErrorBoundary>
    );
  }

  const isFocusMode = FOCUS_ROUTES.has(pathname) || pathname.endsWith('/live');

  return (
    <ErrorBoundary scope="root">
      <RateLimitBanner />
      {!isFocusMode && <PwaInstallBanner />}
      <AppShell focusMode={isFocusMode}>
        <Outlet />
      </AppShell>
      <SessionExpiredModal />
      <PwaUpdateToast />
    </ErrorBoundary>
  );
}
